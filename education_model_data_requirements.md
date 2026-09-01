# Education Model Data Collection Requirements

**Project:** EEC ML educational intelligence and personalization platform  
**Document status:** Planning specification  
**Last updated:** 2026-09-01  
**Primary audience:** Product, engineering, data/ML, academic, security, and school-operations teams

## 1. Executive summary

To build a useful education model, EEC needs more than student marks and chat messages. It needs structured evidence connecting:

1. **What was taught** — curriculum, concept, prerequisite, learning outcome, and content version.
2. **What the learner did** — viewed, attempted, answered, requested a hint, revised, or stopped.
3. **What support was given** — lesson, explanation, recommendation, hint, teacher intervention, or AI response.
4. **What happened afterward** — immediate correctness, later retention, teacher validation, improvement, or no change.

The first recommended models are student-mastery estimation, next-activity recommendation, misconception detection, and tutor-response quality ranking. Training a general-purpose language model from scratch is outside this document's scope and would require a much larger licensed content corpus, specialist infrastructure, and a separate risk review.

EEC already stores curriculum maps, teaching materials, attempts, mastery scores, tutor conversations, reading/writing assessments, student progress, and interventions. The main missing layer is a consistent event and outcome schema that links an input or recommendation to a measurable learning result.

## 2. Goals and non-goals

### Goals

- Estimate mastery for each student, subject, chapter, topic, and concept.
- Identify likely misconceptions and prerequisite gaps.
- Recommend the next suitable learning activity and difficulty.
- Personalize explanation depth, learning mode, and pacing.
- Measure whether AI and teacher interventions improve learning.
- Evaluate retrieval grounding and tutor-response quality.
- Provide explainable signals that teachers can review and override.
- Monitor model quality, safety, reliability, and fairness over time.

### Non-goals

- Predicting intelligence, personality, mental health, family income, or future life outcomes.
- Replacing teacher judgment for grading, promotion, discipline, or special-education decisions.
- Training on student or teacher data simply because it is available.
- Using names, phone numbers, email addresses, fee history, home address, or unrelated administrative records as learning features.
- Creating permanent labels such as “weak student.” Store time-bounded evidence and uncertainty instead.

## 3. Model use cases and required labels

Data collection must start from a decision the model will support. Each use case needs a clearly defined target label.

| Use case | Model input | Target label or ground truth | Decision supported |
|---|---|---|---|
| Topic mastery | Prior attempts, item difficulty, hints, time, concept history | Probability of a correct response on a later, unseen item for the same concept | Ready to advance, practise, or reteach |
| Delayed retention | Mastery state, review history, time since study | Correctness on a review item after a defined delay | When to schedule review |
| Misconception detection | Question, selected answer, work/response, concept | Teacher-validated misconception code or rubric category | Which corrective explanation to show |
| Difficulty selection | Mastery estimate, recent performance, item metadata | Completion and correctness without excessive hints or frustration | Easy, medium, or hard next item |
| Next-activity recommendation | Learning history, curriculum prerequisites, available activities | Learning gain after the recommended activity | Which activity to recommend |
| At-risk learning support | Recent trajectories, missed work, attempts, attendance where approved | Failure to meet a defined academic milestone within a declared window | Teacher review or support—not an automatic adverse action |
| Tutor-response ranking | Question, grounded context, response, mode | Teacher/student quality rating plus subsequent learning outcome | Select safer and more effective tutor responses |
| Retrieval quality | Query, eligible content set, retrieved chunks | Teacher-reviewed relevance and answer-grounding score | Improve retrieval and detect missing material |
| Reading development | Reference text, transcript, timing, rubric | Human-reviewed pronunciation, fluency, and comprehension scores | Targeted language practice |
| Writing development | Prompt, submission, rubric, revisions | Human-reviewed criterion scores and improvement between drafts | Targeted writing feedback |

