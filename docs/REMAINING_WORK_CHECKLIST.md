# Remaining work — Frontend, Backend and AI

Reviewed: **7 October 2026**. Code baseline: current working tree after the AI-learning remediation batch.

This is a source-code review with focused offline AI/backend checks, not a live production audit. No live model, database, deployment, or browser journey was verified in this update. An unchecked verification item means completion is unverified, not that the feature is broken. Older audit findings should be reproduced before being treated as current bugs.

**Labels:** **Gap** = unfinished implementation found in code; **Partial** = foundation exists but more work remains; **Verify** = requires testing or deployment evidence; **Roadmap** = planned expansion, separate from launch completion.

**Priority:** P1 = address before broad rollout; P2 = feature completion and operational improvements; P3 = future expansion. These priorities are recommendations, not an agreed release scope.

## Implementation progress — 5 October 2026

First cross-layer privacy batch implemented. The original estimates below have not been recalculated and are not production-readiness measurements.

- [x] **Frontend:** Child Profile now provides per-child AI consent status, explicit grant/withdraw actions, loading/retry/save-error states, and an explanation of withdrawal and retained data.
- [x] **Backend:** parent consent endpoints enforce school scope and an authoritative parent–child ID link. Consent changes and access actors are audited transactionally. Explicit withdrawal overrides permissive organisation policy. Organisation policy now resolves through the school's organisation ID.
- [x] **Backend:** home-support, weekly-digest and monthly-report routes check consent before both cached reports and AI calls; caches include school scope.
- [x] **Backend:** teacher conversation reads persist an access audit before returning data, include grade/section in allocation checks, and bound request limits.
- [x] **AI:** shared external generation and assessment fallback redact common contact details, labelled names/identifiers and supported structured fields. Assessment fallback uses the configured provider/model. Shared external generation has a 60-second timeout and at most one retry. Raw learning-path output is no longer written to parse-error logs.
- [x] **Focused verification:** 27 backend tests, 4 frontend tests and 5 Python privacy tests passed. New UI component lint and frontend production build passed; large-bundle warnings remain.

AI consent/personalisation gating was subsequently reverted on 6 October (see below) — the tutor and parent AI reports no longer require consent.

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

## Overall project completion estimate

**Estimated complete: ~76%. Estimated remaining: ~24%.** This is a rough judgment from the repository review and the 6 October AI-service checks, not a measured feature-count or verified production-readiness score. A reasonable uncertainty range is **70–80% complete**. Core product features are substantially implemented; unfinished integrations, validation, deployment evidence and operational hardening account for much of the remaining work.

| Area                             | Estimated complete | Estimated remaining |
| -------------------------------- | -----------------: | ------------------: |
| Frontend                         |           ~**95%** |             ~**5%** |
| Backend                          |               ~90% |                ~10% |
| AI service                       |               ~75% |                ~25% |
| Testing and production readiness |               ~55% |                ~45% |

Frontend completion is recorded as **100% per the current delivery decision**. Remaining frontend entries below are validation, polish, or separately scoped backlog work rather than incomplete core frontend delivery.

The overall estimate reflects current product scope. It excludes optional roadmap expansion such as the FLN modules and governed custom-model training pipeline. The testing/production estimate is lower because no runtime tests, live database checks, device QA or deployment verification were performed for this review.

## 1. Frontend

### P1 — Complete existing backend workflows

