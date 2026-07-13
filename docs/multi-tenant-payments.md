# Multi-tenant Razorpay payments

Each Organization owns one Razorpay configuration. Electronic Educare creates orders with that organization's credentials, so Razorpay settles funds directly to the bank account connected to the school's Razorpay account. There is no platform fallback account.

## Deployment

1. Generate a dedicated encryption key with `openssl rand -base64 32` and set `PAYMENT_ENCRYPTION_KEY`. Keep the same value across all application instances and backups. Losing it makes stored credentials unrecoverable.
2. Optionally set `RAZORPAY_TIMEOUT_MS` (default: 10000).
3. Run `cd backend && npm run payments:migrate`, review the dry-run, then run `npm run payments:migrate:apply`.
4. Deploy the API over HTTPS. In each school's Razorpay dashboard, configure `https://<api-host>/api/payments/webhook`, use the same webhook secret entered in Electronic Educare, and enable `payment.captured`, `payment.failed`, and `order.paid`.
5. A school administrator opens **Settings → Payment Gateway**, chooses Test or Live, enters that school's Key ID, Key Secret, and Webhook Secret, then saves. Saving validates the credentials before enabling checkout.

Do not set school Razorpay credentials in shared environment variables. Legacy `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and frontend `VITE_RAZORPAY_KEY_ID` values are no longer used for fee checkout.

## API

- `GET /api/settings/payment` returns connection metadata only.
- `POST /api/settings/payment` validates and stores encrypted credentials for the authenticated school.
- `POST /api/settings/payment/test` tests the stored credentials.
- `DELETE /api/settings/payment` deletes credentials while preserving audit and payment history.
- `POST /api/fees/:feeInvoiceId/pay` creates a tenant-scoped order for an authorized student, parent, or school admin.
- `POST /api/fees/payments/razorpay/verify` verifies checkout signatures and finalizes the receipt.
- `POST /api/payments/webhook` verifies the raw webhook signature and processes supported events idempotently.
- `GET /api/super-admin/organizations/payment-status` exposes read-only health and counts without credentials.

## Isolation and recovery

The API never accepts an organization ID from the checkout client. It derives the organization from the authenticated domain/token and records it with the provider order. Webhooks identify the organization by looking up that server-created order before selecting a webhook secret. Payment and PaymentAudit queries are organization-scoped by the tenant plugin.

Checkout callbacks and webhook delivery can race or be retried. Finalization is idempotent on the provider order ID, fee receipts have unique gateway IDs, and invoice totals are recomputed from receipts. A failed webhook never changes an already captured payment.

## Key rotation

To rotate Razorpay keys, enter the new Key ID and secrets and save; the new credentials are tested before replacing the existing encrypted values. To rotate `PAYMENT_ENCRYPTION_KEY`, use an offline re-encryption procedure that decrypts every stored value with the old key and encrypts it with the new key before changing the application environment.

Audit metadata intentionally stores only action context, amounts, provider IDs, and the final four characters of a Key ID. It never stores Key Secrets or Webhook Secrets.