Do not use an AI-generated score as the only training label for another model. AI labels may bootstrap a dataset, but a sampled subset must be independently reviewed by qualified teachers and label provenance must be stored.

## 4. Data to collect

### 4.1 Tenant, enrollment, and time context — required

These fields establish data ownership and prevent cross-school leakage.

| Field | Purpose |
|---|---|
| `schoolId`, `campusId` | Tenant isolation and school-level evaluation |
| `academicYearId`, `termId` | Correct time period and curriculum version |
| `studentPseudonym` | Stable model identifier that is not a name or public student ID |
| `classId`, `sectionId`, `gradeLevel` | Grade-appropriate modeling and evaluation |
| `enrollmentStart`, `enrollmentEnd` | Define when a learner belongs to a cohort |
| `eventTime`, `ingestedAt`, `timezone` | Sequence learning events and audit delays |
| `sourceSystem`, `schemaVersion` | Trace origin and safely evolve data contracts |

Names and contact information may remain in operational school systems but must be removed or tokenized before data enters a training dataset.

### 4.2 Curriculum and knowledge structure — required

Every learning event must resolve to the same curriculum hierarchy.

| Field | Example |
|---|---|
| `board` / `curriculumCode` | CBSE, ICSE, or approved state/school curriculum code |
| `subjectId` | Mathematics |
| `gradeLevel` | Class 5 |
| `chapterId` and version | Fractions, version 2026.1 |
| `topicId`, `subTopicId`, `conceptId` | Equivalent fractions → simplifying fractions |
| `prerequisiteConceptIds` | Multiplication facts, factors |
| `learningOutcomeIds` | “Compare fractions with unlike denominators” |
| `bloomLevel` | Remember, understand, apply, analyse, evaluate, create |
| `expectedDifficulty` | Teacher-reviewed scale, with rubric definition |
| `language` | English, Hindi, or another supported instructional language |

Prefer stable IDs over titles. Titles can change and may be duplicated across grades or curricula. Store versioned prerequisite edges so historical predictions can be reproduced.

### 4.3 Content and learning activity metadata — required

Collect metadata for lessons, notes, examples, videos, quizzes, flashcards, worksheets, and AI-generated activities.

- `contentId`, `contentVersion`, `contentType`, and content owner.
- Curriculum and concept IDs.
- Intended grade, language, difficulty, Bloom level, and learning outcomes.
- Estimated duration and accessibility properties such as captions or screen-reader compatibility.
- Source type: teacher-authored, licensed publisher content, public/open content, or AI-generated.
- Rights fields: license, permitted purpose, training permission, expiry, and deletion requirements.
- Review status, reviewer role, review date, and approval version.
- Generation provenance when applicable: model, prompt/template version, source material IDs, and safety-check result.
- Content quality signals: factual correctness, curriculum alignment, readability, cultural suitability, and known issues.

Raw copyrighted material must not enter a shared training corpus unless the license and school agreement explicitly permit that use. Retrieval permission and model-training permission are separate decisions.

### 4.4 Question and assessment-item metadata — required

Each question needs enough structure to distinguish student ability from item difficulty.

- `questionId` and immutable `questionVersion`.
- Question type: MCQ, true/false, numeric, short answer, essay, oral reading, or practical task.
- Concept and learning-outcome IDs.
- Difficulty and discrimination estimates, once enough reviewed data exists.
- Bloom level and required prerequisite concepts.
- Correct answer or scoring rubric; alternative valid answers where applicable.
- Distractor-to-misconception mapping for MCQs.
- Maximum marks, partial-credit rules, time limit, and attempt policy.
- Author/source, review status, language, and accessibility metadata.
- Exposure count and whether the learner saw the item or solution previously.

Question text may be stored in the operational assessment system. Training extracts should use only permitted content and retain the item ID/version needed for audit.

### 4.5 Learner interaction events — required

Use append-only events rather than only maintaining counters. At minimum, instrument:

