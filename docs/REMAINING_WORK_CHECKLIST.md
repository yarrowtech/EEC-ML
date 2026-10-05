# Remaining work — Frontend, Backend and AI

Reviewed: **1 October 2026**. Code baseline: `b9b4250a`.

This is a source-code review reconciled with existing project checklists, not a live production audit. No builds, test suites, database checks, or browser journeys were run for this review. An unchecked verification item means completion is unverified, not that the feature is broken. Older audit findings should be reproduced before being treated as current bugs.

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

Details, API contracts, manual acceptance checks and limitations: [AI consent and external-provider privacy](ai-consent-and-external-privacy.md).

This batch does **not** complete all consent coverage, full personal-data anonymisation, training-data redaction, replica-set integration verification or production acceptance. It does not erase historical data or cancel in-flight AI requests. Other teacher-report/assessment paths, student status UI and an admin consent screen remain to be reviewed/completed.

## Implementation progress — 5 October 2026 (later batch)

Two P1 items closed from this checklist. Not yet reflected in the completion estimates below (not recalculated).

- [x] **Frontend — Long-answer assessment UI:** student assigned-question list, answer editor and result view (`frontend/src/components/LongAnswerAssessment.jsx`); teacher create/publish/close and submission review/grade-override screen (`frontend/src/teachers/LongAnswerAssessment.jsx`). Wired into both portals' routing and sidebars. Student submission *history* (`/student/submissions`) is not yet surfaced. Not exercised against a live backend/browser session.
- [x] **Backend — Material file cleanup:** `DELETE /:id` and `POST /bulk/delete` on the teaching-material route now best-effort delete every attachment file (current + version-history), routed to Cloudinary or S3 per attachment (`deleteCloudinaryAsset`/`deleteS3Object`); Cloudinary assets missing a stored `cloudinaryPublicId` (true of essentially all existing ones) fall back to parsing it from the URL. `POST /bulk/delete` also now fires vector deletion per material, which it previously skipped entirely. No persistent retry/reconciliation for failed cleanup — still a gap. Covered by new/expanded unit tests in `backend/__tests__/cloudinaryUpload.test.js` and `backend/__tests__/s3Storage.test.js`; not exercised against a live Cloudinary/S3/Mongo stack.
- [x] **Verification:** full backend Jest suite re-run; pre-existing flaky failures (promotion/progress routes, unrelated to this batch) confirmed present before this batch too. Frontend lint and production build passed for all touched/new files.

## Overall project completion estimate

**Estimated complete: ~75%. Estimated remaining: ~25%.** This is a rough judgment from the repository review, not a measured feature-count or verified production-readiness score. A reasonable uncertainty range is **70–80% complete**. Core product features are substantially implemented; unfinished integrations, validation, deployment evidence and operational hardening account for much of the remaining work.

| Area | Estimated complete | Estimated remaining |
|---|---:|---:|
| Frontend | ~80% | ~20% |
| Backend | ~85% | ~15% |
| AI service | ~70% | ~30% |
| Testing and production readiness | ~50% | ~50% |

The overall estimate reflects current product scope. It excludes optional roadmap expansion such as the FLN modules and governed custom-model training pipeline. The testing/production estimate is lower because no runtime tests, live database checks, device QA or deployment verification were performed for this review.

## 1. Frontend

### P1 — Complete existing backend workflows

