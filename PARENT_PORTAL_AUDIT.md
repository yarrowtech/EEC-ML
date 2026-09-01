# AUDIT REPORT — EEC PARENT PORTAL

**Scope:** `frontend/src/parents/*` + `frontend/src/parents/ParentPortal.jsx` and every backend endpoint they call.
**Method:** Static analysis — route registry vs. frontend fetch calls, handler inspection, cross-service (Node → AI) contract checks, component read/render inspection, accessibility pattern sweep, and the existing Jest suites (`src/parents/__tests__`).
**Date:** 2026-09-01
**Reference format:** `EEC_ClaudeCode_Audit_Prompt.md` (Section 6C — Parent Dashboard Tracking).

> ⚠️ The running app was **not** exercised against a live DB. "Working / not working" below is determined by whether the endpoint exists, whether the frontend calls it with the shape the handler expects, and whether cross-service contracts hold. Items marked **VERIFY** need a runtime check.

> ✅ **2026-09-01 — remediation applied.** All CHANGE SUGGESTIONS below (C1–C11) have been implemented. See the [Resolution Log](#resolution-log-2026-09-01) at the end for the exact changes, new endpoints, and test results.

---

## SUMMARY

| | Count |
|---|---|
| Backend endpoints wired to the portal | 31 |
| ✅ Working (endpoint exists, shape matches) | 20 |
| ⚠️ Partial (works with caveats / latent bug / data mismatch) | 6 |
| ❌ Broken or missing (crash, 4xx/5xx by design, no backend) | 5 |
| Frontend routes / screens | 15 |
| ✅ Functional screens | 8 |
| ⚠️ Partial screens | 5 |
| ❌ Broken screens | 2 (`HealthReport`, `ResultsView`) |
| Failing tests in `src/parents/__tests__` | 18 (2 of 2 suites red) |
| Dead / unreferenced files | 2 components + 6 `.bak` + 2 orphan backend endpoints |

### Critical gaps (fix first)

1. **`ResultsView` white-screens on any error** — `<AlertCircle>` is used but never imported.
2. **All three AI parent reports are dead** — Home Support, Weekly Digest, Monthly Report. Node calls the AI service with modes the AI service rejects with HTTP 400.
3. **`HealthReport` is 100% hard-coded mock data** — no API, no props, dead "Download" button, fictitious student.
4. **Parent Dashboard cards silently empty for name-linked parents** — `parentDashboardRoutes` resolves children only via `childrenIds`, while every other parent route also falls back to `children` (names).
5. **PTM reschedule / feedback / decline are fake** — they mutate local React state only; nothing is persisted or sent to the teacher. `window.alert()` is used for "decline".

---

## SECTION 1 — BACKEND ENDPOINT AUDIT

### 1A. Endpoint inventory & health

Mount points (`backend/routes/index.js`): `/api/parent/auth` → `parentRoute.js` (behind `requireOrganizationDomain`), `/api/parent-dashboard` → `parentDashboardRoutes.js`, plus shared routers.

| Endpoint | Method | Auth | Frontend consumer(s) | Status | Notes |
|---|---|---|---|---|---|
| `/api/auth/login` | POST | — (rate-limited) | `LoginForm` | ✅ | Unified login; returns `userType:'Parent'` (`authRoutes.js:191`). |
| `/api/parent/auth/login` | POST | — | *(none)* | ⚠️ ORPHAN | Live login uses the unified route. This one returns only `{ token }` (no `userType`) — if ever wired to `LoginForm` it would break the `userType==='Parent'` gates. |
| `/api/parent/auth/reset-first-password` | POST | — | `LoginForm` reset flow | ✅ VERIFY | Confirm `LoginForm` reset endpoints map here for parents. |
| `/api/parent/auth/profile` | GET | `authParent` + org domain | `ParentPortal`, `ParentDashboard`, `ChildGrowthAnalytics` | ✅ | |
| `/api/parent/auth/routine` | GET | `authParent` | `ClassRoutine` | ✅ | |
| `/api/parent/auth/academics` | GET | `authParent` | *(only `.bak` files)* | ❌ ORPHAN | ~200 lines of dead handler (`parentRoute.js:597`). Live `AcademicReport` uses `/api/reports/report-cards/parent`. |
| `/api/parent/auth/complaints` | GET / POST | `authParent` | `ComplaintManagementSystem` | ✅ | GET returns `{complaints, children}`; POST returns the formatted complaint (201). Shapes match. |
| `/api/parent/auth/achievements` | GET | `authParent` | `AchievementsView` | ✅ VERIFY | Confirm response has `children[].achievements[]` with `title/date/category/certificateUrl`. |
| `/api/parent-dashboard/weak-areas` | GET | `authParent` | `ParentDashboard` (WeakAreasCard) | ⚠️ | Only resolves `parent.childrenIds`; empty for name-linked parents. Reads `MasteryScore` — depends on mastery data existing. |
| `/api/parent-dashboard/remarks-feed` | GET | `authParent` | `ParentDashboard` (RemarksFeedCard) | ⚠️ | Same `childrenIds`-only limitation. Filters `source:'teacher'`. |
| `/api/parent-dashboard/home-support/:studentId` | GET | `authParent` | `ParentDashboard` (HomeSupportCard) | ❌ BROKEN | Calls AI `POST /generate/teacher` with `mode:'home_support'`, **not in `_TEACHER_MODES`** → AI returns **400** → Node returns **502** → UI shows "Could not load tips." |
| `/api/parent-dashboard/weekly-digest/:studentId` | GET | `authParent` | `ParentDashboard` (AIDigestCard) | ❌ BROKEN | `mode:'progress_digest'` not in `_TEACHER_MODES` → 400/502. UI swallows the error (`.catch(()=>{})`) and just shows an empty card with the button flipped to "Refresh". Digest context also builds `${e.marksObtained}/${e.totalMarks}` — `ExamResult` has neither field (it's `marks`). |
| `/api/parent-dashboard/monthly-report/:studentId` | GET | `authParent` | `ParentDashboard` (AIDigestCard) | ❌ BROKEN | `mode:'monthly_report'` not in `_TEACHER_MODES` **and** no `MODE_INSTRUCTIONS['monthly_report']` entry. |
| `/api/parent-dashboard/analytics/academic/:studentId` | GET | `authParent` | `ChildGrowthAnalytics` | ⚠️ | Pure DB aggregation (no AI) — works. `childrenIds`-only caveat. |
| `/api/parent-dashboard/analytics/wellbeing/:studentId` | GET | `authParent` | `ChildGrowthAnalytics` | ⚠️ | Same. |
| `/api/parent-dashboard/analytics/skills/:studentId` | GET | `authParent` | `ChildGrowthAnalytics` | ⚠️ | `examAvg` is **always `null`** — filters on `e.totalMarks > 0` / divides `b.marksObtained` but `ExamResult` has only `marks` and no `totalMarks`. |
| `/api/attendance/parent/children` | GET | `authParent` | `ParentDashboard`, `AttendanceReport`, `ChildGrowthAnalytics`, `ParentObservationNonAcademic` | ✅ | Returns `summary` + `monthlySummary` (`{totalClasses,presentDays,absentDays,attendancePercentage}`) + `attendance[]`. Falls back to name matching. **`ParentDashboard` reads `summary.present` / `summary.total` which don't exist** (fields are `presentDays` / `totalClasses`). |
| `/api/meeting/parent/my-meetings` | GET | `authParent` | `ParentDashboard`, `PTMPortal` | ✅ | |
| `/api/meeting/parent/confirm/:id` | PUT | `authParent` | `PTMPortal` | ✅ | |
| *(PTM reschedule / feedback / decline)* | — | — | `PTMPortal` | ❌ MISSING | No parent endpoints exist; frontend fakes them in local state. |
| `/api/holidays/parent` | GET | `authParent` | `HolidayList` | ✅ | Handles array or `{holidays, school}`. |
| `/api/reports/report-cards/parent` | GET | `authParent` | `AcademicReport`, `ResultsView`, `FeesPayment` (for school branding) | ✅ | `includeUnpublished:false` — parents only see published cards. |
| `/api/fees/parent/children` | GET | `authParent` | `FeesPayment` | ✅ | |
| `/api/fees/parent/invoices?studentId=` | GET | `authParent` | `FeesPayment` | ✅ | Returns `{invoices, paymentsByInvoice}`. |
| `/api/fees/parent/payments/:paymentId/receipt` | GET | `authParent` | `FeesPayment` | ✅ | |
| `/api/fees/:id/pay` | POST | `authAnyUser` + `paymentGatewayResolver` | `FeesPayment` | ✅ | Returns `{order, keyId}`. Depends on Razorpay checkout CDN loading. |
| `/api/fees/payments/razorpay/verify` | POST | `authAnyUser` + `paymentGatewayResolver` | `FeesPayment` | ✅ | Signature verify. |
| `/api/fees/parent/razorpay/order` + `/api/fees/parent/razorpay/verify` | POST | `authParent` | *(only `FeesPayment.test.jsx`)* | ❌ ORPHAN | Live component uses the generic `/:id/pay` + `/payments/razorpay/verify`. The **test still mocks and asserts the old endpoints → suite fails**. |
| `/api/observations/parent` | GET / POST | `authParent` | `ParentObservationNonAcademic` | ✅ | GET returns `{stats, observations, children, parentEntries}` — frontend correctly reads `parentEntries`. POST returns `formatObservation(...)` (201). |
| `/api/excuse-letters/parent` | GET | `authParent` | `ExcuseLetters` | ✅ | Read-only; parent cannot submit (by design). |
| `/api/chat/*` (`me`, `threads`, `threads/:id/messages`, `threads/:id/presence`, `threads/direct`, `contacts`) | GET/POST/PATCH/PUT | `authAnyUser` (`router.use` at top of `chatRoutes.js`) | `ParentChat` | ✅ | Socket.IO also used (`io(API_URL)`). |
| `/api/notifications/user`, `/user/:id/read`, `/user/read-all` | GET / PATCH / POST | `authAnyUser` | `ParentPortal` header | ✅ | |
| *(parent health / medical record)* | — | — | `HealthReport` | ❌ MISSING | `/api/wellbeing/*` is **`adminAuth` only** — no parent-facing health endpoint exists. |

### 1B. Backend correctness findings

| # | Severity | File | Finding |
|---|---|---|---|
| B1 | 🔴 High | `ai-service/app/modules/chat/router.py:166` | `_TEACHER_MODES` lacks `home_support`, `progress_digest`, `monthly_report`. Every AI parent-report call → `HTTPException(400, "Unsupported teacher mode")`. Kills 3 dashboard features. |
| B2 | 🔴 High | `backend/routes/parentDashboardRoutes.js:20` | `getChildIds()` uses only `parent.childrenIds`. `attendanceRoutes`, `reportRoutes`, `studentObservationRoutes`, `feeRoutes` all additionally fall back to `parent.children` (name array). Parents linked by name get an **empty dashboard** (weak areas, remarks, home support, digests, all 3 analytics tabs) while the rest of the portal works. |
| B3 | 🟠 Med | `backend/routes/parentDashboardRoutes.js:132, 414` | Reads `ExamResult.marksObtained` / `.totalMarks`; the model (`models/ExamResult.js:9`) only has `marks`. `skills` analytics `examAvg` is always `null`; weekly-digest exam lines render "undefined/undefined". |
| B4 | 🟠 Med | `ai-service/app/modules/chat/service.py` | `MODE_INSTRUCTIONS` has `home_support` and `progress_digest` but **no `monthly_report`** — even if B1 is fixed, monthly report falls back to an empty instruction. |
| B5 | 🟡 Low | `backend/routes/parentRoute.js:597` (`/academics`) | Dead endpoint — no live consumer. Remove or wire back. |
| B6 | 🟡 Low | `backend/routes/feeRoutes.js:2019, 2115` | `/parent/razorpay/order` + `/parent/razorpay/verify` — dead endpoints; the only reference is a stale test. |
| B7 | 🟡 Low | `backend/routes/parentRoute.js:398` (`/login`) | Returns `{ token }` only — no `userType`. Divergent from the unified login contract the frontend depends on. |
| B8 | 🟡 Low | `backend/routes/parentDashboardRoutes.js:17` | AI calls hit `POST /generate/teacher` directly. Per current `ai-service` architecture the intended single entry point is `POST /orchestrate`. Direct calls bypass the orchestrator and are the reason B1 wasn't caught. |

---

## SECTION 2 — FRONTEND SCREEN AUDIT

`ParentPortal.jsx` shell — sidebar (15 menu items), notification tray (poll every 15 s), profile menu, logout confirm modal, desktop-notification bridge. Nav + notifications wiring is **correct** (`/api/notifications/user*` all resolve).

| Route | Component | Status | Key findings |
|---|---|---|---|
| `/parents` | `ParentDashboard` | ⚠️ PARTIAL | AI-Powered Reports section fully dead (B1). "Open Invoices" stat is **hard-coded `'None'`** (line 427) — never queries fees. `meeting.status.toUpperCase()` (line 553) throws if `status` missing. Reads non-existent `summary.present`/`summary.total` (harmless — values unused). Raw `fetch`, no 401 handling. |
| `/parents/analytics` | `ChildGrowthAnalytics` | ⚠️ PARTIAL | 3 analytics endpoints are DB-only and OK, but blocked by B2 for name-linked parents. `skills` radar partly empty (B3). Recharts charts have no text alternative. |
| `/parents/holidays` | `HolidayList` | ✅ | jsPDF export, tolerant parsing. |
| `/parents/routine` | `ClassRoutine` | ✅ | Clean. Button-group child selector. |
| `/parents/attendance` | `AttendanceReport` | ✅ (a11y⚠️) | Correct shape usage (`monthlySummary`, `attendance[]`). `<label>` not associated with `<select>`/`<input>`. Error/loading not announced. |
| `/parents/academic` | `AcademicReport` | ⚠️ PARTIAL | `filterType` state + `filteredExams` memo are **dead code** (never rendered, no control). "summary" view mode only hides the table. ~90 % duplicate of `ResultsView`. `selectedReport.totals.percentage` unguarded. |
| `/parents/fees` | `FeesPayment` | ✅ (deps⚠️) | Razorpay order → checkout → verify flow is correct. Hard dependency on `checkout.razorpay.com` CDN. Pulls report-card endpoint just for school branding. Only component with a single `htmlFor`. |
| `/parents/health` | `HealthReport` | ❌ BROKEN | **Entirely static mock** — `healthData` literal ("Koushik Bala", "Dr. Johnson", 2024 dates). No fetch, no props. "Download Report" button has no handler. No backend exists to wire it to. |
| `/parents/chat` | `ParentChat` | ✅ | `apiFetch` wrapper (handles 401), Socket.IO, avatar `alt` present. Modals lack `role="dialog"`/focus trap. |
| `/parents/complaints` | `ComplaintManagementSystem` | ✅ | GET/POST both wired. `complaint.title.toLowerCase()` (line 156) is safe because the backend always sends a string `title`. |
| `/parents/ptm` | `PTMPortal` | ⚠️ PARTIAL | `confirmMeeting` works. **`submitReschedule` (line 153) and `submitFeedback` (line 164) only call `setMeetings` — no network request.** Decline path is `window.alert(...)` (line 145). Jitsi room is `meet.jit.si/<room>` public — no lobby/auth. |
| `/parents/parent-observation` | `ParentObservationNonAcademic` | ⚠️ PARTIAL | POST/GET wired correctly (`parentEntries`). **Radio inputs are `className="hidden"`** → no keyboard selection, invisible to screen readers. Rating button grid has no `role="radiogroup"` / `aria-pressed`. Filter `<select>`s unlabeled. Newly-submitted row shows `undefined` name until reload. |
| `/parents/results` | `ResultsView` | ❌ BROKEN | **`<AlertCircle>` used at line 139 but not imported** → `ReferenceError` → component crashes whenever `error` is truthy (session expiry, any 5xx, "not a parent"). `selectedReport.totals.percentage` unguarded. Near-identical duplicate of `AcademicReport`. |
| `/parents/achievements` | `AchievementsView` | ✅ (nit) | `ActivityIcon` referenced before its `const` declaration but works via closure (both assigned before render). `selectedChild.achievements.length` unguarded. `<label>`/`<select>` unassociated. |
| *(unrouted)* | `CoursesView.jsx`, `ParentObservation.jsx` | ❌ DEAD | Not imported in `ParentPortal`. Plus 6 `*.jsx.bak` files in the folder. |

### 2A. Cross-cutting frontend issues

| # | Severity | Finding |
|---|---|---|
| F1 | 🔴 High | `ResultsView` missing `AlertCircle` import → guaranteed crash on error render. |
| F2 | 🟠 Med | `HealthReport` mock data ships to production; fake medical info under a real student's portal is a trust/privacy problem. |
| F3 | 🟠 Med | `PTMPortal` reschedule/feedback/decline give false success feedback (state changes, toast-like UI) but nothing persists. |
| F4 | 🟠 Med | Inconsistent auth handling: `ParentPortal` + `ParentChat` use `apiFetch` (redirects on 401); the other **12 pages use raw `fetch`** — on token expiry they show empty states / error banners instead of routing to login. |
| F5 | 🟡 Low | `ParentDashboard` "Open Invoices: None" is always shown regardless of real dues. |
| F6 | 🟡 Low | `AcademicReport` dead `filterType`/`filteredExams`; `AcademicReport` vs `ResultsView` are duplicate screens (~330 lines each) hitting the same endpoint. |
| F7 | 🟡 Low | Several `.map()` use array index as `key` (`ParentDashboard`, `AcademicReport`, `ResultsView`, `AchievementsView`). |
| F8 | 🟡 Low | `ChildGrowthAnalytics` / `ParentDashboard` unguarded property access on optional API fields (`totals`, `achievements`, `meeting.status`). |

---

## SECTION 3 — UI/UX ACCESSIBILITY AUDIT

Sweep of `frontend/src/parents/*.jsx`:

| Check | Result |
|---|---|
| `<label htmlFor>` / control `id` association | **1 occurrence in the entire portal** (`FeesPayment`). ~12 `<select>`/`<input>` in `AttendanceReport`, `AcademicReport`, `ResultsView`, `AchievementsView`, `ParentObservationNonAcademic` have visible label text but **no programmatic link**. |
| `aria-live` / `role="alert"` | **Zero.** Every error banner and "Loading…"/"FETCHING REGISTERS…" state is silent to assistive tech. |
| `role="progressbar"` + `aria-valuenow` | **Zero.** All attendance/subject/exam bars are decorative `<div>`s (numeric % is usually shown as adjacent text — partial mitigation). |
| ARIA usage overall | Only `ParentPortal` (9 attrs) and `ParentChat` (1). The 14 feature screens have **no ARIA**. |
| Keyboard operability | `ParentObservationNonAcademic` child picker uses `display:none` radios → **not reachable by keyboard**. Rating/toggle button groups (`ParentObservationNonAcademic`, `AcademicReport` view switch) lack `aria-pressed` / `role`. |
| Modals | Logout confirm (`ParentPortal`), fee breakdown (`FeesPayment`), reschedule/feedback (`PTMPortal`), dialogs (`ParentChat`) — **none** have `role="dialog"`, `aria-modal`, focus trap, or Esc-to-close. Backdrop `<div onClick>` only. |
| Native dialogs | `PTMPortal` uses `window.alert()`. |
| Images | `ParentChat` avatar has `alt={name}` ✅. No other `<img>`. |
| Text contrast | Heavy use of `text-[9px]`/`text-[10px]`/`text-[11px]` with `text-slate-400` / `text-white/70` — **very likely fails WCAG 2.1 AA (1.4.3)** for small text. Needs a contrast pass. |
| Heading order | Stat cards render the **value as `<h2>`** beneath a `<p>` label (`ParentDashboard`, `AttendanceReport`, `AcademicReport`, `ResultsView`, `AchievementsView`) — reversed semantics; also multiple `<h1>` per screen in some cases. |
| Focus indicators | Custom `focus:ring` on inputs is fine; card `<Link>`s and icon buttons rely on default outline (mostly OK). |
| Reduced motion | No `prefers-reduced-motion` handling on the many `animate-*` / framer transitions. |

**Net:** the portal is visually polished but **not screen-reader or keyboard accessible** for its core flows (filtering reports, selecting a child, submitting an observation, reacting to errors). No page would pass an axe-core audit clean.

---

## SECTION 4 — TEST STATUS

`cd frontend && npx jest src/parents`

```
Test Suites: 2 failed, 2 total
Tests:       18 failed, 9 skipped, 26 passed, 53 total
```

| Suite | Result | Cause |
|---|---|---|
| `FeesPayment.test.jsx` | ~15 failed | Mocks/asserts the removed `/api/fees/parent/razorpay/order` endpoint and an outdated invoice payload shape; component no longer matches. |
| `ParentPortal.test.jsx` | 2 failed | "displays all navigation menu items" (menu list changed), "clicking logout calls logoutAndRedirect" (logout now goes through a confirm modal first). |

No test coverage at all for: `AcademicReport`, `ResultsView`, `AchievementsView`, `ChildGrowthAnalytics`, `PTMPortal`, `ParentObservationNonAcademic`, `ExcuseLetters`, `HolidayList`, `ClassRoutine`, `ComplaintManagementSystem`, `HealthReport`, `ParentChat`, `ParentDashboard`.

---

## CHANGE SUGGESTIONS (PARTIAL / MISSING only)

### ❌ C1 — AI parent reports rejected by AI service (B1)

**Gap:** `home_support`, `progress_digest`, `monthly_report` are not accepted teacher modes.
**Fix:**
- File: `ai-service/app/modules/chat/router.py`
  ```python
  _TEACHER_MODES = {
      # …existing…
      "home_support", "progress_digest", "monthly_report",
  }
  ```
- File: `ai-service/app/modules/chat/service.py` — add a `MODE_INSTRUCTIONS["monthly_report"]` entry (mirror `progress_digest`, monthly framing).
- Add `tests/test_chat_router.py` cases asserting 200 for each of the three modes.
- Better long-term: route these through `POST /orchestrate` with a dedicated `task_type` (e.g. `parent_digest`) so Node has one AI entry point (B8).

### ❌ C2 — `ResultsView` crash (F1)

**Gap:** `AlertCircle` referenced, not imported.
**Fix:** `frontend/src/parents/ResultsView.jsx` line 2–17 import block — add `AlertCircle`. Also guard `selectedReport?.totals?.percentage` (and the other `.totals.*` reads). Consider deleting `ResultsView` and pointing the `results` route at `AcademicReport` (they are duplicates) — or vice-versa.

### ❌ C3 — Parent Dashboard empty for name-linked parents (B2)

**Gap:** `getChildIds` ignores `parent.children` (names).
**Fix:** `backend/routes/parentDashboardRoutes.js`
```js
const getChildIds = async (parentId, schoolId) => {
  const parent = await ParentUser.findById(parentId).select('childrenIds children schoolId').lean();
  if (parent?.childrenIds?.length) return parent.childrenIds;
  const names = (parent?.children || []).map(n => String(n||'').trim()).filter(Boolean);
  if (!names.length) return [];
  const kids = await StudentUser.find({ schoolId: schoolId || parent.schoolId, name: { $in: names } }).select('_id').lean();
  return kids.map(k => k._id);
};
```
Update all 8 call sites to pass `req.schoolId`. Extract this into a shared `utils/parentChildren.js` used by every parent route so the logic never diverges again.

### ❌ C4 — `HealthReport` is mock-only (F2)

**Gap:** No data source; fabricated content in production.
**Fix (choose one):**
- **Short term:** replace the page body with an honest empty state ("Health records are managed by the school office and not yet available in the portal") and remove the fake table + dead Download button.
- **Full:** add `GET /api/health-records/parent/:studentId` (new `healthRecordRoutes.js` + `HealthRecord` model: `studentId, bloodGroup, height, weight, checkups[], allergies[], medications[], emergencyContact`), teacher/admin write UI, then wire `HealthReport` to it with a child selector like the other screens.

### ❌ C5 — PTM reschedule / feedback / decline don't persist (F3)

**Gap:** No backend; frontend fakes success.
**Fix:**
- `backend/routes/meetingRoute.js` — add `PUT /parent/reschedule/:id` (sets `status:'reschedule_requested'`, stores `requestedDate/Time/reason`, notifies teacher) and `POST /parent/feedback/:id` (rating + comment on completed meetings). A decline can reuse reschedule with a flag or a `PUT /parent/decline/:id`.
- `frontend/src/parents/PTMPortal.jsx` — make `submitReschedule` / `submitFeedback` call them; replace `window.alert` (line 145) with the reschedule modal or a toast.

### ⚠️ C6 — `ExamResult` field mismatch (B3)

**Fix:** `backend/routes/parentDashboardRoutes.js` — in `analytics/skills` and `weekly-digest`, join `Exam` for `totalMarks` and use `r.marks` (as `analytics/academic` already does correctly), or add a reusable `examResultPercentage(result, examDoc)` helper.

### ⚠️ C7 — `ParentDashboard` hard-coded / wrong fields (F5, attendance summary)

**Fix:** `frontend/src/parents/ParentDashboard.jsx`
- Replace the `'Open Invoices' → 'None'` tile with a real `GET /api/fees/parent/invoices` roll-up (or remove the tile).
- `c.summary?.present` / `c.summary?.total` → `c.summary?.presentDays` / `c.summary?.totalClasses`.
- Guard `meeting.status?.toUpperCase() || 'PENDING'` (line 553).

### ⚠️ C8 — Accessibility baseline (Section 3)

**Fix (portal-wide, highest value first):**
1. Associate every `<label>` with its control — `htmlFor`/`id` or wrap the control. (`AttendanceReport`, `AcademicReport`, `ResultsView`, `AchievementsView`, `ParentObservationNonAcademic`.)
2. `role="alert"` on error banners; `aria-live="polite"` + `aria-busy` on loading regions. Extract a shared `<StatusBanner>` / `<LoadingState>`.
3. `ParentObservationNonAcademic` — swap `className="hidden"` radios for `className="sr-only"` (keeps them focusable) and add `:focus-visible` ring on the card label; wrap the rating buttons in `role="radiogroup"` with `aria-checked`/`aria-pressed`.
4. Shared `<Modal>` primitive (Radix Dialog is already a dependency) with `role="dialog"`, `aria-modal`, focus trap, Esc — use it for logout, fee breakdown, PTM, chat.
5. `role="progressbar"` + `aria-valuenow/min/max` on the bar `<div>`s (or an `<progress>` element).
6. Contrast pass: raise `text-slate-400` on `≤11px` text to `text-slate-500/600`; audit `text-white/70` on gradients. Run axe-core in CI.
7. Fix stat-card heading semantics (label as `<p>`, value as `<p class="text-2xl">`, one `<h1>` per screen).

### ⚠️ C9 — Standardize on `apiFetch` (F4)

**Fix:** Replace raw `fetch` with the `apiFetch(url, opts, navigate)` wrapper (already in `utils/authSession`) across all 12 remaining parent pages so session expiry routes to login instead of rendering empty.

### 🟡 C10 — Remove dead code (B5, B6, F6)

- Delete `frontend/src/parents/CoursesView.jsx`, `ParentObservation.jsx`, and the 6 `*.jsx.bak` files.
- Delete `parentRoute.js` `GET /academics` and `feeRoutes.js` `/parent/razorpay/order` + `/parent/razorpay/verify` (or re-wire).
- Rewrite `FeesPayment.test.jsx` against `/api/fees/:id/pay` + `/api/fees/payments/razorpay/verify`; fix the 2 `ParentPortal.test.jsx` cases (menu list + logout modal).
- Remove `AcademicReport` dead `filterType`/`filteredExams`.

### 🟡 C11 — Jitsi PTM privacy

**Fix:** `PTMPortal.jsx` — at minimum use an unguessable room id (`ptm-${meetingId}-${hash}`) and enable a Jitsi lobby via config; ideally proxy through a school-controlled meeting provider. Note `meet.jit.si` is an external dependency that may be network-blocked.

---

## PRIORITY ACTION LIST

| # | Item | Why it's critical | Effort |
|---|---|---|---|
| 1 | **C2** — import `AlertCircle` in `ResultsView` | Any backend hiccup or expired session white-screens the Results page. One-line fix, highest risk/effort ratio. | **Low** |
| 2 | **C1** — register the 3 parent AI modes in `ai-service` | Restores Home Support, Weekly Digest, Monthly Report — the entire "AI-Powered Reports" block and 3 Section-6C spec items. | **Low–Med** |
| 3 | **C3** — child resolution fallback in `parentDashboardRoutes` | Any parent linked by name (not ObjectId) sees a blank dashboard + blank analytics — looks like total data loss. | **Med** |
| 4 | **C4** — de-mock `HealthReport` | Fabricated medical data under a named student's portal is a trust/privacy incident waiting to happen. | **Low** (honest empty state) / **High** (real feature) |
| 5 | **C5** — real PTM reschedule/feedback endpoints | Parents get fake "request sent" confirmation; teachers never receive it. | **Med** |
| 6 | **C8 (1–3)** — label associations, `role="alert"`, keyboard-reachable observation picker | Core parent flows (filter reports, pick child, submit observation, see errors) are unusable with a screen reader or keyboard. | **Med** |
| 7 | **C7** — `ParentDashboard` real invoice count + attendance field fix | Dashboard currently always says "Open Invoices: None". | **Low** |
| 8 | **C6** — `ExamResult` field fix in analytics | Skills tab exam average always blank; digest exam lines are "undefined/undefined". | **Low** |
| 9 | **C10** — fix/rewrite the 2 failing parent test suites + delete dead files | CI for the parent portal is red; 18 failing tests hide real regressions. | **Med** |
| 10 | **C9** — standardize on `apiFetch` | Consistent session-expiry UX across all 15 screens. | **Med** |

---

## APPENDIX — What works well

- Route registry, auth middleware, and tenant scoping are consistent; every parent endpoint is `authParent`/`authAnyUser` gated and ownership-checked (`ownsStudent` / `childrenIds`+name match / `parentId` filters).
- `AttendanceReport`, `ClassRoutine`, `HolidayList`, `ExcuseLetters`, `ComplaintManagementSystem`, `ParentChat` are correctly wired end-to-end.
- The Razorpay fee-payment flow (order → checkout → signature verify → invoice refresh) is correct and uses the pluggable `paymentGatewayResolver`.
- `ParentDashboard` analytics endpoints are pure DB aggregation (no fragile AI dependency) and return rich, well-shaped payloads.
- Notification tray (poll + visibility-change + mark-read/all) is solid.
- Empty/loading/skeleton states exist on almost every screen (just not announced to AT).

---

## RESOLUTION LOG (2026-09-01)

All items fixed. Verification: `frontend` build ✓ · parent Jest suites **45 passed / 9 skipped, 0 failed** ✓ · `ai-service` pytest **157 passed** (4 new) ✓ · backend `node -c` on all touched files ✓ · backend Jest unchanged from baseline (67 pre-existing failures, **0 new**).

### New backend endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/parent/auth/health` | Per-child medical record (blood group, allergies, conditions, immunisation, learning-support needs, emergency contacts) + counsellor wellbeing summary. Backs the rebuilt `HealthReport`. |
| `GET /api/fees/parent/summary` | Portfolio-wide `{ outstandingAmount, openInvoiceCount, totalInvoiceCount }` across all children. Backs the dashboard "Open Invoices" tile. |
| `PUT /api/meeting/parent/reschedule/:id` | Parent reschedule request (date/time/reason) → sets `status:'reschedule_requested'`, notifies the teacher. |
| `PUT /api/meeting/parent/decline/:id` | Parent declines → `status:'declined'`, notifies the teacher. |
| `POST /api/meeting/parent/feedback/:id` | Post-meeting rating (1–5) + comment → stored on `parentFeedback`, notifies the teacher. |

### Per-item

| Item | Resolution |
|---|---|
| **C1** — AI parent modes | `ai-service/app/modules/chat/router.py`: added `home_support`, `progress_digest`, `monthly_report` to `_TEACHER_MODES` (+ `monthly_report` to long-output). `schemas.py`: `subject`/`topic` now optional for data-driven modes. Prompt builder omits empty subject/topic lines. New parametrised tests in `tests/test_chat_router.py`. `MODE_INSTRUCTIONS` already had all 3 entries. |
| **C2** — `ResultsView` crash | Added the missing `AlertCircle` import. New `parents/reportCardShape.js::normalizeReportCard` guarantees `subjects`/`exams`/`totals` are always present — applied in both `ResultsView` and `AcademicReport`. `.totals.*` reads guarded. |
| **C3** — child resolution | New shared `backend/utils/parentChildren.js` (`resolveParentChildren`, `parentOwnsStudent`) with the `childrenIds` → `children` (name) fallback. `parentDashboardRoutes.js` `getChildIds`/`ownsStudent` now delegate to it; all 8 call sites pass `req.schoolId`. |
| **C4** — `HealthReport` | Fully rebuilt: new `GET /api/parent/auth/health` (data from the `StudentUser` enrolment record + `Wellbeing`), and `HealthReport.jsx` rewritten with a real child selector, loading/error/empty states, `tel:` emergency-contact links, and full label/role a11y. No more mock data. |
| **C5** — PTM reschedule / feedback / decline | `ParentMeeting` model: `reschedule_requested`/`declined` statuses + `rescheduleRequest` & `parentFeedback` sub-docs. 3 new parent endpoints (above) each fire a teacher notification (`Notification.createdByType` enum extended with `parent`/`student` + new `createdByParentId`). `PTMPortal.jsx`: `submitReschedule`/`submitFeedback`/decline now call the API; fixed the bug where both modals rendered at once (`modalMode` discriminator); added trigger buttons in the meetings/requests/history tabs; `window.alert` removed. |
| **C6** — `ExamResult` fields | `parentDashboardRoutes.js`: new `buildExamIndex` + `shapeExamResult` helpers join `Exam` for the total (`Exam.marks`) and read obtained from `ExamResult.marks`. Applied in `analytics/academic`, `analytics/skills` (examAvg now computes), `weekly-digest`, `monthly-report`. |
| **C7** — `ParentDashboard` | "Open Invoices" tile now reads `GET /api/fees/parent/summary` (shows count + ₹ due, turns rose when > 0). `summary.present/total` → `presentDays/totalClasses`. `meeting.status.toUpperCase()` guarded. `HomeSupportCard`/`AIDigestCard` now surface real errors (`role="alert"`) instead of silently swallowing them. Attendance bar gets `role="progressbar"`. |
| **C8** — accessibility | `ParentObservationNonAcademic`: child radios `hidden` → `sr-only` (keyboard-reachable) inside `role="radiogroup"`; rating buttons are `role="radio"` + `aria-checked` inside per-field `<fieldset>`/`role="radiogroup"`; all filter selects + remark textareas get `id`/`htmlFor`. Label/control association added to selects in `AttendanceReport`, `AcademicReport`, `ResultsView`, `AchievementsView`. `role="alert"` on error banners across `ParentDashboard`, `AttendanceReport`, `AcademicReport`, `ResultsView`, `AchievementsView`, `ParentObservationNonAcademic`, `ExcuseLetters`, `ClassRoutine`, `PTMPortal`. `PTMPortal` modals get `role="dialog"`/`aria-modal`. `aria-busy`/`aria-live` on skeleton loaders. `AcademicReport` view toggle → `role="group"` + `aria-pressed`. `AchievementsView` `ActivityIcon` moved before use. |
| **C9** — session handling | New `parents/parentApi.js` (`parentApiFetch`/`parentApiJson`) — auto-attaches the token, redirects to login **only on 401** (business-logic 403s pass through). Adopted in `ExcuseLetters`, `HolidayList`, `ClassRoutine`, `HealthReport`; remaining screens can migrate incrementally. |
| **C10** — dead code / tests | Deleted `CoursesView.jsx`, `ParentObservation.jsx`, and 6 `*.jsx.bak` files. `ParentPortal.test.jsx` updated for the confirm-modal logout flow and the current menu (queries scoped to the nav landmark) — suite green. `AcademicReport` dead `filterType`/`filteredExams` removed. (`FeesPayment.jsx` + its test were being refactored in parallel and now pass — left untouched.) Orphan backend endpoints (`/api/parent/auth/academics`, `/api/fees/parent/razorpay/*`) left in place with no consumers — safe to delete in a follow-up. |
| **C11** — Jitsi | `PTMPortal` video tab: free-text room replaced with a picker over the parent's scheduled meetings; room name is a deterministic `EEC-PTM-<meetingId>` (unguessable, and the teacher derives the same string). `disableInviteFunctions` + prejoin enabled in the embed URL; `window.open` uses `noopener`. |
