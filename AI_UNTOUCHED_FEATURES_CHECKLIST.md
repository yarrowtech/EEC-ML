# EEC AI/ML Portal Readiness Checklist

Audit scope: teacher portal and student portal AI/ML flows.

Status:
- [x] Implemented or available in the current codebase.
- [ ] Missing, incomplete, or requiring production hardening.

## Student Portal

- [x] Subject, topic, mode, difficulty, learning goal, and response-depth selection
- [x] Authentication and school/campus/class/section scoping
- [x] Qdrant retrieval of teacher materials
- [x] RAG citations and visual evidence
- [x] Personalised context: mastery, risk, pace, gaps, memory, development profile
- [x] Conversation history
- [x] Explanation, quiz, flashcard, notes, mind-map, homework, misconception, and practice modes
- [x] Mastery updates from quiz and assessment results
- [x] Wrong-answer error records
- [x] Recommendations and spaced repetition
- [x] Student learning health card
- [x] Exclude disabled materials from the student tutor material query
- [x] Make mastery updates consistent across every tutor and assessment path
- [ ] Track recommendation acceptance, completion, and learning impact

## Teacher Portal

- [x] Weak and at-risk student list
- [x] Risk scores using attendance, assessments, and trends
- [x] Weak-topic and mastery views
- [x] Per-topic mastery heatmap
- [x] Gap-detection results
- [x] Bloom distribution report
- [x] Student AI tutor session visibility
- [x] Intervention creation
- [x] Intervention actions, notes, and scheduled dates
- [x] Intervention outcomes and improvement tracking
- [x] Real-time intervention alerts
- [x] Admin AI performance insights
- [ ] Teacher correction or override of AI answers
- [x] Automatic intervention-plan generation — each new daily at-risk alert now creates a deduplicated, teacher-scoped planned intervention log

## Core Learning Intelligence

- [x] Knowledge-graph prerequisite traversal
- [x] Root-cause gap detection
- [x] Recommendation engine
- [x] Weekly personalised study-plan generator — persisted weekly plan generated from mastery and recommendations; student completion endpoint: `GET/PATCH /api/study-plans/*`
- [x] Bloom classification for newly ingested document chunks; older chunks require re-indexing
- [x] Bloom-level filtering during retrieval — Qdrant accepts a target Bloom level; legacy chunks require re-indexing
- [x] Bloom-level question generation for quiz modes — mastery-derived target is passed to the AI service
- [x] Mastery-based Bloom progression — mastery bands map to remember, understand, apply, analyse, and evaluate
- [x] Concept-error classification
- [x] Calculation-error classification
- [x] Reading-error classification
- [x] Logic-error classification
- [x] Academic answer evaluator connected to stored exam and assignment answers when callers provide their record identifiers
- [x] Missing-concept detection from student answers — evaluator output is persisted on exam answers and assignment submissions
- [x] Confidence score for AI evaluation — evaluator output is persisted on exam answers and assignment submissions
- [x] Automatic mastery updates across baseline, tutor, practice, practice-paper, and exam flows
- [ ] Long-answer assessment workflow — evaluator supports `long_answer`, but a dedicated student assessment UI/submission workflow remains
- [x] Permanent AI-generated question-bank storage — teacher save/list APIs persist generated questions in `GeneratedQuestion`
- [x] Teacher review and editing of generated questions — teacher edit and approve APIs are available with school scoping

## Critical Production Issues

- [x] Add teacher allocation checks to the teacher AI-session endpoint
- [x] Add `isEnabled: true` to the student tutor material query
- [x] Fix tutor evaluation mastery updates so poor results can reduce mastery correctly
- [x] Run scheduled at-risk scans instead of relying only on new mastery events
- [x] Add database-level deduplication for concurrent intervention alerts
- [x] Verify intervention student IDs against teacher allocation scope — intervention creation now validates school, student identity, and teacher allocation
- [x] Check `response.ok` before reporting intervention success in the frontend
- [x] Add cross-teacher and cross-school access tests — teacher allocation scope regression coverage added
- [x] Add disabled-material and alert-deduplication tests — material default and unique insight dedupe-index coverage added
- [x] Add mastery-regression tests after poor results — poor-result score reduction coverage added

## Intervention Effectiveness

- [x] Persist at-risk status with timestamp and reason — `StudentInsight` stores the daily risk record and dedupe key
- [x] Add intervention plan templates — intervention logs now record a `planTemplate`
- [x] Add automatic follow-up assessment after intervention — plans now schedule 7-, 14-, and 30-day checkpoints
- [x] Measure outcomes after 7, 14, and 30 days — checkpoints persist scheduled/completed dates, score, and improvement fields
- [ ] Calculate improvement automatically from later assessment results
- [ ] Escalate serious cases to counsellor or school leadership
- [x] Show open, overdue, and completed interventions on the teacher dashboard API — intervention listing now returns summary counts

## Safety and Governance

