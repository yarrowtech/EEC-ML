# EEC AI Portal — Pending Features by Priority

**Source audit:** [EEC Everything Research.md](./EEC%20Everything%20Research.md)  
**Status legend:** `[x] ✅ PRESENT` · `[~] ⚠️ PARTIAL` · `[ ] ❌ MISSING` · `[!] 🔴 CRITICAL`

This backlog lists AI Portal features that are missing or materially incomplete. The ordering reflects implementation dependencies, educational correctness, security, privacy, and production risk.

## P0 — Critical: security and learning correctness

These items should be completed before treating the AI Portal as production-ready or adaptive.

| Rank | Feature not completed | Status | What remains |
|---:|---|---|---|
| 1 | AI-service authentication | [!] 🔴 CRITICAL | Protect every FastAPI generation, document, speech, assessment, memory, and admin endpoint with signed service authentication and scopes. |
| 2 | End-to-end tenant isolation | [!] 🔴 CRITICAL | Enforce organization, school, academic year, class, section, and student scope in MongoDB, Qdrant, Redis, APIs, deletion, prompts, and AI logs. |
| 3 | Safe document ingestion | [!] 🔴 CRITICAL | Prevent SSRF; restrict URL schemes, hosts, redirects, private IPs, file types, and maximum download size. |
| 4 | Server-authoritative assessment | [!] 🔴 CRITICAL | Remove browser grading and arbitrary mastery updates. Load questions and correct answers on the server and persist authoritative attempts. |
| 5 | Canonical learning events | [!] 🔴 CRITICAL | Add immutable events for answers, hints, retries, revisions, abandonment, reassessment, reflections, and intervention outcomes. |
| 6 | Real mastery model | [!] 🔴 CRITICAL | Replace the non-decreasing `$max` score with concept/skill mastery, confidence, evidence count, recency, history, uncertainty, and contradictory-evidence handling. |
| 7 | Concept and prerequisite model | [!] 🔴 CRITICAL | Introduce stable curriculum concepts, skills, learning objectives, chapter relationships, and prerequisite edges. |
| 8 | Misconception detection | [!] 🔴 CRITICAL | Add misconception taxonomy, error classification, repeated-pattern detection, evidence, confidence, teacher validation, and resolution tracking. |
| 9 | Evidence-based recommendation engine | [!] 🔴 CRITICAL | Persist recommendations with evidence, reasons, confidence, alternatives, expiry, student decision, teacher decision, and measured outcome. |
| 10 | Complete adaptive feedback loop | [!] 🔴 CRITICAL | Implement answer → error diagnosis → hint → retry → explanation → example → reassessment → mastery update. |
| 11 | Child-safety system | [!] 🔴 CRITICAL | Handle distress, bullying, unsafe requests, self-harm, abuse disclosures, sensitive information, and human escalation. |
| 12 | RAG isolation and citations | [!] 🔴 CRITICAL | Add organization/year metadata, trusted enrollment filters, tenant-scoped deletion, source attribution, and citation display in the student UI. |
| 13 | Teacher authorization enforcement | [!] 🔴 CRITICAL | Apply teacher subject/class allocations to every analytics, assessment, recommendation, observation, and intervention query. |
| 14 | Remove fake intelligence | [!] 🔴 CRITICAL | Remove hardcoded goals, recommendations, leaderboards, mastery insights, “weak student” labels, and demo fallbacks that appear to be real AI analysis. |
| 15 | Complete student-data deletion | [!] 🔴 CRITICAL | Delete or anonymize all related assessments, conversations, events, vectors, AI logs, files, summaries, and derived state—not only five collections. |

## P1 — High: core adaptive-learning features

These items create the actual student learning model and persistent learning loop.

