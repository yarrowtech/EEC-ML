# Remaining work — Frontend, Backend and AI

Reviewed: **6 October 2026**. Code baseline: current working tree after the AI-learning remediation batch and the fresh full-stack audit below.

This is a source-code review with focused offline AI/backend checks, not a live production audit. No live model, database, deployment, or browser journey was verified in this update. An unchecked verification item means completion is unverified, not that the feature is broken. Older audit findings should be reproduced before being treated as current bugs.

**Labels:** **Gap** = unfinished implementation found in code; **Partial** = foundation exists but more work remains; **Verify** = requires testing or deployment evidence; **Roadmap** = planned expansion, separate from launch completion.

**Priority:** P1 = address before broad rollout; P2 = feature completion and operational improvements; P3 = future expansion. These priorities are recommendations, not an agreed release scope.

## Implementation progress — 5 October 2026

First cross-layer privacy batch implemented. The original estimates below have not been recalculated and are not production-readiness measurements.

- [x] **Backend:** teacher conversation reads persist an access audit before returning data, include grade/section in allocation checks, and bound request limits.
- [x] **AI:** shared external generation and assessment fallback redact common contact details, labelled names/identifiers and supported structured fields. Assessment fallback uses the configured provider/model. Shared external generation has a 60-second timeout and at most one retry. Raw learning-path output is no longer written to parse-error logs.
- [x] **Focused verification:** 27 backend tests, 4 frontend tests and 5 Python privacy tests passed. New UI component lint and frontend production build passed; large-bundle warnings remain.

## Fresh full-stack audit — 6 October 2026

This is the current audit result. It supersedes optimistic completion labels from earlier focused checks. A passing build or targeted test does not equal full production readiness.

### Verification results

| Layer | Result | Interpretation |
|---|---|---|
| Frontend production build | **Passed** — Vite transformed 10,681 modules | The application bundles successfully; large chunk warnings remain. |
| Frontend repository lint | **Failed** — 5,326 errors and 3 warnings | The repository ESLint configuration does not consistently cover Jest globals/JSX runtime and reports extensive prop-types, unused-variable and React-in-scope errors. Focused delivered-file lint is not equivalent to repository lint. |
| Frontend full Jest run | **Failed** — 38/53 suites passed; 194/277 tests passed; 15 suites and 83 tests failed | Failures include accessibility violations, assignment notification/test-contract drift, dashboard/attendance/points expectations and registration/login flows. |
| Backend full Jest run | **Failed** — 68/78 suites passed; 407/483 tests passed; 10 suites and 76 tests failed | Failures include assignment and student-subject route contracts, logger utility expectations, promotion/progress timeouts, rate-limit behavior, migration mocks and sandbox server-listen restrictions. |
| Backend security suite | **Not executed successfully** — connection to `127.0.0.1:5000` failed with `EPERM` | The attack suite expects a running backend and cannot certify security from this environment. |
| AI service compile | **Passed** — Python bytecode compilation | Syntax/import compilation is healthy. |
| AI offline focused tests | **Passed** — 39 tests | Retrieval, repository filters, chunking and document STEM-ingestion checks pass; Qdrant compatibility warnings show no live Qdrant server was verified. |
| AI full pytest run | **Not completed** | The full command produced no progress/output and was stopped after hanging; the Python 3.14/httpx `TestClient` compatibility problem remains unresolved. |

### Confirmed remaining implementation or evidence gaps

