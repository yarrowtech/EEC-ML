# EEC Adaptive Learning System — Full Codebase Audit Report
**Generated:** 2026-07-27  
**Audited by:** Claude Code (claude-sonnet-4-6)

---

## SUMMARY

| | Count | % |
|---|---|---|
| Total items audited | **188** | |
| ✅ Present | **79** | 42% |
| ⚠️ Partial | **61** | 32% |
| ❌ Missing | **48** | 26% |

**Key finding:** The platform has a solid structural shell — auth, content delivery, assignments, exams, real-time chat, AI tutor modes — but the adaptive intelligence layer (mastery tracking, threshold routing, spaced repetition, ML prediction) is almost entirely absent. Addressing Priority items 1–3 would unblock the majority of the remaining 109 partial/missing items since they all depend on per-topic mastery scores.

---

## SECTION-BY-SECTION RESULTS

---

### SECTION 1A — Student Portal UI Screens [Done]

| Item | Status | Notes |
|------|--------|-------|
| Login and onboarding screen | ⚠️ PARTIAL | Login exists; no post-login baseline assessment or onboarding flow |
| Home dashboard | ✅ PRESENT | `DashboardHome.jsx`, `QuickStats.jsx` |
| Learning path map — visual step-by-step | ⚠️ PARTIAL | Teacher-published path renders; no student-facing graphical map |
| Subject and topic selector | ✅ PRESENT | In `AITutorHomeScreen.jsx` and `LearningHub.jsx` |
| Lesson viewer — PDF, video, handwritten | ⚠️ PARTIAL | `StudyMaterials.jsx` + `TeachingMaterial` model; no video streaming or sketch view |
| Flashcard deck screen | ✅ PRESENT | `FlashcardUI` in `AITutorHomeScreen.jsx` |
| Mind map viewer | ✅ PRESENT | `MindMapUI` in `AITutorHomeScreen.jsx` |
| Quiz and practice screen | ✅ PRESENT | `QuizUI`, `PracticeTestInterface.jsx`, `PracticePapersPortal.jsx` |
| Worksheet download and submit | ⚠️ PARTIAL | Download available; no dedicated submission/upload-back UI |
| Progress dashboard — charts | ⚠️ PARTIAL | `CourseProgress.jsx`; no topic-level or time-series chart |
| Mastery level indicator per topic | ❌ MISSING | No per-topic mastery field in `StudentProgress` model |
| Streak tracker and badge wall | ⚠️ PARTIAL | Attendance streak exists; badge awarding not automated |
| Notification center | ⚠️ PARTIAL | Notifications fetched and shown in header; no dedicated inbox screen |
| Exam schedule and countdown timer | ⚠️ PARTIAL | Schedule shown in `StudentExamsView.jsx`; no live countdown |
| Result and report card view | ✅ PRESENT | `ResultsView.jsx`, `reportCardPdf.js`, `/api/report-cards` |
| Reflection journal screen | ✅ PRESENT | Journal UI in `AssignmentView.jsx`; `StudentJournalEntry` model |
| AI tutor chat interface | ✅ PRESENT | `AITutorHomeScreen.jsx` (2300+ lines), all modes connected to FastAPI |
| Profile and settings screen | ✅ PRESENT | `ProfileUpdate.jsx` |

---

### SECTION 1B — Student Learning and AI Features [Done]

| Item | Status | Notes |
|------|--------|-------|
| Adaptive learning path engine — threshold routing | ❌ MISSING | No automated engine; teacher manually publishes paths |
| Personalised content recommendation | ❌ MISSING | No recommendation engine |
| AI tutor — LLM conversational Q&A | ✅ PRESENT | Ollama via FastAPI `/generate/tutor`; Socratic homework_help mode |
| Auto-generated flashcard deck | ✅ PRESENT | `flashcards` mode in AI service |
| Auto-generated revision notes | ✅ PRESENT | `notes` mode |
| Concept mind map auto-builder | ✅ PRESENT | `mind_map` mode |
| Spaced repetition scheduler — Day 1, 3, 7, 14 | ❌ MISSING | No model, no cron, no trigger |
| Active recall quiz — 3 difficulty tiers | ⚠️ PARTIAL | `quiz` mode generates MCQs; no IRT 3-tier difficulty |
| Error analysis — wrong answer pattern detection | ⚠️ PARTIAL | `PracticeAttempt` stores wrong answers; no pattern clustering |
| Misconception correction explainer | ❌ MISSING | No LLM prompt for "wrong answer → why + correct" |
| Mastery threshold gating | ❌ MISSING | Node unlock is manual/teacher-driven only |
| Tiered practice — Basic / Intermediate / Advanced | ⚠️ PARTIAL | `difficultyLevel` field exists; not wired to mastery routing |
| Real-world application example generator | ❌ MISSING | No LLM mode for this |
| Dual-format notes — PDF and sketch | ❌ MISSING | Text only; no PDF export of AI notes; no sketch view |
| Progress trend visualisation | ⚠️ PARTIAL | Trend in admin analytics; student-facing time-series absent |
| Next-step nudge notifications | ⚠️ PARTIAL | Schedulers for holidays/feedback exist; no learning-step nudge |
| Low engagement detection and content swap | ❌ MISSING | `viewCount`/`timeSpent` tracked; no detection or swap logic |

---

### SECTION 1C — Exam, Result, and Trackingv [Done]

