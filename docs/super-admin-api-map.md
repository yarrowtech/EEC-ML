# Detailed Backend API File Map

## URL: http://localhost:5173/super-admin/organizations

Organization lifecycle and tenant branding are implemented by `backend/routes/organizationRoutes.js` and `backend/models/Organization.js`. Access requires main-domain super-admin authentication through `backend/middleware/adminAuth.js`.

Endpoints:
- `POST /api/super-admin/organizations`
- `GET /api/super-admin/organizations`
- `GET /api/super-admin/organizations/stats`
- `PATCH /api/super-admin/organizations/:id`

The public tenant branding endpoint is `GET /api/tenant`.

---

## URL: http://localhost:5173/school-registration

1. Entry server + route mount
backend/index.js
Mounted API used by this page:
- /api/school-registration -> backend/routes/schoolRegistrationRoutes.js

2. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

3. Route endpoint handler (POST /api/school-registration)
backend/routes/schoolRegistrationRoutes.js

4. Route-level rate limiting
backend/middleware/rateLimit.js
(used inside backend/routes/schoolRegistrationRoutes.js)

5. Structured logger implementation (Pino) used by route + middleware
backend/utils/logger.js

6. Database model used for create/find duplicate
backend/models/School.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Test/simulation scripts (verification layer, current files in repo)
backend/scripts/finalSchoolRegistrationSecuritySuite.js
backend/scripts/productionSecurityAttackSuite.js
backend/scripts/validateRuntimeLogs.js
backend/scripts/attack-sim-output.json
backend/scripts/production-security-attack-report.json

Endpoints directly connected to this flow:
- POST /api/school-registration

---

## URL: http://localhost:5173/super-admin/overview

1. Entry server + route mounts
backend/index.js
Mounted APIs used by this page:
- /api/schools -> backend/routes/schoolRoutes.js
- /api/support -> backend/routes/supportRoutes.js
- /api/issues -> backend/routes/issueRoutes.js
- /api/admin/auth -> backend/routes/adminRoutes.js
Also present but not used directly by this page:
- /api/super-admin -> backend/routes/superAdminRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js
Referenced in route files via ensureSuperAdmin:
- backend/routes/schoolRoutes.js
- backend/routes/supportRoutes.js
- backend/routes/issueRoutes.js
- backend/routes/adminRoutes.js

3. Route endpoint handlers used by /super-admin/overview
backend/routes/schoolRoutes.js
backend/routes/supportRoutes.js
backend/routes/issueRoutes.js
backend/routes/adminRoutes.js

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by these overview APIs
backend/models/School.js
backend/models/SupportRequest.js
backend/models/Issue.js
backend/models/Admin.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/productionSecurityAttackSuite.js
backend/scripts/finalSchoolRegistrationSecuritySuite.js
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the overview flow:
- GET /api/schools/registrations/unapproved
- PUT /api/schools/registrations/:id/approve
- PUT /api/schools/registrations/:id/reject
- POST /api/admin/auth/school-admins/notify-credentials
- GET /api/support/requests?supportType=feedback
- GET /api/support/requests?supportType=complaint
- PATCH /api/support/requests/:id
- GET /api/issues
- PATCH /api/issues/:id
- POST /api/admin/auth/profile

---

## URL: http://localhost:5173/super-admin/requests

1. Entry server + route mounts
backend/index.js
Mounted APIs used by this page:
- /api/schools -> backend/routes/schoolRoutes.js
- /api/admin/auth -> backend/routes/adminRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js
Referenced in route files via ensureSuperAdmin.

3. Route endpoint handlers used by /super-admin/requests
backend/routes/schoolRoutes.js
backend/routes/adminRoutes.js

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by these request APIs
backend/models/School.js
backend/models/Admin.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/productionSecurityAttackSuite.js
backend/scripts/finalSchoolRegistrationSecuritySuite.js
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the requests flow:
- GET /api/schools/registrations/unapproved
- DELETE /api/schools/registrations/pending?confirm=DELETE
- PUT /api/schools/registrations/:id/approve
- PUT /api/schools/registrations/:id/reject
- POST /api/admin/auth/school-admins
- POST /api/admin/auth/school-admins/notify-credentials

---

## URL: http://localhost:5173/super-admin/feedback

1. Entry server + route mounts
backend/index.js
Mounted API used by this page:
- /api/support -> backend/routes/supportRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js
Referenced in route file via ensureSuperAdmin for update operations.