- **Frontend accessibility:** parent portal axe tests report unnamed buttons/links and an unnamed select. These are real accessibility defects until the components and tests are corrected.
- **Frontend acceptance drift:** assignment evaluation notification badges, attendance text, points updates, dashboard greeting, registration/login and generated-visual expectations fail in the full suite. Some are stale tests, but the contracts must be reconciled before calling the frontend complete.
- **Backend AI-learning mocks — fixed 2026-10-07:** `backend/routes/studentAILearningRoute.js` previously returned grade-based hardcoded courses and hardcoded summary/mind-map content; see the backend P2 section below for the current curriculum/orchestrator-backed implementation.
- **Backend analytics placeholder — fixed 2026-10-07:** `backend/routes/principalDashboardRoutes.js` previously emitted `improvement: 0` and `trend: 'up'` rather than a measured trend; see the backend P2 section below for the current exam-evidence-based calculation.
- **Frontend lint baseline:** repository lint currently reports 5,326 errors, including missing React-in-scope/prop-types rules and test-global configuration errors. This is separate from the successful production build.
- **Backend test regressions:** student allocated-subject tests mock `findOne` while the route now uses `Class.find`/`Section.find`; logger tests expect portal helper exports/metadata that differ from the current implementation; migration tests mock `MigrationBatch` without `updateOne`; promotion/progress/rate-limit tests expose contract or isolation issues. These need either implementation fixes or deliberate test updates, not blanket suppression.
- **AI quality/evaluation:** no live Ollama/Qdrant generation, ingestion, speech, vision or latency/cost evaluation was completed. Full route coverage still cannot be trusted while the test harness hangs.
- **AI data lifecycle:** material vector deletion has retry state, but student language-memory vector purge, cache purge, backup deletion and deletion certificates are still incomplete.
- **Operational readiness:** no verified deployment/rollback/restore rehearsal, model registry, fairness report, alert thresholds or school/feature usage limits were found.

## Implementation progress — 6 October 2026 (AI-service readiness batch)

- [x] **AI service test safety:** the Ollama connection smoke test is now opt-in (`RUN_OLLAMA_CONNECTION_TESTS=1`) instead of making live model calls during normal pytest collection.
- [x] **AI service startup:** model warmup is configurable with `AI_WARMUP_MODELS` and remains enabled by default; tests disable it so route/unit tests do not require GPU speech models. `.env` is loaded relative to the AI service, so startup does not depend on the process working directory.
- [x] **AI retrieval resilience:** hybrid retrieval now falls back to semantic results when Qdrant keyword/BM25 retrieval or index setup is unavailable. Retrieval, repository-filter and chunking checks passed: **37 tests passed**.
- [x] **Backend AI authentication:** the exam-feedback `fetch` call now sends `X-Internal-Key`, matching the shared Axios-authenticated AI calls. Backend AI-auth regression test passed.
- [ ] **Verify — Live AI dependencies:** Ollama and Qdrant were not reachable from the audit environment. Run health and end-to-end generation, ingestion, retrieval, assessment, vision and speech checks against the intended deployment before marking live readiness complete.
- [ ] **Verify — Full route suite:** FastAPI `TestClient` hangs in the current Python 3.14/httpx environment, including with a minimal FastAPI app. Resolve the test-harness compatibility issue and run the complete AI route suite.

## Implementation progress — 7 October 2026 (AI-learning remediation batch)

- [x] **Student learning scope:** `StudentUser` now has durable `classId` and `sectionId` references. Practice resolution prefers these IDs and retains grade/section-name fallback for legacy records.
- [x] **Language-memory correctness:** assessment embeddings run off the event loop; Qdrant memory retrieval is school-scoped, indexed by school, and sorted by stored assessment time before the limit is applied. Reading/writing callers now send `school_id`.
- [x] **Assessment-to-mastery linkage:** completed reading and writing assessments now write verified `reading`/`writing` events to the append-only mastery stream with idempotent assessment IDs. Delivery remains non-blocking if the replica-set transaction is unavailable, with a logged reconciliation signal.
- [x] **Erasure coverage:** explicit student erasure now also purges mastery events, practice attempts, student insights, spaced-repetition schedules, weekly study plans, student progress and other registered AI artifacts through the retention service.
- [x] **Vector deletion retry workflow:** material vector deletion failures are persisted in `PendingVectorDeletion`, retried by the 15-minute scheduler with bounded backoff, and retained with attempt/error/completion state. Student language-memory vector deletion still needs a student-specific purge endpoint.

## E01–E20 reconciliation — 7 October 2026

The supplied audit table is retained as historical evidence. The current tree changes the status of several entries:

