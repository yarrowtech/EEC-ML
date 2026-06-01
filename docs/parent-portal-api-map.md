# Detailed Backend API File Map - Parent Portal URLs

Parent portal base URLs:
- `http://localhost:5173/parents`
- `http://localhost:5173/parents/*`
- `http://localhost:5173/parent`
- `http://localhost:5173/parent/*`
- (`/parent/*` is normalized to `/parents/*` by parent router logic in `ParentPortal.jsx`)

Core route host files:
- `frontend/src/App.jsx`
- `frontend/src/parents/ParentPortal.jsx`

---

## Parent portal route inventory
Mounted in frontend:
- `/parents/*` -> `frontend/src/parents/ParentPortal.jsx`
- `/parent/*` -> `frontend/src/parents/ParentPortal.jsx`

Active parent portal pages in `ParentPortal.jsx`:
- `/parents` and `/parent`
- `/parents/holidays` and `/parent/holidays`
- `/parents/routine` and `/parent/routine`
- `/parents/attendance` and `/parent/attendance`
- `/parents/academic` and `/parent/academic`
- `/parents/fees` and `/parent/fees`
- `/parents/health` and `/parent/health`
- `/parents/chat` and `/parent/chat`
- `/parents/complaints` and `/parent/complaints`
- `/parents/ptm` and `/parent/ptm`
- `/parents/parent-observation` and `/parent/parent-observation`
- `/parents/results` and `/parent/results`
- `/parents/achievements` and `/parent/achievements`

Shared parent-shell API used before/around page rendering:
- `GET /api/parent/auth/profile`

Frontend files involved:
- `frontend/src/App.jsx`
- `frontend/src/parents/ParentPortal.jsx`

---

## All parent-facing backend APIs connected to current frontend
Mounted under `backend/index.js`:
- `/api/parent/auth/profile` -> `backend/routes/parentRoute.js`
- `/api/parent/auth/routine` -> `backend/routes/parentRoute.js`
- `/api/parent/auth/complaints` -> `backend/routes/parentRoute.js`
- `/api/parent/auth/achievements` -> `backend/routes/parentRoute.js`
- `/api/attendance/parent/children` -> `backend/routes/attendanceRoutes.js`
- `/api/reports/report-cards/parent` -> `backend/routes/reportRoutes.js`
- `/api/fees/parent/children` -> `backend/routes/feeRoutes.js`
- `/api/fees/parent/invoices` -> `backend/routes/feeRoutes.js`
- `/api/fees/parent/razorpay/order` -> `backend/routes/feeRoutes.js`
- `/api/fees/parent/razorpay/verify` -> `backend/routes/feeRoutes.js`
- `/api/holidays/parent` -> `backend/routes/holidayRoutes.js`
- `/api/chat/me` -> `backend/routes/chatRoutes.js`
- `/api/chat/threads` -> `backend/routes/chatRoutes.js`
- `/api/chat/threads/:threadId/presence` -> `backend/routes/chatRoutes.js`
- `/api/chat/threads/:threadId/messages` -> `backend/routes/chatRoutes.js`
- `/api/chat/threads/direct` -> `backend/routes/chatRoutes.js`
- `/api/chat/contacts` -> `backend/routes/chatRoutes.js`
- `/api/meeting/parent/my-meetings` -> `backend/routes/meetingRoute.js`
- `/api/meeting/parent/confirm/:id` -> `backend/routes/meetingRoute.js`
- `/api/observations/parent` -> `backend/routes/studentObservationRoutes.js`

Parent-related backend APIs present in code but not currently called by mounted parent pages:
- `/api/parent/auth/academics` -> `backend/routes/parentRoute.js`
- `/api/parent/auth/login` -> `backend/routes/parentRoute.js`
- `/api/parent/auth/register` -> `backend/routes/parentRoute.js`
- `/api/parent/auth/reset-first-password` -> `backend/routes/parentRoute.js`
- `/api/chat/parents/:parentId/profile` -> `backend/routes/chatRoutes.js` (teacher-facing helper)
- `/api/chat/keys/me` -> `backend/routes/chatRoutes.js`
- `/api/chat/threads/:threadId/keys` -> `backend/routes/chatRoutes.js`
- `/api/chat/threads/:threadId/seen` -> `backend/routes/chatRoutes.js`

---

## Parent portal logger map
Parent portal requests now use the shared multi-portal logger path in `backend/utils/studentPortalLogger.js`.