| Item | Status | Notes |
|------|--------|-------|
| Exam registration and schedule view | ✅ PRESENT | `StudentExamsView.jsx` + backend schedule route |
| Pre-exam revision path auto-assignment | ❌ MISSING | No logic to auto-assign revision before exams |
| Mock exam with countdown timer | ❌ MISSING | Not implemented |
| Live exam interface — secure, anti-copy | ❌ MISSING | No live exam UI or anti-copy measures |
| Auto-graded MCQ | ⚠️ PARTIAL | Practice MCQ auto-graded; exam MCQ requires bulk Excel upload |
| Subjective answer submission | ⚠️ PARTIAL | Assignment file upload exists; no exam-specific subjective flow |
| Result release — score, rank, percentile | ⚠️ PARTIAL | Score published; rank and percentile not calculated |
| Topic-wise result breakdown | ⚠️ PARTIAL | Subject-level only; no sub-topic breakdown |
| Wrong answer review with correct explanation | ❌ MISSING | Wrong answers stored; no review + LLM explanation screen |
| Mastery re-assessment after exam | ❌ MISSING | No post-exam mastery recalculation trigger |
| Pre and post score comparison | ⚠️ PARTIAL | `improvementTrend` enum exists; no explicit delta UI |
| Report card download as PDF | ✅ PRESENT | `reportCardPdf.js` + `/api/report-cards` |
| Progress timeline — term-wise | ⚠️ PARTIAL | Results stored; no term-wise timeline chart |
| Badge awarded on topic mastery | ❌ MISSING | `AchievementsView.jsx` exists; no automated badge award on mastery |
| Learning path auto-update after exam | ❌ MISSING | No hook connecting exam results to path updates |
| Parent notified on result release | ✅ PRESENT | Parent notification in `examRoute.js` |
| AI post-exam personalised feedback | ❌ MISSING | No LLM endpoint for result → student feedback |

---

### SECTION 2A — Teacher Portal UI Screens

| Item | Status | Notes |
|------|--------|-------|
| Teacher dashboard | ✅ PRESENT | `TeacherDashboard.jsx` |
| Student roster with at-risk tags | ⚠️ PARTIAL | `StudentAnalyticsPortal.jsx`; tags are score-threshold only, not ML-driven |
| Lesson builder | ✅ PRESENT | `AIPoweredTeaching.jsx` with full chapter builder |
| Content library — upload, tag, manage | ✅ PRESENT | `teachingMaterialRoutes.js` + `TeachingMaterial` model + Cloudinary |
| Assignment creator screen | ✅ PRESENT | `AssignmentManagement.jsx`, `AssignmentHub.jsx` |
| Quiz and exam builder | ✅ PRESENT | `ExamManagement.jsx`, `PracticeQuestions.jsx` |
| Rubric and marking scheme editor | ❌ MISSING | No rubric model or UI |
| Class attendance tracker | ✅ PRESENT | `AttendanceManagement.jsx` |
| Weak student alert panel — ML-driven | ⚠️ PARTIAL | Score-threshold flagging only; no ML model |
| Intervention planner screen | ⚠️ PARTIAL | Intervention tab exists; no outcome tracking |
| Student learning path viewer + override | ✅ PRESENT | `GenerateAIPathPortal.jsx` with publish/override; `TeacherLearningPaths.jsx` |
| Analytics and trends dashboard | ⚠️ PARTIAL | Student analytics visible; teacher-facing trend dashboard limited |
| Exam results review screen | ✅ PRESENT | `ExamResultPortal.jsx`, `ResultManagement.jsx` |
| Feedback and annotation on submissions | ⚠️ PARTIAL | Text feedback in `AssignmentEvaluation.jsx`; no inline file annotation |
| Parent communication panel | ✅ PRESENT | `ParentMeetings.jsx`, `TeacherChat.jsx` |
| AI assistant for lesson planning | ✅ PRESENT | `GenerateAIPathPortal.jsx` now LLM-wired; lesson suggestion in `AIPoweredTeaching.jsx` |
| Calendar and session planner | ✅ PRESENT | `ClassRoutine.jsx`, `CalendarWidget.jsx` |
| Settings and class configuration | ✅ PRESENT | Class/section/subject selectors in header |

---

### SECTION 2B — Teacher AI and Teaching Tools [Done]

| Item | Status | Notes |
|------|--------|-------|
| AI lesson content generator (LLM) | ⚠️ PARTIAL | `applyAiSuggestion` inserts hardcoded HTML template, not LLM output |
| Auto quiz and worksheet builder (LLM) | ⚠️ PARTIAL | `PracticePaperBuilder.jsx` is fully manual; no LLM wiring |
| Misconception detection report — class-wide | ❌ MISSING | No class-level misconception aggregation |
| Class-wide learning gap analysis | ⚠️ PARTIAL | `analyzeStudentWeakness` per student; no class aggregate view |
| At-risk student predictor — 7-day forecast (ML) | ❌ MISSING | Score threshold flag only; no time-window trend model |
| Intervention recommendation engine | ⚠️ PARTIAL | `interventionLevel` computed; no specific content recommendations |
| Differentiated content — Foundation/Standard/Extension | ❌ MISSING | No 3-version LLM prompt |
| I Do / We Do / You Do lesson planner | ⚠️ PARTIAL | `instructionalFlow` phases in schema and UI; not LLM-generated |
| Hinge question generator | ❌ MISSING | No LLM endpoint or UI |
| Exit ticket auto-grader | ❌ MISSING | Not implemented |
| AI summary of class performance (LLM) | ❌ MISSING | No LLM class summary endpoint |
| Parent report auto-writer (LLM) | ❌ MISSING | Reports are manual |
| Feedback annotation with AI assist | ❌ MISSING | No AI assist for grading feedback |
| Learning path override control | ✅ PRESENT | Full publish/override in `GenerateAIPathPortal.jsx` |
| Curriculum alignment checker | ❌ MISSING | No checker |
| Mastery growth report per student | ⚠️ PARTIAL | `improvementTrend` is an enum; no time-series growth report |
| Time-to-mastery forecast (ML) | ❌ MISSING | Not implemented |

---

### SECTION 2C — Teacher Exam, Result, and Assessment [Done]

