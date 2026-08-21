# Detailed Backend API File Map - Student Portal URLs

Student portal base URLs:
- `http://localhost:5173/student`
- `http://localhost:5173/student/*`
- (`/dashboard/*` is redirected to `/student/*` by frontend router logic)

Core route host files:
- `frontend/src/App.jsx`
- `frontend/src/components/Dashboard.jsx`

## Recently verified student surfaces

The student portal now has documented, authenticated routes for assignments/results, fees, health, wellbeing, complaints, and student-specific PTM visibility. Sensitive records are scoped by the authenticated student and school/campus; parent-only meeting actions remain on parent routes.

---

## URL: http://localhost:5173/student (Home / Dashboard)
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this flow:
- `/api/student/auth` -> `backend/routes/studentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js` (used inside student auth routes)  
`frontend/src/components/ProtectedRoute.jsx` (frontend role gate)

3. Route endpoint handlers used by this page  
`backend/routes/studentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/StudentUser.js`  
`backend/models/School.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`  
`backend/scripts/productionSecurityAttackSuite.js`

Endpoints directly connected:
- `GET /api/student/auth/dashboard` (via `StudentDashboardContext`)
- `GET /api/student/auth/class-teacher` (via `StudentDashboardContext`)

Frontend files using these:
- `frontend/src/components/StudentDashboardContext.jsx`
- `frontend/src/components/DashboardHome.jsx`

---

## URL: http://localhost:5173/student/attendance
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this page:
- `/api/student/auth` -> `backend/routes/studentRoute.js`
- `/api/notifications` -> `backend/routes/notificationRoutes.js`
- `/api/lesson-plans` -> `backend/routes/lessonPlanRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`  
`backend/middleware/authAnyUser.js` (notifications user endpoints)

3. Route endpoint handlers used by this page  
`backend/routes/studentRoute.js`  
`backend/routes/notificationRoutes.js`  
`backend/routes/lessonPlanRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/StudentUser.js`  
`backend/models/Notification.js`  
`backend/models/LessonPlanCompletion.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/auth/attendance`
- `GET /api/notifications/user`
- `GET /api/lesson-plans/student/status?fromDate=...&toDate=...`

Frontend file:
- `frontend/src/components/AttendanceView.jsx`

---

## URL: http://localhost:5173/student/routine
## URL: http://localhost:5173/student/schedule
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this page:
- `/api/student/auth` -> `backend/routes/studentRoute.js`
- `/api/timetable` -> `backend/routes/timetableRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`  
`backend/middleware/adminAuth.js` (timetable route currently admin-scoped)

3. Route endpoint handlers used by this page  
`backend/routes/studentRoute.js`  
`backend/routes/timetableRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/Timetable.js`  
`backend/models/StudentUser.js`  
`backend/models/Class.js`  
`backend/models/Section.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/auth/schedule` (primary)
- `GET /api/student/dashboard/routine` (fallback attempted by frontend)
- `GET /api/student/routine` (fallback attempted by frontend)
- `GET /api/timetable?...` (fallback attempted by frontend)

Important implementation note:
- `backend/routes/student.js` does **not** currently expose `/api/student/dashboard/routine` or `/api/student/routine`.
- `GET /api/timetable` is mounted but route auth is admin-scoped in `backend/routes/timetableRoutes.js`.

Frontend file:
- `frontend/src/components/RoutineView.jsx`

---

## URL: http://localhost:5173/student/assignments
## URL: http://localhost:5173/student/assignments-journal
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this page:
- `/api/student/auth` -> `backend/routes/studentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/studentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/StudentJournalEntry.js`  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/auth/journal`
- `POST /api/student/auth/journal`
- `PUT /api/student/auth/journal/:id`
- `DELETE /api/student/auth/journal/:id`

Frontend file:
- `frontend/src/components/AssignmentView.jsx`

---

## URL: http://localhost:5173/student/assignments-academic-alcove
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/alcove` -> `backend/routes/alcoveRoute.js`