| Rank | Feature not completed | Status | What remains |
|---:|---|---|---|
| 16 | Learning session model | [ ] ❌ MISSING | Persist session goal, selected topic, activities, context version, recommendation, events, completion state, and follow-up. |
| 17 | Longitudinal student learning state | [!] 🔴 CRITICAL | Maintain historical mastery, gaps, misconceptions, attempts, successful explanations, interventions, retention, and decline over time. |
| 18 | Student goals | [ ] ❌ MISSING | Let students create, edit, pause, complete, and reflect on subject/concept goals. |
| 19 | Recommendation acceptance/rejection | [ ] ❌ MISSING | Allow students to accept, reject, defer, request an alternative, or choose another topic without penalty. |
| 20 | Recommendation explanation UI | [!] 🔴 CRITICAL | Show why an activity was recommended, supporting events, confidence, timestamp, prerequisites, and alternatives. |
| 21 | Teacher AI-review workflow | [!] 🔴 CRITICAL | AI proposes → teacher sees evidence → approves/changes/rejects → intervention occurs → result is measured. |
| 22 | Intervention follow-up assessment | [!] 🔴 CRITICAL | Link interventions to triggers, evidence, start/end dates, teacher decisions, reassessment, and measurable outcomes. |
| 23 | Adaptive practice selection | [~] ⚠️ PARTIAL | Select items using concept mastery, prerequisite gaps, recency, prior support, difficulty, spacing, and goals—not one percentage. |
| 24 | Adaptive difficulty | [~] ⚠️ PARTIAL | Replace fixed score bands with item-level evidence, successful independence, confidence, and recent contradictory evidence. |
| 25 | Adaptive scaffolding | [~] ⚠️ PARTIAL | Track hints and retries and gradually adjust help based on demonstrated need. |
| 26 | Retrieval practice and spacing | [~] ⚠️ PARTIAL | Unify duplicate schedulers, correct score-scale inconsistencies, and record later recall outcomes. |
| 27 | Diagnostic assessment | [ ] ❌ MISSING / UNVERIFIED | Secure, validate, and mount the existing baseline route; map diagnostic items to concepts and confidence. |
| 28 | Reassessment | [!] 🔴 CRITICAL | Schedule concept-level follow-up assessments after learning activities and interventions. |
| 29 | Learning-context service | [~] ⚠️ PARTIAL | Build a versioned, minimal LLM context from trusted evidence instead of invalid risk/mastery summaries. |
| 30 | Structured LLM output | [~] ⚠️ PARTIAL | Require validated schemas for activities, hints, questions, explanations, citations, safety disposition, and generation metadata. |
| 31 | Prompt and output safety validation | [!] 🔴 CRITICAL | Add policy checks before and after generation; regex prompt cleaning alone is insufficient. |
| 32 | LLM timeout and fallback handling | [~] ⚠️ PARTIAL | Add capability-specific timeouts, approved fallbacks, failure disclosure, and safe degradation. |

## P2 — High/Medium: complete the student and teacher experience

| Rank | Feature not completed | Status | What remains |
|---:|---|---|---|
| 33 | Meaningful progress display | [~] ⚠️ PARTIAL | Show concept progress, evidence strength, uncertainty, recent improvement, retention, goals, and next steps—not fixed badges. |
| 34 | Student reflection | [~] ⚠️ PARTIAL | Add post-activity reflection and feed it into planning without treating self-rating as mastery. |
| 35 | Revision and self-correction tracking | [~] ⚠️ PARTIAL | Record changed answers, draft lineage, delayed retries, independent corrections, and support used. |
| 36 | Writing-learning workflow | [~] ⚠️ PARTIAL | Use hint-first feedback, explanation, example, student revision, comparison, and reassessment instead of simply rewriting the answer. |
| 37 | Reading comprehension model | [ ] ❌ MISSING | Add vocabulary, comprehension, inference, perspective-taking, emotional understanding, interest, and reading stamina. |
| 38 | Speech evidence integration | [~] ⚠️ PARTIAL | Feed pronunciation, fluency, listening, and speaking evidence into the student model with evaluated confidence. |
| 39 | Pronunciation fairness validation | [!] 🔴 CRITICAL | Validate models across children, accents, dialects, devices, and background noise; do not treat accent as quality. |
| 40 | Engagement model | [!] 🔴 CRITICAL | Separate session participation from mastery, retention, transfer, and assessment performance. |
| 41 | Retention measurement | [ ] ❌ MISSING | Measure whether knowledge is recalled after a meaningful delay. |
| 42 | Transfer measurement | [ ] ❌ MISSING | Assess whether knowledge can be applied to novel questions or real-world situations. |
| 43 | Parent educational recommendations | [~] ⚠️ PARTIAL | Provide verified, privacy-limited progress context and appropriate parent-child activities rather than surveillance metrics. |
| 44 | Teacher-readable evidence panels | [ ] ❌ MISSING | Display attempts, misconceptions, support used, mastery changes, recommendation logic, and intervention outcomes. |
| 45 | Curriculum-aware question generation | [~] ⚠️ PARTIAL | Add concept IDs, difficulty metadata, objectives, answer validation, distractor checks, duplication checks, provenance, and teacher review. |
| 46 | Question-quality workflow | [ ] ❌ MISSING | Generated questions need draft, validation, approval, publication, versioning, and retirement states. |