- [ ] Wellbeing/distress detection connected to human escalation — wellbeing assessment exists, but no automated human-escalation workflow is connected
- [ ] Safeguarding workflow for abuse, bullying, self-harm, or threats
- [ ] Explainable AI audit trail — generic audit-log infrastructure exists; evaluator prompt/input/output lineage is not yet recorded
- [ ] Bias and fairness monitoring
- [ ] AI response-quality evaluation framework
- [ ] Prompt-injection and security evaluation suite — security attack coverage exists, but it is not yet a complete AI-specific release gate
- [ ] Consent-based AI personalisation controls — parental-consent fields exist, but AI personalisation enforcement and UI controls are incomplete
- [ ] Student/parent AI-data export
- [ ] AI-data correction and deletion workflows
- [ ] Conversation and memory retention policy — retention expiry fields exist for students, but conversation/memory lifecycle policy is incomplete
- [ ] Backup and cache deletion policy
- [ ] Audit log for teacher access to student AI conversations — teacher conversation visibility exists, but access-specific audit coverage is not verified
- [ ] PII redaction from free-text AI inputs

## AI Quality and Monitoring

- [ ] Curriculum-grounding accuracy measurement
- [ ] Hallucination and refusal-rate measurement
- [ ] Age-appropriateness testing
- [ ] Quiz correctness and duplicate-question testing
- [ ] Socratic-mode compliance testing
- [ ] Misconception-correction accuracy testing
- [ ] STEM arithmetic and unit-verification testing
- [ ] Visual-grounding accuracy testing
- [ ] Teacher and student ratings connected to quality metrics
- [ ] Confidence or uncertainty indicators for ML signals
- [ ] Model, prompt, retrieval, and response version logging
- [ ] AI latency monitoring
- [ ] Token and cost monitoring
- [ ] Provider error, retry, and fallback monitoring

## Training-Data Readiness

- [ ] Dedicated AI interaction logging schema
- [ ] Training-data extraction pipeline
- [ ] PII and sensitive-data redaction pipeline
- [ ] School opt-out from model-training use
- [ ] Dataset provenance and ownership tracking
- [ ] Dataset versioning
- [ ] Train/validation/test split process
- [ ] Student and school leakage prevention across dataset splits
- [ ] Human approval of training examples
- [ ] Model evaluation benchmark
- [ ] Model registry and rollback process
- [ ] Training-data deletion propagation

## Recommended Priority Order

1. [x] Fix teacher allocation authorization for student AI-session access
2. [x] Exclude disabled materials from student AI/RAG queries
3. [x] Correct mastery updates across every evaluation path
4. [x] Add scheduled at-risk scanning and reliable teacher alerts
5. [x] Add automatic intervention plans and follow-up measurement
6. [x] Connect academic answer evaluation and missing-concept detection
7. [x] Complete Bloom filtering, question generation, and progression
8. [ ] Add safety escalation and privacy workflows
9. [ ] Add AI quality, cost, latency, and version monitoring
10. [ ] Build the governed training-data pipeline

## Key Implementation References

### Analytics connection work (in progress)

- [x] Shared assessment writer: transactional score/history persistence, retry identifiers, finite-score validation, and decreasing mastery after poor results.
- [x] Baseline, tutor, practice, practice-paper, exam-result updates, post-exam and self-rating routes call the shared writer. Consumer integration/testing is in progress.
- [x] Published assignment grades and exam results have an idempotent reconciliation path; assignment saves trigger synchronization and a 15-minute sweep retries failures.
- [ ] Analytics authorization: intersect all class/section requests with teacher allocations; endpoint tests pending.
- [x] Implemented normalized assessment-evidence summaries and daily regression forecast with explicit insufficient-history status and fit error; integration/tests pending.
- [x] ML risk/trend readers now use assessment events; mastery growth reads append-only events and compares matching topics.
- [x] Follow-up measurement links later assessment evidence to a fixed pre-intervention baseline at days 7/14/30; no evidence leaves a checkpoint pending. Reusable plan templates contain actions.
- [x] At-risk automation resolves real allocation references and uses independent unique upserts for insights, plans, and notifications so retries can recover partial delivery. Decay writes history too.
- [ ] Academic evaluator integration: stored-question evaluation adapter added; exam and assignment connection, explicit fallback provenance and review testing in progress.
- [x] Written exams and rubric assignments use the evaluator; exam retries include timed-out attempts, repeated/unknown question IDs are rejected, omitted answers count as unanswered, and evaluator fallbacks are labeled for review.
- [x] Added class-wide forecast and misconception aggregation from cross-source errors and missing concepts; repeated attempts cannot inflate affected-student percentages.
- [ ] Connect and test every source and analytics consumer. MongoDB replica-set transactions are required; live database verification is still pending.
- [ ] Validate forecasting accuracy using longitudinal assessment data before describing forecasts as production-validated ML.

- At-risk students: `backend/routes/teacherAnalyticsRoutes.js`
- Intervention records: `backend/routes/teacherAnalyticsRoutes.js`
- Mastery updates: `backend/services/masteryEngine.js`
- Immutable mastery history: `backend/models/MasteryEvent.js`, `backend/services/masteryEventService.js` (currently connected to tutor evaluation; remaining assessment sources are next)
- Gap detection: `backend/services/gapDetectionEngine.js`
- Recommendations: `backend/services/recommendationEngine.js`
- Student tutor: `backend/routes/aiTutorRoutes.js`
- Teacher portal: `frontend/src/teachers/StudentAnalyticsPortal.jsx`
- Student tutor UI: `frontend/src/components/AITutorHomeScreen.jsx`
