# EEC AI — Personalisation Inputs to the LLM

This document explains every piece of student-specific data that is collected and injected into the LLM before it generates a response. None of this happens on the frontend — all personalization data is assembled on the backend in `backend/utils/studentContextBuilder.js` and merged into the AI request before it reaches the model.

---

## The Core Principle

When a student asks the AI tutor a question, the model does not receive only the question. It receives a structured **Student Learning Profile** assembled from seven data sources in parallel. The LLM uses this profile to calibrate its vocabulary, depth, difficulty, and tone — invisibly to the student. The student never sees the profile; they just experience a response that feels right for them.

---

## The 5-Tier Learning System

Every student is automatically placed into one of five tiers based on their mastery score for the active subject and topic:

| Score | Tier Label | What the LLM Does |
|-------|-----------|-------------------|
| 0 – 39% | **FOUNDATION** | Simplest words, shortest sentences, concrete everyday analogies, no technical terms |
| 40 – 59% | **REVISION** | Revisit key concepts, fill gaps, gentle scaffolding |
| 60 – 74% | **DEVELOPING** | Grade-appropriate language, moderate challenge, guided application |
| 75 – 89% | **PROFICIENT** | Precise vocabulary, harder examples, encourages independent reasoning |
| 90 – 100% | **MASTERY** | Advanced analysis, synthesis questions, pushes beyond recall |

The tier assignment happens automatically every time a student completes a quiz. No teacher needs to manually categorise a student.

---

## Data Source 1 — Mastery Scores (`MasteryScore` model)

**What it is:** A per-student, per-topic score (0–100%) that updates every time the student completes a quiz in the AI tutor.

**What is collected:**
- `studentId` — which student
- `schoolId` — which school (tenant isolation)
- `subject` — which subject (e.g. Mathematics, Science)
- `topicId` — which topic (e.g. `fractions`, `photosynthesis`)
- `topicTitle` — human-readable label (e.g. "Fractions", "Photosynthesis")
- `score` — 0–100% mastery score

**How it reaches the LLM:**
- The active subject's mastery scores are fetched and averaged
- The score for the exact topic being studied is isolated
- This produces the tier (FOUNDATION to MASTERY)
- Weak topics (score < 60%) in the same subject are listed explicitly

**Example injected text:**
```
Current subject: Mathematics — mastery score 47% → TIER: REVISION — developing understanding, revisit key concepts
Weak topics in Mathematics: Fractions (38%), Long Division (44%), Decimals (52%)
```

---

## Data Source 2 — At-Risk Detection (`mlEngine.computeAtRisk`)

**What it is:** A real-time ML signal that computes whether a student's recent performance is declining, based on their exam score history.

**What is collected and computed:**
- Recent exam average (last 3 exams)
- Prior exam average (3 exams before that)
- Trend direction: `improving` / `declining` / `stable`
- Boolean `isAtRisk` flag

**How it reaches the LLM:**
- If the student is at risk, the LLM is told to use extra encouragement, celebrate small wins, and avoid discouraging phrasing
- If on track, the LLM is told the student's recent average and trend as context

**Example injected text:**
```
Risk status: AT-RISK — declining trend, recent avg 41% (was 68%). Use extra encouragement.
```
or
```
Risk status: On track (recent avg 74%, trend: improving)
```

---

## Data Source 3 — Learning Pace (`mlEngine.computeLearningPace`)

**What it is:** A computed estimate of how quickly this student is progressing, based on their session frequency and mastery score trajectory.

**What is collected and computed:**
- Average sessions per week
- Estimated weeks to reach mastery target (score ≥ 75%)
- Pace label: `fast` / `steady` / `slow` / `inactive`

**How it reaches the LLM:**
- The LLM adjusts how much it covers in one response — a fast learner gets more depth per answer; a slow or inactive learner gets one concept at a time

**Example injected text:**
```
Learning pace: slow, ~8 weeks to mastery target | Avg 1 sessions/week
```

---

## Data Source 4 — Learning Gaps (`mlEngine.detectLearningGaps`)

**What it is:** Cross-subject gap detection — topics where the student scores below a threshold across any subject, ranked by severity.

**What is collected and computed:**
- Per-topic mastery scores across all subjects
- Topics flagged as `critical` (score < 40%), `moderate` (40–60%), `minor` (60–70%)
- Top 3 critical gaps included in the context

**How it reaches the LLM:**
- The LLM knows when the current topic may be blocked by a prerequisite gap in another subject (e.g. a student struggling with Physics problems may have a critical gap in Mathematics — the LLM will not assume maths knowledge)

**Example injected text:**
```
Critical learning gaps: Algebraic Expressions in Mathematics (31%); Fractions in Mathematics (38%); Force and Motion in Science (42%)
```

---

## Data Source 5 — Student Progress Record (`StudentProgress` model)

**What it is:** A school-wide academic standing record for the student, updated by teachers and the system.

**What is collected:**
- `overallGrade` — A+, A, B+, B, C+, C, D, F
- `interventionLevel` — `low` / `medium` / `high` / `critical`
- `weaknessAnalysis` — per-subject consistency scores and identified weak areas

**How it reaches the LLM:**
- The overall grade and intervention level give the model a broad academic context even before any topic-specific mastery data is available
- The weakness analysis adds subject-level consistency scores (separate from per-topic mastery)