- `session_started`, `session_ended`.
- `content_opened`, `content_progressed`, `content_completed`.
- `question_presented`, `answer_submitted`, `answer_changed`.
- `hint_requested`, `solution_viewed`, `explanation_requested`.
- `feedback_shown`, `feedback_acknowledged`.
- `recommendation_shown`, `recommendation_opened`, `recommendation_completed`, `recommendation_dismissed`.
- `review_scheduled`, `review_started`, `review_completed`.
- `tutor_message_sent`, `tutor_response_shown`, `tutor_response_rated`.
- `teacher_override`, `teacher_feedback_submitted`, `intervention_started`, `intervention_completed`.

Common event fields:

| Field | Notes |
|---|---|
| `eventId` | Globally unique and idempotent |
| `eventName`, `eventVersion` | Controlled event vocabulary |
| `studentPseudonym`, tenant keys | Never use display name as a join key |
| `sessionId`, `attemptId` | Connect a sequence without guessing from timestamps |
| `subjectId`, `conceptId`, `contentId`, `questionId` | Nullable only when genuinely not applicable |
| `occurredAt`, `durationMs` | Use active duration; distinguish it from an idle open tab |
| `source`, `deviceClass`, `connectivityClass` | Diagnose UX and access issues; avoid fingerprinting |
| `experimentId`, `variantId` | Required when testing model changes |
| `consentVersion`, `collectionPurpose` | Demonstrate the permitted use |

### 4.6 Assessment responses and learning evidence — required

For every attempt, collect:

- Attempt, learner, item, curriculum, and session identifiers.
- Presented question version and option order.
- Student response, normalized response, and response language.
- Correctness, marks awarded, maximum marks, and rubric breakdown.
- Start time, submit time, active response time, timeout, and completion status.
- Number and type of hints, solution exposure, retries, and answer changes.
- Confidence selection if the learner voluntarily provides it.
- Scoring source: deterministic, teacher, AI-assisted, or imported.
- Scorer/model/rubric version and teacher override where applicable.
- Misconception code and labeler provenance.
- Whether this was practice, baseline, formative, summative, or delayed retention measurement.

The response before feedback and the later response after feedback must remain distinguishable. Otherwise the dataset will incorrectly treat assisted performance as independent mastery.

### 4.7 Outcomes and intervention data — required for causal usefulness

A recommendation is not a useful training example until its outcome is measured.

- Baseline measurement before the lesson or intervention.
- Intervention type, content/version, assigned difficulty, reason, and responsible actor.
- Whether the intervention was actually opened and completed.
- Immediate post-activity assessment using a non-identical item.
- Delayed assessment after a defined interval.
- Teacher judgment: effective, partially effective, ineffective, or unclear.
- Change in mastery estimate with confidence/uncertainty.
- Adverse outcome signals: repeated failure, rapid abandonment, inappropriate content report, or teacher reversal.
- Context changes that affect interpretation, such as curriculum change or prolonged absence.

Store the assignment policy or model version that selected the intervention. Without it, offline evaluation and controlled experiments cannot be reproduced.

### 4.8 Tutor conversation data — conditional and sensitive

Collect only with an approved purpose, student/guardian notice where required, and strong redaction controls.

- Pseudonymous student and session identifiers.
- Subject, topic, grade, learning mode, language, and difficulty.
- Student message and tutor response, after automated PII/secrets screening.
- Retrieved source IDs/chunk IDs and citation coverage.
- Model, model version, system-prompt version, generation settings, latency, and error status.
- Safety-filter result and reason code.
- Student rating using age-appropriate controls.
- Teacher review: correct, grounded, pedagogically useful, age-appropriate, safe, and actionable.
- Follow-up learning outcome, not only a satisfaction rating.

Raw conversations should be access-restricted and retained for a short, approved operational period. A separate de-identified, quality-reviewed extract should be created for model development. Do not assume that operational storage permission also grants training permission.

### 4.9 Retrieval and grounding telemetry — required for RAG models