| IDs | Current status | Evidence / remaining action |
|---|---|---|
| E01 | **Resolved / stale finding** | `backend/routes/index.js` registers `/api/baseline`; route registration is centralized there rather than in the line range cited by the old audit. |
| E02 | **Implemented; verify live** | Tenant plugin and resolver apply organization scope to Mongoose operations. Run cross-organization integration tests against MongoDB. |
| E03 | **Improved / partial** | `StudentUser` now stores `classId` and `sectionId`; durable goals are still not modeled. Backfill legacy students and verify all enrollment paths populate IDs. |
| E04–E07 | **Implemented foundation** | Mastery uses append-only assessment events and blended projections; practice submissions update mastery; recommendation lifecycle events record issue/decision/completion/impact. Verify replica-set behavior and duplicate events. |
| E08–E10 | **Implemented / partial legacy coverage** | Context and tutor retrieval pass school/class/section scope when IDs exist. Legacy name fallback remains for older students and should be migrated and tested. |
| E11–E12 | **Resolved in current code** | AI service requires `X-Internal-Key`; CORS is closed to browser origins; material downloads enforce HTTPS, approved hosts, and size limits. Verify deployment configuration and key rotation. |
| E13 | **Fixed in current batch** | Language memory no longer awaits a synchronous embed call; retrieval requires school scope and returns newest records first. Existing Qdrant records should be rechecked for `school_id`/`created_at`. |
| E14 | **Partial** | Teacher analytics and intervention records exist. Allocation-scoped outcome evidence and live teacher-journey verification remain. |
| E15 | **Improved in current batch** | Reading/writing results now feed mastery events. Validate scoring quality and replica-set transaction behavior. |
| E16 | **Partial / not a trained ML claim** | Current “ML” services are deterministic evidence/heuristic engines. Remove or relabel any UI copy that implies trained-model accuracy; fix remaining field/schema mismatches if reproduced. |
| E17 | **Improved / partial** | Erasure now purges more Mongo collections through the retention service; material-vector failures have a durable retry queue. Student language-memory vectors, files, backups, and deletion certificates still require an operational workflow. |
| E18 | **Partial** | Server-backed learning data exists, but frontend placeholders/mock fallbacks still require a portal sweep to ensure they cannot be presented as authoritative intelligence. |
| E19 | **Open verification** | Providers/models are configured and interaction logs now accept provider usage/cost, but evaluation, latency, fairness, and a model-version registry remain missing. |
| E20 | **Superseded by focused checks** | Current focused verification: Python compile passed, 37 retrieval/repository/chunking tests passed, and backend AI-auth regression passed. Full AI route suite and live Ollama/Qdrant evaluation remain pending. |

## Implementation progress — 5 October 2026 (later batch)

Two P1 items closed from this checklist. Not yet reflected in the completion estimates below (not recalculated).

- [x] **Frontend — Long-answer assessment UI:** student assigned-question list, answer editor and result view (`frontend/src/components/LongAnswerAssessment.jsx`); teacher create/publish/close and submission review/grade-override screen (`frontend/src/teachers/LongAnswerAssessment.jsx`). Wired into both portals' routing and sidebars. Student submission *history* (`/student/submissions`) is not yet surfaced. Not exercised against a live backend/browser session.
- [x] **Backend — Material file cleanup:** `DELETE /:id` and `POST /bulk/delete` best-effort delete current and version-history attachments through Cloudinary/S3. Vector deletion failures now have a durable retry queue; live Cloudinary/S3/Mongo verification remains pending. Covered by the existing Cloudinary/S3 tests.
- [x] **Verification:** full backend Jest suite re-run; pre-existing flaky failures (promotion/progress routes, unrelated to this batch) confirmed present before this batch too. Frontend lint and production build passed for all touched/new files.

## Implementation progress — 7 October 2026 (backend reliability batch)

- [x] **AI-data portability:** added authenticated, school-scoped student and parent-child export endpoints with audit records. Export includes the registered AI-learning collections and does not allow a parent to request an unrelated student.
- [x] **AI usage fields:** `AiInteractionLog` now stores provider-reported input/output/total tokens and cost when available; the logger normalizes OpenAI/LangChain-style usage keys without inventing billed usage for local providers.
- [x] **Vector deletion reliability:** teaching-material vector deletion failures now create a durable `PendingVectorDeletion` record and are retried by the scheduled worker with bounded backoff and attempt/error state.
- [x] **Focused backend verification:** syntax checks passed and **5 suites / 33 tests** passed for interaction logging, retention, tenant isolation, mastery trust boundaries and recommendation impact.

