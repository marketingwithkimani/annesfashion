import { Env } from './types';

/**
 * Creates a Direct Creator Upload URL for Cloudflare Stream.
 * The browser uploads video directly to Stream — never touches Worker or Vercel.
 */
// Maximum allowed video upload size: 20 MB
const MAX_VIDEO_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function handleStreamUploadUrl(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    if (env.STREAM && typeof env.STREAM.createDirectUpload === 'function') {
      const uploadResult = await env.STREAM.createDirectUpload({
        maxDurationSeconds: 300, // 5 minute cap — enough for a fashion video
        maxSizeBytes: MAX_VIDEO_SIZE_BYTES,
      });

      return Response.json({
        success: true,
        uid: uploadResult.uid,
        uploadURL: uploadResult.uploadURL,
      });
    }

    // Fallback: Use Cloudflare API directly with token
    const token = env.ADMIN_AUTH_TOKEN || env.JWT_SECRET;
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ maxDurationSeconds: 300, maxSizeBytes: MAX_VIDEO_SIZE_BYTES }),
    });
    const data = await res.json() as any;
    if (!data.success) {
      return Response.json({ success: false, error: data.errors?.[0]?.message || 'Stream upload URL failed' }, { status: 500 });
    }
    return Response.json({ success: true, uid: data.result.uid, uploadURL: data.result.uploadURL });
  } catch (err: any) {
    console.error('Stream createDirectUpload error:', err);
    return Response.json({ success: false, error: err.message || 'Failed to create upload URL' }, { status: 500 });
  }
}

/**
 * Uploads a video to Stream from an existing URL (e.g., migrating Supabase videos).
 */
export async function handleStreamUploadFromUrl(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { videoUrl, name } = await request.json() as { videoUrl?: string; name?: string };
  if (!videoUrl) {
    return Response.json({ success: false, error: 'videoUrl is required' }, { status: 400 });
  }

  try {
    if (env.STREAM && typeof env.STREAM.upload === 'function') {
      const streamVideo = await env.STREAM.upload(videoUrl, {
        meta: name ? { name } : undefined,
      });

      return Response.json({
        success: true,
        uid: streamVideo.uid,
        playback: streamVideo.playback,
      });
    }

    return Response.json({ success: false, error: 'Stream binding not configured' }, { status: 500 });
  } catch (err: any) {
    console.error('Stream upload error:', err);
    return Response.json({ success: false, error: err.message || 'Failed to upload video to Stream' }, { status: 500 });
  }
}

/**
 * Returns the playback details for a Stream video.
 */
export async function handleStreamPlayback(request: Request, env: Env, uid: string): Promise<Response> {
  if (!uid) {
    return Response.json({ success: false, error: 'Video UID is required' }, { status: 400 });
  }

  try {
    if (env.STREAM && typeof env.STREAM.get === 'function') {
      const video = await env.STREAM.get(uid);
      if (!video || video.readyToStream === false) {
        return Response.json({
          success: true,
          ready: false,
          status: video?.status || 'processing',
        });
      }

      let playbackUrl = video.playback?.hls;
      if (video.requireSignedURLs && typeof env.STREAM.signPlaybackUrl === 'function') {
        playbackUrl = await env.STREAM.signPlaybackUrl(uid);
      }

      return Response.json({
        success: true,
        ready: true,
        uid,
        playback: playbackUrl,
        thumbnail: video.thumbnail,
        duration: video.duration,
        meta: video.meta,
      });
    }

    // Default playback format
    const playbackUrl = `https://customer-${env.CLOUDFLARE_ACCOUNT_ID.substring(0, 10)}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
    const thumbnail = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=1s&height=600`;
    return Response.json({ success: true, ready: true, uid, playback: playbackUrl, thumbnail });
  } catch (err: any) {
    console.error('Stream get error:', err);
    return Response.json({ success: false, error: err.message || 'Failed to get video' }, { status: 500 });
  }
}

/**
 * Deletes a video from Stream.
 */
export async function handleStreamDelete(request: Request, env: Env, uid: string): Promise<Response> {
  if (request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    if (env.STREAM && typeof env.STREAM.delete === 'function') {
      await env.STREAM.delete(uid);
      return Response.json({ success: true, message: 'Video deleted from Stream' });
    }
    return Response.json({ success: false, error: 'Stream binding not configured' }, { status: 500 });
  } catch (err: any) {
    console.error('Stream delete error:', err);
    return Response.json({ success: false, error: err.message || 'Failed to delete video' }, { status: 500 });
  }
}