3. Route endpoint handlers used by /super-admin/feedback
backend/routes/supportRoutes.js

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by these feedback APIs
backend/models/SupportRequest.js
backend/models/Admin.js
backend/models/School.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/productionSecurityAttackSuite.js
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the feedback flow:
- GET /api/support/requests?supportType=feedback
- PATCH /api/support/requests/:id

---

## URL: http://localhost:5173/super-admin/issues

1. Entry server + route mounts
backend/index.js
Mounted APIs used by this page:
- /api/issues -> backend/routes/issueRoutes.js
- /api/support -> backend/routes/supportRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js
Referenced in route files via ensureSuperAdmin.

3. Route endpoint handlers used by /super-admin/issues
backend/routes/issueRoutes.js
backend/routes/supportRoutes.js

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by these issue APIs
backend/models/Issue.js
backend/models/SupportRequest.js
backend/models/Admin.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/productionSecurityAttackSuite.js
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the issues flow:
- GET /api/issues
- PATCH /api/issues/:id
- GET /api/support/requests?supportType=complaint
- PATCH /api/support/requests/:id

---

## URL: http://localhost:5173/super-admin/credentials

1. Entry server + route mounts
backend/index.js
Mounted API supplying shared data for this page:
- /api/schools -> backend/routes/schoolRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js
Referenced in route files via ensureSuperAdmin.

3. Route endpoint handlers used by /super-admin/credentials
No direct page-specific backend call in current component.
Shared upstream loader call is handled in:
- backend/routes/schoolRoutes.js (GET /api/schools/registrations/unapproved)

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by this flow
backend/models/School.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the credentials flow:
- No direct API from page component.
- Uses shared state loaded via GET /api/schools/registrations/unapproved.

---

## URL: http://localhost:5173/super-admin/id-pass

1. Entry server + route mounts
backend/index.js
Mounted API supplying shared data for this page:
- /api/admin/auth -> backend/routes/adminRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js

3. Route endpoint handlers used by /super-admin/id-pass
No direct page-specific backend call in current component.
Shared profile loader call is handled in:
- backend/routes/adminRoutes.js (POST /api/admin/auth/profile)

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by this flow
backend/models/Admin.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the id-pass flow:
- No direct API from page component.
- Uses shared state loaded via POST /api/admin/auth/profile.

---

## URL: http://localhost:5173/super-admin/operations

1. Entry server + route mounts
backend/index.js
Mounted API used by this page:
- /api/support -> backend/routes/supportRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js
Referenced in route file via ensureSuperAdmin for update operations.

3. Route endpoint handlers used by /super-admin/operations
backend/routes/supportRoutes.js

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by these operations APIs
backend/models/SupportSetting.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the operations flow:
- GET /api/support/settings
- PATCH /api/support/settings

---

## URL: http://localhost:5173/super-admin/active-schools

1. Entry server + route mounts
backend/index.js
Mounted APIs used by this page:
- /api/schools -> backend/routes/schoolRoutes.js
- /api/admin/auth -> backend/routes/adminRoutes.js
- /api/super-admin -> backend/routes/superAdminRoutes.js

2. Auth + access control middleware (super admin gating)
backend/middleware/adminAuth.js
Referenced in route files via ensureSuperAdmin.

3. Route endpoint handlers used by /super-admin/active-schools
backend/routes/schoolRoutes.js
backend/routes/adminRoutes.js
backend/routes/superAdminRoutes.js

4. Global request correlation/logging (requestId, traceId, request start/end)
backend/middleware/requestLogger.js

5. Structured logger implementation (Pino) used across middleware/routes
backend/utils/logger.js

6. Database models used by these active-schools APIs
backend/models/School.js
backend/models/Admin.js

7. API docs mapping (reference)
backend/swagger.js (expected by npm run swagger:gen, currently not present in this workspace)
backend/swagger-output.json (loaded by backend/index.js when present, currently not present in this workspace)

8. Verification / attack simulation layer (current files in repo)
backend/scripts/productionSecurityAttackSuite.js
backend/scripts/super-admin-endpoint-smoke-report.json

Endpoints directly connected to the active-schools flow:
- GET /api/schools
- GET /api/admin/auth/school-admins
- PATCH /api/super-admin/schools/:id/status
- POST /api/admin/auth/school-admins/:id/reset-password