- Query ID and de-identified query text or approved derived representation.
- Filters applied: school, class, section, subject, chapter, topic, and curriculum version.
- Eligible corpus version and embedding model version.
- Retrieved chunk IDs, ranks, similarity scores, and source page references.
- Whether the final response cited and used each chunk.
- No-result, thin-material, wrong-scope, and tenant-filter failure reason codes.
- Teacher relevance labels for a sampled set of query–chunk pairs.
- Answer-grounding, citation-correctness, and unsupported-claim review labels.
- Retrieval and generation latency plus failure status.

Never log credentials, signed download URLs, or unrestricted raw document paths in telemetry.

### 4.10 Teacher feedback and human validation — required

Human review turns behavioral logs into trustworthy labels.

- Reviewer pseudonym and role; do not expose reviewer identity in training rows.
- Reviewed object and exact version: item, content, response, score, recommendation, or AI answer.
- Structured rubric scores and optional comment.
- Original value, corrected value, reason code, and timestamp.
- Reviewer confidence and adjudication status.
- Inter-rater agreement fields when more than one reviewer labels the same sample.
- Conflict resolution and final approved label.

Student ratings are useful experience signals but are not substitutes for correctness or pedagogical review.

### 4.11 Optional accessibility and fairness-audit data — restricted

Language preference, accessibility needs, coarse device class, and broad connectivity quality can help make the product usable. Sensitive demographic or disability information should be collected only when necessary, lawful, transparent, and explicitly approved.

- Keep fairness-audit attributes in a separate, tightly controlled store.
- Do not expose them to tutor prompts or recommendation features by default.
- Report results only for cohorts large enough to protect identity.
- Never infer caste, religion, disability, gender, income, or mental-health status from names, text, behavior, or location.
- Never use protected attributes to reduce learning opportunities or automate adverse decisions.

## 5. Minimum canonical datasets

### 5.1 `learning_event`

One row per learner action. This is the common event backbone.

```json
{
  "eventId": "evt_uuid",
  "eventName": "hint_requested",
  "eventVersion": 1,
  "occurredAt": "2026-09-01T10:15:23.000Z",
  "studentPseudonym": "stu_token",
  "schoolId": "school_id",
  "academicYearId": "year_id",
  "sessionId": "session_uuid",
  "subjectId": "subject_id",
  "conceptId": "concept_id",
  "contentId": "content_id",
  "questionId": "question_id",
  "properties": { "hintLevel": 1 },
  "collectionPurpose": "learning_personalization",
  "consentVersion": "policy_version",
  "schemaVersion": 1
}
```

### 5.2 `assessment_response`

One row per submitted answer, including assistance and scoring provenance.

```json
{
  "attemptId": "attempt_uuid",
  "studentPseudonym": "stu_token",
  "questionId": "question_id",
  "questionVersion": 3,
  "conceptIds": ["concept_id"],
  "response": "student response",
  "isCorrect": false,
  "marksAwarded": 0,
  "maxMarks": 1,
  "activeDurationMs": 42000,
  "hintCount": 1,
  "solutionViewedBeforeSubmit": false,
  "misconceptionCode": "UNLIKE_DENOMINATOR_DIRECT_ADD",
  "scoringSource": "teacher",
  "rubricVersion": "fractions_v2",
  "submittedAt": "2026-09-01T10:17:05.000Z"
}
```

### 5.3 `model_interaction`

One row per model decision or generated response.

```json
{
  "interactionId": "model_uuid",
  "task": "next_activity_recommendation",
  "studentPseudonym": "stu_token",
  "inputSnapshotId": "feature_snapshot_uuid",
  "modelName": "mastery-recommender",
  "modelVersion": "2026-09-01.1",
  "promptVersion": null,
  "recommendedObjectId": "activity_id",
  "reasonCodes": ["PREREQUISITE_GAP", "LOW_DELAYED_RECALL"],
  "confidence": 0.71,
  "shownAt": "2026-09-01T10:18:00.000Z",
  "acceptedAt": null,
  "outcomeWindow": "7d"
}
```

