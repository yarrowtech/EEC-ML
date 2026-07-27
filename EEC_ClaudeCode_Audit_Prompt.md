# EEC Adaptive Learning System — Full Codebase Audit Prompt
# Give this entire file to Claude Code. It will scan your existing system,
# check every item listed, and produce a structured gap report with change suggestions.

---

## ROLE AND OBJECTIVE

You are a senior full-stack architect and EdTech product engineer auditing an existing
school learning management system called EEC (Adaptive Learning System).

Your job is to:
1. Scan the entire codebase, database schemas, API routes, and configuration files.
2. Check every item in the specification below against what currently exists.
3. For each item — mark it as PRESENT, PARTIAL, or MISSING.
4. For every PARTIAL or MISSING item — provide a specific, actionable change suggestion
   including which file to edit, what to add, and what the code or config should look like.
5. Output a structured audit report grouped by section.

Do not assume anything is present. Check actual files, routes, models, components,
and database tables before marking anything as PRESENT.

---

## AUDIT INSTRUCTIONS

For each item in the specification:
- Search the codebase for relevant files, components, routes, models, and schemas.
- Check frontend screens (React/Vue/HTML components or pages).
- Check backend routes and controllers (REST or GraphQL endpoints).
- Check database models or migration files.
- Check AI/ML integration files or service connectors.
- Mark the item as:
  - ✅ PRESENT — fully implemented and functional
  - ⚠️ PARTIAL — exists but incomplete, broken, or missing key behaviour
  - ❌ MISSING — not found anywhere in the codebase
- For PARTIAL and MISSING — write a concrete suggestion:
  - File path to create or edit
  - What specifically needs to be added
  - Code snippet or schema example where helpful

---

## SECTION 1 — STUDENT PORTAL

### 1A. UI Screens (check for frontend page/component files)

- [ ] Login and onboarding screen
- [ ] Home dashboard — daily learning overview
- [ ] Learning path map — visual step-by-step flow
- [ ] Subject and topic selector
- [ ] Lesson viewer — PDF, video, handwritten notes
- [ ] Flashcard deck screen
- [ ] Mind map viewer
- [ ] Quiz and practice screen — MCQ, short answer
- [ ] Worksheet download and submit screen
- [ ] Progress dashboard — charts and graphs
- [ ] Mastery level indicator per topic
- [ ] Streak tracker and badge wall
- [ ] Notification center
- [ ] Exam schedule and countdown timer
- [ ] Result and report card view
- [ ] Reflection journal screen
- [ ] AI tutor chat interface
- [ ] Profile and settings screen

### 1B. Learning and AI Features (check services, hooks, API calls, AI integrations)

- [ ] Adaptive learning path engine — mastery-threshold-based routing
- [ ] Personalised content recommendation logic
- [ ] AI tutor — LLM-powered conversational Q&A
- [ ] Auto-generated flashcard deck from topic
- [ ] Auto-generated revision notes per weak topic
- [ ] Concept mind map auto-builder
- [ ] Spaced repetition scheduler — Day 1, 3, 7, 14 intervals
- [ ] Active recall quiz generator — 3 difficulty tiers
- [ ] Error analysis module — wrong answer pattern detection
- [ ] Misconception correction explanation generator
- [ ] Mastery threshold gating — locks next topic until threshold met
- [ ] Tiered practice problems — Basic, Intermediate, Advanced
- [ ] Real-world application example generator
- [ ] Dual-format notes — PDF and sketch/handwritten style
- [ ] Progress trend visualisation — improvement over time
- [ ] Next-step nudge notifications
- [ ] Low engagement detection and content swap

### 1C. Exam, Result, and Tracking (check exam flows and result models)

- [ ] Exam registration and schedule view
- [ ] Pre-exam revision path auto-assignment
- [ ] Mock exam with countdown timer
- [ ] Live exam interface — secure, anti-copy
- [ ] Auto-graded MCQ and fill-in-the-blank
- [ ] Subjective answer submission and upload
- [ ] Result release — score, rank, percentile
- [ ] Topic-wise result breakdown
- [ ] Wrong answer review with correct explanation
- [ ] Mastery re-assessment triggered after exam
- [ ] Pre and post score comparison — improvement %
- [ ] Report card download as PDF
- [ ] Progress timeline — term-wise view
- [ ] Completion badge awarded on topic mastery
- [ ] Learning path auto-update triggered after exam result
- [ ] Parent notified on result release
- [ ] AI post-exam personalised feedback

