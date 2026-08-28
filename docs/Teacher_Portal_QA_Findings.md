# Teacher Portal — QA Findings & Fix Plan

**Source:** `docs/teacher-testing-gopal.pdf` (13 pages, tester: Gopal; account: "Ananya Sen", Mathematics teacher, Kolamal Santoshini High School, Class 5-A)
**Method:** Every reported issue traced to source (backend routes/models + `frontend/src/teachers/*`). No code changed yet.
**Date:** 2026-08-28

---

## TL;DR

22 reported issues collapse to **~11 real fixes** plus **3 items that need a live repro or a product decision**.

The dominant root cause behind Group A is that several teacher screens **call admin-only endpoints** or **read fields the model doesn't have**, so scoped data comes back empty and the UI shows zeros / "not found". A second cluster is **prototype screens with hardcoded or seeded data** that were never wired to the API.

| Verdict | Count | Items |
|---|---|---|
| **Confirmed bug** | 13 | 1, 3, 4, 5, 8, 9, 12, 13, 14, 16, 20, 21, 22 |
| **Confirmed, likely config/expectation** | 2 | 6 (class-teacher gating), 10/11 (leave-type filter) |
| **Needs live repro** | 3 | 2, 7, 17/18 |
| **Not a bug (empty test data)** | 1 | 4 partially — see notes |

---

## Group A — Data / logic

### A1 · Dashboard "Attendance" doesn't open the teacher's assigned class/section — **CONFIRMED**

- **Where:** `frontend/src/teachers/TeacherDashboard.jsx:268,292,514` — all "Attendance" links are hardcoded to `/teacher/classes/current/students/attendance`.
- **Root cause:** `frontend/src/teachers/TeacherPortal.jsx:723` — `ClassWorkspace` does `if (!classId || classId === 'current') return undefined;`. The literal slug `current` is never resolved to a real class/section, so every child screen (Attendance, Achievements, etc.) opens with no class context → "No students found".
- **Fix:** On mount, `ClassWorkspace` should resolve `current` → the teacher's primary allocation (prefer `isClassTeacher`, else first allocation) from `/api/teacher/dashboard/allocations` and `navigate(replace)` to the real slug. Then the dashboard shortcut lands on a populated page. Alternatively make `AttendanceManagement` fall back to the teacher's primary allocation when `classId === 'current'`.
- **Effort:** M · **Test:** yes (allocation → slug resolution).

### A2 · "Select Class" dropdown doesn't restrict to assigned classes — **NEEDS LIVE REPRO**

- **Where:** `frontend/src/teachers/TeacherPortal.jsx:410–508` (`SelectClassScreen`).
- **What the code does:** fetches `/api/teacher/dashboard/allocations` (a proper `authTeacher` endpoint), builds `classNames` / `sections` / `subjects` strictly from the teacher's allocations, auto-selects the first of each. The screenshot on p.2 actually shows "5 / A / Mathematics" selected with a "SELECTED 5 A Mathematics" chip — i.e. it appears to be working.
- **Assessment:** The code path looks correct. The complaint text ("unable to select") contradicts its own screenshot. Possible real problem: the dropdown shows classes the teacher is *not* allocated to (would need to see the open dropdown), or it's empty on first open before allocations load. **Need the tester to show the open dropdown.**
- **Depends on:** `/api/teacher/dashboard/allocations` returning correct data for this account, and the account actually having allocations for the active academic year (`TeacherPortal.jsx:436–441` filters allocations to the active year and silently drops mismatches).

### A3 · "Needs Support" always 0% for every student; Class Progress all 0% — **CONFIRMED (root-cause)**

- **Where:** `frontend/src/teachers/StudentAnalyticsPortal.jsx:124–127` calls `GET /api/progress/students` and `GET /api/progress/analytics`.
- **Root cause:** `backend/routes/progressRoute.js:57` and `:216` — **both endpoints use `adminAuth`**, not `authTeacher`. A teacher token gets 401/403, so `studentsRes.ok` is false and the component falls into the fallback path (`StudentAnalyticsPortal.jsx:133–154`) which builds students with **`progressMetrics: []` hardcoded**. `analytics` stays `null`.
  - `overallScore()` (`:510`) returns **0** for any student with no metrics → every student scores `< 60` → every student is in `supportStudents` (`:720`) → "30 AT RISK", every row "0%".
  - `progressItems` (`:742–747`) — all four (`Overall class average`, `Attendance rate`, `Assignment completion`, `Test performance`) derive from `analytics` (null) or empty metrics → all **0%**.
