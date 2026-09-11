/**
 * Stream Binding Integration for client-api Worker
 * 
 * Uses the Cloudflare Stream binding (env.STREAM) — no API token needed.
 * Launched May 2026: https://developers.cloudflare.com/changelog/post/2026-05-07-stream-workers-binding/
 *
 * Prerequisite: Add to wrangler.jsonc:
 *   "stream": { "binding": "STREAM" }
 *
 * Then redeploy: npx wrangler deploy
 */

/**
 * POST /api/media/stream-upload-url
 * 
 * Creates a Direct Creator Upload URL for Stream.
 * The browser uploads the video file directly to Stream — it never touches
 * your Worker or Vercel. The returned UID is then saved to D1 via /api/media/save.
 * 
 * No Stream API token is exposed to the browser. The binding handles auth internally.
 */
async function handleStreamUploadUrl(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // TODO: Add admin auth check here (verify env.ADMIN_AUTH_TOKEN header)

  try {
    // Create a direct upload — the browser sends the file to the returned uploadURL
    const uploadResult = await env.STREAM.createDirectUpload({
      maxDurationSeconds: 3600, // 1 hour max video length
      // Optional: require signed playback (restrict who can view)
      // requireSignedURLs: true,
    });

    return Response.json({
      success: true,
      uid: uploadResult.uid,
      uploadURL: uploadResult.uploadURL,
    });
  } catch (err) {
    console.error('Stream createDirectUpload error:', err);
    return Response.json(
      { success: false, error: 'Failed to create upload URL' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/media/upload-from-url
 * 
 * Uploads a video to Stream from a URL (e.g., migrating existing Supabase videos).
 * Useful for backfilling the Stream library from URLs stored in D1.
 */
async function handleStreamUploadFromUrl(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // TODO: Add admin auth check here

  const { videoUrl, name } = await request.json();
  if (!videoUrl) {
    return Response.json(
      { success: false, error: 'videoUrl is required' },
      { status: 400 }
    );
  }

  try {
    const streamVideo = await env.STREAM.upload(videoUrl, {
      // Optional metadata
      meta: name ? { name } : undefined,
    });

    // streamVideo contains: uid, playback URL, HLS/DASH manifest URLs, thumbnails
    return Response.json({
      success: true,
      uid: streamVideo.uid,
      playback: streamVideo.playback,
      // Save this UID to D1 product_media table via /api/media/save
    });
  } catch (err) {
    console.error('Stream upload error:', err);
    return Response.json(
      { success: false, error: 'Failed to upload video to Stream' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/media/stream-playback/:uid
 * 
 * Returns the playback URL for a Stream video.
 * If signed URLs are required, generates a signed playback token
 * without needing a separate signing key.
 */
async function handleStreamPlayback(request, env, uid) {
  if (!uid) {
    return Response.json(
      { success: false, error: 'Video UID is required' },
      { status: 400 }
    );
  }

  try {
    // Get video details from Stream
    const video = await env.STREAM.get(uid);

    if (!video || video.readyToStream === false) {
      return Response.json({
        success: true,
        ready: false,
        status: video?.status || 'processing',
      });
    }

    // If signed playback is enabled, generate a signed URL
    let playbackUrl = video.playback?.hls;
    if (video.requireSignedURLs) {
      // Generate signed playback token — no signing key needed with the binding
      playbackUrl = await env.STREAM.signPlaybackUrl(uid);
    }

    return Response.json({
      success: true,
      ready: true,
      uid: uid,
      playback: playbackUrl,
      thumbnail: video.thumbnail,
      duration: video.duration,
      meta: video.meta,
    });
  } catch (err) {
    console.error('Stream get error:', err);
    return Response.json(
      { success: false, error: 'Failed to get video' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/media/stream/:uid
 * 
 * Deletes a video from Stream. Called when removing a video product.
 */
async function handleStreamDelete(request, env, uid) {
  if (request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  // TODO: Add admin auth check here

  try {
    await env.STREAM.delete(uid);
    return Response.json({ success: true, message: 'Video deleted' });
  } catch (err) {
    console.error('Stream delete error:', err);
    return Response.json(
      { success: false, error: 'Failed to delete video' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/media/save
 * 
 * Saves a Stream video UID to D1 product_media table.
 * Called by the browser after a successful direct upload to Stream.
 */
async function handleMediaSave(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // TODO: Add admin auth check here

  const { product_id, media_type, media_reference, poster_reference, sort_order } =
    await request.json();

  if (!product_id || !media_type || !media_reference) {
    return Response.json(
      { success: false, error: 'product_id, media_type, and media_reference are required' },
      { status: 400 }
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO product_media (product_id, media_type, media_reference, poster_reference, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(product_id, media_type, media_reference, poster_reference || null, sort_order || 0)
      .run();

    return Response.json({
      success: true,
      id: result.meta.last_row_id,
      message: 'Media saved successfully',
    });
  } catch (err) {
    console.error('Media save error:', err);
    return Response.json(
      { success: false, error: 'Failed to save media' },
      { status: 500 }
    );
  }
}

module.exports = {
  handleStreamUploadUrl,
  handleStreamUploadFromUrl,
  handleStreamPlayback,
  handleStreamDelete,
  handleMediaSave,
};