---

## SECTION 2 — TEACHER PORTAL

### 2A. UI Screens (check teacher-side frontend pages and components)

- [ ] Teacher dashboard — class performance overview
- [ ] Student roster with status tags (at-risk, on-track, mastered)
- [ ] Lesson builder — topic input to full content output
- [ ] Content library — upload, tag, manage resources
- [ ] Assignment creator screen
- [ ] Quiz and exam builder
- [ ] Rubric and marking scheme editor
- [ ] Class attendance tracker
- [ ] Weak student alert panel — ML-driven
- [ ] Intervention planner screen
- [ ] Student learning path viewer and override control
- [ ] Analytics and trends dashboard
- [ ] Exam results review screen — student and class level
- [ ] Feedback and annotation tool on student submissions
- [ ] Parent communication panel
- [ ] AI assistant for lesson planning
- [ ] Calendar and session planner
- [ ] Settings and class configuration screen

### 2B. AI and Teaching Tools (check AI service calls, LLM integrations, ML outputs)

- [ ] AI lesson content generator — topic input → lesson output (LLM)
- [ ] Auto quiz and worksheet builder (LLM)
- [ ] Misconception detection report across class (ML)
- [ ] Class-wide learning gap analysis
- [ ] At-risk student predictor — 7-day forecast (ML)
- [ ] Intervention recommendation engine
- [ ] Differentiated content generator — Foundation, Standard, Extension tracks
- [ ] I Do / We Do / You Do lesson planner
- [ ] Hinge question generator for mid-lesson check
- [ ] Exit ticket auto-grader
- [ ] AI summary of class performance (LLM)
- [ ] Parent report auto-writer (LLM)
- [ ] Feedback annotation with AI assist
- [ ] Learning path override control — teacher manual input
- [ ] Curriculum alignment checker
- [ ] Mastery growth report per student
- [ ] Time-to-mastery forecast per topic (ML)

### 2C. Exam, Result, and Assessment (check exam management flows)

- [ ] Exam creation — MCQ, short answer, subjective
- [ ] Question bank — create, tag, reuse questions
- [ ] Exam scheduling and distribution to students
- [ ] Live exam monitoring panel — who is active
- [ ] Auto-grading engine — MCQ and fill-in
- [ ] Manual grading interface — essay and long-form
- [ ] Rubric-based marking tool
- [ ] Result release control — teacher triggers publish
- [ ] Class result analysis — topic and question level
- [ ] Rank and percentile calculator
- [ ] Improvement score tracking — pre vs post
- [ ] Repeated mistake cluster view — class-wide patterns
- [ ] Post-exam learning path update trigger
- [ ] Grade book and report card builder
- [ ] Term-wise progress comparison
- [ ] Export results — CSV and PDF
- [ ] Cohort performance dashboard — multi-class view

---

## SECTION 3 — WORKFLOW AND DECISION MAKING

### 3A. Student Workflow Triggers (check event handlers, state machines, or workflow logic)

- [ ] Login → baseline assessment → personalised path assignment
- [ ] Lesson complete → mastery check → route to next action
- [ ] Mastery below 40% → assign basic concept lesson and guided practice
- [ ] Mastery 40–60% → assign revision material and easy practice
- [ ] Mastery 60–75% → assign medium worksheet and quiz
- [ ] Mastery above 75% → unlock next topic
- [ ] Mastery above 90% → assign advanced challenge questions
- [ ] Repeated mistake detected → trigger misconception fix content
- [ ] Low engagement score → swap to shorter/simpler content
- [ ] Weak retention → trigger spaced revision quiz
- [ ] Continued difficulty → fire teacher intervention alert
- [ ] Exam complete → result stored → learning path updated
- [ ] Day 1, 3, 7, 14 after learning → spaced recall quiz triggered
- [ ] Topic mastered → badge awarded → progress updated
- [ ] All phases complete → progress report auto-generated

### 3B. Teacher Workflow Triggers (check backend event triggers and automations)

