# Multi-Tenant SaaS Architecture

## Request flow

1. DNS sends `*.electroniceducare.com` to the same Nginx/application deployment.
2. `tenantResolver` normalizes `req.hostname`, resolves an active `Organization`, and attaches `req.organization` and `req.organizationId`.
3. `AsyncLocalStorage` carries that tenant through the full asynchronous request lifecycle.
4. The global Mongoose tenant plugin adds `organizationId` and an index to compiled schemas. It scopes reads, counts, updates, deletes, aggregations, inserts, saves, and bulk writes.
5. JWTs contain `organizationId`. Authentication middleware rejects a token when its organization differs from the hostname organization.
6. `TenantProvider` loads `/api/tenant`, exposes branding/settings, and applies the tenant title, favicon, theme, and CSS color variables.

The existing `schoolId` and `campusId` remain in place. They still represent the product's school/campus hierarchy, while `organizationId` is the mandatory SaaS isolation boundary.

The root domain, `www`, `localhost`, and loopback addresses bypass tenant resolution. Super-admin organization management is restricted to that main-domain context. Unknown, suspended, and nested subdomains return `404` before API routes run.

## Organization APIs

- `GET /api/tenant`: public branding for the resolved hostname.
- `POST /api/super-admin/organizations`: create an organization and generated subdomain.
- `GET /api/super-admin/organizations`: list organizations.
- `GET /api/super-admin/organizations/stats`: status totals.
- `PATCH /api/super-admin/organizations/:id`: branding, status, settings, subscription, and custom-domain management.

Organization management requires the existing super-admin JWT and the main hostname. Reserved slugs are `www`, `api`, `admin`, `mail`, `dashboard`, `support`, `app`, and `docs`.

## Migration

Back up MongoDB before migration. Set `ROOT_DOMAIN` and run a dry-run first:

```bash
cd backend
npm run tenant:migrate
npm run tenant:migrate:apply
```

The idempotent migration creates an organization for each existing `School`, maps records by `schoolId`, assigns unscoped records automatically only when the database contains one school, and adds `organizationId` indexes. It reports unresolved records for manual mapping when multiple schools exist. Do not deploy tenant enforcement until unresolved tenant-owned records are zero.

Legacy globally unique user indexes must be replaced with the schema's compound `(organizationId, username/code)` indexes during a maintenance window. After migration, run Mongoose index synchronization under the normal deployment process or explicitly inspect/drop the old `username_1`, `employeeCode_1`, and `studentCode_1` indexes before creating the compound indexes.

Application code must not use `Model.collection`, `mongoose.connection.db`, or raw MongoDB clients in request handlers because raw collection calls bypass Mongoose middleware. Those APIs are reserved for reviewed migrations and platform-wide maintenance.

## Environment and local development

```env
ROOT_DOMAIN=electroniceducare.com
MAIN_DOMAIN=electroniceducare.com
```

In production, leave `VITE_API_URL` empty when the frontend and API are served through the same wildcard origin. Vite proxies `/api` to `127.0.0.1:5000` locally. To exercise resolution directly:

```bash
curl -H 'Host: xaviers.electroniceducare.com' http://127.0.0.1:5000/api/tenant
```

## DNS and Nginx

Create `A`/`AAAA` records for the apex domain and `*.electroniceducare.com`. DNS provisioning is external to the application.

```nginx
server {
    listen 80;
    server_name electroniceducare.com www.electroniceducare.com *.electroniceducare.com;

    location /api/ {
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_pass http://127.0.0.1:5000;
    }

    location / {
        proxy_set_header Host $host;
        proxy_pass http://127.0.0.1:5173;
    }
}
```

Use a wildcard TLS certificate and set Express `TRUST_PROXY` to match the trusted Nginx hop. Never accept a client-provided organization ID as authority; hostname resolution and the signed token are the authorities.

## Render free instance keep-alive

The backend sends a health request every 10 minutes. On Render it automatically targets `RENDER_EXTERNAL_URL`; elsewhere set `KEEP_ALIVE_URL` explicitly.

```env
KEEP_ALIVE_ENABLED=true
KEEP_ALIVE_INTERVAL_MS=600000
# KEEP_ALIVE_URL=https://your-service.onrender.com/health
```

Set `KEEP_ALIVE_ENABLED=false` to disable it. The timer is unreferenced so it does not block graceful process shutdown.
