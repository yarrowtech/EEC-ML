# Admin Portal Audit Checklist

Audit date: 2026-08-05  
Scope: `frontend/src/admin`, `frontend/src/Super Admin`, and the corresponding Express routes under `backend/`.

## How to read this checklist

- `[x]` means verified by source inspection or an automated check.
- `[ ]` means it still needs a live browser/API verification.
- `BLOCKER` means a confirmed defect or security issue found in source.
- This audit does not claim that every control works live: the local API could not be reached from the current sandbox, so authenticated click-through testing was not possible.

## Executive result

**Status: Not ready for a “all buttons and APIs working / security up to mark” sign-off.**

The frontend production build passes, and the application has several useful security controls, but the audit found confirmed functional/API defects and a critical unauthenticated upload surface. Full frontend and backend test suites also fail. The unchecked items below require a running backend, database, and test accounts for final confirmation.

Static inventory found approximately 270 frontend `fetch` call sites in the admin and super-admin surfaces, 32 page files containing API calls, and 43 files containing buttons. The checklist therefore groups controls by page and workflow while preserving the individual retest items.

## Page-by-page portal checklist

### Core admin navigation and dashboard

- [x] Admin routes are declared in `frontend/src/admin/AdminApp.jsx`.
- [ ] Sidebar navigation opens every permitted route with an Admin account.
- [ ] Super-admin-only links are hidden from a normal school Admin account.
- [ ] Dashboard cards, notifications, recent activity, fee summaries, and quick actions return data with a valid token.
- [ ] Expired/invalid sessions consistently redirect to login.
- [ ] **Finding:** `AdminSidebar.jsx` contains a dead logout handler referencing undefined `logoutAndRedirect`, `navigate`, and `AUTH_NOTICE`. The currently used callback is separate, but the dead handler should be removed or repaired.

### Analytics

- [ ] Date range and school filters update the displayed data.
- [ ] Student, attendance, fee, academic, teacher, wellbeing, and operational analytics endpoints return expected payloads.
- [ ] AI insight loading and error states work.
- [ ] **Finding:** AI insight text is inserted with `dangerouslySetInnerHTML` after only a bold-marker replacement. Escape or sanitize the content before rendering.

### Students and archived students

- [ ] Student list, search, filters, pagination, create, edit, view, delete/archive, bulk import, credential generation, attendance, and fee actions work end to end.
- [ ] Student API responses are scoped to the current school/campus.
- [ ] Archived student list loads from `/api/nif/students/archived`.
- [x] Archived export is now implemented at `/api/nif/students/archived/export` with tenant scope and an allowlisted CSV projection.
- [x] The CSV download now uses an authenticated blob request instead of `window.location.href`.
- [ ] Retest archived export live with an Admin token.

### Teachers, staff, and parents

- [ ] Teacher list, create/edit, status, timetable, feedback, credentials, and deletion actions work.
- [ ] HR staff list, profile, leave, attendance, payroll-related views, and document actions work.
- [ ] Parent list, search, profile, credentials, and student associations work.
- [ ] Every read/write request is checked for tenant scope and correct role.
- [ ] Reset/credential actions do not expose reusable passwords in the UI or API response.

### Academic setup

- [ ] Academic years can be created, edited, activated, archived, and restored.
- [ ] Classes, sections, subjects, buildings, floors, rooms, and teacher allocations can be created, edited, and deleted.
- [ ] Bulk class/section operations validate duplicates and partial failures.
- [x] The single “Add Class” modal now calls the academic class create API with validation and refreshes the list.
- [ ] Pagination, filters, and active-year selection persist correctly after mutations.

### Attendance, routine, floor/room, and timetable

- [ ] Student attendance loads, filters by date/class, saves, and reports the server result.
- [ ] Routine/class routine create, edit, publish, delete, conflict validation, and PDF/print actions work.
- [ ] Teacher timetable loads the correct teacher and school logo.
- [ ] Floor/room allocation prevents duplicate or cross-school assignments.
- [ ] Direct routes and redirected routes (`/routine` → `/routines`) work on refresh.

### Wellbeing

- [ ] Student list loads.
- [ ] **BLOCKER:** `Wellbeing.jsx` calls `/api/wellbeing/:studentId`, and `wellbeingRoute.js` defines that route, but `backend/index.js` does not mount `/api/wellbeing`. Detail/save calls will return 404 until the mount is added or the frontend is changed.
- [ ] Verify access is limited to authorized school staff after the route is mounted.

### Lesson plans