## P3 — Medium: multimodal, motivation, and real-world learning

| Rank | Feature not completed | Status | What remains |
|---:|---|---|---|
| 47 | Task-specific modality choice | [~] ⚠️ PARTIAL | Let students choose text, audio, visual, interactive, or example-based support where appropriate. |
| 48 | Accessibility preferences | [ ] ❌ MISSING | Store accessibility and task preferences without assigning permanent “learning style” labels. |
| 49 | Offline activity recommendations | [ ] ❌ MISSING | Recommend experiments, observations, outdoor tasks, parent reading, peer work, and teacher-led activities. |
| 50 | Appropriate contextual examples | [~] ⚠️ PARTIAL | Adapt examples using safe, student-selected interests without collecting unnecessary sensitive data. |
| 51 | Self-regulation support | [~] ⚠️ PARTIAL | Support planning, goal review, reflection, revision, delayed retry, and independent practice. |
| 52 | Healthy motivation system | [~] ⚠️ PARTIAL | Emphasize meaningful progress, choice, suitable challenge, reflection, and encouragement. |
| 53 | Gamification safeguards | [~] ⚠️ PARTIAL | Remove excessive leaderboards, pressure, permanent rankings, manipulative streaks, and shame-oriented feedback. |
| 54 | Student recommendation history | [ ] ❌ MISSING | Show previous suggestions, student choices, results, and alternatives without forcing a fixed path. |
| 55 | Cross-session continuity | [~] ⚠️ PARTIAL | Persist active goals, unfinished activities, prior support, and safe conversation context through a learning session model. |

## P4 — Medium/Low: platform quality and research readiness

| Rank | Feature not completed | Status | What remains |
|---:|---|---|---|
| 56 | AI decision observability | [!] 🔴 CRITICAL | Log model/version, prompt template, selected context, retrieved sources, decision reasons, latency, tokens, failures, and outcome links. |
| 57 | Model registry and evaluation | [ ] ❌ MISSING | Document every generation, embedding, speech, assessment, and classification model with metrics, thresholds, privacy, cost, and rollback rules. |
| 58 | Retrieval evaluation | [ ] ❌ MISSING | Build labeled relevance, grounding, citation, and cross-tenant leakage benchmarks. |
| 59 | Hallucination evaluation | [ ] ❌ MISSING | Measure unsupported claims and require source-grounded answers for curriculum content. |
| 60 | Durable background jobs | [~] ⚠️ PARTIAL | Replace critical in-process cron/fire-and-forget work with retryable jobs, idempotency, and failure monitoring. |
| 61 | Redis learning-context architecture | [ ] ❌ MISSING | Add properly namespaced short-lived session/context/cache state only where it improves reliability. |
| 62 | Token and cost monitoring | [ ] ❌ MISSING | Track usage by capability, model, tenant, activity, and outcome without logging excessive student content. |
| 63 | Latency and model-failure monitoring | [~] ⚠️ PARTIAL | Add service-level metrics and safe user-visible fallback states. |
| 64 | Experiment framework | [ ] ❌ MISSING | Add ethical assignment, exposure, consent/governance, treatment version, outcome, and exclusion records. |
| 65 | A/B testing | [ ] ❌ MISSING | Implement only after security and valid learning-outcome measurement exist. |
| 66 | 5E/EVER evaluation | [ ] ❌ MISSING | Evaluate efficacy, effectiveness, ethics, equity, environment, and science-of-learning alignment. |
| 67 | Teacher workload measurement | [ ] ❌ MISSING | Measure review time, recommendation acceptance, overrides, decision quality, and workload effects. |
| 68 | Student and teacher feedback research | [~] ⚠️ PARTIAL | Add structured, purpose-limited feedback linked to feature versions and outcomes. |

## Recommended execution order

```text
Security and tenant isolation
        ↓
Authoritative learning events
        ↓
Curriculum concepts and evidence model
        ↓
Mastery and misconception engine
        ↓
Recommendation and feedback loop
        ↓
Teacher review and interventions
        ↓
Student goals, agency and progress
        ↓
Reading/writing/speech integration
        ↓
Retention, transfer and engagement analytics
        ↓
Research and advanced personalization
```

## First practical milestone

Build one secure, curriculum-mapped practice activity that:

1. Produces authoritative server-side evidence.
2. Updates concept mastery with uncertainty.
3. Generates an explainable recommendation.
4. Allows the student to accept, reject, or request an alternative.
5. Allows teacher review for high-impact decisions.
6. Reassesses the concept later and records whether learning was retained.

