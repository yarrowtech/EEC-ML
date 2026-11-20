# Backend (Express API)

See [multi-tenant Razorpay payments](../docs/multi-tenant-payments.md) for per-school payment setup, migration, webhooks, and key rotation.

## Setup

1. Copy `.env.example` to `.env`
2. Configure required values:
   - `MONGODB_URL` points to a database reachable from the machine running the backend. The example uses local MongoDB at `127.0.0.1:27017`, so start MongoDB on that machine. For Atlas, use the database user's connection string and add the backend machine's public IP to the project's IP access list.
   - `JWT_SECRET`
   - `CORS_ORIGINS`
   - `CORS_ALLOW_LAN=true` for access from phones on the same private Wi-Fi
     during development (ignored when `NODE_ENV=production`)
   - `ALLOW_SHARED_DOMAIN_TENANT_LOGIN=true` to let tenant users authenticate
     through localhost or a LAN IP during development (ignored in production)
   - `STUDENT_DATA_ENCRYPTION_KEY` (32-byte key, use `hex:<64-char-hex>` or `base64:<44-char-base64>`)
   - `PAYMENT_ENCRYPTION_KEY` (32-byte key for Razorpay secrets, use `hex:<64-char-hex>` or `base64:<44-char-base64>`; if omitted, the app derives a fallback key from an existing env secret in development)

## Install

```bash
npm install
```

## Development

Each clone needs its own `backend/.env`. The API starts listening after MongoDB initializes. If startup fails, check the backend terminal for the connection error before retrying login.

```bash
npm run dev
```

## Production

```bash
npm start
```

## Swagger

- UI: `GET /api/docs`
- JSON: `GET /api/docs.json`

Regenerate JSON:

```bash
npm run swagger:gen
```