- [ ] Lesson-plan options, list, create, edit, publish, and delete actions work.
- [ ] Attachments and teacher/class filters are scoped and validated.
- [ ] Unauthorized teacher/school access is rejected.

### Examination and results

- [ ] Exam groups, exams, schedules, question/mark inputs, publish/unpublish, and delete actions work.
- [ ] Results load, filter, save, bulk import, publish, and export correctly.
- [ ] Invalid marks, duplicate entries, and closed exams are rejected server-side.
- [x] Exam/report upload calls now pass through authenticated upload middleware; see the remaining live retest below.

### Report cards

- [ ] Templates, signatories, school settings, previews, bulk generation, download, and print actions work.
- [ ] Generated cards contain only the selected school’s students.
- [ ] Uploads and generated documents are not publicly writable or unnecessarily public.
- [x] Report-card assets, school logos, and avatars use the protected shared upload route.

### Fees and payment gateway

- [ ] Fee structures, invoices, collections, student details, filters, pagination, and exports work.
- [ ] Payment initiation, success, failure, webhook reconciliation, and duplicate-payment handling work against a test gateway.
- [ ] Payment secrets are never returned to the browser.
- [ ] Encryption key is configured in every deployed environment; the test run reported a fallback key because `PAYMENT_ENCRYPTION_KEY` was absent.
- [ ] Production frontend/API URLs use HTTPS and are allowed by CSP/CORS.

### HR

- [ ] Leave, employee attendance, expense, payroll, and settings workflows return persisted server data.
- [x] Employee “Pay” no longer reports a false success; it is visibly disabled until a real payroll integration exists.
- [x] Vendor “Pay” no longer reports a false success; it is visibly disabled until a real payment integration exists.
- [ ] Implement audited payroll/vendor payment workflows before enabling these controls.

### Notices, holidays, support, and settings

- [ ] Notice create, edit, publish, view, detail, delete, and attachment actions work.
- [ ] Holiday create, edit, delete, import, and calendar display work.
- [ ] Support request submission, status, and persistence work.
- [ ] Profile, school settings, logo/avatar upload, payment gateway settings, and password actions work.
- [ ] **Finding:** Support requests are queued in `localStorage`; assess whether the stored student/school information is acceptable under the privacy policy.
- [ ] **Finding:** Many pages use raw `fetch` instead of the shared `apiFetch`, so expired sessions may show page errors rather than consistently logging out/redirecting.

### Super Admin

- [ ] Overview metrics and school/organization lists load.
- [ ] School registration requests can be reviewed, approved, rejected, and inspected.
- [ ] Feedback, issues, operations, active schools, organizations, and payment-status actions work.
- [ ] Super Admin pages reject normal Admin tokens and cross-tenant identifiers.
- [x] Source inspection confirms the main super-admin route groups use `adminAuth` and `ensureSuperAdmin`.
- [ ] Live authorization and IDOR tests still required for each read/write endpoint.

## Confirmed loopholes and security findings

- [x] **F-01 — CRITICAL — Unauthenticated public uploads — fixed in source.** Shared Cloudinary endpoints now require a valid user token, allow only approved folders/types, enforce limits, and return generic errors. Public school registration uses separate fixed-folder, type-limited, rate-limited endpoints.
- [x] **F-02 — HIGH — Shared default password reset — fixed in source.** Resets now generate a unique 16-character temporary password, do not persist it in `initialPassword`, and preserve first-login reset behavior. Live verification must confirm the model hash and reset flow.
- [x] **F-03 — HIGH — Wellbeing API was not mounted — fixed in source.** `/api/wellbeing` is now mounted with the existing admin authentication middleware.
- [x] **F-04 — HIGH — Archived CSV action had no endpoint/auth header — fixed in source.** A tenant-scoped export route and authenticated frontend blob download now exist.
- [x] **F-05 — HIGH — Single-class creation was a no-op — fixed in source.** The modal now validates and calls the class create API.
- [x] **F-06 — HIGH — HR payment controls were demo-only — mitigated in source.** False success actions are disabled. A real audited payment workflow remains to be implemented.
- [x] **F-07 — HIGH — Possible DOM XSS in analytics — fixed in source.** AI markdown is now rendered as escaped React text/fragments without `dangerouslySetInnerHTML`.
- [x] **F-08 — MEDIUM — CSP allowed `unsafe-inline` — fixed in source.** Inline script/style allowances were removed. Confirm the deployed API origin and any required external assets in live browser testing.
- [x] **F-09 — MEDIUM — Raw backend error messages — mitigated globally for 5xx responses.** Express now replaces 5xx `error`/`message` fields with `Internal server error`; detailed exceptions remain in server logs. Client-facing 4xx validation messages remain intentional.
- [ ] **F-10 — MEDIUM — Frontend API URL is configured as HTTP in the local environment.** Production must use HTTPS; reject unsafe production configuration at startup/build time.
- [x] **F-11 — MEDIUM — Browser storage was used for queued support PII — mitigated in source.** Failed support requests now remain in component memory and are not persisted. Auth tokens still use `localStorage`; migrating them to secure HttpOnly SameSite cookies remains recommended.
- [ ] **F-12 — LOW — Large frontend bundle and lint debt reduce reviewability.** The build reports a roughly 7.4 MB main minified chunk, and full lint reports 2,262 problems. Split admin bundles and fix admin-surface lint errors before release.
- [x] **F-13 — HIGH — Public first-admin bootstrap — fixed in source.** Production `/api/admin/auth/register` now requires `SUPER_ADMIN_BOOTSTRAP_SECRET` in the `x-super-admin-bootstrap-secret` header when no admin exists.
- [x] **F-14 — MEDIUM — Startup password overwrite — fixed in source.** Seed startup preserves an existing super-admin password unless `RESET_SUPER_ADMIN_PASSWORD=true` is explicitly set.