### 5.4 `learning_outcome`

One row per pre/post or delayed outcome tied to an intervention.

```json
{
  "interactionId": "model_uuid",
  "studentPseudonym": "stu_token",
  "conceptId": "concept_id",
  "baselineScore": 0.40,
  "postScore": 0.70,
  "delayedScore": 0.60,
  "baselineItemSetId": "set_a",
  "postItemSetId": "set_b",
  "delayedItemSetId": "set_c",
  "completedIntervention": true,
  "teacherEffectivenessLabel": "partially_effective",
  "measuredAt": "2026-09-08T10:18:00.000Z"
}
```

## 6. What EEC already has and what is missing

This mapping is based on the repository schemas and documentation reviewed on 2026-09-01. It describes implementation coverage, not data completeness or production quality.

| Area | Existing repository evidence | Main gap before model training |
|---|---|---|
| Curriculum structure | `CurriculumMap` topics, learning outcomes, concepts, order | Stable concept IDs, explicit prerequisite edges, curriculum/version history |
| Teaching content | `TeachingMaterial` targeting, content, versions, attachments, engagement, quiz metadata | Explicit license/training permission, content-quality labels, immutable dataset version |
| Practice attempts | `PracticeAttempt` answer and correctness | Attempt/session ID, response time, hint/solution exposure, question version, scoring provenance |
| Exam attempts | `ExamAttempt` answers, marks, topic, timestamps, status | Concept IDs, rubric version, assistance/exposure fields, item-version snapshot |
| Mastery | `MasteryScore` by topic with score and attempt count | Score algorithm/version, uncertainty, evidence links, decay/retention measurement |
| Tutor sessions | `TutorConversation` message text, subject, topic | Prompt/model/retrieval versions, ratings, safety labels, outcome link, de-identification pipeline |
| Long-term tutor memory | `StudentMemorySummary` summaries and insights | Evidence provenance, teacher/student correction, expiry and deletion policy |
| Reading | `ReadingAssessment` transcript, duration, detailed scores, word errors | Required tenant keys, human-validation sample, rubric/model version, raw-audio retention decision |
| Writing | `WritingAssessment` submission, corrections, detailed scores, CEFR | Required tenant keys, human-validation sample, rubric/model version, revision lineage |
| Progress | `StudentProgress` submissions, subject metrics, trends, interventions, AI grading | Time-bounded label definitions, feature provenance, removal of permanent learner labels |
| Intervention | `InterventionLog` action, status, outcome, improvement | Baseline/post/delayed measurement, intervention version, comparison policy |
| RAG | Qdrant payload and retrieval filtering documented in `docs/AI_Analytics_Data_Collection.md` | Persisted query–chunk telemetry, reviewed relevance labels, corpus/embedding version |
| Feedback | Teacher and student feedback models exist | Model-output-specific review rubric, correction fields, label adjudication |
| Governance | Tenant IDs exist on most models | Training consent ledger, deletion across MongoDB/Qdrant/exports, purpose restrictions, dataset registry |

Priority schema fixes include making `schoolId` and `campusId` mandatory and consistently typed for reading and writing assessments, and replacing name-bearing fields in ML extracts with pseudonymous identifiers.

## 7. Measurement framework

### Primary outcomes

Use one to three primary metrics for each model release:

1. **Delayed concept retention:** proportion of previously studied concepts answered correctly on unseen, equivalent items after the declared delay. Report the delay and eligible cohort.
2. **Learning gain:** post-assessment score minus baseline score on an equated concept-level item set. Report completion and missing-outcome rates.
3. **Teacher-validated recommendation success:** proportion of completed recommendations judged appropriate and followed by non-negative learning gain.

### Driver metrics