## Implementation progress — 7 October 2026 (backend analytics/content-gap batch)

- [x] **Backend — Real AI-learning courses/content:** `backend/routes/studentAILearningRoute.js` replaced its hardcoded grade-based course list and mock summary/mind-map/flashcard/quiz content with Subject + published-material-backed courses and an AI-service orchestrator call (`/orchestrate`, `task_type: generate`). No frontend route currently calls this endpoint, so it is unverified against a live UI session.
- [x] **Backend — Real principal analytics trend:** `backend/routes/principalDashboardRoutes.js` now derives per-subject `improvement`/`trend` and the overall `improvementRate` from earliest-vs-latest dated `ExamResult` averages instead of the hardcoded `improvement: 0` / `trend: 'up'`. Unverified against live exam data.
- [x] **Verification:** both files pass `node -c` syntax checks; no other code referenced the removed mock helper functions; the pre-existing, unrelated `apiBootstrap.test.js` principal-route failure (ParentUser/mongoose load-order issue) was confirmed present before this batch too.

## Implementation progress — 7 October 2026 (AI service provider-resilience batch)

- [x] **Fixed — Ollama timeout/retry parity:** the Ollama branch of `create_chain()` (`ai-service/app/core/llm.py`) now sets a 60s client timeout and a bounded retry (`stop_after_attempt=2`), matching the OpenRouter branch; previously only OpenRouter had bounded timeout/retry.
- [x] **Fixed — Real cross-provider failover in tutor generation:** `ai-service/app/modules/chat/service.py`'s `/generate/tutor` path now retries once on Ollama if the configured OpenRouter primary call raises, instead of only ever using whichever provider was selected at startup. The response's `lineage.usedProviderFallback` flag records when this happened.
- [x] **Added — Index-freshness reconciliation tooling:** `GET /ingest/index-audit` (`ai-service/app/modules/documents/router.py` + `repository.py::audit_index_health()`) summarises, per `material_id`, Qdrant chunk count, distinct school IDs, and missing required payload fields. `backend/scripts/reconcileAiIndex.js` (`npm run ai:reconcile-index`) diffs that against published/enabled `TeachingMaterial` records to report not-indexed, orphaned, and incomplete-metadata materials. Read-only; not yet run against a live Qdrant collection.
- [x] **Verification:** full offline pytest run (excluding opt-in live/eval markers) — **167 passed, 1 skipped** (4 new tests for the index-audit endpoint/repository function), no regressions from either change in this batch.
- **Not addressed in this batch (require live infra, human review, or a product decision on scope — not closeable by writing more code):** release-evaluation pass thresholds, grounding/hallucination measurement against teacher-reviewed examples, AI-specific attack evaluation, STEM/visual accuracy expansion beyond the pilot, speech quality on real devices, fairness/forecast validation, the feedback-to-quality loop, monitoring/alerting dashboards, and actually running the new index-audit tooling against a live Qdrant collection. These remain listed as `Partial`/`Verify` in the sections below — see each for what it specifically needs before it can close.

## Overall project completion estimate

**Estimated complete: ~75%. Estimated remaining: ~25%.** This is a rough judgment from the fresh source audit, full test runs, the 7 October backend analytics/content-gap batch and the 7 October AI service provider-resilience/index-tooling batch — not a measured feature-count or verified production-readiness score. Core product features are substantially implemented; failing contracts, accessibility defects, live AI validation and operational evidence account for the remaining work. The two hardcoded backend paths flagged in the fresh audit (`studentAILearningRoute.js`, `principalDashboardRoutes.js`) are now implemented against real data, AI-service generation now has real cross-provider failover instead of a one-time provider pick, and read-only index-freshness reconciliation tooling now exists where none did before — so the backend and AI service estimates below both move up slightly; none of this is verified against live infrastructure (a real AI service, exam dataset, or Qdrant collection).

| Area                             | Estimated complete | Estimated remaining |
| -------------------------------- | -----------------: | ------------------: |
| Frontend                         |           ~**90%** |            ~**10%** |
| Backend                          |               ~89% |                ~11% |
| AI service                       |               ~78% |                ~22% |
| Testing and production readiness |               ~55% |                ~45% |