## Security controls present

- [x] JWT verification is implemented for admin requests, including token type and tenant validation.
- [x] Super-admin route groups use an explicit `ensureSuperAdmin` check.
- [x] Many school/campus reads and writes use server-side scope filters.
- [x] Helmet, CORS allowlisting, Mongo query sanitization, request logging, token replay telemetry, and multiple rate limiters are present.
- [x] Upload and AI rate limiters are present, but upload authentication is still missing.
- [ ] Live unauthenticated, expired-token, role-boundary, IDOR, tenant-isolation, upload-abuse, and rate-limit tests completed.
- [ ] Dependency vulnerability audit completed; `npm audit --omit=dev --audit-level=high` could not reach the registry because of DNS/network failure.

## Automated verification evidence

- [x] `frontend npm run build` — passed. Warnings remain for JSX characters, a large bundle, and a jsPDF import pattern.
- [ ] `frontend npm run lint` — failed: 2,262 problems (2,144 errors, 118 warnings). The output includes broad pre-existing/generated-file issues, so run a focused admin lint pass after cleanup.
- [x] Targeted remediated admin ESLint — 0 errors, 7 hook-dependency warnings remain in Academic Setup and HR.
- [ ] `frontend npm test -- --runInBand` — failed: 10 suites failed, 7 passed; 79 tests failed, 64 passed, 9 skipped.
- [ ] `backend npm test -- --runInBand` — failed: 3 suites failed, 15 passed; 61 tests failed, 83 passed. Bootstrap mocking, promotion response drift, and a timeout were observed.
- [ ] `backend` production security attack suite — not run because it requires a live API/database and creates test data.
- [ ] Live browser click-through and network inspection — not run because the local API socket was unavailable in this environment.

### Remediation verification completed

- [x] Backend syntax checks pass for the modified bootstrap, upload, registration, archived-student, and admin-user route files.
- [x] Frontend production build passes after remediation.
- [x] Confirmed old shared upload route has authentication middleware and no longer returns raw Cloudinary errors.
- [x] Confirmed old `Pass@123`, demo payment messages, analytics `dangerouslySetInnerHTML`, and single-class TODO are absent from the remediated admin paths.
- [x] Confirmed production bootstrap and startup seed changes pass backend syntax validation.

## Release gate / retest checklist

- [x] Add upload authentication, tenant checks, MIME/folder limits, and generic errors.
- [x] Mount wellbeing routes.
- [x] Implement authenticated archived-student export.
- [x] Implement single-class creation and disable misleading HR payment actions.
- [x] Sanitize analytics insight rendering and remove unsafe inline CSP allowances.
- [x] Replace shared password reset defaults with a random temporary password.
- [ ] Run the backend with a test database and execute every page action with Admin and Super Admin accounts.
- [ ] Capture each request’s method, URL, status, response shape, and visible success/error state.
- [ ] Test expired tokens, wrong roles, cross-school IDs, duplicate submissions, refresh/deep links, empty states, and network failures.
- [ ] Run focused admin lint/tests, full frontend/backend tests, dependency audit, and the production security suite.
- [ ] Recheck this document and obtain sign-off only after all BLOCKER items are checked and passing.