- Recommendation open and completion rate.
- Productive practice completion without solution exposure.
- Hint escalation rate by concept and difficulty.
- Retrieval relevance and citation coverage.
- Teacher approval/correction rate for AI output.
- Time to first useful response and model failure rate.

### Guardrail metrics

- Unsupported-claim and unsafe-response rate.
- Teacher override rate, especially for high-impact recommendations.
- Performance gap across approved fairness-audit cohorts.
- False-positive rate for at-risk flags.
- Student frustration proxy: repeated failures followed by abandonment; validate this proxy before use.
- PII detection rate in proposed training rows.
- Deletion-request completion across all storage systems and derived datasets.

Engagement alone is not a learning outcome. Time spent, clicks, or chat volume can increase without improved understanding and should remain diagnostic metrics.

## 8. Data quality requirements

- Define every metric, event, label, and enum in a versioned data dictionary.
- Enforce required tenant, learner, curriculum, timestamp, and schema-version fields at ingestion.
- Reject impossible values, negative durations, future timestamps beyond tolerance, and duplicate event IDs.
- Track completeness by school, grade, subject, concept, language, and device/connectivity class.
- Validate joins from response → item version → concept → curriculum version.
- Store label source and confidence; separate teacher labels from AI-generated labels.
- Sample and double-label high-impact tasks; measure reviewer agreement.
- Detect duplicate or near-duplicate questions before train/test splitting.
- Monitor delayed and out-of-order events.
- Keep raw, cleaned, feature, label, and training-snapshot layers separate and reproducible.
- Publish a dataset card for every training snapshot with purpose, owner, sources, dates, exclusions, known bias, consent basis, and deletion status.

## 9. Training, validation, and leakage prevention

- Split data by learner and time, not by random row. Earlier events may train; later events evaluate.
- Keep all versions of the same question, passage, document chunk, and near-duplicate content in one split.
- Hold out complete schools or curricula for a separate generalization evaluation where agreements permit it.
- Never use future grades, post-test results, teacher interventions, or later mastery updates as features for an earlier prediction.
- Snapshot features at decision time and store `inputSnapshotId`.
- Compare against simple baselines such as last score, moving average, or curriculum order.
- Evaluate calibration as well as accuracy; a 70% mastery prediction should succeed about 70% of the time for comparable cases.
- Report coverage and abstention. The model should return “insufficient evidence” when data is sparse.
- Run shadow evaluation before showing recommendations, then a controlled pilot with teacher review before wider release.

## 10. Privacy, safety, and governance

Because most learners are children, data minimization and adult accountability are product requirements, not optional compliance work.

### Required controls

- Maintain a purpose and consent ledger: who approved collection, for which purpose, version, start/end date, and withdrawal state.
- Separate operational use, analytics use, school-specific model use, and shared-model training permission.
- Pseudonymize learner and reviewer IDs in analytical and training stores.
- Encrypt sensitive data in transit and at rest; apply field-level protection where appropriate.
- Use least-privilege role access and immutable audit logs for exports, labels, and model datasets.
- Scan free text for names, phone numbers, email addresses, addresses, secrets, abuse disclosures, and other sensitive content before training use.
- Define deletion propagation across MongoDB, object storage, logs, Qdrant vectors, feature stores, backups, exports, and future training snapshots.
- Maintain model cards, dataset cards, approval records, and rollback procedures.
- Require human review for grading, promotion, intervention, disciplinary, wellbeing, or other high-impact decisions.
- Complete a formal privacy, child-safety, security, and legal review before production training. This document is not legal advice.

### Do not collect or use as model features by default

- Full name, phone, email, home address, government ID, parent details, or payment/fee data.
- Precise location, contact lists, browser fingerprint, unrelated browsing history, or private device contents.
- Face templates, fingerprints, continuous camera feeds, or other biometric identifiers.
- Medical, disability, counseling, wellbeing, or behavior records for academic prediction without a separately approved and necessary use case.
- Caste, religion, political belief, income, or inferred sensitive attributes.
- Private teacher notes not intended for the learner or model.
- Credentials, tokens, signed URLs, internal secrets, or unrestricted system logs.

