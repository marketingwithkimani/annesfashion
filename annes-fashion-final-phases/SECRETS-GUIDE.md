# Secrets Guide for Anne's Fashion Worker (client-api)

## How to set secrets

All secrets are set via Wrangler CLI from your project directory:

```bash
npx wrangler secret put SECRET_NAME --name client-api
```

You'll be prompted to enter the value. The value is encrypted and stored
server-side — it never appears in your source code or wrangler.jsonc.

Access secrets in Worker code via `env.SECRET_NAME`.

---

## Required secrets

### 1. ADMIN_AUTH_TOKEN (REQUIRED)

Protects admin endpoints (media upload, backup trigger, product management).

```bash
npx wrangler secret put ADMIN_AUTH_TOKEN --name client-api
```

Generate a strong random token:
```bash
openssl rand -hex 32
```

Usage in frontend admin panel:
```
Authorization: Bearer <ADMIN_AUTH_TOKEN>
```
or
```
X-Admin-Token: <ADMIN_AUTH_TOKEN>
```

---

## Conditionally required secrets

### 2. JWT_SECRET (IF you have user authentication)

Only needed if your Worker issues or verifies JWT tokens for customer/admin login.

```bash
npx wrangler secret put JWT_SECRET --name client-api
```

Generate:
```bash
openssl rand -hex 64
```

### 3. MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET (IF using M-Pesa payments)

Your test orders showed KES amounts (e.g., 2600 KES). If you integrate
Safaricom M-Pesa STK Push or C2B, you'll need these.

```bash
npx wrangler secret put MPESA_CONSUMER_KEY --name client-api
npx wrangler secret put MPESA_CONSUMER_SECRET --name client-api
npx wrangler secret put MPESA_PASSKEY --name client-api
npx wrangler secret put MPESA_SHORTCODE --name client-api
```

### 4. SMTP credentials (IF sending email from the Worker)

Only if you send order confirmations or notifications via email from the Worker.

```bash
npx wrangler secret put SMTP_HOST --name client-api
npx wrangler secret put SMTP_USER --name client-api
npx wrangler secret put SMTP_PASSWORD --name client-api
```

---

## NOT needed (Stream binding eliminates this)

### STREAM_API_TOKEN — DO NOT SET

The Stream binding (`env.STREAM`) handles authentication internally.
No API token is needed. Do NOT create a `STREAM_API_TOKEN` secret.

If your existing code uses the Stream REST API with a token, migrate to the
binding instead — it's more secure and simpler.

---

## Development Worker secrets (client-api-dev)

Set separate secrets for the development Worker:

```bash
npx wrangler secret put ADMIN_AUTH_TOKEN --name client-api-dev
# ... other dev-specific secrets
```

Keep development and production secrets separate. Never share the same
secret value across environments.

---

## Summary checklist

| Secret | Required? | Purpose |
|---|---|---|
| `ADMIN_AUTH_TOKEN` | ✅ Yes | Protects admin endpoints |
| `JWT_SECRET` | If auth | User/admin JWT signing |
| `MPESA_*` | If M-Pesa | Payment integration |
| `SMTP_*` | If email | Email sending |
| `STREAM_API_TOKEN` | ❌ No | Replaced by Stream binding |

---

## Local development

For local dev, create a `.dev.vars` file (NOT committed to git):

```
ADMIN_AUTH_TOKEN=dev-admin-token-here
JWT_SECRET=dev-jwt-secret-here
```

Add `.dev.vars*` and `.env*` to your `.gitignore`.
