import { Env } from './types';

/**
 * R2 Media Handlers — Anne's Fashion Line
 *
 * Replaces Cloudflare Stream entirely.
 * All product images and videos are stored in Cloudflare R2.
 *
 * R2 Object Layout:
 *   products/{id}/images/{filename}.webp
 *   products/{id}/video/product-video-v{n}.mp4
 *   products/{id}/poster/poster-v{n}.webp
 *
 * Upload Flow (Direct Client Upload):
 *   1. Admin calls POST /api/media/upload-url
 *   2. Worker generates presigned R2 PUT URL (server-side signing — no credentials sent to client)
 *   3. Client uploads file directly to R2
 *   4. Client calls PUT /api/products/:id with the resulting key/URL
 *
 * Delivery Flow:
 *   GET /media/{key} → Worker proxies R2 object with long-lived cache headers
 *   (Future: replace with R2 custom domain on images.annesfashion.co.ke for zero CPU cost)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100 MB — single-part upload limit
const UPLOAD_URL_TTL = 900;                 // 15 minutes in seconds

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
]);

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-m4v',
]);

const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'; // 1 year
const CACHE_SHORT     = 'public, max-age=3600';                // 1 hour fallback

// ─── Presigned Upload URL ──────────────────────────────────────────────────────

/**
 * POST /api/media/upload-url
 * Body: { key: string, contentType: string, fileSize: number }
 * Headers: X-Admin-Token or Authorization: Bearer <token>
 *
 * Returns: { uploadUrl, key, expiresAt }
 *
 * The browser/mobile client uploads directly to R2 via the returned presigned PUT URL.
 * No credentials are exposed to the client — all signing happens server-side here.
 */
export async function handleGetUploadUrl(request: Request, env: Env): Promise<Response> {
  // ── Admin auth ──
  const adminToken = request.headers.get('X-Admin-Token')
    || request.headers.get('Authorization')?.replace('Bearer ', '');

  if (env.ADMIN_AUTH_TOKEN && adminToken !== env.ADMIN_AUTH_TOKEN) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { key?: string; contentType?: string; fileSize?: number };
  try {
    body = await request.json() as any;
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { key, contentType, fileSize } = body;

  if (!key || !contentType) {
    return Response.json({ success: false, error: 'key and contentType are required' }, { status: 400 });
  }

  // ── Validate key path — must start with products/ ──
  if (!key.startsWith('products/')) {
    return Response.json({ success: false, error: 'key must start with products/' }, { status: 400 });
  }

  // ── Validate MIME type ──
  const isImage = ALLOWED_IMAGE_TYPES.has(contentType);
  const isVideo = ALLOWED_VIDEO_TYPES.has(contentType);

  if (!isImage && !isVideo) {
    return Response.json({
      success: false,
      error: `Unsupported content type: ${contentType}. Allowed: ${[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(', ')}`,
    }, { status: 400 });
  }

  // ── Validate file size ──
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (fileSize && fileSize > maxSize) {
    return Response.json({
      success: false,
      error: `File size ${(fileSize / 1024 / 1024).toFixed(1)} MB exceeds limit of ${maxSize / 1024 / 1024} MB for ${isVideo ? 'videos' : 'images'}`,
    }, { status: 400 });
  }

  // ── Generate presigned PUT URL via R2 S3-compatible API ──
  // R2 presigned URLs are generated using the S3 presign mechanism
  // via the account's R2 S3 endpoint + HMAC-SHA256 signing.
  try {
    const presignedUrl = await generateR2PresignedUrl(env, key, contentType);
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL * 1000).toISOString();
    const mediaUrl = getR2MediaUrl(key, env);

    return Response.json({
      success: true,
      uploadUrl: presignedUrl,
      key,
      mediaUrl,
      expiresAt,
    });
  } catch (err: any) {
    console.error('R2 presign error:', err);
    return Response.json({
      success: false,
      error: err.message || 'Failed to generate upload URL',
    }, { status: 500 });
  }
}

// ─── R2 Object Proxy (Media Delivery) ─────────────────────────────────────────

/**
 * GET /media/{key}
 * Proxies R2 object to the client with long-lived cache headers.
 * Videos get Cache-Control: immutable (1 year).
 *
 * Future upgrade path:
 *   Replace this proxy with an R2 custom domain on images.annesfashion.co.ke
 *   to serve media with zero Worker CPU cost and Cloudflare CDN caching.
 */
