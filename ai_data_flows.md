# EEC AI — Data Flows & Model Training Strategy

This document covers three things:
1. What data goes **into** the LLM on every request
2. What the LLM **produces** as output
3. What data EEC **collects** that will power our own fine-tuned educational model

---

## Part 1 — What Goes Into the LLM (Input Data)

Every student AI request assembles a structured context before it reaches the model. The LLM never receives raw user input alone.

### 1.1 System Prompt (always present)

The system prompt is built programmatically and controls the model's behaviour for that request. It contains:

| Component | Example / Purpose |
|-----------|------------------|
| **Safety prefix** | "You are a school tutor for students aged 6–18. You must ONLY answer questions directly related to the study material below…" |
| **Role & grade** | "You are a friendly AI tutor for a Class 9 student studying Science." |
| **RAG constraint** | "Do not use outside knowledge, assumptions, or URLs unless they appear inside the retrieved text." |
| **Mode instruction** | For `quiz`: "Write exactly 10 multiple-choice questions…" For `homework_help`: "You are a Socratic tutor…" |
| **STEM rules** | Injected when subject is Mathematics/Physics/Chemistry: preserve notation, carry units, check dimensional consistency |
| **Visual grounding rules** | Injected when a PDF diagram page is retrieved: what the model can and cannot say about visual elements |
| **Student learning profile** | Mastery tier (Foundation/Core/Extension), weak subjects, intervention level — shapes vocabulary and depth |
| **Socratic override** | For homework help: an additional CRITICAL OVERRIDE block that forbids the model from stating any answer |

### 1.2 Retrieved Course Material (RAG context)

This is the core of what makes EEC's AI different. Before the LLM is called, the system:

1. Embeds the student's question using `nomic-embed-text` (768-dimensional vector)
2. Searches Qdrant vector store for the closest matching chunks from uploaded teacher materials
3. Filters strictly by `school_id`, `class_id`, `section_id` — a student from School A can never retrieve School B's content
4. Strips teacher-only sections (`Note to the Teacher` blocks) before the context reaches the model
5. Checks if the context has enough usable words (minimum 80) — if not, refuses to generate rather than hallucinate

The retrieved context contains:
- Extracted text from PDFs (text-based or OCR-scanned)
- Extracted text from Word and PowerPoint files
- Visual evidence descriptions from diagram-heavy pages (described by a vision model, not invented)
- STEM metadata: detected formulas, units, concepts
- Source citation: which file, which page

### 1.3 Conversation History (multi-turn)

For ongoing tutoring sessions, the last N turns of the conversation are included as alternating `HumanMessage` / `AIMessage` entries, giving the model context about what has already been explained or attempted.

### 1.4 Student Question / Request

The student's actual input — a question, a topic request, a homework problem — is appended as the final `HumanMessage`.

### 1.5 Verification Context (STEM only)

For Mathematics, Physics, and Chemistry questions, a separate deterministic verification context is generated to check arithmetic. This context is labelled clearly as "for arithmetic checking only — it does not expand the curriculum scope." This prevents the LLM from using it as a source of new facts.

### 1.6 Generated Visual Specification

For certain topics (fractions, number lines, balance problems), the system generates a structured visual specification before calling the LLM. This spec describes a safe, code-rendered diagram with exact verified values. The LLM is told to explain from this spec rather than inventing values.

---

## Part 2 — What the LLM Produces (Output Data)

### 2.1 Student-Facing Outputs

| Mode | Output Format | Used For |
|------|-------------|---------|
| `explain` | Prose explanation with step-by-step sections | Concept understanding |
| `visual_explain` | Look / Notice / Connect walkthrough tied to a specific PDF page | Diagram-heavy topics |
| `quiz` | Numbered MCQ list with A–D options and `Answer: X` markers | Exam practice |
| `flashcards` | `Q: … / A: …` pairs | Memory retention |
| `mind_map` | Nested bullet-point hierarchy | Visual overview |
| `notes` | Structured revision notes with headings and bullet points | Quick revision |
| `homework_help` | Socratic question chain — never the answer | Independent thinking |
| `summarize` | Bullet-point summary of the material | Revision |
| `practice_basic / intermediate / advanced` | 5 questions per tier with answers | Differentiated practice |
| `misconception` | Explanation of why the wrong answer seems right, then the correct concept | Post-quiz remediation |
| `real_world` | 3 real-world connections to the topic | Engagement |

### 2.2 Teacher-Facing AI Outputs

| Mode | Output |
|------|--------|
| `lesson_content` | Hook, key concepts, step-by-step teaching guide, recap |
| `hinge_question` | 4 diagnostic MCQs with misconception analysis |
| `differentiated_plan` | Foundation / Standard / Extension content for one topic |
| `quiz_generate` | JSON array of 5 MCQs with `isCorrect`, `explanation`, `difficulty` |
| `rubric_generate` | JSON rubric with 4–5 criteria, 4-level descriptors |
| `rubric_grade` | JSON scoring with per-criterion comments and overall feedback |
| `exit_ticket_grade` | Understanding level + what was missed + next step |
| `worksheet` | Full printable worksheet (Fill-in-blanks, Short answer, Match, True/False) |
| `parent_report` | Parent-facing narrative progress report |
| `intervention_plan` | 2-week class-wide intervention plan with grouping strategy |
| `class_performance_summary` | Data-driven teacher-facing class overview |
| `idoweedo` | I Do / We Do / You Do lesson structure with timings |

### 2.3 Classification Outputs (generated at ingest time, not request time)

When a teacher uploads a document, three classification calls run in the background:

