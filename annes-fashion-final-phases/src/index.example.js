/**
 * Example: How to wire the Stream handlers and backup cron handler
 * into your existing client-api Worker's main entry point.
 *
 * This is a REFERENCE — do NOT replace your existing Worker code.
 * Merge these additions into your existing src/index.js.
 */

const {
  handleStreamUploadUrl,
  handleStreamUploadFromUrl,
  handleStreamPlayback,
  handleStreamDelete,
  handleMediaSave,
} = require('./stream-handlers');

const { performBackup } = require('./backup-handler');

// CORS helper — update CORS_ORIGINS in wrangler.jsonc vars
function corsHeaders(env) {
  const origins = (env.CORS_ORIGINS || '').split(',');
  return {
    'Access-Control-Allow-Origin': origins[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    // ── EXISTING ROUTES (keep your current handlers) ──
    // GET  /health
    // GET  /api/products
    // GET  /api/products/:id
    // POST /api/client/order
    // GET  /api/settings
    // ... etc.

    // ── NEW STREAM ROUTES ──

    if (path === '/api/media/stream-upload-url' && request.method === 'POST') {
 return handleStreamUploadUrl(request, env);
    }

    if (path === '/api/media/upload-from-url' && request.method === 'POST') {
      return handleStreamUploadFromUrl(request, env);
    }

    if (path === '/api/media/save' && request.method === 'POST') {
      return handleMediaSave(request, env);
    }

    // Stream playback: /api/media/stream-playback/:uid
    const playbackMatch = path.match(/^\/api\/media\/stream-playback\/(.+)$/);
    if (playbackMatch) {
      return handleStreamPlayback(request, env, playbackMatch[1]);
    }

    // Stream delete: /api/media/stream/:uid
    const streamDeleteMatch = path.match(/^\/api\/media\/stream\/(.+)$/);
    if (streamDeleteMatch && request.method === 'DELETE') {
      return handleStreamDelete(request, env, streamDeleteMatch[1]);
    }

    // ── MANUAL BACKUP TRIGGER (admin only) ──
    // POST /api/admin/backup — triggers an immediate D1 backup to R2
    if (path === '/api/admin/backup' && request.method === 'POST') {
      // Verify admin token
      const adminToken = request.headers.get('X-Admin-Token');
      if (!adminToken || adminToken !== env.ADMIN_AUTH_TOKEN) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      const result = await performBackup(env);
      return Response.json({ success: true, ...result });
    }

    // ... your existing route handling continues here ...

    return new Response('Not found', { status: 404 });
  },

  // ── CRON TRIGGER HANDLER ──
  // Runs daily at 2:00 AM UTC (per wrangler.jsonc triggers.crons)
  async scheduled(controller, env, ctx) {
    console.log(`Cron triggered: ${controller.cron} at ${new Date(controller.scheduledTime).toISOString()}`);

    // Use waitUntil so the backup runs to completion
    ctx.waitUntil(performBackup(env));
  },
};