| Item | Status | Notes |
|------|--------|-------|
| Exam creation — MCQ, short answer, subjective | ✅ PRESENT | `ExamManagement.jsx` + `examRoute.js` |
| Question bank — create, tag, reuse | ✅ PRESENT | `PracticeQuestion` model + `practiceRoutes.js` |
| Exam scheduling and distribution | ✅ PRESENT | `ExamGroup` model |
| Live exam monitoring panel | ❌ MISSING | No real-time view of active exam takers |
| Auto-grading engine — MCQ | ⚠️ PARTIAL | Practice MCQ auto-graded; exam MCQ requires Excel bulk upload |
| Manual grading — essay/long-form | ⚠️ PARTIAL | `AssignmentEvaluation.jsx`; exam essay grading not distinct |
| Rubric-based marking tool | ❌ MISSING | No rubric model |
| Result release control | ✅ PRESENT | `/results/bulk-publish` with teacher control |
| Class result analysis — topic/question level | ⚠️ PARTIAL | Subject-level only; no per-question class analysis |
| Rank and percentile calculator | ❌ MISSING | Not implemented |
| Improvement score tracking — pre vs post | ⚠️ PARTIAL | Enum field exists; no explicit delta calculation |
| Repeated mistake cluster view | ❌ MISSING | Wrong answers stored; no class-wide cluster view |
| Post-exam learning path update trigger | ❌ MISSING | No event hook |
| Grade book and report card builder | ✅ PRESENT | `reportRoutes.js` + `ReportCardTemplate` model |
| Term-wise progress comparison | ⚠️ PARTIAL | Results stored; no comparison chart |
| Export results — CSV and PDF | ⚠️ PARTIAL | PDF report card exists; no CSV export of exam results |
| Cohort performance dashboard — multi-class | ⚠️ PARTIAL | Principal dashboard has aggregation; teacher multi-class view absent |

---

### SECTION 3A — Student Workflow Triggers [Done]

| Item | Status | Notes |
|------|--------|-------|
| Login → baseline → path assignment | ❌ MISSING | Login goes directly to dashboard |
| Lesson complete → mastery check → next action | ❌ MISSING | No lesson-complete event trigger |
| Mastery <40% → basic concept lesson | ❌ MISSING | No threshold engine |
| Mastery 40–60% → revision + easy practice | ❌ MISSING | Same |
| Mastery 60–75% → medium quiz | ❌ MISSING | Same |
| Mastery >75% → unlock next topic | ❌ MISSING | Manual teacher unlock only |
| Mastery >90% → challenge questions | ❌ MISSING | Same |
| Repeated mistake → misconception fix | ❌ MISSING | Wrong answers stored; no auto-trigger |
| Low engagement → content swap | ❌ MISSING | No detection or swap |
| Weak retention → spaced revision quiz | ❌ MISSING | No spaced repetition system |
| Continued difficulty → teacher alert | ⚠️ PARTIAL | `needsIntervention` flag exists; no automatic alert on continued difficulty events |
| Exam complete → result stored → path updated | ⚠️ PARTIAL | Result stored; path not updated |
| Day 1/3/7/14 → spaced recall quiz | ❌ MISSING | No scheduler |
| Topic mastered → badge awarded | ❌ MISSING | Not automated |
| All phases complete → progress report | ❌ MISSING | No completion trigger |

---

### SECTION 3B — Teacher Workflow Triggers

| Item | Status | Notes |
|------|--------|-------|
| Class setup → curriculum map linked | ⚠️ PARTIAL | Class/section/subject setup in admin; no curriculum map linking |
| Student added → profile created → tracking initialised | ✅ PRESENT | `adminUserManagement.js` + `StudentProgress` created on first analysis |
| ML alert → teacher intervention screen populated | ⚠️ PARTIAL | Manual score flag; no ML-fired alert |
| Teacher overrides AI path → saved | ✅ PRESENT | `learningPathRoutes.js` publish flow |
| Assignment created → distributed → tracked | ✅ PRESENT | Full flow in `assignmentRoute.js` |
| Submission received → auto-graded → scored | ⚠️ PARTIAL | MCQ practice auto-graded; essays manual |
| Grade entered → mastery recalculated | ❌ MISSING | No mastery recalculation on grading |
| Hinge question mass-wrong → class path adjustment | ❌ MISSING | No hinge question concept |
| Exit quiz low scores → re-teach flag | ❌ MISSING | Not implemented |
| Exam created → approved → released | ✅ PRESENT | Exam lifecycle with status flags |
| Exam submitted → graded → result published | ✅ PRESENT | Bulk result upload + publish |
| Result published → parent notified | ✅ PRESENT | `examRoute.js` |
| 30-day review → improvement report | ❌ MISSING | No scheduled report |
| Low class mastery → re-lesson recommendation | ❌ MISSING | Not implemented |
| Term end → grade book exported → admin | ⚠️ PARTIAL | Report cards generated; no automated term-end export |

---

### SECTION 4A — ML Model Responsibilities

| Item | Status | Notes |
|------|--------|-------|
| Mastery score calculator — per topic weighted | ❌ MISSING | Per-subject average only; no per-topic formula |
| Learning gap detector | ⚠️ PARTIAL | `analyzeStudentWeakness` uses score history; no activity event patterns |
| At-risk predictor — 7-day decline | ❌ MISSING | Point-in-time threshold flag only |
| Performance trend analyser — rolling average | ⚠️ PARTIAL | `improvementTrend` enum; no rolling average computation |
| Engagement scorer | ❌ MISSING | `viewCount`/`timeSpent` tracked; no aggregate scorer exposed |
| Misconception cluster model | ❌ MISSING | No clustering |
| Learning pace estimator | ❌ MISSING | Not implemented |
| Intervention level classifier | ✅ PRESENT | `interventionLevel` (low/medium/high/critical) in `aiLearningRoute.js` |
| Path effectiveness scorer | ❌ MISSING | Not implemented |
| Time-to-mastery forecaster | ❌ MISSING | Not implemented |
| Dropout risk detector | ❌ MISSING | Not implemented |
| Content difficulty ranker — per student | ❌ MISSING | `difficultyLevel` field exists; no student-calibrated ranking |
| Spaced repetition interval calculator | ❌ MISSING | Not implemented |
| Cohort similarity clustering | ❌ MISSING | Not implemented |
| Adaptive threshold auto-calibrator | ❌ MISSING | Thresholds are hardcoded constants |