| Output | Model Used | What It Produces |
|--------|-----------|-----------------|
| **Bloom's Taxonomy level** | llama3.2:3b (temperature 0.05) | One of: remember / understand / apply / analyse / evaluate / create |
| **Learning outcomes** | llama3.2:3b (temperature 0.2) | 3–5 "Students will be able to…" statements |
| **Topic auto-detection** | llama3.2:3b (temperature 0.1) | A 2–6 word topic title if the teacher left it blank |

These are stored on the `TeachingMaterial` record and used to enrich retrieval and curriculum mapping.

### 2.4 Session Summaries

After a tutoring session, the system can generate a structured session summary:
- A 2–3 sentence summary of what the student learned and struggled with
- Up to 5 key learning insights about the student's patterns

These are stored and used as context for the next session.

---

## Part 3 — Data Being Collected for Our Own Educational Model

Every interaction on the EEC platform generates structured data. The goal is to eventually fine-tune or train a purpose-built educational model that understands Indian school curricula, student language patterns, and subject-specific pedagogy better than a general-purpose LLM.

### 3.1 Curriculum Content Corpus

| Data | Source | Value for Training |
|------|--------|--------------------|
| Teacher-uploaded PDFs, Word, PowerPoint files | `TeachingMaterial` model | Real Indian school curriculum content at chapter and topic level |
| OCR-extracted text from scanned textbooks | `ai-service` parser | Digitized versions of textbooks used across Indian schools |
| Bloom-classified materials | `bloomLevel` field on `TeachingMaterial` | Labelled dataset: content → cognitive level |
| Auto-extracted learning outcomes | `learningOutcomes` field | Content → expected learning outcomes |
| Auto-detected topic titles | `topicTitle` field | Content → topic label |
| Curriculum maps (subject → chapter → topic ordering) | `CurriculumMap` model | Structured knowledge graph of Indian school curricula |

This builds a proprietary corpus of labelled Indian school curriculum content that no other company has.

### 3.2 Student Interaction Data

| Data | Source | Value for Training |
|------|--------|--------------------|
| Student questions per topic | Chat request logs | What language students use when confused about each topic |
| Mode selections per topic | Request `mode` field | Which learning modes work for which subjects and grade levels |
| Conversation histories | `conversationHistory` on requests | Multi-turn tutoring dialogues with real student phrasing |
| Session summaries + key insights | `summarize-session` outputs | Compressed representations of learning events |
| Topics students re-ask about | Repeated requests on same topic | Difficulty signal per topic per grade |
| Thin material signals (refused answers) | `noMaterialFound` logs | Which topics lack educational content across schools |

### 3.3 Assessment & Performance Data

| Data | Source | Value for Training |
|------|--------|--------------------|
| Quiz answers (correct and wrong) | `PracticePaper`, `ExamResult` models | Common misconception patterns per topic |
| Wrong answers with student context | `misconception` mode requests | Input-output pairs for misconception correction training |
| Assignment scores over time | `StudentProgress` model | Learning trajectory data per student per subject |
| Mastery scores by topic | `weaknessAnalysis` on `StudentProgress` | Difficulty labels per topic per grade level |
| Rubric grades on assignments | `rubric_grade` mode outputs | Grounded, labelled assessment data |
| Exit ticket responses + AI grades | `exit_ticket_grade` outputs | Short-answer understanding classification data |

### 3.4 Teacher Quality Signals

| Data | Source | Value for Training |
|------|--------|--------------------|
| Teacher feedback ratings | `TeacherFeedback` model | Teacher effectiveness labels |
| Lesson plan structures | `LessonPlan` model | Expert-authored lesson planning examples |
| Teacher AI usage (which outputs they accept/edit) | Teacher AI request logs | Implicit quality signal on generated lesson content |
| Material effectiveness (views, quiz performance from it) | `TeachingMaterial.viewedBy`, quiz results | Which content leads to better learning outcomes |

### 3.5 Retrieval Quality Signals

| Data | Source | Value for Training |
|------|--------|--------------------|
| Retrieved chunks per question | Qdrant query logs | Query → relevant chunk pairs |
| `groundedInMaterial: false` events | Response logs | Retrieval failure cases — what was asked, what was missing |
| Thin material rejections (< 80 words) | `THIN_MATERIAL_MESSAGE` events | Cover pages and low-quality uploads — negative examples |
| Retrieval hit rate per topic | Qdrant search logs | Topic coverage map per school |

### 3.6 What We Will Train Our Own Model To Do

With this data, EEC can train a model that:

1. **Understands Indian school curricula** — not just from public sources, but from real teacher-authored materials across hundreds of schools
2. **Classifies any educational content by Bloom level** better than a general-purpose model, because it has been trained on thousands of labelled examples from real classrooms
3. **Generates Socratic hints** calibrated to specific topics and grade levels, trained on real student misconception patterns
4. **Predicts student difficulty** per topic before the student even asks, based on historical patterns across the platform
5. **Generates culturally appropriate examples** — Indian names, Indian contexts, Indian units — instead of generic Western examples
6. **Produces learning outcomes** aligned to CBSE/ICSE/State Board standards

### 3.7 Data Privacy and Ownership

- All student data is stored under school-specific `schoolId` — students and their data belong to the school, not to EEC.
- No personally identifiable information (names, emails, phone numbers) is ever used as training input — only anonymized learning signals (question patterns, performance scores, topic difficulties) are retained for model training.
- Session conversation data used for training is stripped of any student identifier before use.
- Each school retains ownership of its curriculum content. EEC uses aggregate patterns (not raw school content) to improve the shared model.

---

*Last Updated: 2026-08-17 | EEC Platform — YarrowTech / HouseofMusa*