## 11. Recommended collection phases

### Phase 0 — governance and definitions

- Approve model use cases, data purposes, prohibited uses, and human-review boundaries.
- Create the consent/purpose ledger, data dictionary, stable curriculum identifiers, and retention/deletion policy.
- Assign an owner for every dataset and label.

### Phase 1 — minimum viable learning dataset

- Instrument canonical learning events and assessment responses.
- Add question versions, concept IDs, response duration, hint exposure, and scoring provenance.
- Record baseline, immediate post-test, and delayed-retention outcomes.
- Build reproducible, pseudonymous dataset snapshots.

This phase is enough to prototype mastery estimation and spaced-repetition scheduling with simple baselines.

### Phase 2 — recommendations and teacher labels

- Log recommendation decisions, reason codes, model/policy version, acceptance, completion, and outcomes.
- Add structured teacher review, corrections, and adjudication.
- Pilot next-activity recommendation in shadow mode, then teacher-approved mode.

### Phase 3 — tutor and retrieval quality

- Add model/prompt/corpus/embedding provenance and query–chunk telemetry.
- Build a de-identified, reviewed set of tutor responses and retrieval judgments.
- Evaluate correctness, grounding, pedagogy, safety, latency, and learning outcome together.

### Phase 4 — controlled expansion

- Add multilingual, accessibility, reading, and writing datasets only after their specialized rubrics and privacy controls are ready.
- Expand across schools and curricula only under explicit agreements and school-isolated evaluation.
- Retrain or fine-tune only when the dataset demonstrates sufficient coverage, label reliability, and measurable improvement over simpler approaches.

## 12. Readiness checklist

A dataset is not ready for model training until all applicable items are complete:

- [ ] Model task, user decision, target label, prediction window, and eligible cohort are documented.
- [ ] Every row has tenant, pseudonymous learner, time, curriculum, and schema-version context.
- [ ] Content and question versions are immutable and traceable.
- [ ] Training permission is distinct from operational-use permission.
- [ ] Raw PII and prohibited fields are excluded from the training view.
- [ ] AI-generated labels are identified and human-validated on a representative sample.
- [ ] Missingness, duplication, class imbalance, label disagreement, and cohort coverage are measured.
- [ ] Baseline, post-intervention, and delayed outcomes are linked.
- [ ] Feature timestamps prevent future-data leakage.
- [ ] Train, validation, and test splits prevent learner and content leakage.
- [ ] Primary, driver, and guardrail metrics are defined with owners.
- [ ] Deletion, retention, access, audit, incident, and rollback procedures have been tested.
- [ ] Teachers can inspect, correct, override, and appeal high-impact outputs.
- [ ] A dataset card and model card are approved before release.

## 13. Repository sources reviewed

- `docs/AI_Analytics_Data_Collection.md` — current AI/analytics data inventory and compliance gaps.
- `ai_personalization_inputs.md` — current student-context inputs used for tutor personalization.
- `ai_data_flows.md` — current AI input/output flows and earlier training strategy.
- `backend/models/CurriculumMap.js` and `backend/models/TeachingMaterial.js` — curriculum and content schemas.
- `backend/models/PracticeAttempt.js`, `backend/models/ExamAttempt.js`, and `backend/models/MasteryScore.js` — assessment and mastery schemas.
- `backend/models/TutorConversation.js` and `backend/models/StudentMemorySummary.js` — tutor interaction and memory schemas.
- `backend/models/ReadingAssessment.js` and `backend/models/WritingAssessment.js` — language assessment schemas.
- `backend/models/StudentProgress.js` and `backend/models/InterventionLog.js` — progress and intervention schemas.

This specification should be updated whenever an event contract, model schema, consent purpose, curriculum versioning rule, or model use case changes.
