# Student Portal — A-to-Z Audit (UI/UX + Backend)

**Scope:** `frontend/src/` (student portal: `components/Dashboard*`, `LearningHub`, `AITutorHomeScreen`, `AttendanceView`, `ResultsView`, `MasteryView`, `Sidebar`, `MobileBottomNav`, `StudentDashboardContext`, `components/tutor/*`, related `utils/*`) and `backend/` APIs consumed by `/student/*` (`routes/studentRoute.js`, `routes/student.js`, `routes/studentDashboardRoutes.js`, `routes/studentAILearningRoute.js`, `routes/studentMaterialRoutes.js`, `routes/practiceRoutes.js`, `routes/practicePaperRoutes.js`, `routes/masteryRoutes.js`, `routes/progressRoute.js`, `routes/subjectRoute.js`, `routes/attendanceRoutes.js`, `middleware/authStudent*`, `middleware/authFactory.js`, `models/StudentUser.js`).

**Method:** Read-only static review of routes, middleware, models, and React components; endpoint + auth inventory via grep; targeted test run of student-related Jest suites. **No source files were modified.**

**Environment observed:** `NODE_ENV` unset (⇒ every `NODE_ENV==='production'` guard is inert, including the encryption-key and JWT-secret checks). Node/Jest available.

**Audit date:** 2026-09-03
**Remediation applied:** 2026-09-03 (branch `fix/backend-audit-top10`) — see [Remediation status](#remediation-status) at the bottom.

**Overall student-portal health score: 48 / 100** (pre-remediation)

| Area | Score | One-line |
|---|---|---|
| Backend security | 40/100 | Inherits the platform's unauthenticated first-password-reset + plaintext temp-password issues; adds student-portal-specific integrity holes. |
| Backend data integrity | 38/100 | Students can self-report mastery scores, self-mark attendance, and mass-assign their own profile fields — all feed teacher/parent/principal analytics. |
| Backend correctness | 55/100 | Study-materials access filter is broken; an entire "Smart Learning Courses" module returns hardcoded mock data. |
| Frontend UX | 66/100 | Strong visual design and first-run states; silent failure of analytics cards; fake-data module erodes trust. |
| Frontend accessibility | 45/100 | Color/emoji-only status, unlabelled progress bars and charts, `title`-attribute tooltips. |
| Frontend security/privacy | 55/100 | Sensitive data cached in `localStorage` and not cleared on normal logout; no central 401 handling. |

---

## Test & tooling results (facts)

| Check | Result |
|---|---|
| `npx jest __tests__/progressRoute.test.js __tests__/studentSubjectsRoute.test.js __tests__/studentPortalLogger.test.js` | **3 suites passed**, 31 passed / 2 skipped (these suites were repaired on this branch; the parent audit's failing state no longer reproduces here) |
| Student route/auth inventory | ~70 student-reachable handlers across 11 route files |
| `AITutorHomeScreen.jsx` size | 5,719 lines (still holds inline copies of the mode renderers + dispatcher) |
| Direct `fetch()` call sites in `components/` | 42 files; `apiFetch` (the 401-aware wrapper) used in **1** |

Anything not confirmed by reading the code is marked **[UNVERIFIED]**.

---

## CRITICAL

### C1 — Unauthenticated first-login password reset (account takeover)
**File:** `backend/routes/studentRoute.js:931` (`POST /api/student/auth/reset-first-password`)

`reset-first-password` accepts only `{ username, newPassword }`. The sole gate is `if (user.lastLoginAt) return 400`. There is no current-password check, no signed one-time token, and no email/SMS verification. Any party who knows or guesses a student login id (the ids are sequential and formulaic — `SCH-STD-25-001`, `SCH-STD-25-002`, … built in `resolveStudentPrefix`/`getNextStudentUsername`) can set the password on any student account that has never logged in. The rate limiter (20/min) does not stop targeted takeover.

This is the same class of bug already flagged for teachers/parents/principals/admins in `teacher-backend-audit.md`; it is repeated verbatim in the student route. **Fix:** replace with a hashed, single-use, short-expiry activation token issued at enrolment; disable the current endpoint until then.

### C2 — Student PII encryption key silently derives from `JWT_SECRET`
**File:** `backend/models/StudentUser.js:10-31, 273-291`

`STUDENT_SENSITIVE_FIELDS = ['mobile','email','address','aadharNumber','guardianPhone','guardianEmail']` are AES-256-GCM encrypted at rest. When `STUDENT_DATA_ENCRYPTION_KEY` is unset, the model throws **only if `NODE_ENV==='production'`** — which is not set in this environment — and otherwise derives the key from `sha256(JWT_SECRET || SUPER_ADMIN_INCOMING_SECRET || MONGODB_URL)`. Consequences:

- Aadhaar (a regulated Indian national ID) for every student is protected by a key derived from the same secret that signs auth tokens — one secret compromise = auth forgery **and** PII decryption.
- `JWT_SECRET` cannot be rotated without a decrypt/re-encrypt migration or all encrypted student PII becomes permanently unreadable.

**Fix:** set a dedicated `STUDENT_DATA_ENCRYPTION_KEY`; make the missing-key path throw in **all** environments; run a re-encryption migration before any secret rotation. (Matches `BACKEND_AUDIT-Parents.md` C1.)

---

## HIGH

### H1 — Mass assignment on `POST /api/student/profile/update`
**File:** `backend/routes/student.js:31-57`

```js
const updates = { ...(req.body || {}) };
// ... only profilePic + dob are special-cased ...
const updatedStudent = await StudentUser.findOneAndUpdate(
  { _id: req.user.id, schoolId }, updates, { new: true, runValidators: true });
```

There is **no field whitelist**. An authenticated student can PATCH arbitrary schema fields on their own record, including:

- `grade`, `section`, `roll`, `academicYear`, `status`, `approvalStatus` — **academic-record tampering** (a student can move themselves to another class/section, which then changes which timetable, materials, practice papers, and class-teacher they see, and how they appear in teacher/principal rosters).
- `achievements[]` — self-award certificates/medals shown on the Achievements page and to parents.
- `attendance[]` — overwrite attendance history.
- `admissionNumber`, `aadharNumber`, `guardianPhone`, `parentConsentGivenAt`, `dataRetentionExpiresAt`, `isArchived`, `initialPassword`.

**Fix:** explicit allowlist (`name`, `mobile`, `email`, `address`, `profilePic`, `bloodGroup`, emergency contacts — whatever the profile form actually edits) and reject everything else.

### H2 — Students self-report mastery scores and self-mark lesson completion
**Files:** `backend/routes/masteryRoutes.js:75` (`POST /api/mastery/update`), `:247` (`/lesson-complete`); `backend/routes/studentDashboardRoutes.js:128` (`/flashcard-result`)

`/api/mastery/update` takes `score` straight from the request body, `$max`-es it into `MasteryScore`, then fires `runWorkflowTriggers`. A student can POST `score: 100` for every `subject`/`topicId` and thereby:

- earn "Topic Mastered" achievements + Mastery Badges (`masteryRoutes.js:148` `awardMasteryBadge`, `studentRoute.js:2597` system badges),
- unlock every node of teacher-assigned learning paths (`unlockNextPathNode`, score ≥ 75),
- trigger congratulatory notifications,
- inflate the mastery/gap analytics that teachers, principals, and parents consume (`services/masteryEngine`, `progressRoute`, `mlEngine`).

`/lesson-complete` (`selfRating` 1–5) and `/flashcard-result` have the same shape. The AI-tutor and practice-submit paths compute scores server-side from real answers — those are fine — but the raw `/update` endpoint bypasses all of it.

**Fix:** remove client-supplied `score` from `/api/mastery/update`; derive mastery only from server-graded activities (practice submit, exam publish via `internalAuth` `/post-exam`, AI evaluator). If a self-rating signal is wanted, store it in a separate low-trust field that does not drive badges/paths/analytics.

### H3 — Students can mark their own attendance as "present"
**File:** `backend/routes/attendanceRoutes.js:1046` (`POST /api/attendance/mark`, `authStudent`)

The endpoint pushes `{ status, subject }` into the student's embedded `attendance[]` for "today", with only a one-per-day guard. A student can mark themselves `present` every day. Attendance percentage feeds the dashboard, streak trackers, the Attendance Hero / Perfect Attendance system badges (`studentRoute.js:2601`), and the attendance figures shown to teachers, parents, and admins. There is no teacher reconciliation step.

**Fix:** remove student write access to attendance, or make student-marked entries a distinct `source: 'self'` status that is not counted until a teacher confirms.

### H4 — Study Materials access filter is broken (wrong-class / school-wide exposure)
**File:** `backend/routes/studentMaterialRoutes.js:15-25, 41-59, 100-119`

```js
const getStudentClassSection = async (studentId) => {
  const student = await StudentUser.findById(studentId).lean();
  return { className: student.className, sectionName: student.sectionName,
           classId: student.classId, sectionId: student.sectionId };
};
```

`StudentUser` has **none** of `className / sectionName / classId / sectionId` — the schema stores `grade` and `section` (strings) only (`models/StudentUser.js:174-176`). So every value is `undefined` and the access `$or` becomes `[{classId: undefined, sectionId: undefined}, {className: undefined, sectionName: undefined}]`, which Mongoose reduces to matching documents where those fields are absent/null. Depending on how teacher uploads populate `TeachingMaterial`, students either see **nothing** (feature silently broken) or **every published material in the school regardless of class/section**. The same broken shape is in `/:id`, `/:id/view`, `/:id/quiz/*`, `/:id/poll/vote`.

`routes/practicePaperRoutes.js:334` (`buildStudentPaperAccess`) does this correctly — it falls back to `student.grade` / `student.section`. Copy that logic here.

### H5 — Entire "Smart Learning Courses" module is mock data; one endpoint is unauthenticated
**File:** `backend/routes/studentAILearningRoute.js`

- `POST /generate-content` (line 65) has **no auth middleware** — it is mounted under `aiApiLimiter` only. Today it returns hardcoded strings, but it is the wired entry point for AI generation and must not ship without `authStudent`.
- `GET /progress/:studentId` (line 134) returns a hardcoded object — `totalTopicsStudied: 25`, `currentStreak: 7`, `subjectProgress: { Mathematics: 75%, Physics: 53% … }` — **identical for every student**.
- `GET /recommendations/:studentId` (line 252) returns hardcoded "Review Quadratic Functions — *You struggled with this topic in recent assignments*" regardless of the student.
- `POST /activity` (line 192) accepts and echoes activity but persists nothing ("In real implementation, save to database").
- `GET /courses/:studentId` returns a static subject list for grade ≥ 9, empty otherwise.

A student (or a parent viewing shared progress) can be shown a fabricated "struggling" signal and act on it. **Fix:** either wire this module to real data (`MasteryScore`, `PracticeAttempt`, `recommendationEngine`) or remove the surface until it exists; add `authStudent` to `/generate-content` immediately.

### H6 — `initialPassword` (plaintext temporary password) is serialized to the client
**Files:** `backend/routes/studentRoute.js:1011` (`.select('-password')`), `backend/routes/student.js:92`, `models/StudentUser.js:172`

Profile endpoints exclude `password` but not `initialPassword`, a schema field that holds the **cleartext** enrolment password (`studentRoute.js:615` `initialPassword: password`) until first-login reset clears it (`:959`). Between enrolment and first login the value is returned in the `/profile` response body and then written to `localStorage` by `studentApiCache` / `studentDashboardCacheV1`. Combined with C1, a newly enrolled student's account is exposed on two fronts.

**Fix:** remove `initialPassword` from the schema entirely (use activation tokens); mark credential fields `select: false`; migrate existing plaintext values away. (Matches `teacher-backend-audit.md` finding 2.)

---

## MEDIUM

### M1 — Sensitive student data persists in `localStorage` after a normal logout
**Files:** `frontend/src/utils/authSession.js:31-40` (`clearAuthData`), `utils/studentApiCache.js`, `components/StudentDashboardContext.jsx:16`

`logoutAndRedirect()` without `clearAllLocalStorage` (the path used by `Sidebar.jsx:140`, `Header.jsx:149`, `MobileBottomNav.jsx:162`) removes only `token` and `userType`. Left behind: `studentDashboardCacheV1` (name, school name/address, recent attendance), `student-api-cache:*` (dashboard, results, schedule, allocated subjects), `eec_points_*`, tutor chat cache, and E2EE chat keys. On a shared school-lab machine the next user can read the previous student's data from DevTools. Only token *expiry* (`ProtectedRoute`) does a full `localStorage.clear()`.

**Fix:** call `clearAuthData({ clearAllLocalStorage: true })` (or explicitly purge the `student-*` / `eec_*` keys) on every logout path.

### M2 — No central API client; inconsistent auth-failure UX
**Files:** 42 components under `frontend/src/components/`; `utils/studentApiCache.js:100-110`

`fetchCachedJson` throws a generic `Error('Request failed (401)')` and does not redirect. Most student components call bare `fetch()` and handle failure ad hoc (`.catch(() => {})`, a toast, or nothing). A student whose token is revoked/expired server-side mid-session gets a patchwork of empty cards and error toasts instead of a clean bounce to login. `apiFetch` (which does redirect on 401/403) exists but is used once.

**Fix:** route all student calls through one wrapper that handles 401/403 → `logoutAndRedirect`, and standardise error/loading/empty states.

### M3 — Dashboard analytics cards fail silently
**File:** `frontend/src/components/DashboardHome.jsx:41, 163, 195, 217, 248` and the `/api/student-dashboard/*` handlers

Every card (`ProgressTrendChart`, `MasteryTopicsCard`, `LearningStreakCard`, `TimeBySubjectCard`, `FlashcardStatsCard`) does `.catch(() => {})` then `return null`. If the backend errors (all those handlers `return res.status(500)` on any exception), the student sees a shorter page with no error, no skeleton-that-resolves-to-empty, and no retry. Diagnosing "my streak disappeared" becomes guesswork.

**Fix:** distinguish "no data yet" from "failed to load"; show an inline retry on failure.

### M4 — Student profile picture stored as a base64 data URI inside the Mongo document
**File:** `backend/routes/student.js:36-41`

`updates.profilePic = 'data:<mime>;base64,<...>'` for up to a 3 MB upload. This inflates the `StudentUser` document (which is already large with embedded `attendance[]` / `achievements[]`), is re-transferred on every `/profile` and `/dashboard` fetch, and diverges from the teacher/material flow which uses Cloudinary (`utils/cloudinaryUpload.js`). Base64 also adds ~33% size.

**Fix:** upload student profile pics to Cloudinary and store the URL, as elsewhere.

### M5 — `authStudent` accepts admin tokens and short-circuits per-student ownership checks
**Files:** `backend/middleware/authStudent.js:4`, `routes/studentAILearningRoute.js:8-13`

`roleCheck: (d) => d.type === 'admin' || d.userType === 'student'`, and `ensureStudentAccess` returns `true` whenever `req.userType === 'Admin'`. Any admin token can therefore call every `/api/student/*` endpoint and pass any `:studentId`. This may be intentional for support tooling, but it is a broad, undocumented cross-account capability with no scoping to the admin's own school beyond the token's `schoolId`.

**Fix:** if admins need student-context reads, give them an explicit, logged `/api/admin/...` path rather than silently widening the student middleware.

### M6 — `/api/student/auth/schedule` is an uncached N+1
**File:** `backend/routes/studentRoute.js:2069-2294`

Each call runs: active-year lookup → class-candidate query → optional academic-year resolution → up to two timetable queries with three `populate()`s each → in-memory grouping. No caching, no rate limiting beyond the general limiter. The timetable rarely changes; the frontend hits this on every schedule view.

**Fix:** cache per (class, section, academicYear) with a short TTL invalidated on timetable writes, mirroring `student.js` `allocated-subjects`.

### M7 — Mermaid SVG from LLM/RAG output rendered via `dangerouslySetInnerHTML` with `securityLevel: 'antiscript'`
**Files:** `frontend/src/components/tutor/MermaidBlock.jsx:13-16, 80`; `AITutorHomeScreen.jsx:1191, 1257, 2469`

Tutor prose is rendered through a safe custom React parser (good — no markdown XSS). Diagrams are not: mermaid renders to an SVG string that is injected as raw HTML. `'antiscript'` strips `<script>` but is weaker than `'strict'` (which also blocks click-bindings and foreignObject HTML). The diagram source is model-generated and influenced by teacher-uploaded documents in the RAG store, so it is partially attacker-controllable.

**Fix:** set `securityLevel: 'strict'`; optionally run the SVG through DOMPurify (SVG profile) before injection.

### M8 — Accessibility: status conveyed by color/emoji only; unlabelled progress bars and charts
**Files:** `frontend/src/components/ResultsView.jsx` (0 aria/role/alt), `MasteryView.jsx` (0), `DashboardHome.jsx:125-148, 180`, `AttendanceView.jsx`

- Attendance dots use `✓ / ✗ / L` plus green/red/blue with a `title` attribute only — `title` is not exposed to keyboard or touch, and the color is the primary signal (fails WCAG 1.4.1 Use of Color).
- Score tiers are red/amber/green text with no text label of the tier.
- Progress bars are `<div style={{ width: n% }}>` with no `role="progressbar"` / `aria-valuenow` / `aria-label`.
- Recharts charts (`ProgressTrendChart`, and charts in `MasteryView` / `LanguageRadarChart`) have no `<title>`/`aria-label` or tabular fallback.

**Fix:** add `role="progressbar"` + aria values; pair every color/emoji status with visible text; give charts an accessible name and a data-table alternative.

### M9 — `console.*` used directly, against the logging convention
**Files:** `backend/routes/studentMaterialRoutes.js:94, 141` (`console.error`), `frontend/src/components/StudentDashboardContext.jsx:90`, `DashboardHome`-adjacent components

CLAUDE.md: "Route logging goes through `utils/logger.js` (Pino) — never `console` directly." The material routes log raw errors to `console.error` instead of `req.log` / the Pino logger, so these failures don't carry request/tenant context and may not land in the structured log stream.

---

## LOW

- **L1 — `attendance` enum mismatch.** `models/StudentUser.js:150` allows only `['present','absent']`, but `studentRoute.js:1855`, `DashboardHome.jsx:127`, and the streak logic all branch on `status === 'leave'` — a dead code path that also means teacher-recorded leave (if it exists elsewhere) can't be stored on the student doc.
- **L2 — Mastery/dashboard queries scoped by `studentId` only.** `masteryRoutes.js:126, 140`, `studentDashboardRoutes.js:184, 208` rely entirely on the global tenant plugin for org isolation; `time-by-subject` uses `.aggregate()` (which bypasses the plugin) and manually passes `req.schoolId` — an inconsistent pattern that is easy to get wrong on the next endpoint. Standardise on always passing `schoolId` explicitly.
- **L3 — Complaint spam.** `POST /api/student/auth/complaints` (`studentRoute.js:1149`) has no per-student rate limit; a student can create unlimited `SupportRequest` tickets.
- **L4 — Two "streak" concepts on one screen.** `DashboardHome` shows an attendance streak (`StreakTracker`) and a learning-activity streak (`LearningStreakCard`) side by side, both using 🔥/🏆 — easily conflated. Label them distinctly.
- **L5 — Hardcoded palettes; Theme Customizer scope unclear.** `LearningHub.jsx` and most student screens hardcode hex colors (`#F4F1EA`, `bg-amber-50`, …) with no dark-mode variants, while `/student/themecustomizer` and `contexts/ThemeContext.jsx` ship in the portal. **[UNVERIFIED]** whether the customizer affects these screens at all.
- **L6 — `App.jsx` student routing is a hand-maintained list** of ~40 `studentSections` plus a `/dashboard`→`/student` redirect shim and a `smart-learning/*` wildcard mixed with exact paths — brittle; a missing entry 404s silently.
- **L7 — `student.js` `/allocated-subjects` cache** is correctly tenant+student scoped (good), but the raw dashboard/results caches in `studentApiCache` key only on an 8+8-char slice of the token — two tokens sharing those 16 chars (astronomically unlikely, but) would collide.
- **L8 — `logStudentPortalEvent` logs `topic` / `subject` / free-text** on AI-learning events (`studentAILearningRoute.js:69-78`); confirm none of these can carry student PII before shipping to a log sink.

---

## What's done well

- **First-run / empty states.** `DashboardHome` detects a brand-new student and renders `FirstRunDashboard` with guided links instead of a wall of empty cards; `EmptyState` / `Skeleton` are used consistently.
- **Tutor prose rendering is XSS-safe** — a custom segmenting parser, not raw HTML injection (only mermaid SVG is the gap, M7).
- **Proactive session expiry** — `AuthSessionManager` + `ProtectedRoute` decode the JWT `exp` client-side and bounce to login with a notice before an expired token is used.
- **Practice-paper and practice-question grading is fully server-side** — answers are checked against `correctAnswer` on the server, `isCorrect` is never trusted from the client, and `correctAnswer`/`isCorrect` are stripped from the "start attempt" payload (`practicePaperRoutes.js:447-455`).
- **Tenant isolation via the global Mongoose plugin** covers the endpoints that forget to pass `organizationId` by hand.
- **Results endpoint respects publication state** — `studentRoute.js:1971` only returns `published: true` exam results and `publishedByTeacher: true` graded submissions.
- **Sidebar / MobileBottomNav** carry real `aria-label`s, focus states, and a mobile backdrop; responsive layout is handled.
- **`student.js` `/allocated-subjects`** is a model for the rest: per-tenant, per-student cache key, `Cache-Control: private, no-store`, short TTL with version bumping.

---

## Recommended fix order

1. **C1** disable `reset-first-password`, ship activation tokens (platform-wide).
2. **H1** whitelist `profile/update` fields.
3. **H3 / H2** remove student write access to attendance and to raw mastery scores.
4. **H4** fix `studentMaterialRoutes` class/section resolution (copy `buildStudentPaperAccess`).
5. **H5** add `authStudent` to `/generate-content`; hide or wire the mock AI-learning module.
6. **C2 / H6** dedicated `STUDENT_DATA_ENCRYPTION_KEY`, throw on missing in all envs; drop `initialPassword`.
7. **M1 / M2** clear all student `localStorage` on logout; single 401-aware API client.
8. **M3 / M8** surface analytics-card failures; accessibility pass on Results / Mastery / Attendance.

---

## Remediation status

Fixed on branch `fix/backend-audit-top10` (2026-09-03). Full backend suite: **30 suites / 180 tests passing**; frontend `vite build` clean.

| Item | Status | Change |
|---|---|---|
| **H1** profile mass-assignment | ✅ Fixed | `backend/routes/student.js` — strict `STUDENT_EDITABLE_PROFILE_FIELDS` allowlist; non-editable keys dropped + logged (`profile_update.rejected_fields`); password change split out with `isStrongPassword` policy check; response no longer returns `password`/`initialPassword`. |
| **H2** self-reported mastery scores | ✅ Fixed | `services/masteryEngine.js` — `runWorkflowTriggers({ trusted })`; badge award / path unlock / teacher "stuck" alert now fire only for `trusted` (server-graded) events. `routes/masteryRoutes.js` `/update` + `/lesson-complete` pass `trusted:false` and cap self-reported scores at `SELF_REPORT_CAP = 85` with a gradual blend on repeat submissions. Practice-submit and `/post-exam` keep full trust. |
| **H3** student self-marks attendance | ✅ Fixed | `backend/routes/attendanceRoutes.js` — `POST /api/attendance/mark` now returns `403` ("Attendance can only be recorded by your teacher."). Not used by the frontend. |
| **H4** broken Study Materials scoping | ✅ Fixed | `backend/routes/studentMaterialRoutes.js` — `getStudentClassSection` falls back to `grade`/`section`; new `buildMaterialAccessFilter` (mirrors `practicePaperRoutes.buildStudentPaperAccess`) returns `null` → empty result when class can't be resolved (never an unfiltered query). New `requireMaterialAccess` middleware guards `/:id/view`, `/download`, `/complete`, `/quiz/*`, `/poll/vote`. |
| **H5** mock AI-learning module | ✅ Fixed | `backend/routes/studentAILearningRoute.js` — `authStudent` added to `POST /generate-content` and (already on) `/activity`. `/progress/:studentId` and `/recommendations/:studentId` now derive from the student's real `MasteryScore` / `PracticeAttempt` records instead of hardcoded values (with graceful `.catch` fallbacks). `/activity` message softened (no fabricated "logged" claim). |
| **C2** PII key derivation | ✅ Fixed | `backend/models/StudentUser.js` — derived-key fallback now allowed **only** when `NODE_ENV` is exactly `development` or `test`; unset / `production` / `staging` throws. Fallback source narrowed to `JWT_SECRET` (never the Mongo connection string). `.env.example` updated. |
| **H6** `initialPassword` leak | ✅ Fixed | `initialPassword` is `select: false` at the model layer (Student/Parent/Teacher/Principal); `routes/student.js` profile responses additionally strip `-password -initialPassword`. Full removal (activation tokens) remains the longer-term follow-up. |
| **M1** localStorage after logout | ✅ Fixed | `frontend/src/utils/authSession.js` — `clearAuthData()` now purges `studentDashboardCacheV1` and all `student-api-cache:` / `parent-api-cache:` / `teacher-api-cache:` / `eec_points*` / `chatCache` / `chat_e2ee_` / `tutorChatHistory` / `learningContinuity` keys on every logout, not just full-clear paths. |
| **M2** no central 401 handling | ✅ Fixed | `frontend/src/utils/studentApiCache.js` — `fetchCachedJson` treats 401/403 as a session failure: clears auth + dispatches `AUTH_LOGOUT_EVENT`. `AuthSessionManager` listens for that event and redirects to login with the "session expired" notice. |
| **M3** silent analytics-card failure | ✅ Fixed | `frontend/src/components/DashboardHome.jsx` — new `useCardData` hook + `CardError` component; every dashboard analytics card now shows an inline "Couldn't load — Retry" instead of vanishing. `MasteryView` gets a distinct load-failure banner (separate from the "no quizzes yet" sample state). |
| **M8** accessibility | ✅ Fixed (pass 1) | Progress bars in `MasteryView` / `AttendanceView` / `ResultsView` now carry `role="progressbar"` + `aria-valuenow/min/max` + `aria-label`; SVG rings get `role="img"` + `aria-label`; accordion buttons get `aria-expanded`; decorative icons/mini-bars `aria-hidden`; topic rows expose a full text description via `aria-label`. Deeper work (chart data-tables, full color-contrast audit) still open. |
| **C1** unauthenticated first-password reset | ⛔ Not done | Out of the requested set — platform-wide (teacher/parent/principal/admin too); needs the activation-token design. |

**Follow-ups not in this pass:** C1 (activation tokens, platform-wide); apply the C2 `NODE_ENV` fix to `ParentUser.js`; move student profile pics to Cloudinary (M4); dedicated activity-log collection so `/activity` persists; replace `title`-attribute tooltips; chart text alternatives.