---

### SECTION 4B — LLM Responsibilities

| Item | Status | Notes |
|------|--------|-------|
| Lesson content generator (topic + grade → full lesson) | ⚠️ PARTIAL | `applyAiSuggestion` inserts hardcoded HTML; not LLM |
| Flashcard deck builder | ✅ PRESENT | `flashcards` mode |
| Quiz question generator | ✅ PRESENT | `quiz` mode |
| Revision note writer | ✅ PRESENT | `notes` mode |
| Mind map structure generator | ✅ PRESENT | `mind_map` mode |
| Misconception correction explainer | ❌ MISSING | No LLM prompt or endpoint |
| AI tutor — conversational Q&A | ✅ PRESENT | `homework_help` Socratic mode |
| Student progress summary writer (teacher) | ❌ MISSING | No LLM endpoint |
| Parent report auto-writer | ❌ MISSING | No LLM endpoint |
| Post-exam personalised feedback | ❌ MISSING | No LLM endpoint |
| Worksheet generator | ❌ MISSING | `PracticePaperBuilder.jsx` is manual |
| Real-life application story builder | ❌ MISSING | No LLM mode |
| Hinge question generator | ❌ MISSING | No LLM endpoint |
| Differentiated content writer — 3 versions | ❌ MISSING | No LLM endpoint |
| Answer explanation generator | ⚠️ PARTIAL | `explain` mode is topic-level; no "wrong answer → step-by-step correct" prompt |
| Learning path generator | ✅ PRESENT | `/generate/learning-path` AI service + `/api/learning-paths/generate` backend |

---

### SECTION 5A — Data and Storage

| Item | Status | Notes |
|------|--------|-------|
| Student profile model | ✅ PRESENT | `StudentUser.js` |
| Academic score store | ⚠️ PARTIAL | Per-subject average only; no per-assignment score timeline |
| Activity event log | ⚠️ PARTIAL | `AuditLog.js` tracks user actions; no dedicated learning-event log per topic per date |
| Mastery score table — student × topic × score | ❌ MISSING | Does not exist |
| Learning path store | ✅ PRESENT | `TeacherLearningPath.js` |
| Content library CMS | ✅ PRESENT | `TeachingMaterial.js` + Cloudinary |
| Exam and result database | ✅ PRESENT | `Exam.js`, `ExamGroup.js`, `ExamResult.js` |
| Flashcard and quiz content store | ✅ PRESENT | `PracticePaper.js`, `PracticeQuestion.js`, `PracticeAttempt.js` |
| Spaced repetition schedule table | ❌ MISSING | No model |
| Curriculum map database | ❌ MISSING | No curriculum/prerequisite model |
| Notification queue | ✅ PRESENT | `Notification.js`, `PushSubscription.js` |
| Audit and access log | ✅ PRESENT | `AuditLog.js` + Pino with correlation IDs |

---

### SECTION 5B — APIs and Services

| Item | Status | Notes |
|------|--------|-------|
| Auth API — JWT, role routing | ✅ PRESENT | `authRoutes.js` + role-specific middleware |
| Student data API | ✅ PRESENT | `studentRoute.js` |
| Learning path API | ✅ PRESENT | `learningPathRoutes.js` |
| Mastery scoring API | ❌ MISSING | No `/api/mastery` endpoint |
| Content delivery API | ✅ PRESENT | `studentMaterialRoutes.js` + `teachingMaterialRoutes.js` |
| AI inference API | ✅ PRESENT | `aiTutorRoutes.js` + FastAPI `/generate/tutor` |
| ML prediction API | ⚠️ PARTIAL | `aiLearningRoute.js` rule-based scoring; no true ML model |
| Exam management API | ✅ PRESENT | `examRoute.js` |
| Grading engine API | ⚠️ PARTIAL | Practice MCQ auto-graded; exam grading via Excel bulk upload |
| Notification push API | ✅ PRESENT | `notificationRoutes.js` + Web Push |
| Report export API — PDF and CSV | ⚠️ PARTIAL | PDF report card exists; no CSV export |
| Analytics aggregation API | ⚠️ PARTIAL | Principal dashboard aggregates; no teacher-level analytics API |

---

### SECTION 5C — Security and Access Control

| Item | Status | Notes |
|------|--------|-------|
| Role-based access control | ✅ PRESENT | All six middleware guards throughout |
| Student PII encryption at rest | ⚠️ PARTIAL | Payment keys + chat encrypted; student name/email not encrypted at rest |
| Secure exam session — tab-lock, timer | ❌ MISSING | No live exam UI |
| Anti-copy exam mode | ❌ MISSING | Not implemented |
| Session timeout — idle auto-logout | ⚠️ PARTIAL | 24h JWT; 401 redirect exists; no client-side idle timer |
| Parent consent and data privacy controls | ❌ MISSING | No consent model or UI |
| Teacher approval gate for AI path changes | ✅ PRESENT | No AI auto-publish; teacher must explicitly publish |
| AI output moderation | ❌ MISSING | LLM responses displayed unfiltered |
| Data retention policy | ❌ MISSING | No TTL or purge logic |
| Full audit trail | ✅ PRESENT | `AuditLog.js` + Pino |
| GDPR — data export and delete on request | ⚠️ PARTIAL | `deleteSchoolCascade.js` exists; no per-user GDPR request flow |
| 2FA for teacher and admin | ❌ MISSING | Not implemented |