- [ ] Class setup → curriculum map linked → student paths configured
- [ ] Student added → profile created → tracking initialised
- [ ] ML alert fires → teacher intervention screen populated
- [ ] Teacher overrides AI path → manual path saved and tracked
- [ ] Assignment created → distributed to students → submission tracked
- [ ] Submission received → auto-graded → score stored
- [ ] Grade entered → mastery score recalculated and updated
- [ ] Hinge question mass-wrong → class path adjustment trigger
- [ ] Exit quiz low scores → re-teach flag for next session
- [ ] Exam created → approved → released to student roster
- [ ] Exam submitted by all → graded → result published
- [ ] Result published → parent notification sent
- [ ] 30-day review → improvement report auto-generated
- [ ] Low class mastery detected → class-wide re-lesson recommended
- [ ] Term end → grade book exported → submitted to admin

---

## SECTION 4 — AI LAYER

### 4A. ML Model Responsibilities (check ML services, model endpoints, prediction jobs)

- [ ] Mastery score calculator — weighted formula per topic
- [ ] Learning gap detector — from activity patterns and scores
- [ ] At-risk student predictor — 7-day decline window
- [ ] Performance trend analyser — rolling average over time
- [ ] Engagement scorer — time on task + interaction events
- [ ] Misconception cluster model — groups similar wrong patterns
- [ ] Learning pace estimator — per student per subject
- [ ] Intervention level classifier — L1 (content), L2 (nudge), L3 (teacher)
- [ ] Path effectiveness scorer — outcome vs path type
- [ ] Time-to-mastery forecaster — estimated days to threshold
- [ ] Dropout risk detector — early warning signal
- [ ] Content difficulty ranker — calibrated per student
- [ ] Spaced repetition interval calculator — Leitner/Ebbinghaus based
- [ ] Cohort similarity clustering — groups students by need
- [ ] Adaptive threshold auto-calibrator — adjusts mastery thresholds

### 4B. LLM Responsibilities (check LLM API calls, prompt templates, output parsers)

- [ ] Lesson content generator — topic + grade → full lesson
- [ ] Flashcard deck builder — topic → Q&A pairs
- [ ] Quiz question generator — topic + difficulty → questions + options + answers
- [ ] Revision note writer — weak topic → concise notes
- [ ] Mind map structure generator — topic → hierarchical JSON
- [ ] Misconception correction explainer — wrong answer → why + correct
- [ ] AI tutor — student question → grade-appropriate answer (conversational)
- [ ] Student progress summary writer — data → human-readable summary (teacher)
- [ ] Parent report auto-writer — performance data → parent-friendly paragraph
- [ ] Post-exam personalised feedback — result data → student feedback
- [ ] Worksheet generator — topic + difficulty → structured worksheet
- [ ] Real-life application story builder — topic → relatable example
- [ ] Hinge question generator — topic + lesson stage → diagnostic question
- [ ] Differentiated content writer — topic → 3 versions (Foundation, Standard, Extension)
- [ ] Answer explanation generator — question + correct answer → step-by-step

---

## SECTION 5 — TECHNICAL ARCHITECTURE

### 5A. Data and Storage (check database models, migrations, and schemas)

- [ ] Student profile model — ID, name, class, section, school, session, guardian, subjects
- [ ] Academic score store — assignment, quiz, test scores per topic per date
- [ ] Activity event log — lesson views, video watches, quiz attempts, time spent
- [ ] Mastery score table — student × topic × score × updated_at
- [ ] Learning path store — student × assigned path × stage × completion status
- [ ] Content library CMS — lesson, PDF, video, worksheet, flashcard assets
- [ ] Exam and result database — exam meta, questions, student answers, scores
- [ ] Flashcard and quiz content store — question, options, answer, difficulty
- [ ] Spaced repetition schedule table — student × card × next_review_date × interval
- [ ] Curriculum map database — class × subject × chapter × topic × prerequisite × difficulty
- [ ] Notification queue — student/teacher/parent notifications with delivery status
- [ ] Audit and access log — all user actions with timestamp and role

### 5B. APIs and Services (check route files and API documentation)

