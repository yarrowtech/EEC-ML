# Notices vs Notifications — Communication Architecture

## 1. Concepts

| | **Notice** (`kind: 'notice'`) | **Notification** (`kind: 'notification'`) |
|---|---|---|
| Purpose | Official, persistent school communication | Short, actionable, targeted alert |
| Examples | Exam scheduled, routine published, holiday, results published, admin circulars, class notes | "Your exam routine was updated", "Exam duty assigned", "Payment received", "Promoted" |
| Where shown | Notices pages (student Notice Board, parent Notices, teacher Notices tab, admin Notice Management) | Bell / Notifications pages |
| Web push | No | Yes |
| Wording | Neutral, class-level | Per role (student / parent / teacher) |

Both live in the existing `notifications` collection, separated by `kind`.

## 2. Pipeline

```
ADMIN ACTION ─► EVENT (EVENTS.*) ─► TARGETING ENGINE ─► NOTICE and/or NOTIFICATIONS ─► role views
                                     class/section → active students → linked parents (ParentUser.childrenIds)
                                     exam duty      → that teacher
                                     studentIds     → those students (+ parents)
```

- `services/communicationService.js` — `EVENTS`, `resolveAudience()`, `notify()` (per-role copies), `broadcast()` (one school-wide alert), `publishNotice()`, `fingerprint()`.
- `services/examCommunication.js` — exam created, routine published/updated, results.
- `services/schoolCommunication.js` — holidays, fee invoices, fee payments, promotions.
- Notifications reference the source (`relatedEntity.entityType/entityId`); large data is not copied.

## 3. Files

**New**
- `backend/services/communicationService.js`
- `backend/services/examCommunication.js`
- `backend/services/schoolCommunication.js`
- `backend/scripts/migrateNotificationKinds.js`
- `frontend/src/parents/ParentNotices.jsx`
- `docs/COMMUNICATION_ARCHITECTURE.md`

**Changed — backend**
- `models/Notification.js` — `kind`, `eventType`, `targetRole`, categories (general/academic/exam/events/fee/transport), new entity types, `{schoolId, kind, createdAt}` index, no push for notices.
- `routes/notificationRoutes.js` — `?kind=` filter on `GET /user`, `POST /user/read-all`, `GET /user/unread-count`; admin list = notices only; admin notice / teacher class note → notice + one companion alert.
- `routes/examRoute.js` — exam created / routine / duty through the engine; removed teacher-wide "routine published" and "exam scheduled" copies.
- `utils/notificationService.js` — class notices marked `kind: notice`; results and standalone exams trigger student/parent alerts; assignment alert scoped to the class.
- `routes/holidayRoutes.js`, `routes/feeRoutes.js`, `services/paymentLifecycleService.js`, `routes/promotionRoutes.js` — engine hooks.
- `package.json` — `notifications:migrate-kinds` script.

**Changed — frontend**
- Bells request `?kind=notification`: `admin/useAdminNotifications.js`, `hooks/useNotifications.js` (student), `parents/ParentPortal.jsx`, `teachers/TeacherPortal.jsx` (header), `teachers/MyWorkPortal.jsx`.
- Student Notice Board requests `?kind=notice` (`components/NoticeBoard.jsx`).
- Teacher Notifications page: Notifications / Notices switch.
- Parent portal: new **Notices** page (`/parents/notices`).

## 4. APIs

| Endpoint | Change |
|---|---|
| `GET /api/notifications/user?kind=notice\|notification` | Filters by kind (omit = both, backwards compatible) |
| `POST /api/notifications/user/read-all?kind=…` | Marks only that kind read |
| `GET /api/notifications/user/unread-count?kind=…` | Count per kind |
| `GET /api/notifications` (admin) | Notices only |
| `POST /api/notifications` (admin) | Creates notice + one NOTICE_PUBLISHED alert |

No new routes; exam, fee, holiday and promotion endpoints are unchanged — they now emit events.

## 5. Example flows

**Exam**
1. Admin creates exam group for Class 5-A → notice "Exam Scheduled: Term 1" (class 5-A) + students: "New Examination Scheduled…" + each parent: "…scheduled for Rahul (Class 5, Section A)".
2. Admin publishes routine → routine notice (with table) + students/parents "Exam Routine Published". Each invigilator: "Exam Duty Assigned: Term 1" (only their slots).
3. Admin changes a date and republishes → students/parents "Exam Routine Updated"; only teachers whose slots changed get "Exam Duty Changed". Republishing unchanged → nothing.
4. Results published → notice + "Your Term 1 results have been published" / "Rahul's Term 1 results…".

**Holiday** — create → notice "Holiday: Diwali" + one alert "Holiday Declared"; edit dates → notice updated + "Holiday Updated"; edit with no change → silent; delete → notice removed + "Holiday Cancelled".

**Fee** — invoice issued (single or bulk) → student + parents "New Fee Invoice … Due by …" (bulk: only newly invoiced students). Payment (admin, Razorpay callback or webhook) → "Payment of ₹X received for Rahul. Receipt No … Remaining balance …", once per receipt.

**Promotion** — students "Congratulations! You have been promoted to Class 6, Section A…", parents "Rahul has been promoted…".

## 6. Duplicate prevention

- Every engine record has `dedupeKey = EVENT:school:entityType:entityId:fingerprint:role:scope` with a **unique sparse index**. A repeat with identical data finds the key and is skipped; a concurrent race hits `E11000` and is also skipped.
- `fingerprint` = sha1 of only the data that matters (e.g. routine rows without rooms). Changed data → new key → an **Updated** alert; unchanged → nothing.
- Routine: compares against the latest PUBLISHED/UPDATED key for that exam group.
- Duty: compares the teacher's slot set before/after the atomic merge; unchanged → no push, stays read.
- Payments: keyed per receipt, so webhook + callback produce one alert.
- Holiday notice: one per holiday (`holiday-notice:<school>:<id>`), updated in place.
- Push only fires for newly created notifications (model `post('save')`), never for notices.

## 7. Migration

```bash
cd backend
npm run notifications:migrate-kinds            # dry run
npm run notifications:migrate-kinds -- --apply # write
```
Sets `kind` on records without one (notices: admin/super-admin posts, class notes, exam class/teacher notices, broadcasts, achievements; everything else → notification). Idempotent; revert with `db.notifications.updateMany({}, { $unset: { kind: '' } })`. Already applied on the dev database (447 notices / 5,421 notifications).

## 8. Deployment checklist

1. Deploy backend + frontend together (bells send `?kind=`; older backends ignore it harmlessly).
2. Run the migration with `--apply` on production.
3. Set `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY` in production.
4. Restart the backend.