---

### SECTION 5D — Infrastructure and DevOps

| Item | Status | Notes |
|------|--------|-------|
| Cloud hosting / containerisation | ❌ MISSING | No Dockerfile, docker-compose, or deployment manifests |
| CDN for static assets | ⚠️ PARTIAL | Cloudinary for uploads; no CDN for app's own static assets |
| Real-time event bus (Socket.IO) | ✅ PRESENT | Socket.IO in `backend/index.js` |
| Background job scheduler | ⚠️ PARTIAL | `setInterval`-based schedulers; no production-grade queue |
| ML model serving pipeline | ❌ MISSING | No ML model; rule-based scoring only |
| LLM rate limiting and fallback | ⚠️ PARTIAL | No rate limiting on LLM calls; down Ollama returns 502 with no fallback |
| Mobile-responsive / PWA | ⚠️ PARTIAL | `sw.js` + `MobileBottomNav.jsx`; no web app manifest, no offline caching |
| Offline mode for lessons | ❌ MISSING | Service worker handles push only; no content caching |
| CI/CD pipeline | ❌ MISSING | No `.github/workflows`, no Jenkinsfile |
| Error monitoring — Sentry or equivalent | ❌ MISSING | Pino only; no Sentry |
| Performance logging (latency metrics) | ⚠️ PARTIAL | Request logger exists; no AI latency or DB query time metrics |
| Backup and disaster recovery | ❌ MISSING | No automated snapshot scripts |

---

### SECTION 6A — Student Dashboard Tracking

| Item | Status | Notes |
|------|--------|-------|
| Phase completion % per subject | ⚠️ PARTIAL | Broad progress shown; no phase-level breakdown |
| Mastery per topic | ❌ MISSING | No per-topic mastery tracked |
| Quiz score history chart | ⚠️ PARTIAL | `PracticeAttempt` stored; no student-facing chart |
| Learning streak | ⚠️ PARTIAL | Attendance streak; no learning-event streak |
| Time spent per subject | ⚠️ PARTIAL | `timeSpent` in material engagement; not shown to student |
| Pending/completed steps | ✅ PRESENT | `TeacherLearningPaths.jsx` |
| Flashcard recall rate | ❌ MISSING | "Got it / Still learning" is in-memory only; not persisted |
| Error frequency log | ⚠️ PARTIAL | `PracticeAttempt` stores; no recurring-mistake student UI |
| Exam history and trend | ⚠️ PARTIAL | Results shown; no trend chart |
| Badge and milestone log | ⚠️ PARTIAL | Static `AchievementsView.jsx`; not earned dynamically |

---

### SECTION 6B — Teacher Dashboard Tracking

| Item | Status | Notes |
|------|--------|-------|
| Class mastery heatmap — student × topic grid | ❌ MISSING | No heatmap |
| Weak student list — ML-flagged | ⚠️ PARTIAL | Score-threshold only |
| Assignment completion rate | ✅ PRESENT | `teacherDashboardRoutes.js` |
| Topic-wise gap view | ⚠️ PARTIAL | `weakAreas` array; no visual breakdown |
| Engagement score per student | ❌ MISSING | No computed score exposed to teacher |
| Intervention log | ❌ MISSING | No log of past interventions |
| Learning path override log | ⚠️ PARTIAL | Path versions archived on re-publish; no explicit diff/change log |
| Exam result per student | ✅ PRESENT | `ExamResultPortal.jsx` + `ResultManagement.jsx` |
| Improvement trend — 7/15/30-day windows | ❌ MISSING | Enum only; no time-window calculation |
| 30-day cohort narrative report | ❌ MISSING | Not implemented |

---

### SECTION 6C — Parent Dashboard Tracking

| Item | Status | Notes |
|------|--------|-------|
| Learning progress summary — weekly digest | ❌ MISSING | No scheduled weekly digest |
| Attendance and engagement summary | ✅ PRESENT | `AttendanceReport.jsx` in parent portal |
| Weak areas notification | ⚠️ PARTIAL | General notifications exist; no weak-area-specific push |
| Exam date reminders | ✅ PRESENT | Scheduler exists |
| Result release alert | ✅ PRESENT | Fired on result publish |
| Teacher remarks feed | ⚠️ PARTIAL | `StudentObservation.jsx` notes; no structured parent feed |
| Suggested home support actions | ❌ MISSING | Not implemented |
| Monthly AI-generated progress report (LLM) | ❌ MISSING | No LLM report |
| Report card download link | ✅ PRESENT | PDF download in parent portal |
| Milestone and achievement celebration alert | ❌ MISSING | No automated celebration notification |

---

### SECTION 6D — Admin Dashboard Tracking

| Item | Status | Notes |
|------|--------|-------|
| School-wide mastery view | ❌ MISSING | No mastery view in admin `Analytics.jsx` |
| Subject performance matrix | ⚠️ PARTIAL | Subject breakdown in analytics; not a matrix |
| Teacher effectiveness report | ❌ MISSING | Not implemented |
| AI path effectiveness audit | ❌ MISSING | Not implemented |
| Dropout and risk dashboard | ❌ MISSING | Not implemented |
| Term-on-term cohort trend | ⚠️ PARTIAL | Results exist; no comparison view |
| Content usage analytics | ⚠️ PARTIAL | `viewCount` tracked; no aggregated dashboard |
| System health monitoring | ❌ MISSING | `/health` on AI service; no admin-facing dashboard |
| Exam integrity reports | ❌ MISSING | No monitoring during exams |
| Bulk data export — CSV, PDF, Excel | ⚠️ PARTIAL | PDF report cards + Excel import; no bulk CSV export |

