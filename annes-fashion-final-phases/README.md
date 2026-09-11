# Anne's Fashion — Final Infrastructure Phases

This repo contains the implementation code for the three remaining phases
of the Cloudflare infrastructure setup.

## Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Complete production Worker config with Stream binding + cron trigger |
| `src/stream-handlers.js` | Stream binding integration (upload, playback, delete, media save) |
| `src/backup-handler.js` | D1 → R2 backup logic with scheduled() cron handler |
| `src/index.example.js` | Reference for wiring handlers into your existing Worker entry point |
| `SECRETS-GUIDE.md` | Which secrets to set via `wrangler secret put` |

## Deployment steps for your developer

### 1. Add the Stream binding to wrangler.jsonc

Merge the `"stream": { "binding": "STREAM" }` line and the `"triggers"` block
from the included `wrangler.jsonc` into your existing config.

Do NOT replace your existing wrangler.jsonc — merge carefully.

### 2. Add the stream handlers

Copy `src/stream-handlers.js` into your project.

Wire the routes into your existing `src/index.js` fetch handler using the
pattern in `src/index.example.js`.

### 3. Add the backup handler

Copy `src/backup-handler.js` into your project.

Add the `scheduled()` handler to your Worker's default export:

```js
async scheduled(controller, env, ctx) {
  const { performBackup } = require('./backup-handler');
  ctx.waitUntil(performBackup(env));
}
```

### 4. Set secrets

```bash
npx wrangler secret put ADMIN_AUTH_TOKEN --name client-api
```

See `SECRETS-GUIDE.md` for the full list.

### 5. Deploy

```bash
npx wrangler deploy --name client-api
```

### 6. Test the backup manually

```bash
curl -X POST https://api.annesfashion.co.ke/api/admin/backup \
  -H "X-Admin-Token: <your-admin-token>"
```

Verify the backup file appears in the `client-production-backups` R2 bucket
under `d1-backups/client-production/`.

### 7. Test the cron locally

```bash
npx wrangler dev --test-scheduled
curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=0+2+*+*+*"
```

### 8. Monitor cron events

After deploying, check the **Cron Events** tab in the Workers dashboard
to verify the scheduled backup is firing.

⚠️ Note: There is currently a minor Cloudflare incident affecting
Workers Cron Triggers. Monitor: https://www.cloudflarestatus.com/incidents/sjs8s0q2x4hw

### 9. Test Stream upload flow

```bash
# Get a direct upload URL
curl -X POST https://api.annesfashion.co.ke/api/media/stream-upload-url \
  -H "Authorization: Bearer <admin-token>"

# Browser uploads file to the returned uploadURL
# Then save the UID to D1
curl -X POST https://api.annesfashion.co.ke/api/media/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"product_id": 121, "media_type": "video", "media_reference": "<stream-uid>", "sort_order": 0}'
```