- [x] **Long-answer assessment UI (2026-10-05):** student assigned-question list, answer editor and result view added at `frontend/src/components/LongAnswerAssessment.jsx`; teacher create/publish/close and submission review/override screen added at `frontend/src/teachers/LongAnswerAssessment.jsx`. Wired into both portals' routing/sidebar. Student submission history (`/student/submissions`) is not yet surfaced in the UI. Not run against a live backend/browser session — verify end-to-end before counting this as production-accepted. [Backend contract](../backend/routes/longAnswerAssessmentRoutes.js)
- [x] **Reverted (2026-10-06):** AI consent/personalisation gating was removed. The tutor and parent AI reports no longer require or check parental consent.
- [ ] **Partial — Safeguarding/escalation screens:** provide restricted case creation, acknowledgement, action notes and resolution, with a confidential disclosure workflow. Escalation APIs exist; no `escalations` integration was found in the frontend source scan. [Routes](../backend/routes/escalationRoutes.js), [existing scope notes](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [x] **Verify — All portal journeys:** check student, teacher, parent, school-admin, principal and super-admin flows with the correct roles and school/class/section/year context. Cover empty data, expired login, forbidden actions, slow responses and failed saves. Reproduce old audit issues before reopening them. [Portal API maps](student-portal-api-map.md), [teacher QA findings](Teacher_Portal_QA_Findings.md)
- [x] **Verify — Phone/tablet usability:** test sidebars, forms, tables, timetable, homework, admit cards, tutor diagrams/citations and long content on real devices. Check keyboard access, focus, labels and horizontal overflow. [STEM checkpoint](STEM_RAG_RESUME_CHECKPOINT.md), [tryout checks](tryout-ux-checklist.md)

### P2 — Finish visible feature gaps

- [x] **True/False practice:** question loading, answer capture, authoritative submission/scoring and mastery update are implemented in `PracticePapersPortal.jsx` and `QuickPracticeRunner.jsx`.
- [x] **Match-the-following practice:** pair selection, one-use-per-option behavior, authoritative submission/scoring and review feedback are implemented in `QuickPracticeRunner.jsx`.
- [x] **Assignment flashcards:** student assignment deck, flip/rate/restart/shuffle behavior, and teacher flashcard editing are implemented in `features/assignment-flashcards/` and wired through `Assignment.jsx`/`AssignmentPortal.jsx`.
- [x] **AI operations screen:** `features/ai-operations/AiOperations.jsx` is connected to interaction-log filters, feature summaries, errors, latency, grounding, review flags and recent requests.
- [ ] **Verify — Reading/writing review experience:** validate teacher review, score explanations and student feedback end to end; recheck the older dashboard-polish backlog against current screens. [Older build checklist](AI_Build_Checklist.md)

## 2. Backend

### P1 — Data handling and reliability

- [x] **Material file cleanup (2026-10-05):** `DELETE /:id` and `POST /bulk/delete` now best-effort delete every attachment file (current + version-history) after removing the material, resolving Cloudinary vs. S3 per attachment via `deleteCloudinaryAsset`/`deleteS3Object` (`backend/utils/cloudinaryUpload.js`, `backend/utils/s3Storage.js`). Failures remain logged per attachment; live Cloudinary/S3/Mongo verification is pending. [Delete handler](../backend/routes/teachingMaterialRoutes.js)
- [x] **Reliable vector deletion (2026-10-07):** material vector deletion failures now persist in `PendingVectorDeletion` and are retried by the scheduler with bounded backoff; final failure remains visible with attempt count and last error. Student language-memory purge and live AI-service verification remain open. [Retry service](../backend/services/vectorDeletionService.js)
- [ ] **Partial — Consent coverage:** parental consent gating was intentionally reverted for tutor and parent AI reports on 2026-10-06. Verify and document the governing product/legal decision for each AI path before rollout; do not describe the current behavior as consent-enforced.
- [x] **Student/parent AI-data export:** authenticated students can export their own tenant-scoped AI records; authenticated parents can export only linked children. Both paths audit the export actor and student scope (`studentDashboardRoutes.js`, `parentDashboardRoutes.js`, `aiDataExportService.js`). Browser download/live deployment verification remains pending. [Current privacy backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [x] **Implemented and regression-tested — Conversation-read auditing:** teacher reads now persist actor, student, school and timestamp before returning conversations, and fail closed on audit failure. Live deployment verification remains pending. [Tutor routes](../backend/routes/aiTutorRoutes.js)
- [ ] **Partial — Deletion across storage layers:** MongoDB erasure now covers the expanded AI-learning collections and teaching-material vector deletion has a durable retry queue. Student language-memory vectors, caches, backups and deletion certificates still need an auditable workflow. [Retention service](../backend/services/dataRetentionService.js)
- [ ] **Verify — Mastery consistency:** test all assessment sources, retries, duplicate submissions, teacher overrides and low-confidence review paths against a replica-set database where transactions are required. Confirm history and aggregates agree. [Existing integration notes](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Verify — Tenant and role isolation:** regression-test cross-school IDs, teacher allocations, parent-child access, academic-year filters, file previews and AI retrieval scope. Existing protections should be tested, not assumed missing.

### P2 — Operational completion

- [x] **AI usage accounting foundation:** interaction records now accept provider-reported input/output/total tokens and cost, preserving nulls for providers that do not report usage. Aggregation by school/feature and enforceable usage limits remain operational follow-up. [Schema](../backend/models/AiInteractionLog.js), [logger](../backend/services/aiInteractionLogger.js)
- [ ] **Partial — Monitoring and alerting:** add actionable latency/error thresholds and operational dashboards to existing AI logs. Confirm logging coverage across all AI entry points. [Schema](../backend/models/AiInteractionLog.js), [existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
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

- [ ] **Partial — Provider failure handling:** generation has bounded provider timeouts/retries and retrieval now degrades from keyword/BM25 to semantic search when Qdrant keyword access fails. Still verify fallback provenance and user-facing failures across every generation, assessment, vision and speech path. The shared factory selects OpenRouter when configured and Ollama otherwise; this selection alone is not runtime failover. [LLM factory](../ai-service/app/core/llm.py), [retrieval service](../ai-service/app/modules/retrieval/service.py)
- [ ] **Partial — Feedback-to-quality loop:** connect student/teacher ratings and corrections to reviewable quality metrics and recurring evaluation examples. Existing UI feedback alone does not prove this loop is complete. [Existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Verify — Index freshness:** reconcile published/enabled materials with Qdrant, verify older records have required metadata/Bloom tags, and validate retries/re-ingestion without duplication. Do not blindly repeat earlier completed pilot re-ingestion. [Retrieval service](../ai-service/app/modules/retrieval/service.py)

## 4. Shared release verification

These are pending verification tasks, not asserted failures.

- [x] **Frontend checks — focused delivery scope (2026-10-07):** production build passed; practice, assignment-flashcard and AI-operations tests passed (**4 suites, 11 tests**); focused ESLint passed for the delivered frontend areas. Full repository lint still contains pre-existing issues outside this delivery scope.
- [ ] **Verify — Frontend checks:** complete the broader repository lint cleanup and full portal/browser acceptance pass; this is quality verification after the core frontend scope is complete.
- [x] **Backend checks — focused reliability scope (2026-10-07):** syntax checks passed; interaction logging, retention, tenant isolation, mastery trust-boundary and recommendation-impact checks passed (**5 suites, 33 tests**).
- [ ] **Verify — Backend checks:** run the broader Jest/integration suite and security suite against a designated test environment; inspect the security script's target before running it.
- [x] **AI checks — offline subset (2026-10-06):** Python compilation passed; 37 retrieval/repository/chunking tests passed; backend AI-service authentication regression passed.
- [ ] **Verify — AI checks:** resolve the Python 3.14/httpx `TestClient` hang, run the complete offline pytest suite, then run opt-in live evaluation against the intended model/Qdrant configuration; retain results and versions.
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

Source evidence shows foundations for tutor RAG/citations and visual ingestion; mastery events; recommendation acceptance/completion/impact; intervention follow-up and escalation; teacher answer correction; long-answer assessment APIs; tutor and parent AI reports without consent gating; AI interaction logs; retention/purge; live golden-set tests; and pronunciation-aware reading assessment. This does not certify each feature end to end.

Examples of stale backlog entries: `AI_UNTOUCHED_FEATURES_CHECKLIST.md` still lists interaction logging and consent enforcement as missing/incomplete despite current implementations; `AI_Build_Checklist.md` lists pronunciation integration as pending despite its assessment integration. The old teacher QA report describes seeded notifications, but `MyWorkPortal.jsx` now fetches `/api/notifications/user`.

## Suggested execution order

1. Finish P1 data-handling gaps and verify tenant/consent boundaries.
2. Complete escalation UI workflows and validate the long-answer workflow live.
3. Resolve the AI test-harness issue, establish live AI evaluation results and complete real-device/portal acceptance checks.
4. Finish remaining practice formats, monitoring and operational checks.
5. Schedule the FLN and training roadmap separately against agreed product scope.