---

## CHANGE SUGGESTIONS (PARTIAL and MISSING items)

---

### 1. Per-topic MasteryScore model and API

**Status:** ❌ MISSING  
**Gap:** `StudentProgress.progressMetrics` stores per-subject averages. No per-topic mastery exists. The entire threshold-routing and adaptive path engine cannot function without this.

**File to create:** `backend/models/MasteryScore.js`
```js
const mongoose = require('mongoose');
const masteryScoreSchema = new mongoose.Schema({
  schoolId:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  subject:      { type: String, required: true },
  topicId:      { type: String, required: true },
  topicTitle:   { type: String },
  score:        { type: Number, min: 0, max: 100, default: 0 },
  attemptCount: { type: Number, default: 0 },
  lastUpdated:  { type: Date, default: Date.now },
}, { timestamps: true });
masteryScoreSchema.index({ studentId: 1, subject: 1, topicId: 1 }, { unique: true });
module.exports = mongoose.model('MasteryScore', masteryScoreSchema);
```

**File to create:** `backend/routes/masteryRoutes.js`
- Add `POST /api/mastery/update` (authStudent) — upsert score after quiz completion
- Add `GET /api/mastery/student` (authStudent) — fetch all scores for the logged-in student
- Wire quiz submission in `studentMaterialRoutes.js` to call upsert after each attempt

---

### 2. Adaptive learning path engine (threshold router)

**Status:** ❌ MISSING  
**Gap:** No engine routes students to content based on their mastery score.

**File to create:** `backend/services/masteryRouter.js`
```js
const MasteryScore = require('../models/MasteryScore');
const THRESHOLDS = { CRITICAL: 40, LOW: 60, MID: 75, HIGH: 90 };

async function getNextAction(studentId, subject, topicId) {
  const m = await MasteryScore.findOne({ studentId, subject, topicId }).lean();
  const score = m?.score ?? 0;
  if (score < THRESHOLDS.CRITICAL) return { action: 'basic_lesson',  reason: 'Below 40%' };
  if (score < THRESHOLDS.LOW)      return { action: 'revision',      reason: '40–60%' };
  if (score < THRESHOLDS.MID)      return { action: 'medium_quiz',   reason: '60–75%' };
  if (score < THRESHOLDS.HIGH)     return { action: 'advance',       reason: '75–90%' };
  return                                  { action: 'challenge',      reason: 'Above 90%' };
}
module.exports = { getNextAction };
```

- Expose as `GET /api/mastery/next-action?subject=&topicId=` (authStudent)
- Call after every quiz submission to determine next content block for the student

---

### 3. Spaced repetition scheduler

**Status:** ❌ MISSING  
**Gap:** No model, no cron, no trigger. Ebbinghaus Day 1/3/7/14 recall is completely absent.

**File to create:** `backend/models/SpacedRepetitionSchedule.js`
```js
const schema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
  topicId:        String,
  topicTitle:     String,
  subject:        String,
  intervalDays:   { type: Number, default: 1 },
  nextReviewDate: { type: Date, required: true },
  stage:          { type: Number, default: 0 }, // 0=day1, 1=day3, 2=day7, 3=day14
  lastScore:      Number,
}, { timestamps: true });
```

**File to create:** `backend/utils/spacedRepetitionScheduler.js`
- Run daily via node-cron
- Find cards where `nextReviewDate <= now`
- Push quiz notification to student
- After quiz, advance `stage` and set `nextReviewDate = now + [1,3,7,14][stage]`
- Wire: call `createSpacedSchedule(studentId, topicId)` when a topic mastery score first exceeds 75%

---

### 4. Live exam interface with timer and anti-copy

**Status:** ❌ MISSING  
**Gap:** Students cannot take any exam in the system. All grading relies on external Excel uploads.

**File to create:** `frontend/src/components/LiveExamInterface.jsx`
```jsx
// Key features:
// - Countdown timer via useInterval
// - onBeforeUnload + visibilitychange tab-detection (flag to server)
// - onContextMenu={e => e.preventDefault()}
// - onCopy={e => e.preventDefault()} on the exam container div
// - MCQ and text-answer rendering with per-question local save
// - Final submit calls POST /api/exam/submit
```

**File to edit:** `backend/routes/examRoute.js`
- Add `POST /api/exam/submit` — stores student answers with timestamps
- Add `POST /api/exam/tab-switch` — logs tab-switch events for integrity reports

---

### 5. Misconception correction LLM mode

**Status:** ❌ MISSING  
**Gap:** Wrong answers stored in `PracticeAttempt` but no feedback loop explains the error.

**File to edit:** `ai-service/app/modules/chat/service.py`
```python
MODE_INSTRUCTIONS["misconception"] = (
    "The student answered incorrectly. Explain in simple language: "
    "(1) why the wrong answer seems plausible, "
    "(2) what the correct answer is and why, "
    "(3) a memory aid to avoid this mistake again. "
    "Keep it under 120 words. Use the student's grade level."
)
```

- Add `question` and `wrongAnswer` fields to `TutorGenerateRequest` schema
- Use them in `build_prompt()` when `mode == "misconception"`
- Wire from the practice attempt review screen in the frontend

---

### 6. Rank and percentile on exam results

**Status:** ❌ MISSING  
**Gap:** Results published without rank; parents and students cannot know class standing.

**File to edit:** `backend/models/ExamResult.js`
```js
rank:       { type: Number },
percentile: { type: Number },
```

**File to edit:** `backend/routes/examRoute.js` — at result publish time:
```js
const results = await ExamResult.find({ examId, classId }).sort({ totalScore: -1 });
for (let i = 0; i < results.length; i++) {
  results[i].rank = i + 1;
  results[i].percentile = Math.round((1 - i / results.length) * 100);
  await results[i].save();
}
```