- [x] **Long-answer assessment UI (2026-10-05):** student assigned-question list, answer editor and result view added at `frontend/src/components/LongAnswerAssessment.jsx`; teacher create/publish/close and submission review/override screen added at `frontend/src/teachers/LongAnswerAssessment.jsx`. Wired into both portals' routing/sidebar. Student submission history (`/student/submissions`) is not yet surfaced in the UI. Not run against a live backend/browser session — verify end-to-end before counting this as production-accepted. [Backend contract](../backend/routes/longAnswerAssessmentRoutes.js)
- [ ] **Partial — AI consent controls:** expose consent status and a clear administration/parent workflow, including withdrawal behavior and the effect on personalisation. Parent controls are now implemented in Child Profile; student status UI and the admin screen remain. [Consent routes](../backend/routes/aiTutorRoutes.js), [consent service](../backend/services/aiConsentService.js)
- [ ] **Partial — Safeguarding/escalation screens:** provide restricted case creation, acknowledgement, action notes and resolution, with a confidential disclosure workflow. Escalation APIs exist; no `escalations` integration was found in the frontend source scan. [Routes](../backend/routes/escalationRoutes.js), [existing scope notes](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Verify — All portal journeys:** check student, teacher, parent, school-admin, principal and super-admin flows with the correct roles and school/class/section/year context. Cover empty data, expired login, forbidden actions, slow responses and failed saves. Reproduce old audit issues before reopening them. [Portal API maps](student-portal-api-map.md), [teacher QA findings](Teacher_Portal_QA_Findings.md)
- [ ] **Verify — Phone/tablet usability:** test sidebars, forms, tables, timetable, homework, admit cards, tutor diagrams/citations and long content on real devices. Check keyboard access, focus, labels and horizontal overflow. [STEM checkpoint](STEM_RAG_RESUME_CHECKPOINT.md), [tryout checks](tryout-ux-checklist.md)

### P2 — Finish visible feature gaps

- [ ] **Gap — True/False practice:** finish the question-to-attempt-to-result flow; this format is explicitly `comingSoon`. [Practice portal](../frontend/src/components/PracticePapersPortal.jsx)
- [ ] **Gap — Match-the-following practice:** finish question display, answer capture and scoring; this format is explicitly `comingSoon`. [Practice portal](../frontend/src/components/PracticePapersPortal.jsx)
- [ ] **Gap — Assignment flashcards:** replace the “Flashcard functionality coming soon” screen with the assignment-specific flow. Tutor flashcards are a separate existing feature. [Assignments](../frontend/src/components/Assignment.jsx)
- [ ] **Partial — AI operations screen:** connect existing interaction-log aggregates to an admin view for errors, latency, grounding and review-needed results. No frontend references to `interaction-logs` were found. [Existing API](../backend/routes/aiTutorRoutes.js)
- [ ] **Verify — Reading/writing review experience:** validate teacher review, score explanations and student feedback end to end; recheck the older dashboard-polish backlog against current screens. [Older build checklist](AI_Build_Checklist.md)

## 2. Backend

### P1 — Data handling and reliability

- [x] **Material file cleanup (2026-10-05):** `DELETE /:id` and `POST /bulk/delete` now best-effort delete every attachment file (current + version-history) after removing the material, resolving Cloudinary vs. S3 per attachment via `deleteCloudinaryAsset`/`deleteS3Object` (`backend/utils/cloudinaryUpload.js`, `backend/utils/s3Storage.js`); Cloudinary assets without a stored `cloudinaryPublicId` (all pre-existing ones — the upload path never populated it) fall back to parsing the public_id/resource_type out of the URL. Failures are logged per-attachment, not retried — no persistent retry/reconciliation job yet, so a failed delete can still leave an orphaned file silently. Covered by `backend/__tests__/cloudinaryUpload.test.js` and additions to `backend/__tests__/s3Storage.test.js`; not exercised against a live Cloudinary/S3/Mongo stack. [Delete handler](../backend/routes/teachingMaterialRoutes.js)
- [ ] **Partial — Reliable vector deletion (2026-10-05 update):** `POST /bulk/delete` now also fires vector deletion per material (previously it skipped this entirely and only removed the Mongo doc). Both routes still fire vector deletion asynchronously and only log failures — no persistent retry/reconciliation, so a failed cleanup can still leave stale searchable material indefinitely. [Delete handler](../backend/routes/teachingMaterialRoutes.js)
- [ ] **Partial — Consent coverage:** verify every AI path that uses student-specific context observes consent and withdrawal, including teacher-generated reports and assessment flows where applicable. The tutor and three parent AI report routes now enforce consent; other report and assessment flows still need review. [Consent service](../backend/services/aiConsentService.js)
- [ ] **Partial — Student/parent AI-data export:** add an authorised, tenant-scoped export flow with access auditing and a usable download. Existing purge/retention endpoints do not provide export. [Current privacy backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [x] **Implemented and regression-tested — Conversation-read auditing:** teacher reads now persist actor, student, school and timestamp before returning conversations, and fail closed on audit failure. Live deployment verification remains pending. [Tutor routes](../backend/routes/aiTutorRoutes.js)
- [ ] **Partial — Deletion across storage layers:** define and verify deletion/expiry for application records, files, vectors, caches and backups. MongoDB AI-data purge and retention services already exist. [Retention service](../backend/services/dataRetentionService.js)
- [ ] **Verify — Mastery consistency:** test all assessment sources, retries, duplicate submissions, teacher overrides and low-confidence review paths against a replica-set database where transactions are required. Confirm history and aggregates agree. [Existing integration notes](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Verify — Tenant and role isolation:** regression-test cross-school IDs, teacher allocations, parent-child access, academic-year filters, file previews and AI retrieval scope. Existing protections should be tested, not assumed missing.

### P2 — Operational completion

- [ ] **Partial — AI usage accounting:** extend interaction records with input/output tokens and applicable provider cost; aggregate by school/feature and define usage limits. Current schema records latency/output characters but has no token/cost fields. [Schema](../backend/models/AiInteractionLog.js)
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

- [ ] **Partial — Provider failure handling:** verify bounded timeouts, retry behavior, fallback provenance and user-facing failures across generation and assessment. The shared factory selects OpenRouter when configured and Ollama otherwise; this selection alone is not runtime failover. [LLM factory](../ai-service/app/core/llm.py)
- [ ] **Partial — Feedback-to-quality loop:** connect student/teacher ratings and corrections to reviewable quality metrics and recurring evaluation examples. Existing UI feedback alone does not prove this loop is complete. [Existing backlog](../AI_UNTOUCHED_FEATURES_CHECKLIST.md)
- [ ] **Verify — Index freshness:** reconcile published/enabled materials with Qdrant, verify older records have required metadata/Bloom tags, and validate retries/re-ingestion without duplication. Do not blindly repeat earlier completed pilot re-ingestion. [Retrieval service](../ai-service/app/modules/retrieval/service.py)

## 4. Shared release verification

These are pending verification tasks, not asserted failures.

- [ ] **Verify — Frontend checks:** run `npm run build`, `npm run lint` and appropriate Jest suites; record failures and coverage evidence.
- [ ] **Verify — Backend checks:** run relevant Jest/integration tests and the security suite against a designated test environment; inspect the security script's target before running it.
- [ ] **Verify — AI checks:** run offline pytest coverage, then opt-in live evaluation against the intended model/Qdrant configuration; retain results and versions.
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

Source evidence shows foundations for tutor RAG/citations and visual ingestion; mastery events; recommendation acceptance/completion/impact; intervention follow-up and escalation; teacher answer correction; long-answer assessment APIs; consent-gated tutor personalisation; AI interaction logs; retention/purge; live golden-set tests; and pronunciation-aware reading assessment. This does not certify each feature end to end.

Examples of stale backlog entries: `AI_UNTOUCHED_FEATURES_CHECKLIST.md` still lists interaction logging and consent enforcement as missing/incomplete despite current implementations; `AI_Build_Checklist.md` lists pronunciation integration as pending despite its assessment integration. The old teacher QA report describes seeded notifications, but `MyWorkPortal.jsx` now fetches `/api/notifications/user`.

## Suggested execution order

1. Finish P1 data-handling and consent gaps; verify tenant boundaries.
2. Complete long-answer, consent and escalation UI workflows.
3. Establish AI evaluation results and complete real-device/portal acceptance checks.
4. Finish remaining practice formats, monitoring and operational checks.
5. Schedule the FLN and training roadmap separately against agreed product scope.