Parent portal logging layers:
- `backend/middleware/requestLogger.js`
  - mounted globally in `backend/index.js`
  - attaches `requestId`, `traceId`, and `req.log`
  - emits `http_request_start` and `http_request_complete`
  - emits `security.header_forwarding_suspicious` when proxy headers look suspicious
- `backend/utils/logger.js`
  - shared structured logger used by middleware and route handlers
- `backend/utils/studentPortalLogger.js`
  - now supports both student and parent traffic
  - emits `parent_portal_event` for parent portal activity
  - resolves parent-facing surfaces such as `/parents/fees`, `/parents/chat`, `/parents/ptm`, `/parents/results`
  - can mirror audit/business and security events
- `backend/utils/authEventLogger.js`
  - now emits `auth_event` for `/api/parent/auth/*` endpoints
- `backend/utils/securityEventLogger.js`
  - used by `requestLogger`, `rateLimit`, failed auth logging, and security-mirror logging
- `backend/middleware/rateLimit.js`
  - used on parent auth routes such as login and first-password reset
  - emits `security.rate_limit_triggered`

### What now logs for parent portal traffic
For nearly every parent API request:
- `http_request_start`
- `http_request_complete`
- request/trace correlation via `requestId` and `traceId`
- suspicious forwarded-header security events when triggered

For parent-auth flows:
- `auth_event`
- `security.auth_failure_detected` on failed login attempts
- `security.rate_limit_triggered` on throttled requests

For parent portal business flows:
- `parent_portal_event`
- mirrored business/audit logs for audit-category actions
- mirrored security logs when security-category or mirrored security logging is used

### Parent portal endpoint logger coverage
`GET /api/parent/auth/profile`
- Generic request logs: yes, through `requestLogger`
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/parentRoute.js`

`GET /api/parent/auth/routine`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/parentRoute.js`

`GET /api/parent/auth/complaints`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/parentRoute.js`

`POST /api/parent/auth/complaints`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Complaint document also stores an internal `auditTrail`
- File: `backend/routes/parentRoute.js`

`GET /api/parent/auth/achievements`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/parentRoute.js`

`GET /api/attendance/parent/children`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/attendanceRoutes.js`

`GET /api/reports/report-cards/parent`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/reportRoutes.js`

`GET /api/holidays/parent`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/holidayRoutes.js`

`GET /api/fees/parent/children`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/feeRoutes.js`

`GET /api/fees/parent/invoices`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/feeRoutes.js`

`POST /api/fees/parent/razorpay/order`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/feeRoutes.js`

`POST /api/fees/parent/razorpay/verify`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/feeRoutes.js`

`GET /api/chat/me`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Emitted through the shared multi-portal logger path
- File: `backend/routes/chatRoutes.js`

`GET /api/chat/threads`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Emitted through the shared multi-portal logger path
- File: `backend/routes/chatRoutes.js`

`GET /api/chat/threads/:threadId/presence`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Emitted through the shared multi-portal logger path
- File: `backend/routes/chatRoutes.js`

`GET /api/chat/threads/:threadId/messages`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Emitted through the shared multi-portal logger path
- File: `backend/routes/chatRoutes.js`

`POST /api/chat/threads/direct`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Emitted through the shared multi-portal logger path
- File: `backend/routes/chatRoutes.js`

`GET /api/chat/contacts`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Emitted through the shared multi-portal logger path
- File: `backend/routes/chatRoutes.js`

`POST /api/chat/threads/:threadId/messages`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- Emitted through the shared multi-portal logger path
- File: `backend/routes/chatRoutes.js`

`GET /api/meeting/parent/my-meetings`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/meetingRoute.js`

`PUT /api/meeting/parent/confirm/:id`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/meetingRoute.js`

`GET /api/observations/parent`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/studentObservationRoutes.js`

`POST /api/observations/parent`
- Generic request logs: yes
- Route-level structured parent/business/audit log: yes
- File: `backend/routes/studentObservationRoutes.js`

### Parent auth logger coverage
`POST /api/parent/auth/register`
- Calls `logAuthEvent(...)` in `backend/routes/parentRoute.js`
- Actual emitted `auth_event`: yes
- Generic request logs: yes

`POST /api/parent/auth/login`
- Calls `logAuthEvent(...)`
- Actual emitted `auth_event`: yes
- Rate limit security logging: yes, through `backend/middleware/rateLimit.js`
- Generic request logs: yes

`POST /api/parent/auth/reset-first-password`
- Calls `logAuthEvent(...)`
- Actual emitted `auth_event`: yes
- Rate limit security logging: yes
- Generic request logs: yes