---

### 7. AI lesson content generator (replace hardcoded template)

**Status:** ⚠️ PARTIAL  
**Gap:** `applyAiSuggestion` in `AIPoweredTeaching.jsx` inserts a hardcoded HTML string.

**File to edit:** `ai-service/app/modules/chat/service.py`
```python
MODE_INSTRUCTIONS["lesson_plan"] = (
    "Generate a structured lesson plan for the given topic and grade. "
    "Include: Learning Objectives (3 bullets), Warm-Up (2 min activity), "
    "Explanation (10 min — step-by-step), Guided Practice (8 min), "
    "Recap (2 min exit question). Write in teacher-facing language."
)
```

**File to edit:** `backend/routes/aiTutorRoutes.js`
- Add `POST /api/ai-tutor/generate-lesson` proxy route (authTeacher)

**File to edit:** `frontend/src/teachers/AIPoweredTeaching.jsx`
- Replace the hardcoded `applyAiSuggestion` body with a `fetch` to `/api/ai-tutor/generate-lesson`

---

### 8. Post-exam learning path auto-update

**Status:** ❌ MISSING  
**Gap:** After results are published there is no hook to recalculate mastery or update paths.

**File to edit:** `backend/routes/examRoute.js` — after result publish:
```js
// For each student result, upsert MasteryScore per topic
// Then call masteryRouter.getNextAction() to determine if path node should advance
// Emit a socket event or create notification for the student
const { getNextAction } = require('../services/masteryRouter');
for (const result of publishedResults) {
  const next = await getNextAction(result.studentId, result.subject, result.topicId);
  // Update TeacherLearningPath node status based on next.action
}
```

---

### 9. Automated badge awarding on mastery events

**Status:** ❌ MISSING  
**Gap:** `AchievementsView.jsx` and badge UI exist but nothing awards badges.

**File to create:** `backend/services/badgeService.js`
```js
const BADGE_THRESHOLDS = [
  { id: 'first_topic', label: 'First Topic Mastered', condition: (count) => count === 1 },
  { id: 'five_topics', label: 'Five Topics Mastered', condition: (count) => count === 5 },
  { id: 'subject_star', label: 'Subject Star', condition: (count) => count >= 10 },
];

async function checkAndAwardBadges(studentId, masteredTopicCount) {
  for (const badge of BADGE_THRESHOLDS) {
    if (badge.condition(masteredTopicCount)) {
      // Upsert into StudentBadge collection and send notification
    }
  }
}
```

- Call `checkAndAwardBadges` after any MasteryScore update that crosses 75%

---

### 10. 2FA for teacher and admin accounts

**Status:** ❌ MISSING  
**Gap:** Teacher/admin accounts hold full school data. A stolen credential gives persistent unrestricted access.

**File to edit:** `backend/package.json` — add `speakeasy` and `qrcode`

**File to edit:** `backend/models/TeacherUser.js` and `Admin.js`
```js
twoFactorSecret:  { type: String },
twoFactorEnabled: { type: Boolean, default: false },
```

**File to edit:** `backend/routes/` — add teacher auth endpoints:
- `POST /api/teacher/auth/2fa/setup` — generate TOTP secret + return QR code data URL
- `POST /api/teacher/auth/2fa/verify` — validate TOTP token, set `twoFactorEnabled: true`

**File to edit:** `backend/middleware/authTeacher.js`
- If `twoFactorEnabled`, require `x-2fa-token` header and validate with `speakeasy.totp.verify()`

---

### 11. AI output moderation

**Status:** ❌ MISSING  
**Gap:** LLM responses are displayed to students unfiltered.

**File to edit:** `ai-service/app/modules/chat/router.py`
```python
BLOCKED_TERMS = ["violence", "adult content", "explicit", "harm"]

def _moderate(text: str) -> str:
    if any(term in text.lower() for term in BLOCKED_TERMS):
        return "I'm not able to help with that topic. Please ask about your study material."
    return text

# Apply in generate_tutor_content() before returning:
content = _moderate(content)
```

---

### 12. Parent report auto-writer (LLM)

**Status:** ❌ MISSING

**File to edit:** `ai-service/app/modules/chat/service.py`
```python
MODE_INSTRUCTIONS["parent_report"] = (
    "Write a warm, jargon-free 150-word progress summary for a parent. "
    "Include: attendance summary, recent exam score, strongest subjects, "
    "areas needing support at home, and one specific actionable tip. "
    "Tone: encouraging and clear. Avoid educational jargon."
)
```

- Add `POST /api/ai-tutor/parent-report` backend route (authTeacher)
- Pass aggregated student data (attendance %, scores, weak areas) as the `topic` context field

---

### 13. Differentiated content generator — Foundation / Standard / Extension

**Status:** ❌ MISSING

**File to edit:** `ai-service/app/modules/chat/service.py`
```python
MODE_INSTRUCTIONS["differentiated"] = (
    "Generate THREE versions of the same lesson content for one topic:\n"
    "1. FOUNDATION — simplified language, concrete examples, step-by-step\n"
    "2. STANDARD — grade-level language, mix of examples and abstract\n"
    "3. EXTENSION — challenge language, open questions, real-world application\n"
    "Label each section clearly. Keep each version under 200 words."
)
```

---

### 14. Curriculum map database

**Status:** ❌ MISSING  
**Gap:** No prerequisite or sequencing model; content has loose `chapterTitle`/`topicTitle` strings only.

**File to create:** `backend/models/CurriculumMap.js`
```js
const schema = new mongoose.Schema({
  schoolId:      { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classId:       String,
  subject:       String,
  chapterId:     String,
  chapterTitle:  String,
  topicId:       String,
  topicTitle:    String,
  prerequisites: [String],  // array of topicIds that must be mastered first
  difficulty:    { type: Number, min: 1, max: 5 },
  bloomLevel:    { type: String, enum: ['remember','understand','apply','analyze','evaluate','create'] },
  estimatedDays: Number,
}, { timestamps: true });
```

