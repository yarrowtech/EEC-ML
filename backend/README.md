# Backend (Express API)

See [multi-tenant Razorpay payments](../docs/multi-tenant-payments.md) for per-school payment setup, migration, webhooks, and key rotation.

## Setup

1. Copy `.env.example` to `.env`
2. Configure required values:
   - `MONGODB_URL`
   - `JWT_SECRET`
   - `CORS_ORIGINS`
   - `STUDENT_DATA_ENCRYPTION_KEY` (32-byte key, use `hex:<64-char-hex>` or `base64:<44-char-base64>`)

## Install

```bash
npm install
```

## Development

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