2. Auth + access control middleware  
`backend/middleware/authAnyUser.js`  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/alcoveRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/AlcovePost.js`  
`backend/models/AlcoveComment.js`  
`backend/models/AlcoveSubmission.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/alcove/posts`
- `GET /api/alcove/posts/:id/comments`
- `POST /api/alcove/posts/:id/comments`
- `GET /api/alcove/posts/:postId/submissions`
- `POST /api/alcove/posts/:postId/submissions`
- `GET /api/alcove/posts/:postId/my-submission`

Frontend file:
- `frontend/src/components/AcademicAlcove.jsx`

---

## URL: http://localhost:5173/student/results
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/reports` -> `backend/routes/reportRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/reportRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ReportCardTemplate.js`  
`backend/models/ExamResult.js`  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/reports/report-cards/me`

Frontend file:
- `frontend/src/components/ResultsView.jsx`

---

## URL: http://localhost:5173/student/holidays
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/holidays` -> `backend/routes/holidayRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

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
- `GET /api/holidays/student`

Frontend file:
- `frontend/src/components/HolidayListView.jsx`

---

## URL: http://localhost:5173/student/noticeboard
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this page:
- `/api/notifications` -> `backend/routes/notificationRoutes.js`
- `/api/student/auth` -> `backend/routes/studentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authAnyUser.js`  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/notificationRoutes.js`  
`backend/routes/studentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/Notification.js`  
`backend/models/TeacherUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/notifications/user`
- `GET /api/student/auth/class-teacher`

Frontend file:
- `frontend/src/components/NoticeBoard.jsx`

---

## URL: http://localhost:5173/student/teacherfeedback
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/student/auth` -> `backend/routes/studentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/studentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/TeacherFeedback.js`  
`backend/models/StudentUser.js`  
`backend/models/TeacherUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/auth/teacher-feedback/context`
- `GET /api/student/auth/teacher-feedback`
- `POST /api/student/auth/teacher-feedback`

Frontend file:
- `frontend/src/components/TeacherFeedback.jsx`

---

## URL: http://localhost:5173/student/chat
## URL: http://localhost:5173/student/communication
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
`backend/models/StudentUser.js`  
`backend/models/ParentUser.js`

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

Frontend files:
- `frontend/src/components/StudentChat.jsx`
- `frontend/src/components/MobileBottomNav.jsx` (thread count/preview fetch)

---

## URL: http://localhost:5173/student/excuse-letter
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this page:
- `/api/excuse-letters` -> `backend/routes/excuseLetterRoutes.js`
- `/api/student/auth` -> `backend/routes/studentRoute.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/excuseLetterRoutes.js`  
`backend/routes/studentRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/ExcuseLetter.js`  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/auth/profile`
- `GET /api/student/auth/dashboard`
- `GET /api/excuse-letters/student`
- `POST /api/excuse-letters/student`

Frontend file:
- `frontend/src/components/ExcuseLetter.jsx`

---

## URL: http://localhost:5173/student/fees
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/fees` -> `backend/routes/feeRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/feeRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/FeeInvoice.js`  
`backend/models/FeePayment.js`  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/fees/student/invoices`
- `POST /api/fees/:id/pay`
- `POST /api/fees/payments/razorpay/verify`

Frontend file:
- `frontend/src/components/StudentFees.jsx`

---

## URLs: student health, wellbeing, complaints, and meetings

Frontend URLs:
- `http://localhost:5173/student/health`
- `http://localhost:5173/student/wellness`
- `http://localhost:5173/student/wellbeing`
- `http://localhost:5173/student/complaints`
- `http://localhost:5173/student/meetings`

Mounted APIs and handlers:
- `/api/student/auth` -> `backend/routes/studentRoute.js`
- `/api/meeting` -> `backend/routes/meetingRoute.js`

All endpoints use `backend/middleware/authStudent.js` and scope reads to the authenticated student and school/campus:
- `GET /api/student/auth/health`
- `GET /api/student/auth/wellbeing`
- `GET /api/student/auth/complaints`
- `POST /api/student/auth/complaints`
- `GET /api/meeting/student/my-meetings`

Database models:
- `backend/models/StudentUser.js`
- `backend/models/StudentObservation.js`
- `backend/models/Wellbeing.js`
- `backend/models/SupportRequest.js`
- `backend/models/ParentMeeting.js`

Frontend files:
- `frontend/src/components/StudentHealthReport.jsx`
- `frontend/src/components/StudentWellbeing.jsx`
- `frontend/src/components/StudentComplaints.jsx`
- `frontend/src/components/StudentMeetings.jsx`

Student meeting access is read-only. Parent confirmation remains on the parent-authenticated meeting endpoints.

---

## URL: http://localhost:5173/student/profile
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this page:
- `/api/student/auth` -> `backend/routes/studentRoute.js`
- `/api/student` -> `backend/routes/student.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/studentRoute.js`  
`backend/routes/student.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/StudentUser.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/auth/profile`
- `POST /api/student/profile/update`