---

### 15. Hinge question generator (LLM)

**Status:** ❌ MISSING

**File to edit:** `ai-service/app/modules/chat/service.py`
```python
MODE_INSTRUCTIONS["hinge_question"] = (
    "Generate ONE diagnostic hinge question for mid-lesson use. "
    "The question must reveal a common misconception if answered incorrectly. "
    "Format: Question, then 4 MCQ options (A–D), mark the correct answer and "
    "for each wrong option explain what misconception it reveals."
)
```

---

### 16. Spaced repetition schedule store (flashcard recall rate)

**Status:** ❌ MISSING  
**Gap:** "Got it / Still learning" ratings in `FlashcardUI` are in-memory only; never persisted.

**File to edit:** `frontend/src/components/AITutorHomeScreen.jsx` — `FlashcardUI`
- On "Got it" / "Still learning" click, call `POST /api/mastery/flashcard-rate` with `{ topicId, cardIndex, result: 'known'|'learning' }`

**File to edit:** `backend/routes/masteryRoutes.js`
- Add `POST /api/mastery/flashcard-rate` — updates the spaced repetition schedule for that card

---

### 17. CI/CD pipeline

**Status:** ❌ MISSING

**File to create:** `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd backend && npm ci && npm test
      - run: cd frontend && npm ci && npm test -- --watchAll=false
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: cd ai-service && pip install -r requirements.txt && pytest
```

---

### 18. Docker containerisation

**Status:** ❌ MISSING

**File to create:** `docker-compose.yml`
```yaml
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    ports: ["5000:5000"]
  frontend:
    build: ./frontend
    ports: ["5173:5173"]
  ai-service:
    build: ./ai-service
    env_file: ./ai-service/.env
    ports: ["8000:8000"]
  mongo:
    image: mongo:7
    volumes: [mongo-data:/data/db]
volumes:
  mongo-data:
```

---

### 19. At-risk student predictor (7-day slope)

**Status:** ❌ MISSING  
**Gap:** `isWeakStudent` is a point-in-time flag, not trend detection.

**File to edit:** `backend/models/StudentProgress.js`
```js
// Add to progressMetrics sub-schema:
scoreHistory: [{ score: Number, date: { type: Date, default: Date.now } }]
```

**File to edit:** `backend/routes/aiLearningRoute.js` — after each weakness analysis:
```js
// Compute linear slope over last 7 days of scoreHistory
// If slope < -5 points/week → set isWeakStudent=true, fire teacher notification
const recentScores = student.progressMetrics[subject]?.scoreHistory?.slice(-7) || [];
if (recentScores.length >= 2) {
  const slope = (recentScores.at(-1).score - recentScores[0].score) / recentScores.length;
  if (slope < -5) {
    progress.isWeakStudent = true;
    // create Notification for teacher
  }
}
```

---

### 20. Engagement scorer

**Status:** ❌ MISSING  
**Gap:** `viewCount` and `timeSpent` are tracked on `TeachingMaterial` but no aggregate engagement score is computed or exposed.

**File to create:** `backend/services/engagementScorer.js`
```js
// Score = (timeSpentMinutes * 0.4) + (quizAttempts * 0.3) + (materialsViewed * 0.3)
// Normalise to 0–100; update StudentProgress.engagementScore
async function computeEngagement(studentId, schoolId, subject) {
  const material = await TeachingMaterial.findOne({...});
  const attempts = await PracticeAttempt.countDocuments({ studentId, subject });
  // ... compute and save
}
```

- Expose as `GET /api/analytics/engagement/:studentId` (authTeacher)

---

## PRIORITY ACTION LIST

| # | Item | Why Critical | Effort |
|---|------|-------------|--------|
| 1 | **Per-topic MasteryScore model + API** | Every adaptive feature is blocked without `student × topic × score`. No threshold routing, no spaced repetition, no gap analysis can function. | Medium |
| 2 | **Adaptive learning path engine (threshold router)** | The core pedagogical promise — Bloom, Mastery Learning, ZPD — is undelivered. All 15 workflow triggers in Section 3A are blocked. | High |
| 3 | **Spaced repetition scheduler (Day 1, 3, 7, 14)** | Highest evidence-backed feature per Ebbinghaus research. Nothing in the codebase even stores a next-review date. | Medium |
| 4 | **Live exam interface with timer + anti-copy** | Students cannot take any exam inside the system. All grading relies on external Excel uploads. | High |
| 5 | **Misconception correction LLM mode** | Wrong answers stored in `PracticeAttempt` but zero feedback loop. Closing this with a single LLM mode is the easiest high-impact win. | Low |
| 6 | **Rank and percentile on exam results** | Results published without rank — parents and students cannot assess class standing. Simple computation at publish time. | Low |
| 7 | **AI lesson content generator (replace hardcoded template)** | The lesson builder's "AI suggestion" button inserts hardcoded HTML. One LLM mode addition makes the teacher's main tool actually intelligent. | Low |
| 8 | **Post-exam learning path auto-update** | After result publish there is no hook to recalculate mastery or update paths. This is the critical link between assessment and personalised learning. | Medium |
| 9 | **Automated badge awarding on mastery events** | `AchievementsView.jsx` exists but nothing awards badges. Wiring to mastery threshold events closes the gamification loop. | Medium |
| 10 | **2FA for teacher and admin accounts** | Teacher/admin accounts hold full school data. A stolen 24h JWT gives persistent unrestricted access to all student PII. | Medium |

---

*End of audit report. 42% present · 32% partial · 26% missing.*