- [ ] Auth API — JWT-based login, role routing (student/teacher/parent/admin)
- [ ] Student data API — CRUD for profile, scores, activity
- [ ] Learning path API — fetch path, update stage, override
- [ ] Mastery scoring API — calculate and update mastery per topic
- [ ] Content delivery API — serve lessons, PDFs, videos, worksheets
- [ ] AI inference API — LLM endpoint for content generation and tutor
- [ ] ML prediction API — risk scores, mastery forecasts, engagement scores
- [ ] Exam management API — create, schedule, submit, grade, publish
- [ ] Grading engine API — auto-grade MCQ, store scores, trigger path update
- [ ] Notification push API — in-app and email/SMS delivery
- [ ] Report export API — generate and download PDF and CSV reports
- [ ] Analytics aggregation API — class, cohort, and admin-level rolled-up data

### 5C. Security and Access Control (check auth middleware, role guards, encryption)

- [ ] Role-based access control — student / teacher / parent / admin roles enforced
- [ ] Student data encryption — PII fields encrypted at rest
- [ ] Secure exam session — tab-lock, copy-disable, timer enforcement
- [ ] Anti-copy exam mode — right-click disable, clipboard block
- [ ] Session timeout management — auto-logout on inactivity
- [ ] Parent consent and data privacy controls
- [ ] Teacher approval gate — AI path changes require teacher confirmation
- [ ] AI output moderation — LLM responses filtered before display
- [ ] Data retention policy — automatic purge after configured period
- [ ] Full audit trail — every create, update, delete logged with user and timestamp
- [ ] GDPR / data protection compliance — data export and delete on request
- [ ] 2FA for teacher and admin accounts

### 5D. Infrastructure and DevOps (check deployment config, environment files, CI/CD)

- [ ] Cloud hosting — scalable container or serverless deployment
- [ ] CDN for content delivery — static assets served via CDN
- [ ] Real-time event bus — WebSocket or pub/sub for live notifications
- [ ] Background job scheduler — cron or queue for spaced repetition, reports
- [ ] ML model serving pipeline — scheduled retraining and inference endpoint
- [ ] LLM API integration — API key management, rate limiting, fallback
- [ ] Mobile-responsive design — PWA or React Native support
- [ ] Offline mode for lessons — service worker or cached content
- [ ] CI/CD deployment pipeline — automated test and deploy on push
- [ ] Error monitoring and alerting — Sentry or equivalent
- [ ] Performance logging — response time, query time, AI latency
- [ ] Backup and disaster recovery — automated DB snapshots

---

## SECTION 6 — TRACKING, UPDATES, AND DASHBOARDS

### 6A. Student Dashboard Tracking (check student-facing analytics components)

- [ ] Phase completion percentage — per subject per session
- [ ] Mastery level per topic — current score and threshold
- [ ] Quiz score history — chart over time
- [ ] Streak and consistency tracker
- [ ] Time spent per subject — daily and cumulative
- [ ] Pending and completed learning steps
- [ ] Flashcard recall rate — correct vs incorrect
- [ ] Error frequency log — recurring mistakes flagged
- [ ] Exam history and trend — score over multiple exams
- [ ] Badge and milestone log — earned and locked

### 6B. Teacher Dashboard Tracking (check teacher analytics and alert systems)

- [ ] Class mastery heatmap — student × topic grid
- [ ] Weak student alert list — ML-flagged, with reason
- [ ] Assignment completion rate — per assignment per class
- [ ] Topic-wise gap view — which topics most students struggle with
- [ ] Engagement score per student — active vs passive
- [ ] Intervention log — what was done, when, by whom
- [ ] Learning path override log — all manual changes tracked
- [ ] Exam result per student — score, rank, topic breakdown
- [ ] Improvement score trend — 7, 15, 30-day windows
- [ ] 30-day cohort report — class-wide improvement narrative

### 6C. Parent Dashboard Tracking (check parent portal or notification system)

- [ ] Learning progress summary — weekly digest
- [ ] Attendance and engagement summary
- [ ] Weak areas notification — subject and topic level
- [ ] Exam date reminders — push or email
- [ ] Result release alert — instant notification
- [ ] Teacher remarks feed — from teacher portal
- [ ] Suggested home support actions
- [ ] Monthly AI-generated progress report (LLM)
- [ ] Report card download link
- [ ] Milestone and achievement celebration alert