**Example injected text:**
```
Grade: Grade 8  |  Overall Grade: C  |  Intervention Level: high
Known weak areas: Mathematics (consistency 41%), Science (consistency 55%)
```

---

## Data Source 6 — Long-Term Memory Summary (`StudentMemorySummary` model)

**What it is:** A rolling AI-generated summary of everything the student has learned and struggled with across all past tutoring sessions. It is updated at the end of each session via the `/generate/summarize-session` endpoint.

**What is collected and stored:**
- `summary` — a 2–3 sentence compressed narrative of the student's learning history (e.g. "This student consistently struggles with abstract reasoning in Algebra but responds well to visual diagrams. They ask for re-explanation frequently, suggesting low confidence rather than low ability.")
- `keyInsights` — up to 5 short bullet facts about the student's learning patterns (e.g. "Responds better to real-world examples than abstract definitions")

**How it reaches the LLM:**
- The summary and insights are injected verbatim into the system prompt
- This means the AI tutor remembers across sessions — if a student struggled with fractions last week, this week's session starts with that knowledge already loaded

**Example injected text:**
```
Past session memory: Student consistently struggles with fraction comparison when denominators differ. Responds well to visual diagrams (number lines and chocolate bar models). Tends to rush quiz answers without checking.
Key learning insights: Prefers short, visual explanations | Needs extra time on comparison problems | Responds well to encouragement after wrong answers
```

---

## Data Source 7 — Recent Conversation History (`TutorConversation` model)

**What it is:** The last 3 turns (student message + AI reply pairs) from the most recent tutoring session, carried into the new request.

**What is collected:**
- Last 3 message pairs from the most recent `TutorConversation` document for this student
- Each message is capped at 300 characters before injection

**How it reaches the LLM:**
- Injected as `HumanMessage` / `AIMessage` pairs before the new question
- This gives the model conversational continuity — it knows what was just said without the student having to repeat context

**Example (passed as conversation history array):**
```
[student]: I don't understand how photosynthesis works
[tutor]: Let's start with the simple version — think of a plant as a factory...
[student]: Okay but what does chlorophyll actually do?
[tutor]: Great question. Chlorophyll is like the factory's solar panels...
[student]: What about the oxygen — where does that come from?
```

---

## Request-Level Personalisation (from the Student's UI Choices)

In addition to the seven data sources above, every request carries personalisation signals from what the student chose in the UI:

| Field | Where It Comes From | How It Personalises the Response |
|-------|---------------------|----------------------------------|
| `gradeLevel` | Student's grade stored in `StudentUser.grade` | Sets the vocabulary ceiling and complexity baseline |
| `mode` | Student clicked Explain / Quiz / Flashcards / etc. | Completely changes the output format and instruction |
| `difficulty` | Auto-fetched from `/api/mastery/suggested-difficulty` based on current mastery | Sets quiz difficulty to easy / medium / hard automatically |
| `responseDepth` | Visual Explain slider: Simple / Detailed / Deep | Controls length and depth of visual explanations |
| `learningGoal` | Student selects: Understand / Revision / Practice | Shifts emphasis to intuition, memorisation, or application |
| `wrongAnswer` | Passed when student gets a quiz question wrong | Triggers misconception mode — explains why the wrong answer felt right |
| `question` | The student's typed message | The actual question or homework problem |

---

## How All These Inputs Combine — Full Example

When a Grade 8 student with 38% mastery in Fractions asks the AI tutor to explain the topic, this is what the LLM actually receives (simplified):

```
── STUDENT LEARNING PROFILE (for AI personalisation) ──
Grade: Grade 8  |  Overall Grade: C  |  Intervention Level: high

Current subject: Mathematics — mastery score 38% → TIER: FOUNDATION — needs basics, use simplest language and short analogies

Weak topics in Mathematics: Fractions (38%), Long Division (44%)

Risk status: AT-RISK — declining trend, recent avg 41% (was 61%). Use extra encouragement.

Learning pace: slow, ~10 weeks to mastery target | Avg 1 sessions/week

Critical learning gaps: Fractions in Mathematics (38%); Place Value (41%)

Known weak areas: Mathematics (consistency 39%), Science (consistency 61%)

Past session memory: Student gets confused when fraction denominators are different. Needs visual representations — abstract rules alone don't work for this student.

Key learning insights: Responds to visual diagrams | Needs encouragement after mistakes | Struggles with abstract rules

── END PROFILE ──
Adapt your language, depth, and difficulty to match this student's tier above.
For FOUNDATION tier: use simple words, short sentences, concrete analogies.
If student is AT-RISK: be extra encouraging, celebrate small wins, avoid discouraging phrasing.

[+ retrieved course material from the teacher's uploaded PDFs]
[+ the student's question]
```

The LLM produces an explanation using pizza slices or chocolate bars — not formulas — in short sentences, with an encouraging tone, because every data point above told it to.

---

## What Is NOT Sent to the LLM

| Data | Reason Not Included |
|------|-------------------|
| Student's full name | Privacy — responses are not personalised by name |
| Student's phone / email | Not relevant to academic response |
| Parent information | Not needed for student-facing AI |
| Fee records | Out of scope for the tutor |
| Raw exam paper answers | Only scores and trends are used, not answer text |
| Other students' data | Strict per-student isolation; no class averages shared with the model |

---

*Last Updated: 2026-08-17 | EEC Platform — YarrowTech / HouseofMusa*