Frontend is **not recorded as 100%** after the fresh full-suite audit. Core feature coverage is broad, but accessibility defects, failing UI contracts and unverified portal/device journeys remain.

Backend is **not recorded as 100%**: the two hardcoded-content gaps are closed, but the student language-memory vector purge endpoint, scheduled-job reliability and migration-apply evidence remain open per the P1/P2 sections below.

AI service is **not recorded as 100%**: provider failure handling in the tutor-generation path is fixed and index-freshness reconciliation tooling now exists, but release-evaluation thresholds, grounding/hallucination measurement, AI-specific attack evaluation, STEM/visual accuracy expansion, real-device speech quality, fairness/forecast validation, the feedback-to-quality loop, and actually running the reconciliation tooling against a live Qdrant collection all still require live model/Qdrant access and human review that code changes alone cannot provide — see the AI service section below.

The overall estimate reflects current product scope. It excludes optional roadmap expansion such as the FLN modules and governed custom-model training pipeline. The testing/production estimate is lower because no runtime tests, live database checks, device QA or deployment verification were performed for this review.

## 1. Frontend

### P1 — Complete existing backend workflows

- [x] **Long-answer assessment UI (2026-10-05):** student assigned-question list, answer editor and result view added at `frontend/src/components/LongAnswerAssessment.jsx`; teacher create/publish/close and submission review/override screen added at `frontend/src/teachers/LongAnswerAssessment.jsx`. Wired into both portals' routing/sidebar. Student submission history (`/student/submissions`) is not yet surfaced in the UI. Not run against a live backend/browser session — verify end-to-end before counting this as production-accepted. [Backend contract](../backend/routes/longAnswerAssessmentRoutes.js)
- [ ] **Partial — Safeguarding/escalation screens:** provide restricted case creation, acknowledgement, action notes and resolution, with a confidential disclosure workflow. Escalation APIs exist; no `escalations` integration was found in the frontend source scan. [Routes](../backend/routes/escalationRoutes.js), [existing scope notes](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Verify — All portal journeys:** the fresh full-suite run still has failures in parent, teacher, admin, attendance, registration/login, dashboard and assignment flows. Re-run all roles with correct school/class/section/year context after contract fixes. [Portal API maps](student-portal-api-map.md), [teacher QA findings](Teacher_Portal_QA_Findings.md)
- [ ] **Verify — Phone/tablet usability:** no real-device/browser acceptance evidence was produced. Check sidebars, forms, tables, timetable, homework, admit cards, tutor diagrams/citations, keyboard focus, labels and horizontal overflow. [STEM checkpoint](STEM_RAG_RESUME_CHECKPOINT.md), [tryout checks](tryout-ux-checklist.md)

### P2 — Finish visible feature gaps

- [x] **True/False practice:** question loading, answer capture, authoritative submission/scoring and mastery update are implemented in `PracticePapersPortal.jsx` and `QuickPracticeRunner.jsx`.
- [x] **Match-the-following practice:** pair selection, one-use-per-option behavior, authoritative submission/scoring and review feedback are implemented in `QuickPracticeRunner.jsx`.
- [x] **Assignment flashcards:** student assignment deck, flip/rate/restart/shuffle behavior, and teacher flashcard editing are implemented in `features/assignment-flashcards/` and wired through `Assignment.jsx`/`AssignmentPortal.jsx`.
- [x] **AI operations screen:** `features/ai-operations/AiOperations.jsx` is connected to interaction-log filters, feature summaries, errors, latency, grounding, review flags and recent requests.
- [ ] **Verify — Reading/writing review experience:** validate teacher review, score explanations and student feedback end to end; recheck the older dashboard-polish backlog against current screens. [Older build checklist](AI_Build_Checklist.md)
- [ ] **Gap — Accessibility cleanup:** fix the parent portal axe findings for unnamed buttons/links/selects and rerun the parent accessibility suite.

## 2. Backend

### P1 — Data handling and reliability

- [x] **Material file cleanup (2026-10-05):** `DELETE /:id` and `POST /bulk/delete` now best-effort delete every attachment file (current + version-history) after removing the material, resolving Cloudinary vs. S3 per attachment via `deleteCloudinaryAsset`/`deleteS3Object` (`backend/utils/cloudinaryUpload.js`, `backend/utils/s3Storage.js`). Failures remain logged per attachment; live Cloudinary/S3/Mongo verification is pending. [Delete handler](../backend/routes/teachingMaterialRoutes.js)
- [x] **Reliable vector deletion (2026-10-07):** material vector deletion failures now persist in `PendingVectorDeletion` and are retried by the scheduler with bounded backoff; final failure remains visible with attempt count and last error. Student language-memory purge and live AI-service verification remain open. [Retry service](../backend/services/vectorDeletionService.js)
- [x] **Student/parent AI-data export:** authenticated students can export their own tenant-scoped AI records; authenticated parents can export only linked children. Both paths audit the export actor and student scope (`studentDashboardRoutes.js`, `parentDashboardRoutes.js`, `aiDataExportService.js`). Browser download/live deployment verification remains pending. [Current privacy backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [x] **Implemented and regression-tested — Conversation-read auditing:** teacher reads now persist actor, student, school and timestamp before returning conversations, and fail closed on audit failure. Live deployment verification remains pending. [Tutor routes](../backend/routes/aiTutorRoutes.js)
- [ ] **Partial — Deletion across storage layers:** MongoDB erasure now covers the expanded AI-learning collections and teaching-material vector deletion has a durable retry queue. Student language-memory vectors, caches, backups and deletion certificates still need an auditable workflow. [Retention service](../backend/services/dataRetentionService.js)
- [ ] **Verify — Mastery consistency:** test all assessment sources, retries, duplicate submissions, teacher overrides and low-confidence review paths against a replica-set database where transactions are required. Confirm history and aggregates agree. [Existing integration notes](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Verify — Tenant and role isolation:** regression-test cross-school IDs, teacher allocations, parent-child access, academic-year filters, file previews and AI retrieval scope. Existing protections should be tested, not assumed missing.

### P2 — Operational completion

- [x] **AI usage accounting foundation:** interaction records now accept provider-reported input/output/total tokens and cost, preserving nulls for providers that do not report usage. Aggregation by school/feature and enforceable usage limits remain operational follow-up. [Schema](../backend/models/AiInteractionLog.js), [logger](../backend/services/aiInteractionLogger.js)
- [ ] **Partial — Monitoring and alerting:** add actionable latency/error thresholds and operational dashboards to existing AI logs. Confirm logging coverage across all AI entry points. [Schema](../backend/models/AiInteractionLog.js), [existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [x] **Fixed (2026-10-07) — Replace hardcoded AI-learning content:** `backend/routes/studentAILearningRoute.js` now builds `/courses/:studentId` from the student's actual `Subject` records and chapter/topic titles pulled from materials published to their class+section, and `/generate-content` calls the AI service orchestrator (`/orchestrate`, `task_type: generate`) instead of returning static mock summaries/mind-maps/flashcards/quizzes. No frontend consumer of this route was found in the current tree, so behavior could not be verified end-to-end through a UI; verify against a live AI service before relying on it.
- [x] **Fixed (2026-10-07) — Principal analytics trends:** `backend/routes/principalDashboardRoutes.js` now computes per-subject `improvement`/`trend` from the earliest vs. latest dated `ExamResult` average for that subject (falls back to `0`/`flat` when fewer than two dated exams exist), and `academicOverview.improvementRate` is the mean of those measured per-subject improvements instead of a hardcoded `0`. Not yet verified against live exam data.
- [ ] **Verify — Scheduled jobs:** verify retention, recommendation-impact and intervention-follow-up jobs run reliably, avoid duplicate work and surface failures in the deployed environment.
- [ ] **Verify — Migrations:** record dry-run/apply results for tenant, payment, assignment-year, notification and usage migrations that the target environment actually needs. Scripts existing does not prove they were applied. [Available commands](../backend/package.json)

## 3. AI service and learning intelligence

### P1 — Quality before wider rollout

- [ ] **Partial — Release evaluation suite:** expand the existing opt-in golden-set tests into a repeatable release check with explicit pass thresholds. Current tests check retrieval, one cross-school scenario, response flags and keyword presence; they do not establish factual correctness alone. [Live evaluation suite](../ai-service/tests/test_eval_live.py)
- [ ] **Partial — Grounding and hallucination measurement:** evaluate answer correctness and citation support against teacher-reviewed examples; measure unsupported answers and inappropriate refusals across subjects and grades.
- [ ] **Partial — AI-specific attack evaluation:** cover instruction injection in uploaded material and prompts, cross-tenant requests, personal-data extraction and unsafe output. General backend security testing is not sufficient evidence for these cases. [Existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Partial — Free-text personal-data redaction:** Common contact/identifier redaction is now implemented and tested before external model calls. Unlabelled names, narrative identifiers, images, training-data extraction, historical records and comprehensive log/tracing review remain. [Existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Partial — Assessment quality:** validate quiz answer keys, duplicate questions, rubric scoring, missing-concept detection and low-confidence handoff using reviewed examples. Include Socratic homework behavior and age-appropriate responses.
- [ ] **Verify — STEM and visual accuracy:** expand beyond the bounded pilot to geometry, graphs, tables, circuits, scanned equations, chemistry and biology. Arithmetic/visual tests and a vision ingestion path already exist. [Remaining pilot stages](STEM_RAG_RESUME_CHECKPOINT.md), [AI tests](../ai-service/tests)
- [ ] **Verify — Speech quality on real devices:** check microphone permissions, recording/upload latency, noisy audio and pronunciation accuracy across accents and ages. Pronunciation scoring is already integrated into reading assessment. [Assessment service](../ai-service/app/modules/assessment/service.py)
- [ ] **Partial — Fairness and forecast validation:** assess risk, performance forecasts and speech scores against suitable longitudinal/cohort evidence. Define uncertainty and insufficient-evidence behavior before treating outputs as validated predictions. [Existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)

### P2 — Resilience and feedback

- [x] **Fixed (2026-10-07) — Provider failure handling (generation path):** the Ollama branch of `create_chain()` now gets the same bounded client timeout (60s) and a bounded retry (`with_retry(stop_after_attempt=2)`) that OpenRouter already had. `chat/service.py`'s tutor-generation path now actually fails over across providers — if OpenRouter is configured and primary and the call raises, it retries once on Ollama and records `lineage.usedProviderFallback` so the fallback is visible in the response/interaction log instead of being silently masked. Retrieval already degrades from keyword/BM25 to semantic search when Qdrant keyword access fails. Assessment (`assessment/service.py`) already had real Ollama→OpenRouter failover; vision and speech were not changed in this batch — they already use bounded per-call timeouts but do not cross-provider-fail over, since there is no second provider configured for those paths. All 164 non-live pytest cases pass after this change. [LLM factory](../ai-service/app/core/llm.py), [chat service](../ai-service/app/modules/chat/service.py), [retrieval service](../ai-service/app/modules/retrieval/service.py)
- [ ] **Partial — Feedback-to-quality loop:** connect student/teacher ratings and corrections to reviewable quality metrics and recurring evaluation examples. Existing UI feedback alone does not prove this loop is complete. [Existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [x] **Tooling added (2026-10-07) — Index freshness reconciliation:** `GET /ingest/index-audit` (`ai-service/app/modules/documents/router.py` + `repository.py::audit_index_health()`) scrolls the Qdrant collection once and returns, per `material_id`, chunk count, distinct school IDs, and which required payload fields (`school_id`, `class_id`, `material_id`, `subject_name`, `chapter_title`) are missing on any chunk. `backend/scripts/reconcileAiIndex.js` (`npm run ai:reconcile-index`, optional `--schoolId=`) diffs that against currently published/enabled `TeachingMaterial` records and reports not-indexed, orphaned-in-Qdrant, and incomplete-metadata materials — read-only, no writes to Mongo or Qdrant. Covered by 4 new offline tests (`test_repository_filters.py`, `test_documents_router.py`). **Still open:** this has not been run against a live Qdrant collection, so actual drift/duplication/Bloom-tag coverage in the real index is unverified; re-ingestion-without-duplication behavior is unchanged from `scripts/reingest_materials.py`. [Retrieval service](../ai-service/app/modules/retrieval/service.py), [reconciliation script](../backend/scripts/reconcileAiIndex.js)

## 4. Shared release verification

These are pending verification tasks, not asserted failures.

- [x] **Frontend checks — build/focused scope:** production build passed; practice, assignment-flashcard and AI-operations tests passed (**4 suites, 11 tests**); focused ESLint passed for the delivered frontend areas.
- [ ] **Verify — Frontend full suite:** full Jest is currently **38/53 suites and 194/277 tests passed**. Fix or reconcile the 15 failing suites, including axe accessibility failures and UI contract drift, then complete browser/device acceptance.
- [x] **Backend checks — focused reliability scope (2026-10-07):** syntax checks passed; interaction logging, retention, tenant isolation, mastery trust-boundary and recommendation-impact checks passed (**5 suites, 33 tests**).
- [ ] **Verify — Backend checks:** run the broader Jest/integration suite and security suite against a designated test environment; inspect the security script's target before running it.
- [x] **AI checks — offline subset (2026-10-06):** Python compilation passed; **39** retrieval/repository/chunking/document-ingestion tests passed; backend AI-service authentication regression passed.
- [ ] **Verify — AI full suite/live checks:** the full pytest command hung during collection/run and was stopped. Resolve the Python 3.14/httpx `TestClient` issue, run all offline tests, then run opt-in live evaluation against the intended model/Qdrant configuration; retain results and versions.
- [ ] **Verify — Deployment reproducibility:** document the actual server/container deployment, service startup, configuration, health checks and rollback. Older notes mark Docker Compose and Ubuntu deployment pending; no deployment manifest was found in the scanned repository, which does not prove there is no external deployment.
- [ ] **Verify — Restore and recovery:** demonstrate database/vector/file backup restoration, retention behavior and recovery from interrupted ingestion.
- [ ] **Verify — End-to-end acceptance:** teacher publishes material → ingestion → student tutor/assessment → mastery/recommendation → teacher review → parent visibility, including permission boundaries and failures.
- [ ] **Partial — Reconcile older documentation:** update stale checkboxes only after matching them to current code and test evidence. Preserve historical audit dates and distinguish implementation from production validation.

## 5. Separate roadmap — not automatically launch blockers

- [ ] **Roadmap — FLN outcome tracker:** outcome catalog, observations, seed data, teacher grid and summaries. No FLN implementation references were found in the scanned models/routes/teacher UI. [Detailed plan](module-check-list.md)
- [ ] **Roadmap — FLN activity/rhyme library:** approved content, learning-outcome links, browsing and classroom-use records. [Detailed plan](module-check-list.md)
- [ ] **Roadmap — FLN-specific extensions:** outcome-aware lesson plans, development-profile views, observation-based flags and rubric generation. Generic lesson-plan and risk features already exist; this is the FLN-specific extension. [Detailed plan](module-check-list.md)
- [ ] **Roadmap — Governed training pipeline:** approved extraction, redaction, school opt-out, ownership/provenance, dataset versions, student/school-separated splits, human review and deletion propagation. Interaction logging already exists. [Training backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Roadmap — Model lifecycle:** benchmark, registry and rollback for any future trained models. Avoid describing an unvalidated custom model as production-ready. [Training backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)

## Already implemented — do not count as entirely missing

Source evidence shows foundations for tutor RAG/citations and visual ingestion; mastery events; recommendation acceptance/completion/impact; intervention follow-up and escalation; teacher answer correction; long-answer assessment APIs; tutor and parent AI reports; AI interaction logs; retention/purge; live golden-set tests; and pronunciation-aware reading assessment. This does not certify each feature end to end.

Examples of stale backlog entries: `AI_UNTOUCHED_FEATURES_CHECKLIST.md` still lists interaction logging as missing/incomplete despite current implementation; `AI_Build_Checklist.md` lists pronunciation integration as pending despite its assessment integration. The old teacher QA report describes seeded notifications, but `MyWorkPortal.jsx` now fetches `/api/notifications/user`.

## Suggested execution order

1. Finish P1 data-handling gaps and verify tenant boundaries.
2. Complete escalation UI workflows and validate the long-answer workflow live.
3. Resolve the AI test-harness issue, establish live AI evaluation results and complete real-device/portal acceptance checks.
4. Finish remaining practice formats, monitoring and operational checks.
5. Schedule the FLN and training roadmap separately against agreed product scope.