### 6D. Admin Dashboard Tracking (check admin panel and reporting tools)

- [ ] School-wide mastery view — aggregated by class and subject
- [ ] Subject performance matrix — which subjects are weakest
- [ ] Teacher effectiveness report — class improvement per teacher
- [ ] AI path effectiveness audit — path type vs outcome
- [ ] Dropout and risk dashboard — school-wide at-risk count
- [ ] Cohort trend — term-on-term performance comparison
- [ ] Content usage analytics — which materials are used most
- [ ] System health monitoring — uptime, API response, error rate
- [ ] Exam integrity reports — suspicious activity flags
- [ ] Export all data — CSV, PDF, Excel for all views

---

## OUTPUT FORMAT FOR CLAUDE CODE

After scanning the codebase, produce the audit report in this exact format:

---

### AUDIT REPORT — EEC ADAPTIVE LEARNING SYSTEM

#### SUMMARY
- Total items audited: [N]
- ✅ Present: [N] ([%])
- ⚠️ Partial: [N] ([%])
- ❌ Missing: [N] ([%])
- Priority: Critical gaps listed first

---

#### SECTION-BY-SECTION RESULTS

For each section, list every item with its status:

**[Section Name]**

| Item | Status | Notes |
|------|--------|-------|
| Login and onboarding screen | ✅ PRESENT | Found at src/pages/Login.jsx |
| AI tutor chat interface | ⚠️ PARTIAL | Component exists but not connected to LLM API |
| Spaced repetition scheduler | ❌ MISSING | No scheduler or cron job found |

---

#### CHANGE SUGGESTIONS (PARTIAL and MISSING only)

For every non-PRESENT item, provide:

**Item:** [Name]
**Status:** ⚠️ PARTIAL / ❌ MISSING
**Gap:** [What is missing or broken]
**Suggested fix:**
- File to create or edit: `src/services/spacedRepetition.js`
- What to add: [Description]
- Code example:
```js
// example code here
```

---

#### PRIORITY ACTION LIST

After the full audit, list the top 10 highest-impact changes ranked by:
1. Student learning impact
2. Teacher usability impact
3. System correctness (broken logic, missing data models)
4. AI/ML completeness

Format:
1. [Item] — [Why it's critical] — [Estimated effort: Low/Medium/High]
2. ...

---

## ADDITIONAL CONTEXT FOR CLAUDE CODE

### Pedagogical model this system is built on:
- Bloom's Taxonomy — content and assessments must map to cognitive levels
- Constructivism + ZPD — content difficulty must stay just above current mastery
- Dual Coding Theory — all lessons should have both text and visual components
- Spaced Repetition (Ebbinghaus) — recall at Day 1, 3, 7, 14 after learning
- Mastery Learning (Bloom) — students must hit threshold before advancing
- Self-Determination Theory — autonomy (choice), competence (mastery), relatedness (peer/teacher)

### Mastery threshold routing logic (must be enforced in path engine):
- Below 40% → basic concept lesson + guided practice
- 40–60% → revision material + easy practice
- 60–75% → medium worksheet + quiz
- Above 75% → advance to next topic
- Above 90% → advanced challenge questions
- Repeated mistakes → misconception-based explanation
- Low engagement → shorter/simpler content
- Weak retention → spaced revision quiz (4R method)
- Continued difficulty → alert teacher for intervention

### Core outcome formula (must be tracked in analytics):
- Improvement Score = Post-Learning Score − Baseline Score
- Adaptive Impact = Score Improvement + Mastery Growth + Reduced Mistakes + Engagement Rate + Teacher Validation

### Four user roles with distinct access:
- Student — learning path, lessons, quizzes, exams, AI tutor, progress
- Teacher — class management, content creation, AI tools, grading, alerts
- Parent — read-only progress, notifications, reports
- Admin — school-wide analytics, system config, exports

### AI layer split:
- ML: prediction, pattern detection, scoring, clustering, forecasting
- LLM: content generation, explanation, summarisation, conversation
- Teacher always has override authority over AI decisions

---

Begin the audit now. Scan all files systematically before producing the report.