### Remaining logging notes
- Some parent routes still keep `console.error` or `console.warn` statements alongside structured logging.
- The shared helper still lives in `backend/utils/studentPortalLogger.js`; functionally it now behaves as a multi-portal logger even though the filename is student-oriented.

---

## URL: http://localhost:5173/parents (Home / Dashboard)
## URL: http://localhost:5173/parent
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this flow:
- `/api/attendance` -> `backend/routes/attendanceRoutes.js`
- `/api/meeting` -> `backend/routes/meetingRoute.js`
- `/api/parent/auth` -> `backend/routes/parentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`  
`frontend/src/components/ProtectedRoute.jsx` (frontend role gate)

3. Route endpoint handlers used by this page  
`backend/routes/attendanceRoutes.js`  
`backend/routes/meetingRoute.js`  
`backend/routes/parentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`  
`backend/models/ParentMeeting.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`  
`backend/scripts/productionSecurityAttackSuite.js`

Endpoints directly connected:
- `GET /api/attendance/parent/children`
- `GET /api/meeting/parent/my-meetings`
- `GET /api/parent/auth/profile`

Frontend file:
- `frontend/src/parents/ParentDashboard.jsx`

---

## URL: http://localhost:5173/parents/holidays
## URL: http://localhost:5173/parent/holidays
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/holidays` -> `backend/routes/holidayRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/holidayRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/Holiday.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/holidays/parent`

Frontend file:
- `frontend/src/parents/HolidayList.jsx`

---

## URL: http://localhost:5173/parents/routine
## URL: http://localhost:5173/parent/routine
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/parent/auth` -> `backend/routes/parentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/parentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`  
`backend/models/Class.js`  
`backend/models/Section.js`  
`backend/models/Timetable.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/parent/auth/routine`

Frontend file:
- `frontend/src/parents/ClassRoutine.jsx`

---

## URL: http://localhost:5173/parents/attendance
## URL: http://localhost:5173/parent/attendance
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/attendance` -> `backend/routes/attendanceRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/attendanceRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/attendance/parent/children?studentId=...&from=...&to=...` (query params used by frontend filter flow)

Frontend file:
- `frontend/src/parents/AttendanceReport.jsx`

---

## URL: http://localhost:5173/parents/academic
## URL: http://localhost:5173/parent/academic
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/reports` -> `backend/routes/reportRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/reportRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`  
`backend/models/ReportCardTemplate.js`  
`backend/models/ExamGroup.js`  
`backend/models/Exam.js`  
`backend/models/ExamResult.js`  
`backend/models/Class.js`  
`backend/models/Section.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/reports/report-cards/parent`

Frontend file:
- `frontend/src/parents/AcademicReport.jsx`

---

## URL: http://localhost:5173/parents/fees
## URL: http://localhost:5173/parent/fees
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/fees` -> `backend/routes/feeRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/feeRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`  
`backend/models/FeeInvoice.js`  
`backend/models/FeePayment.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/fees/parent/children`
- `GET /api/fees/parent/invoices?studentId=...`
- `POST /api/fees/parent/razorpay/order`
- `POST /api/fees/parent/razorpay/verify`

Frontend file:
- `frontend/src/parents/FeesPayment.jsx`

---

## URL: http://localhost:5173/parents/health
## URL: http://localhost:5173/parent/health
1. Entry server + route mounts  
No backend API used directly by this route in current implementation.

2. Auth + access control middleware  
Frontend protected route only: `ProtectedRoute` (Parent role)

3. Route endpoint handlers used by this page  
No direct backend route handler call.

4. Global request correlation/logging  
Not applicable (no direct request from this page component).

5. Structured logger implementation (Pino)  
Not directly used by this page.

6. Database models used by these APIs  
Not applicable.

7. API docs mapping (reference)  
Not applicable.

8. Verification / simulation layer (current files in repo)  
Not applicable.

Frontend file:
- `frontend/src/parents/HealthReport.jsx`

---

## URL: http://localhost:5173/parents/chat
## URL: http://localhost:5173/parent/chat
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/chat` -> `backend/routes/chatRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authAnyUser.js` (inside chat route stack)