Frontend file:
- `frontend/src/components/ProfileUpdate.jsx`

---

## URL: http://localhost:5173/student/ai-learning
## URL: http://localhost:5173/student/ai-learning-tutor
## URL: http://localhost:5173/student/ai-learning-courses
1. Entry server + route mounts  
`backend/index.js`  
Mounted APIs used by this flow:
- `/api/student/auth` -> `backend/routes/studentRoute.js` (course card/home context calls)
- `/api/student-ai-learning` -> `backend/routes/studentAILearningRoute.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this flow  
`backend/routes/studentRoute.js`  
`backend/routes/studentAILearningRoute.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/StudentUser.js`  
`backend/models/StudentProgress.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/auth/dashboard` (CoursesView cards)
- `POST /api/student-ai-learning/generate-content`
- `POST /api/student-ai-learning/activity`

Frontend files:
- `frontend/src/components/CoursesView.jsx`
- `frontend/src/components/AIQuizGenerator.jsx`
- `frontend/src/components/AISummaryGenerator.jsx`
- `frontend/src/components/MindMapGenerator.jsx`
- `frontend/src/components/FlashcardGenerator.jsx`

---

## URL: http://localhost:5173/student/tryouts
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/student` -> `backend/routes/student.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/student.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/StudentUser.js`  
`backend/models/TeacherAllocation.js`  
`backend/models/Subject.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/student/allocated-subjects`

Frontend file:
- `frontend/src/components/AdventureTryouts.jsx`

---

## URL: http://localhost:5173/student/lesson-plan-status
1. Entry server + route mounts  
`backend/index.js`  
Mounted API used by this page:
- `/api/lesson-plans` -> `backend/routes/lessonPlanRoutes.js`

2. Auth + access control middleware  
`backend/middleware/authStudent.js`

3. Route endpoint handlers used by this page  
`backend/routes/lessonPlanRoutes.js`

4. Global request correlation/logging  
`backend/middleware/requestLogger.js`

5. Structured logger implementation (Pino)  
`backend/utils/logger.js`

6. Database models used by these APIs  
`backend/models/LessonPlan.js`  
`backend/models/LessonPlanCompletion.js`

7. API docs mapping (reference)  
`backend/swagger.js` (expected by script, currently not present)  
`backend/swagger-output.json` (loaded when present, currently not present)

8. Verification / simulation layer (current files in repo)  
`backend/scripts/validateRuntimeLogs.js`

Endpoints directly connected:
- `GET /api/lesson-plans/student/status`

Frontend file:
- `frontend/src/components/LessonPlanStatusView.jsx`

---

## URL: http://localhost:5173/student/games
## URL: http://localhost:5173/student/games/:gameKey
1. Entry server + route mounts  
No backend API used directly by these routes in current implementation.

2. Auth + access control middleware  
Frontend protected route only: `ProtectedRoute` (Student role)

3. Route endpoint handlers used by this page  
No direct backend route handler call.

4. Global request correlation/logging  
Not applicable (no direct request from this page component).

5. Structured logger implementation (Pino)  
Not directly used by this page.

6. Database models used by these APIs  
Not applicable (no direct API).

7. API docs mapping (reference)  
Not applicable.

8. Verification / simulation layer (current files in repo)  
Not applicable.

Frontend file:
- `frontend/src/games/GamesPage.jsx`

---

## Student routes with no direct API calls in current frontend implementation
- `http://localhost:5173/student/achievements`
- `http://localhost:5173/student/themecustomizer`

Mapped frontend files:
- `frontend/src/components/AchievementsView.jsx`
- `frontend/src/components/ThemeCustomizer.jsx`

---

## Global student-portal cross-cutting backend files
These files are part of nearly every student request flow:
- `backend/index.js` (mounts)
- `backend/middleware/requestLogger.js` (requestId/traceId/start-end logging)
- `backend/utils/logger.js` (Pino logger)
- `backend/middleware/rateLimit.js` (used in student auth login/reset endpoints)
- `backend/middleware/authStudent.js` (student token auth)

---

## Notes
- Super-admin, school-admin, parent, and teacher portals are excluded here intentionally.
- Endpoint mapping is based on current frontend calls in `frontend/src/components/*` and backend mounts in `backend/index.js`.
- `backend/swagger.js` and `backend/swagger-output.json` are referenced in backend flow but are not present in this workspace currently.