export async function handleServeMedia(request: Request, env: Env, key: string): Promise<Response> {
  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const object = await env.IMAGES!.get(key);

    if (!object) {
      return new Response('Media not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // Determine cache duration based on media type
    const ct = headers.get('content-type') || '';
    const isVideo = ct.startsWith('video/');
    headers.set('Cache-Control', isVideo ? CACHE_IMMUTABLE : CACHE_IMMUTABLE);
    headers.set('X-Content-Type-Options', 'nosniff');

    // Support range requests for video seeking
    if (isVideo) {
      headers.set('Accept-Ranges', 'bytes');
    }

    // Handle conditional requests (ETag / If-None-Match)
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(object.body, { status: 200, headers });
  } catch (err: any) {
    console.error('R2 serve error:', err);
    return new Response('Internal error', { status: 500 });
  }
}

// ─── R2 Object Delete ──────────────────────────────────────────────────────────

/**
 * DELETE /api/media
 * Body: { key: string }
 * Headers: X-Admin-Token
 *
 * Deletes a single R2 object by key.
 */
export async function handleDeleteMedia(request: Request, env: Env): Promise<Response> {
  const adminToken = request.headers.get('X-Admin-Token')
    || request.headers.get('Authorization')?.replace('Bearer ', '');

  if (env.ADMIN_AUTH_TOKEN && adminToken !== env.ADMIN_AUTH_TOKEN) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { key?: string };
  try {
    body = await request.json() as any;
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.key) {
    return Response.json({ success: false, error: 'key is required' }, { status: 400 });
  }

  if (!body.key.startsWith('products/')) {
    return Response.json({ success: false, error: 'key must start with products/' }, { status: 400 });
  }

  try {
    await env.IMAGES!.delete(body.key);
    return Response.json({ success: true, message: `Deleted: ${body.key}` });
  } catch (err: any) {
    console.error('R2 delete error:', err);
    return Response.json({ success: false, error: err.message || 'Delete failed' }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the public URL for an R2 object key.
 * Format: https://api.annesfashion.co.ke/media/{key}
 *
 * When R2 custom domain is configured on images.annesfashion.co.ke,
 * change this to return https://images.annesfashion.co.ke/{key}
 */
export function getR2MediaUrl(key: string | null, env: Env): string | null {
  if (!key) return null;
  // If it's already a full URL (legacy Supabase URLs), return as-is
  if (key.startsWith('http://') || key.startsWith('https://')) return key;

  const base = env.API_BASE_URL || 'https://api.annesfashion.co.ke';
  return `${base}/media/${key}`;
}

/**
 * Generates an R2 presigned PUT URL using the S3-compatible API with HMAC-SHA256 signing.
 * All credentials stay server-side — only the time-limited URL is returned to the client.
 */
async function generateR2PresignedUrl(env: Env, key: string, contentType: string): Promise<string> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || 'b4316201bd84751a7e7b3e43f5461c1f';
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = 'client-production-images';
  const region = 'auto';
  const service = 's3';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY secrets missing)');
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const host = `${accountId}.r2.cloudflarestorage.com`;

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');     // YYYYMMDD
  const amzDateTime = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  const expiresSeconds = UPLOAD_URL_TTL;
  const signedHeaders = 'host';

  // Build canonical query string
  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDateTime,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  });
  // Content-Type is intentionally NOT in the query string for presigned PUT —
  // the client sends it as a header when doing the actual PUT.

  const canonicalQueryString = queryParams.toString();
  const canonicalUri = `/${bucket}/${key}`;
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDateTime,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  const presignedUrl = `${endpoint}/${bucket}/${key}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  return presignedUrl;
}

// ─── Crypto Helpers ────────────────────────────────────────────────────────────

async function sha256Hex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return hex(digest);
}

async function hmacSHA256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  return hex(await hmacSHA256(key, data));
}

async function getSigningKey(
  secret: string, dateStamp: string, region: string, service: string,
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  let k: ArrayBuffer = enc.encode('AWS4' + secret);
  k = await hmacSHA256(k, dateStamp);
  k = await hmacSHA256(k, region);
  k = await hmacSHA256(k, service);
  k = await hmacSHA256(k, 'aws4_request');
  return k;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