3. Route endpoint handlers used by this page  
`backend/routes/chatRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ChatThread.js`  
`backend/models/ChatMessage.js`  
`backend/models/ChatKey.js`  
`backend/models/ParentUser.js`  
`backend/models/TeacherUser.js`  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/chat/me`
- `GET /api/chat/threads`
- `GET /api/chat/threads/:threadId/presence`
- `GET /api/chat/threads/:threadId/messages`
- `POST /api/chat/threads/direct`
- `GET /api/chat/contacts`
- `POST /api/chat/threads/:threadId/messages`

Frontend file:
- `frontend/src/parents/ParentChat.jsx`

---

## URL: http://localhost:5173/parents/complaints
## URL: http://localhost:5173/parent/complaints
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/parent/auth` -> `backend/routes/parentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/parentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`  
`backend/models/SupportRequest.js`  
`backend/models/Admin.js`  
`backend/models/Class.js`  
`backend/models/Section.js`  
`backend/models/TeacherAllocation.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/parent/auth/complaints`
- `POST /api/parent/auth/complaints`

Frontend file:
- `frontend/src/parents/ComplaintManagementSystem.jsx`

---

## URL: http://localhost:5173/parents/ptm
## URL: http://localhost:5173/parent/ptm
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/meeting` -> `backend/routes/meetingRoute.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/meetingRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentMeeting.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/meeting/parent/my-meetings`
- `PUT /api/meeting/parent/confirm/:id`

Frontend file:
- `frontend/src/parents/PTMPortal.jsx`

---

## URL: http://localhost:5173/parents/parent-observation
## URL: http://localhost:5173/parent/parent-observation
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this page:
- `/api/attendance` -> `backend/routes/attendanceRoutes.js`
- `/api/observations` -> `backend/routes/studentObservationRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/attendanceRoutes.js`  
`backend/routes/studentObservationRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`  
`backend/models/StudentObservation.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/attendance/parent/children`
- `GET /api/observations/parent`
- `POST /api/observations/parent`

Frontend file:
- `frontend/src/parents/ParentObservationNonAcademic.jsx`

---

## URL: http://localhost:5173/parents/results
## URL: http://localhost:5173/parent/results
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/reports` -> `backend/routes/reportRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/reportRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`  
`backend/models/ReportCardTemplate.js`  
`backend/models/ExamGroup.js`  
`backend/models/Exam.js`  
`backend/models/ExamResult.js`  
`backend/models/Class.js`  
`backend/models/Section.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/reports/report-cards/parent`

Frontend file:
- `frontend/src/parents/ResultsView.jsx`

---

## URL: http://localhost:5173/parents/achievements
## URL: http://localhost:5173/parent/achievements
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/parent/auth` -> `backend/routes/parentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authParent.js`

3. Route endpoint handlers used by this page  
`backend/routes/parentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ParentUser.js`  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/parent/auth/achievements`

Frontend file:
- `frontend/src/parents/AchievementsView.jsx`

---

## Parent routes present in code but not mounted in current parent portal sidebar
- `GET /api/parent/auth/academics`
  Route file: `backend/routes/parentRoute.js`
  Note: current parent frontend uses `GET /api/reports/report-cards/parent` for both academic and results pages instead.

- `frontend/src/parents/CoursesView.jsx`
  Current behavior: loads child names from `GET /api/parent/auth/profile`
  Note: this component is not mounted in `ParentPortal.jsx` right now, so `/parents/ai-learning` style routes are not active for parents in current routing.

- Parent auth utility endpoints:
  - `POST /api/parent/auth/login`
  - `POST /api/parent/auth/register`
  - `POST /api/parent/auth/reset-first-password`
  Note: these are parent-related backend APIs but they are not part of the authenticated parent-portal sidebar surfaces.

---

## Parent routes with no direct API calls in current frontend implementation
- `http://localhost:5173/parents/health`

Mapped frontend files:
- `frontend/src/parents/HealthReport.jsx`

---

## Global parent-portal cross-cutting backend files
These files are part of nearly every parent request flow:
- `backend/index.js` (mounts)
- `backend/middleware/requestLogger.js` (requestId/traceId/start-end logging)
- `backend/utils/logger.js` (Pino logger)
- `backend/middleware/rateLimit.js` (used in parent auth login/reset endpoints)
- `backend/middleware/authParent.js` (parent token auth)

---

## Notes
- Parent portal routes are mounted in the frontend under both `/parents/*` and `/parent/*`.
- Endpoint mapping is based on current frontend calls in `frontend/src/parents/*` and backend mounts in `backend/index.js`.
- `backend/swagger.js` and `backend/swagger-output.json` are referenced in backend flow but are not present in this workspace currently.
- Parent login, registration, first-password reset, and standalone complaint public route are excluded here intentionally because this file focuses on authenticated parent-portal surfaces.
