# Cloudflare Infrastructure Setup

This project automates the remaining Cloudflare infrastructure setup for the client-api architecture.

## What This Script Does

1. **Verifies** the API token is active
2. **Inspects** existing D1, R2, and Workers (avoids recreating anything)
3. **Creates D1 databases** (if they don't exist):
   - `client-development`
   - `client-production`
4. **Creates R2 buckets** (if they don't exist, all kept private):
   - `client-development-files`
   - `client-production-images`
   - `client-production-files`
   - `client-production-backups`
5. **Configures Worker bindings**:
   - `client-api-dev`: `DB` → `client-development`, `FILES` → `client-development-files`
   - `client-api`: `DB` → `client-production`, `IMAGES` → `client-production-images`, `FILES` → `client-production-files`, `BACKUPS` → `client-production-backups`
6. **Inspects** existing Worker code and bindings
7. **Validates** all bindings and dev/prod isolation
8. **Prints** a final report with all resource IDs

## What This Script Does NOT Do

- Does NOT create or modify Workers (already done)
- Does NOT create or modify Stream (already done)
- Does NOT create API tokens (already done)
- Does NOT apply D1 migrations (requires project code inspection)
- Does NOT create secrets (requires application code inspection)
- Does NOT create KV, Durable Objects, Queues, DNS records, or Worker Routes

## Prerequisites

- Node.js 18+ (uses built-in `fetch` — no npm packages needed)

## How to Run

```bash
node setup.js
```

The script will output all resource IDs and validation results. Copy the D1 database IDs from the output and paste them into the `wrangler.jsonc` files.

## After Running

1. Update `wrangler-client-api.jsonc` with the actual `database_id` from the script output
2. Update `wrangler-client-api-dev.jsonc` with the actual `database_id` from the script output
3. Merge these configs into your existing project's wrangler config (if one exists)
4. Apply D1 migrations:
   ```bash
   npx wrangler d1 migrations apply client-development --remote
   npx wrangler d1 migrations apply client-production --remote
   ```
5. Create required secrets:
   ```bash
   npx wrangler secret put SECRET_NAME --env development
   npx wrangler secret put SECRET_NAME --env production
   ```
6. Deploy:
   ```bash
   npx wrangler deploy
   ```

## Security Notes

- The API token in `setup.js` has restricted permissions (D1:Edit, R2:Edit, Workers Scripts:Edit, Stream:Edit)
- The token does NOT have DNS, Zone, KV, or User permissions
- No secrets are stored in config files
- All R2 buckets are kept private
- Dev and prod resources are strictly isolated