- **Fix (pick one):**
  - **(a)** Add teacher-accessible `GET /api/progress/students` + `/analytics` (new `authTeacher` handlers scoped to the teacher's allocations), or split the existing ones to accept either role with role-based scoping.
  - **(b)** Point `StudentAnalyticsPortal`'s Overview tab at the existing `authTeacher` routes under `/api/teacher-analytics/*` and `/api/teacher/dashboard/students`, and compute the metrics there.
- **Effort:** L · **Test:** yes (route auth + scoping; score computation).
- **Note:** even after the auth fix, if the test DB genuinely has no exam results / attendance / submissions, the numbers will legitimately still be low — that part is data, not code.

### A4 · Recent Activity always "No recent activity" — **CONFIRMED (partial implementation)**

- **Where:** `frontend/src/teachers/TeacherDashboard.jsx:248,452` ← `dashboardData.recentActivities` from `GET /api/teacher/dashboard`.
- **Root cause:** `backend/routes/teacherDashboardRoutes.js:363` — `recentActivities` is built **only** from `StudentProgress.submissions` that have a `submittedAt`. The empty-state copy promises "Attendance, assignments, reports, and meetings" but the backend only ever emits assignment submissions. With no submissions in scope → empty.
- **Fix:** Either (a) broaden the backend to merge recent attendance marks, published results, scheduled meetings, and new assignments into one sorted feed, or (b) narrow the empty-state copy to "Student submissions will appear here." (a) matches the product intent.
- **Effort:** M (option a) / S (option b) · **Test:** yes for (a).

### A5 · AI path Subject dropdown only shows Math / Science / English — **CONFIRMED**

- **Where:** `frontend/src/teachers/GenerateAIPathPortal.jsx:476–482` — the `<select>` has **three hardcoded `<option>`s**. The whole portal is a prototype: `blueprints` / `lessons` are hardcoded objects keyed by those subject names, students come from a static list, the pedagogy dropdown is `disabled` with one option, "Draft mode" badge.
- **Fix:** Load subjects from the class's real subject list (`/api/teacher/dashboard/allocations` for the selected class, or a class-subjects endpoint), and drive the path generation off the real curriculum instead of `blueprints`.
- **Effort:** M–L (depends how far to wire it) · **Test:** yes (dropdown population).

### A6 · Achievements → Class dropdown empty ("No class-teacher allocation found") — **CONFIRMED, by design**

- **Where:** `frontend/src/teachers/TeacherAchievements.jsx:247` — `.filter((i) => i?.isClassTeacher === true)`. Only class-teacher allocations feed the dropdown.
- **Root cause:** the test account ("Ananya Sen", Maths) is allocated as a **subject teacher** for 5-A but is **not flagged `isClassTeacher`**. So `classTeacherAllocations` is empty → the error message + empty dropdown.
- **This is a product decision, not necessarily a bug:**
  - If achievements are genuinely class-teacher-only → the fix is **admin config** (mark the account as class teacher for 5-A), and optionally improve the empty-state copy ("You're not set as a class teacher for any class. Ask your admin to assign you.").
  - If subject teachers should also manage achievements → remove/loosen the `isClassTeacher` filter.
- **Same gating likely affects other screens** — search for `isClassTeacher === true` across `frontend/src/teachers/`.

### A7 · Timetable "Busiest Day" wrong (Mon, 3 classes) — **NEEDS LIVE REPRO**

- **Where:** `frontend/src/teachers/ClassRoutine.jsx:453–456` — `busiestDay` = day with the most entries in `effectiveSchedule`.
- **Root cause candidate:** `effectiveSchedule` (`:302`) applies a strict class/section filter, then **falls back to a broader teacher-scoped (or school) schedule** when the strict filter yields nothing (`:303` comment). For a class teacher, "busiest day" may be counting the teacher's periods across *all* sections, or school timetable slots — not the assigned class's timetable. The routine also has a dashboard fallback (`:196–208`) that only populates *today*.
- **Assessment:** plausible but I can't confirm which branch fires without seeing what `GET /api/teacher/dashboard/routine` returns for this account. **Need to inspect the `/routine` response.**

### A8 · "Unread Alerts" always shows 2 — **CONFIRMED**

- **Where:** `frontend/src/teachers/MyWorkPortal.jsx:325–330` — `notifications` is **hardcoded seed state** (4 items, 2 with `read: false`). Never fetched from an API. `unreadNotifications` (`:745`) counts unread seeds → always **2** on load.
- **Also seeded / not wired:** the "Activity Timeline" on the Overview tab ("No check-in recorded yet", "Sick Leave request is Approved", "Travel claim is Approved") is likely the same pattern — verify `activityTimeline` / equivalent source.
- **Fix:** wire `MyWorkPortal` notifications to the real teacher-notifications endpoint (`/api/notifications/user` or the teacher header's source at `TeacherPortal.jsx:1054–1078`), or remove the "Unread Alerts" card until it's real.
- **Effort:** M · **Test:** yes.

### A9 / A10 · Used Leave = 0 and Leave Utilization = 0/30, 0% despite an approved leave — **CONFIRMED (same cause)**

- **Where:** `frontend/src/teachers/MyWorkPortal.jsx:702–712` — `leaveStats.usedDays` sums days **only** where `status === 'approved'` **AND** `type === 'casual leave'` (exact lowercased string). `:1123` `Leave Utilization` = `${leaveStats.usedDays}/${leavePolicy.casualLeaveDays}`. `:973` `Used Leave` = `leaveQuota.casualUsedDays || leaveStats.usedDays`.
- **Root cause:** the tester's approved leave is **"Sick Leave"** (visible in the p.10 screenshot Leave Workflow). It doesn't match `type === 'casual leave'`, so it contributes 0 to `usedDays`. Backend `leaveQuota.casualUsedDays` (`:424`) almost certainly filters the same way.
- **This is a labelling/logic mismatch:** the cards say generic "Used Leave" / "Leave Utilization" but only track *casual* leave. Either:
  - count **all approved leave** toward "Used Leave" / utilization (and keep a separate casual-specific quota card), or
  - relabel the cards "Casual Leave Used" / "Casual Leave Utilization" so a sick leave legitimately doesn't move them.
- **Effort:** S–M · **Test:** yes (leave aggregation).

### A11 · Leave Balance "30 days" vs "0 pending approvals" possibly out of sync — **NEEDS LIVE REPRO / likely fine**

- **Where:** `MyWorkPortal.jsx:835` — `Leave Balance` = `leaveQuota.casualAvailableDays` (from backend), hint = `${leaveStats.pendingRequests} pending approvals` where `pendingRequests` = count of local `leaveData` with `status === 'pending'` (`:706`).
- **Assessment:** "0 pending approvals" is correct if the tester's leave is already *approved* (nothing pending). "30 days balance" not decrementing is the A9/A10 issue (sick leave doesn't reduce the casual quota). Probably **not a separate bug** — folds into A9/A10 once "used leave" logic is decided.

### A12 · Parent complaint shows "Mr. Das" instead of the real guardian name — **CONFIRMED**

- **Where:** `backend/routes/teacherDashboardRoutes.js:271` — `parentName: doc.requestDetails?.parentName || 'Parent'`. The complaint list (`:1627`) reads only the frozen `SupportRequest.requestDetails` snapshot; no student/parent lookup.
- **Root cause:** whatever the parent typed / was stored at submit time ("Mr. Das") is shown forever, even if the guardian's real name is on the student/parent record and has since been corrected.
- **Fix:** in `formatTeacherComplaint` (or the `/complaints` query), resolve the complaint's student → current parent/guardian record and prefer the live name; fall back to `requestDetails.parentName`. Needs the `SupportRequest` to carry a student ref (check the model) — if it only has `requestDetails`, match on `studentName + grade + section` or store `studentId` at submit time.
- **Effort:** M · **Test:** yes.

---

## Group B — Broken interactions

### B13 · "Mark complete" button does nothing — **CONFIRMED**

- **Where:** `frontend/src/teachers/TeacherDashboard.jsx:559` — `<button type="button" className="…">Mark complete</button>` — **no `onClick`**. Pure styling.
- **Fix:** wire it to mark the deadline/task complete. `DeadlineTask` receives `task` (an assignment from `upcomingDeadlines`, `teacherDashboardRoutes.js:536`). Needs a "dismiss/complete task" endpoint or client-side hide + persistence. Simplest honest fix: `PATCH` the assignment / a per-teacher task-completion record, then optimistically remove the card.
- **Effort:** S–M (M if a new endpoint is needed) · **Test:** yes.

### B14 · PTM session-filter dropdown only shows "All Sessions" — **CONFIRMED**

- **Where:** `frontend/src/teachers/ParentMeetings.jsx:349–351` — options come from `listSessionOptions` (`:242`) = `[...new Set(meetings.map(m => m.studentId?.academicYear || m.studentId?.session).filter(Boolean))]`.
- **Root cause:** derived purely from the **loaded meetings**. With one meeting whose `studentId.academicYear` is empty, `.filter(Boolean)` empties the list → only "All Sessions". Note `sessionOptions` (`:157`, from `data.options.sessions` — an actual options payload) **exists but isn't used for this dropdown**.
- **Fix:** feed the session/class/section filters from the server-provided `options` (`sessionOptions` etc.) instead of deriving them from the sparse meeting list.
- **Effort:** S · **Test:** optional (small, obvious).

---

## Group C — UI / layout

### C15 · Attendance page — large empty space, needless scrolling — **NEEDS LIVE REPRO (CSS)**

- **Where:** `frontend/src/teachers/AttendanceManagement.jsx` (root container height / `min-h-screen`).
- **Assessment:** almost certainly a `min-h-screen` / fixed-height wrapper on a page whose content is short (30-student list still leaves a gap in the p.4 screenshot). Fix = drop the forced min-height, let the page flow. Quick once located in a browser.
- **Effort:** S.

### C16 · Observation History cut off / not fully visible — **CONFIRMED (CSS)**

- **Where:** `frontend/src/teachers/StudentObservation.jsx:534` (`max-h-56 overflow-y-auto` — cramped), `:667` (`<p className="text-xs text-gray-600 truncate">{obs.additionalNotes}</p>` — single-line ellipsis on the notes).
- **Root cause:** observation notes are `truncate`d and the history panel is a short fixed-height scroll box with no way to expand an entry. The p.5 screenshot also shows text running past the right edge of its column.
- **Fix:** allow the note to wrap (or `line-clamp-3` + "show more"), give the panel a sensible responsive height, ensure the column has `min-w-0` so text wraps instead of overflowing.
- **Effort:** S.

### C17 / C18 · Notification & profile dropdowns overlap the Profile & Work nav tabs — **PARTIALLY CONFIRMED (CSS)**

- **Where:**
  - `frontend/src/components/NotificationPopover.jsx:86` — popover is `absolute right-0 top-full z-50` with **`bg-white/60 … backdrop-blur-2xl`** (translucent frosted glass).
  - `frontend/src/teachers/MyWorkPortal.jsx:1150` — the "My Work" tab bar is `sticky top-0 z-20 bg-[#f6f8fb]/90 backdrop-blur`.
  - Profile menu: `TeacherPortal.jsx:1510` — `absolute right-0 z-50 … bg-white` (this one is opaque).
- **Root cause (notifications):** a **translucent** popover dropping over the **translucent sticky** tab bar → the tabs bleed through, so it "covers but doesn't hide" them. Z-order is actually correct (50 > 20).
- **Fix:** make `NotificationPopover` opaque (`bg-white` instead of `bg-white/60`), or lower/remove the `sticky` on the MyWork tab bar, or add a solid backdrop layer. Opaque popover is the cleanest.
- **Profile menu (C18):** it's already opaque and `z-50`; "overlap" is a normal dropdown covering content below it. **Need the tester to clarify** whether it's mispositioned (off to the right, clipped) or they just mean "it covers the tabs" (expected).
- **Effort:** S.

### C19 · Calendar view-switcher (Month / Week / Agenda) cut off — **NEEDS LIVE REPRO (CSS)**

- **Where:** the teacher calendar component (Smart Scheduling Workspace). The p.11 screenshot shows "Month | Week | Ag…" clipped.
- **Assessment:** a horizontal overflow / fixed-width toolbar not wrapping on this viewport. Fix = `flex-wrap` / `overflow-x-auto` on the toolbar, or a responsive menu. Quick once located.
- **Effort:** S.

### C21 · Lesson Plan → Assessment → "Quiz" number field auto-shows "0"; negatives allowed — **CONFIRMED**

- **Where:** `frontend/src/teachers/components/lesson-plan-builder/AssessmentCard.jsx:31–37` — `<Input type="number" value={assessment.marks} onChange={e => onChange({ …, marks: Number(e.target.value) || 0 })}>`. No `min`. New assessments are created with `marks: 0`, so the field renders "0" and the `placeholder="Marks"` never shows. Clearing the field snaps back to `0`; typing `-5` is accepted.
- **Fix:** initialise `marks` as `''`; in `onChange` allow empty string and clamp to `>= 0` (`const n = e.target.value === '' ? '' : Math.max(0, Number(e.target.value))`); add `min={0}`. Check the "+ Add Assessment" handler (likely in `DrawerModal.jsx`) for the `marks: 0` seed.
- **Effort:** S · **Test:** optional.

### C22 · Lesson Plan → Tryout → "Mode" (Append / Replace) radios cramped / misaligned — **CONFIRMED**

- **Where:** `frontend/src/teachers/components/lesson-plan-builder/TryoutBuilder.jsx:1410–1422` — the "Mode" field is a bordered box (`flex items-center gap-2 rounded-lg border … px-3 py-2`) holding two inline radio `<label>`s, sitting in a 4-column grid alongside three full-width `<select>`s. In a quarter-width column, "Append" + "Replace" + two radio dots with only `gap-2` collide with the field border.
- **Fix:** give Mode its own row or `col-span-2`, or replace the two radios with a segmented toggle; bump the gap and internal padding.
- **Effort:** S.

---

## Group D — Missing info

### D20 · Academic Alcove — Session / Class / Subject not shown — **CONFIRMED (missing feature)**

- **Where:** `frontend/src/teachers/TeacherAlcove.jsx` — no allocation/session/class/subject scoping in the component at all (no `/api/teacher/dashboard/allocations` call, no session state).
- **Assessment:** this is a **gap**, not a regression — the Alcove was built without teacher-assignment context. The p.12 screenshot shows a generic "All subjects" dropdown.
- **Fix:** add a Session / Class / Subject header (defaulting to the teacher's primary allocation) and scope the discussion feed / "Start Discussion" defaults to it — same pattern the other class screens use.
- **Effort:** M · **Test:** yes.

---

## Proposed sequencing

**Phase 1 — quick wins (S, low risk, mostly CSS):**
C16, C21, C22, B14, and C15/C19 once eyeballed in a browser. Plus the C17 opaque-popover change.

**Phase 2 — the allocation root cause (unblocks A1, A6, A7, D20, and the "current" slug everywhere):**
Resolve `current` → the teacher's primary allocation in `ClassWorkspace` (A1). Decide the `isClassTeacher` gating policy (A6) and apply consistently. Add allocation scoping to the Alcove (D20).

**Phase 3 — the data endpoints:**
A3 (teacher-accessible progress/analytics — the biggest one), A8 (wire MyWork notifications to real data), A9/A10 (leave aggregation — needs the "all leave vs casual only" decision), A12 (resolve live guardian name), A4 (broaden the activity feed), B13 (Mark complete handler + persistence).

**Phase 4 — needs the tester / a product call first:**
A2 (show me the open Class dropdown), A7 (what does `/api/teacher/dashboard/routine` return here), C18 (mispositioned or just covering?), A6 policy, A9/A10 policy.

---

## Open questions for you

1. **A6 / achievements & other `isClassTeacher` screens** — should subject teachers (not class teachers) be able to use Achievements / Observations / etc., or is the fix just to mark the test account as class teacher in admin?
2. **A9/A10 leave** — should "Used Leave" / "Leave Utilization" count *all* approved leave, or stay casual-leave-specific (with relabelled cards)?
3. **A3** — new teacher-scoped progress endpoints, or repoint the Overview tab at the existing `/api/teacher-analytics/*` routes?
4. **A4 / A8** — build the real merged activity feed + wire MyWork notifications, or trim those cards until the data exists?
5. Can the tester grab: the **open** Class dropdown (A2), the **`/api/teacher/dashboard/routine` response** (A7), and clarify the **profile-menu overlap** (C18)?
