# Goals & Skills Being Developed — Brainstorming

> This document tracks ongoing discussions and ideas around the learning goals and skills developed through the EEC platform. Updated as conversations progress.

## Mission Statement (defined 2026-08-20)

> "We are trying to develop the holistic development of a child — not only academic learning. We want to develop their brain to think outside of the box, how to find a solution to a problem, how to build confidence, how to build something. All of those should be part of our system. Without knowing it, the student will grow with an intellectual brain, a thinking brain."

This is the north star. Every feature, every score, every AI generation should serve this goal.

---

## Source: Goals / Skills Being Developed (Original List)

1. Cognitive ability
2. Motivational exercise / teaching method
3. Encourages young attention span
4. Develops the child's attention span
5. Develops the child's concentration in answering
6. Convergent analytic thinking
7. Divergent thinking
8. Critical thinking
9. Creative thinking
10. Intelligence
11. Interest
12. Memory
13. Reasoning
14. Develops speaking, listening, reading, writing skills
15. Develops vocabulary
16. Build communication strategies
17. Develops visual goals
18. Develops self-explanation
19. Develops group activity
20. Helps the physical development of a child (Fine motor skills)
21. Helps the mental development of a child
22. Develops the social, emotional and creative development of a child

---

## Brainstorming Sessions

### Session 1 — 2026-08-19: How to Achieve All 22 Goals in EEC

---

## How Each Goal Is / Can Be Achieved in EEC

### 🧠 Thinking & Cognitive Skills

| # | Goal | How to Achieve in EEC | Status |
|---|---|---|---|
| 1 | **Cognitive ability** | Adaptive quizzes that increase in difficulty based on student performance; AI tutor adjusts explanation depth | Partial (quiz exists) |
| 6 | **Convergent analytic thinking** | MCQ quizzes with one correct answer; fill-in-the-blank; math problem solving with step checking | Partial |
| 7 | **Divergent thinking** | Open-ended assignment prompts; "give 3 different ways to solve this" questions; creative writing tasks | Not built |
| 8 | **Critical thinking** | Socratic homework help (already built — never gives answer, asks guiding questions) | ✅ Done |
| 9 | **Creative thinking** | Creative writing assignments; story-building prompts; "what if" scenario questions in AI tutor | Not built |
| 10 | **Intelligence** | Pattern recognition exercises; logic puzzles; IQ-style mini-games as warm-up activities | Not built |
| 13 | **Reasoning** | Cause-and-effect questions; "why did this happen?" reflection prompts; if-then logic exercises | Not built |

---

### 🎯 Motivation & Attention

| # | Goal | How to Achieve in EEC | Status |
|---|---|---|---|
| 2 | **Motivational exercise / teaching method** | Gamification: badges, XP points, streaks, leaderboards; reward system for completing lessons | Not built |
| 3 | **Encourages young attention span** | Short bite-sized lessons (5–10 min); animated content; interactive elements every 2–3 minutes | Partial |
| 4 | **Develops attention span** | Gradually increasing session lengths; focus timer (Pomodoro-style) with breaks | Not built |
| 5 | **Concentration in answering** | Timed quiz mode; distraction-free fullscreen mode; answer-before-proceeding enforcement | Not built |
| 11 | **Interest** | Personalized learning paths based on student interest; "choose your topic" AI tutor sessions | Not built |

---

### 📚 Language & Communication

| # | Goal | How to Achieve in EEC | Status |
|---|---|---|---|
| 14 | **Speaking, listening, reading, writing** | Language Practice module (Reading & Writing Assessment already built); add voice recording for speaking; text-to-speech for listening | ✅ Reading/Writing done; Speaking/Listening not built |
| 15 | **Vocabulary** | Word of the Day widget; contextual vocabulary quizzes; highlight unknown words in AI tutor responses | Not built |
| 16 | **Communication strategies** | Group chat (built); add structured debate feature; peer review on assignments | Partial (chat built) |
| 18 | **Self-explanation** | "Explain back" mode in AI tutor — student types their understanding, AI gives feedback; reflection journal | ✅ Done (ExplainBackUI + explain_back mode — CORRECT / MISSING / CORRECTION / NEXT STEP format) |

---

### 👁️ Visual & Memory

| # | Goal | How to Achieve in EEC | Status |
|---|---|---|---|
| 12 | **Memory** | Flashcards with spaced repetition (card UI built; add spaced repetition scheduling); memory match games | ✅ Done (FlashcardUI + SM-2 spaced repetition scheduling fully built) |
| 17 | **Visual goals** | Mind Map mode (built); add infographic-style notes; image-based questions; visual learning boards | ✅ Mind map done |

---

### 👥 Social & Group

| # | Goal | How to Achieve in EEC | Status |
|---|---|---|---|
| 19 | **Group activity** | Collaborative assignments (submit as a group); team quiz battles; shared whiteboards | Not built |
| 22 | **Social, emotional, creative development** | Peer interaction via chat; emotional check-in prompts ("how are you feeling today?"); collaborative creative projects | Partial (chat built) |

---

### 🏃 Physical & Mental Development

| # | Goal | How to Achieve in EEC | Status |
|---|---|---|---|
| 20 | **Fine motor skills** | Drag-and-drop exercises (match the pair, arrange in order); touch-based drawing/tracing on tablet | Not built |
| 21 | **Mental development** | Puzzle games; memory games; brain-warm-up mini-games before lessons | Not built |

---

## Feature Priority Roadmap (Based on Gap Analysis)

### High Priority (Many goals depend on these)
1. **Gamification System** — badges, XP, streaks, leaderboards → covers goals 2, 11
2. ~~**Spaced Repetition for Flashcards**~~ → ✅ Done (SM-2 scheduling: 1→3→7→14→30 day intervals)
3. **Voice / Speaking module** → covers goal 14
4. **Vocabulary Builder** (Word of the Day + quizzes) → covers goal 15
5. ~~**"Explain Back" mode in AI Tutor**~~ → ✅ Done (ExplainBackUI, covers goal 18)

### Medium Priority
6. **Open-ended / Divergent Question type** in assignments → covers goals 7, 9
7. **Timed Quiz + Focus Mode** → covers goals 4, 5
8. **Logic & Pattern Puzzles** → covers goals 10, 13, 21
9. **Group Assignment / Collaborative Tasks** → covers goals 19, 22
10. **Emotional Check-in** (daily mood prompt) → covers goal 22

### Lower Priority (Nice to have)
11. **Drag-and-drop exercises** (fine motor) → covers goal 20
12. **Debate / Structured Discussion** feature → covers goal 16
13. **Personalized Learning Path** (interest-based) → covers goal 11

---

## Open Questions

- Which age groups are primary targets? (Fine motor = early childhood, divergent thinking = older kids)
- Should gamification be per-school or global leaderboard?
- Can the AI tutor support voice input/output natively?
- Should "explain back" be a new AI tutor mode or a sub-mode of homework_help?

---

---

## Session 5 — 2026-08-20: The Mastery Engine is the Brain

### Core Analogy
The Mastery Engine is the brain of the entire EEC system. Everything else is a part of the body that serves it.

| Part | Role |
|---|---|
| **Mastery Engine** | The brain — receives, processes, learns, decides |
| **AI Tutor** | The mouth — delivers personalised content to the student |
| **Flashcards / Quizzes / Games** | The hands — collects student responses |
| **StudentDevelopmentProfile** | The memory — stores the 6-category scores and trends |
| **studentContextBuilder** | The nervous system — carries the brain's signal to the LLM |
| **Teacher / Parent dashboard** | The eyes — lets humans see what the brain knows |
| **Offline scoring (teacher + peer + checklist)** | The ears — picks up what happens outside the screen |

### Why it is the Brain
- **Receives input** — from every activity the student does (quizzes, flashcards, reading, writing, observations, offline activities)
- **Processes and understands** — computes scores, detects weakness, tracks trends across the 6 development categories
- **Sends output** — tells the LLM what kind of student this is, what they need, what to generate
- **Learns over time** — every session updates it, so it gets smarter about each student

### The Learning Loop
```
Student does something
  → Mastery Engine processes it   ← THE BRAIN
    → LLM generates better content
      → Student improves
        → Brain gets smarter
```

The brain never stops learning about the student — just like a real teacher who knows their student better every day.

---

## Session 4 — 2026-08-20: The Mastery Engine — Full Concept

### Core Idea
Same textbook, different experience for every student based on their mastery profile.

### The Full Flow

```
Teacher uploads material (PDF, doc, ppt)
  → AI generates questions + suggests skill tags (memory, reasoning, creative thinking etc.)
    → Teacher reviews, edits, and publishes
      → Student attempts the questions
        → Results stored in Mastery Engine (per skill category, per topic)
          → Mastery Engine builds student weakness profile
            → Next time student opens AI tutor:
                LLM receives the weakness profile as input
                  → Generates personalised content (not the same for everyone)
                    → Content is always from the textbook, but difficulty/style adapts
```

### Key Principles
- AI generates questions AND suggests tags — teacher just verifies and publishes
- Tags map to the 6 development area categories (cognitive, memory, creative, language, motivation, physical)
- The Mastery Engine stores cumulative performance per category per student
- The LLM uses the mastery profile as context — weak in reasoning = more reasoning-focused questions generated
- Content is always curriculum-aligned (based on uploaded material) but personalised in style and difficulty

### Example
Student A: 8/10 memory, 3/10 reasoning on Water Cycle
Student B: 4/10 memory, 9/10 reasoning on Water Cycle

Same topic, same textbook — but AI tutor generates:
- For Student A: reasoning-focused questions, Socratic prompts, cause-effect exercises
- For Student B: memory-focused flashcards, mnemonics, spaced repetition

### What the Mastery Engine Stores (per student)
- Score per skill category per topic
- Improvement rate over time
- Which question types they struggle with
- Last weakness profile (fed into LLM as input for next session)

### Offline Activity Tracking (The Hardest Problem)

Some skills cannot be measured digitally — they happen in the physical classroom:
- Sports → Physical development, fine motor skills (Goal 20)
- Debate → Communication strategies, critical thinking (Goals 8, 16)
- Peer group discussion → Group activity, social-emotional development (Goals 19, 22)

**Solution: Combine 3 input sources**

| Source | Weight | How |
|---|---|---|
| Teacher manual score | 50% | Teacher rates each student 1–5 after the activity |
| Peer rating | 30% | Students rate each other, system averages it |
| AI checklist | 20% | Teacher fills simple Y/N checklist, AI converts to mastery score |

```
Final Offline Score =
  (Teacher score × 50%) + (Peer rating × 30%) + (AI checklist × 20%)
```

Weights can be adjusted per school or activity type.
All offline scores feed into the same Mastery Engine alongside digital scores.

---

### Parent Portal View (3 Sections)

Parents should NOT see raw scores — they see a clean, meaningful summary:

| Section | What it covers | Categories included |
|---|---|---|
| **1. Academic Growth** | How the child is learning | Cognitive, Memory & Attention, Creative, Language & Communication |
| **2. Emotional Wellbeing** | How the child is developing as a person | Motivation & Social-Emotional, Physical Development |
| **3. Overall Mastery Score** | Single score summarising all 6 categories | All 6 combined |

- Overall score can be shown as a progress ring, radar chart, or simple percentage
- Each section shows trend over time (improving / stable / needs attention)
- Alerts when a category drops below threshold

---

### How Improvement is Detected (Closing the Loop)
- Scores update after every attempt
- If student consistently solves reasoning assignments correctly → Mastery Engine marks reasoning as "improving" or "cleared"
- LLM reads the updated profile → stops generating remedial content → moves to next challenge level
- The cycle repeats continuously — detect weakness → generate targeted content → measure improvement → update profile

---

## Session 3 — 2026-08-20: 6 Development Area Categories

Instead of tracking all 22 goals separately, group them into 6 development areas for smarter weakness detection:

| Development Area | Skills Developed |
|---|---|
| **1. Cognitive Development** | Cognitive ability, intelligence, reasoning, analytical thinking, convergent thinking, critical thinking |
| **2. Memory & Attention** | Attention span, concentration, working memory, long-term memory, recall |
| **3. Creative Development** | Divergent thinking, creative thinking, imagination, visual thinking |
| **4. Language & Communication** | Speaking, listening, reading, writing, vocabulary, communication strategies, self-explanation |
| **5. Motivation & Social-Emotional Development** | Interest, motivation, confidence, group activity, collaboration, emotional development |
| **6. Physical Development** | Fine motor skills, hand-eye coordination, writing, drawing, manipulating objects |

This means the system detects weakness at the **category level** first, then drills down to the specific skill within that category.

---

## Session 2 — 2026-08-20: Full Pipeline — How to Detect Weakness & Feed it into the LLM

### The Core Question
If a student is weak in a skill (e.g. Memory), how do we:
1. Know they are weak?
2. Pass that into the LLM as input?
3. Have the LLM generate targeted content?
4. Let the student practice and share their progress?

---

### Step 1 — Detect the Weakness (data signals per goal)

For **Memory (Goal #12)** we use the existing `FlashcardResult` collection:

```
recall_rate = got_it / (got_it + still_learning)

< 60% recall on a topic over last 7 days  → WEAK
< 40% recall                              → CRITICAL
```

Weakness signals for other goals:

| Goal | Weakness Signal |
|---|---|
| Memory (12) | Flashcard recall rate < 60% |
| Attention (3, 4) | Session duration < 5 min, dropout mid-lesson |
| Concentration (5) | Quiz timeout rate — ran out of time often |
| Vocabulary (15) | Repeated unknown words in AI chat |
| Reasoning (13) | Wrong answers on why/because type quiz questions |
| Critical thinking (8) | Student repeatedly asks AI for direct answer in homework help |
| Speaking / Listening (14) | Low score on reading/writing assessment |

---

### Step 2 — Build the Enriched LLM Input (inject student weakness profile)

Current prompt (simplified):
```
Subject: Science | Topic: Water Cycle | Mode: flashcards
Student asked: "Make flashcards for water cycle"
Context: [retrieved chunks from Qdrant]
```

Enriched prompt after weakness detection:
```
Subject: Science | Topic: Water Cycle | Mode: flashcards

STUDENT WEAKNESS PROFILE:
- Memory weak on this topic (recall rate: 38%, last 7 days)
- Struggled most with: "condensation", "evaporation"
- Failed these cards 3+ times:
    Q: What is condensation? (failed 4x)
    Q: Define evaporation (failed 3x)

INSTRUCTION: Generate memory-optimized flashcards.
- Prioritize the weak concepts above.
- Use mnemonics and vivid analogies to aid retention.
- Add a "memory trick" line on each answer card.
```

This profile is built in the Node backend before calling `/generate/tutor` in the AI service.

---

### Step 3 — LLM Generates Targeted Content

Generic output (before):
```
Q: What is condensation?
A: Condensation is when water vapor turns into liquid.
```

Memory-optimized output (after enriched prompt):
```
Q: What is condensation?
A: Water vapor cools and turns into liquid water.
   Memory trick: CONdensation = CONcentrating water from air into drops.
   Think of a cold glass on a hot day — droplets on the outside = condensation.
```

---

### Step 4 — Student Practices & Shares Progress

After the practice session:
1. Save results → `FlashcardResult` (already built)
2. Recalculate weakness score → did recall rate improve?
3. Generate a shareable progress card:

```
Bala's Memory Practice — Water Cycle
Before: 38% recall  →  After: 72% recall
Cards mastered: 6 / 8
Next review: in 3 days (spaced repetition)
```

Sharing targets:
- Student sees a summary screen after session
- Teacher dashboard shows per-student weakness + improvement
- Parent portal shows child's memory progress over time

---

### Full Data Flow

```
FlashcardResult (DB)
  → weakness_score() function     [Node backend utility]
    → enriched prompt             [Node backend builds this]
      → POST /generate/tutor      [AI service]
        → Ollama LLM              [generates targeted content]
          → FlashcardUI           [student practices]
            → FlashcardResult     [new results saved]
              → Progress report   [Node backend generates]
                → Teacher/Parent  [portal dashboards updated]
```

---

### What Needs to Be Built

| # | Component | Location |
|---|---|---|
| 1 | `weakness_score()` function | Node backend utility |
| 2 | Fetch weak cards before generating flashcards | `studentDashboardRoutes.js` |
| 3 | Inject student weakness profile into prompt | AI service `chat/router.py` |
| 4 | Progress report generator | Node backend |
| 5 | Progress summary card UI | Frontend |
| 6 | Weakness widget in Teacher + Parent dashboards | Frontend |

---

---

## Session 9 — 2026-08-20: Visual Generation in AI Tutor (Type 1 + Type 2)

### Hardware
RTX 5080 16GB VRAM — llava:13b fits comfortably with headroom.

### Visual Strategy (3 types decided)

| Type | Approach | Status |
|---|---|---|
| **Type 1 — Diagrams & Charts** | LLM generates Mermaid.js code → browser renders | ✅ Built |
| **Type 2 — Image Understanding** | llava:13b reads teacher-uploaded PDF diagrams | ✅ Built & wired |
| **Type 3 — Image Generation** | Stable Diffusion (too heavy, not curriculum-accurate) | ❌ Skipped |

---

### Type 1 — Mermaid Diagram Mode

The LLM chooses the best diagram type based on content:
- Process / cycle → `flowchart TD`
- Hierarchy / classification → `graph TD`
- Timeline → `timeline`
- Comparison → `graph LR` with parallel branches
- Cause and effect → `graph TD` with labelled arrows

**Files changed:**
| File | Change |
|---|---|
| `frontend/package.json` | Added `mermaid@^11.17.0` |
| `frontend/src/components/AITutorHomeScreen.jsx` | Added `DiagramUI` component + mermaid import + chip mode + meta + dispatcher |
| `backend/routes/aiTutorRoutes.js` | Added `diagram` to ALLOWED_MODES |
| `ai-service/app/modules/chat/service.py` | Added `diagram` MODE_INSTRUCTION |

**DiagramUI flow:**
```
Student clicks "Diagram" in AI tutor
  → LLM generates Mermaid syntax from textbook chunks
  → parseDiagramResponse() extracts title, code, description
  → mermaid.render() converts code to SVG
  → SVG displayed in white card with violet border
  → Copy code button included for students
```

---

### Type 2 — llava:13b for Image Understanding

**Why 13b over 7b (RTX 5080 16GB):**
- Better at dense scientific diagrams, small text labels, complex relationships
- 16GB VRAM fits it perfectly (~10GB used)
- Runs at ingestion time only — speed is not critical

**Two modes built:**

**Mode A — Ingestion time (reads teacher PDFs):**
```
Teacher uploads PDF
  → llava:13b reads each page image (up to 12 pages)
    → Extracts: visible_text, formulas, units, diagram_labels, chart_labels, description
      → Stored in Qdrant alongside text chunks
        → Used automatically when student asks visual_explain
```

**Mode B — Live explain (new endpoint):**
```
POST /vision/explain-image
  { image: base64, question: "...", grade_level, subject }
  → llava:13b reads image directly
    → Returns plain-language explanation
      → No Qdrant needed — direct vision response
```

**Files changed:**
| File | Change |
|---|---|
| `ai-service/app/core/config.py` | Vision model → `llava:13b`; num_ctx → 32768; max_pages → 12; max_dimension → 2048 |
| `ai-service/app/modules/vision/client.py` | Fixed `think` param (only for thinking models); richer prompt; num_predict → 2000 |
| `ai-service/app/modules/vision/router.py` | New — `POST /vision/explain-image` live explain endpoint |
| `ai-service/app/main.py` | Registered vision router; health shows vision model |

**Key fix — think parameter:**
- `"think": False` was incorrectly sent to llava (only valid for qwen3, deepseek-r1 etc.)
- Now conditionally added only for thinking models via `_supports_thinking(model_name)`

**Config settings (RTX 5080 16GB optimised):**
```
ollama_vision_model           = llava:13b
ollama_vision_num_ctx         = 32768   (was 16384)
ollama_vision_max_pages       = 12      (was 6)
ollama_vision_max_image_dimension = 2048 (was 1600)
ollama_vision_num_predict     = 2000    (was 1200)
```

**To pull:**
```bash
ollama pull llava:13b
```

**Override in .env:**
```
OLLAMA_VISION_MODEL=llava:13b   # default (RTX 5080 16GB)
OLLAMA_VISION_MODEL=llava:7b    # fallback (8GB VRAM)
OLLAMA_VISION_MODEL=moondream   # fallback (CPU only)
```

**Full model stack on RTX 5080 16GB:**
| Model | Role | VRAM |
|---|---|---|
| `llama3.2:3b` | AI tutor chat | ~2GB |
| `nomic-embed-text` | Embeddings | ~0.5GB |
| `llava:13b` | PDF diagram understanding | ~10GB |
| `qwen2.5:14b` | Lesson summaries | ~10GB |
| `qwen3:8b` | Reading/writing assessment | ~6GB |

Models load on demand and unload when idle — 16GB handles all one at a time.

---

## Session 8 — 2026-08-20: Bloom's Taxonomy as a Teaching Method

### What is Bloom's Taxonomy?
A framework (Benjamin Bloom, 1956) describing 6 levels of thinking — from simplest to most complex:

```
🔝 CREATE      — build something new, invent, design
   EVALUATE    — judge, debate, defend an opinion
   ANALYSE     — break down, compare, find patterns
   APPLY       — use knowledge in a new situation
   UNDERSTAND  — explain in your own words
🔽 REMEMBER    — recall facts, memorise
```

### Why It Matters for EEC
Most school apps only generate REMEMBER level questions — straight from the textbook.
Bloom's lets the same textbook produce completely different experiences for different students.

### Weakness → Bloom's Level Mapping
| Weakest Category | Target Bloom Levels | Why |
|---|---|---|
| Memory | remember → understand | Build recall foundation first |
| Cognitive | apply → analyse | Develop reasoning step by step |
| Creative | evaluate → create | Push imagination and invention |
| Language | understand → apply | Practice expression and vocabulary |
| Social-Emotional | evaluate → create | Debate, empathy scenarios, collaboration |
| Strong overall (≥80%) | evaluate → create | Always push to highest levels |
| No data | apply → analyse | Safe default middle ground |

### Same Topic, Different Bloom Levels (Water Cycle example)
| Level | Question |
|---|---|
| Remember | "What 3 things do plants need for photosynthesis?" |
| Understand | "Explain the water cycle in your own words" |
| Apply | "A plant is kept in a dark room for 7 days. What happens and why?" |
| Analyse | "Compare evaporation and condensation — how are they opposite?" |
| Evaluate | "Do you think deforestation affects the water cycle? Defend your answer." |
| Create | "You are a leaf during a drought. Write a diary entry about your struggle." |

### What Was Built
| File | Change |
|---|---|
| `backend/services/developmentProfileService.js` | Added `getBloomRecommendation(profile)` — maps weakest category to Bloom level |
| `backend/utils/studentContextBuilder.js` | Injects Bloom target into every LLM prompt |
| `ai-service/app/modules/chat/service.py` | Extracts Bloom instruction from context; applies to quiz, explain, flashcards, notes, real_world, practice modes |

### Flow
```
Student has Memory: 35% (weakest category)
  → getBloomRecommendation() → targetLevels: [remember, understand]
    → studentContextBuilder adds:
        "BLOOM'S TAXONOMY TARGET: remember → understand"
          → AI service extracts instruction
            → Appended to system prompt:
                "Target REMEMBER and UNDERSTAND levels —
                 use mnemonics, simple recall, explain in own words"
              → LLM generates appropriate depth content automatically
```

---

## Session 7 — 2026-08-20: Is Textbook Material Enough for the LLM?

### Short Answer
Textbook material alone is NOT enough for out-of-the-box content. The LLM needs 3 layers of input.

### The Problem
With only textbook chunks, the LLM generates basic recall questions:
- "What do plants use during photosynthesis?" → straight from the text, not creative

### The LLM Has Two Knowledge Sources
| Source | What it contains |
|---|---|
| Textbook chunks (RAG) | Curriculum facts, definitions, examples |
| LLM's own pre-trained brain | Real world knowledge, analogies, creativity, cross-subject links |

Currently we only use Source 1 — restricting to textbook to avoid hallucination. But this also kills creativity.

### Solution — 3 Layers of Input
```
Layer 1 — Textbook (what to teach)
Layer 2 — Bloom's Taxonomy level (how deep to go)
Layer 3 — Category instruction (which skill to develop)
```

### What This Unlocks (same topic, different depth)
| Level | Example Question |
|---|---|
| Remember | "What 3 things do plants need for photosynthesis?" |
| Apply | "A plant is kept in a dark room for 7 days. What happens and why?" |
| Create | "You are a leaf during a drought. Write a diary entry about your struggle to survive." |
| Real World | "If all plants stopped photosynthesising tomorrow, what would happen to humans in 30 days?" |

### What Needs to Be Built
| What | Where | Purpose |
|---|---|---|
| Bloom's taxonomy level per question | Question model + AI prompt | Controls depth — from recall to creation |
| Category instruction in prompt | studentContextBuilder.js | Tells LLM which skill to target |
| Real world extension mode | AI tutor mode | Lets LLM use its own knowledge beyond textbook |
| Activity templates | AI prompt library | Debate prompt, group challenge, creative writing brief |

### Key Note
The `bloom_question` mode already exists in the allowed modes list in aiTutorRoutes.js.
Next step: connect it to the student weakness profile so weak-in-creative students
automatically get higher Bloom's level questions.

---

## Session 6 — 2026-08-20: What Was Built Today

### New Files Created
| File | Purpose |
|---|---|
| `backend/models/StudentDevelopmentProfile.js` | Stores 6-category scores + trends per student |
| `backend/services/developmentProfileService.js` | Computes scores from existing data; formats for LLM |

### Files Updated
| File | What Changed |
|---|---|
| `backend/utils/studentContextBuilder.js` | Injects 6-category development profile into every LLM prompt |
| `backend/routes/studentDashboardRoutes.js` | Auto-syncs profile after flashcard practice; added GET + POST endpoints |
| `backend/routes/parentDashboardRoutes.js` | Uses real profile scores; added `holistic` 3-section data to response |
| `frontend/src/parents/ChildGrowthAnalytics.jsx` | Added holistic 3-section view at top of page |

### What the Parent Now Sees (3 Sections)
1. **Academic Growth** — Cognitive / Memory / Creative / Language scores with trend arrows (↑ improving, ↓ declining, — stable)
2. **Emotional Wellbeing** — Social-Emotional / Physical scores with trend arrows
3. **Overall Mastery** — Ring chart showing overall % across all 22 goals

### How Scores Are Sourced
| Category | Real Data Source | Fallback (if no profile yet) |
|---|---|---|
| Cognitive | MasteryScore avg | masteryAvg from quiz history |
| Memory | FlashcardResult recall rate + SpacedRepetition stage | Blend of attendance + mood |
| Creative | Manual / offline input only | Heuristic from thinking skills |
| Language | ReadingAssessment + WritingAssessment scores | masteryAvg |
| Social-Emotional | Wellbeing mood + socialEngagement + Observations | Blend of mood + positiveRatio |
| Physical | Teacher offline input only | Blend of cognitive + attention |

### Key Design Decision
The `StudentDevelopmentProfile` is kept as a **stored model** (not computed on the fly) because:
- It tracks **trends over time** (improving / stable / declining)
- Trends change how the LLM responds — not just what difficulty level to use
- "Memory improving" → LLM encourages and pushes harder
- "Memory declining" → LLM slows down and revisits basics
- On-the-fly computation cannot provide this directional context

---

## Session 10 — 2026-08-20: Visual Explain Shows Real Diagrams

### Problem
`visual_explain` mode retrieved visual facts from Qdrant (via llava:13b extraction at ingestion time) but the response was pure text. The `ExplainUI` component rendered it as structured text cards — no actual diagram.

### Solution
Split `visual_explain` into two layers:
1. **Mermaid diagram at top** — LLM generates a diagram of the concept from retrieved material
2. **Text explanation below** — walks the student through what the diagram shows

### How it works now
```
Student asks: "Explain photosynthesis visually"
  → Qdrant retrieves textbook chunks (+ llava-extracted diagram facts)
    → LLM generates response in structured format:
        DIAGRAM:
        ```mermaid
        flowchart TD
          Sun --> Light
          Light --> Chlorophyll
          ...
        ```
        EXPLANATION:
        <paragraph explaining the diagram>
    → parseVisualExplain() splits the response
    → VisualExplainUI renders diagram via mermaid.render()
    → ExplainUI renders explanation below
```

### Response format (from LLM)
```
DIAGRAM:
```mermaid
<valid Mermaid.js — max 12 nodes, flowchart TD / graph LR / graph TD / sequenceDiagram>
```

EXPLANATION:
<2-4 paragraphs referencing the diagram, age-appropriate language>
```

If not enough info for a diagram, LLM writes `DIAGRAM: none` and explanation only is shown.

### Files changed
| File | Change |
|---|---|
| `ai-service/app/modules/chat/service.py` | Updated `visual_explain` MODE_INSTRUCTION — now returns structured DIAGRAM + EXPLANATION format |
| `frontend/src/components/AITutorHomeScreen.jsx` | Added `parseVisualExplain()` helper; added `VisualExplainUI` component; updated dispatcher so `visual_explain` → `VisualExplainUI`, `explain` → `ExplainUI` (split from the old combined route) |

### Fallback behaviour
- If LLM returns `DIAGRAM: none` → shows only text explanation via `ExplainUI`
- If Mermaid render fails → shows error message, explanation still shown below
- If response has no DIAGRAM/EXPLANATION markers → `VisualExplainUI` falls back to `ExplainUI` with full text

---

---

## Session 11 — 2026-08-22: AI Feature Audit (Code vs. Doc)

A full code audit was run against the student portal (`AITutorHomeScreen.jsx`, `aiTutorRoutes.js`, `ai-service/app/modules/chat/service.py`, `spacedRepetitionRoutes.js`, `studentContextBuilder.js`) to verify what is actually built vs. what the doc previously claimed.

---

### Status Corrections

| Feature | Old Status | Corrected Status |
|---|---|---|
| **Spaced Repetition scheduling** (Goal 12) | Partial (UI only) | ✅ Done — SM-2 algorithm built in `spacedRepetitionRoutes.js` with stages: 1→3→7→14→30 days; `/schedule`, `/due`, `/all` endpoints mounted at `/api/spaced-repetition`; masteryEngine reads overdue items |
| **Explain Back** (Goal 18) | Not built | ✅ Done — `explain_back` in `ALLOWED_MODES`; `ExplainBackUI` component renders CORRECT / MISSING / CORRECTION / NEXT STEP; chip in `COMPANION_CHIPS`; MODE_INSTRUCTION enforces warm, specific feedback |

---

### New Modes Built (Not Previously Documented)

These modes exist in the codebase but were not in previous sessions — all wired end-to-end (backend ALLOWED_MODES + MODE_INSTRUCTION + frontend chip + UI renderer):

| Mode | Chip Label | UI Component | Goals Covered |
|---|---|---|---|
| `real_world` | Real World | TutorMessageContent | Real-world connections, curiosity |
| `practice_basic` | Basic Practice | TutorMessageContent | Goals 1, 6 (foundation recall) |
| `practice_intermediate` | Intermediate Practice | TutorMessageContent | Goals 1, 6, 8 (apply + connect) |
| `practice_advanced` | Advanced Practice | TutorMessageContent | Goals 7, 8, 13 (analysis, synthesis) |
| `engagement_swap` | Re-Engage Me | TutorMessageContent | Goal 11 (interest), Goal 2 (motivation) |
| `visual_quiz` | Visual Quiz | QuizUI | Goal 17 (visual), Goal 6 |
| `hinge_question` | Hinge Questions | HingeQuestionUI | Goals 8, 13 (diagnostic MCQ with misconception analysis) |
| `misconception` | (auto-triggered) | TutorMessageContent | Goal 8 (critical thinking) — fires when student answers quiz wrong |
| `diagram` | Diagram | DiagramUI | Goal 17 (visual) — standalone Mermaid diagram from textbook material |
| `worksheet` | Worksheet | WorksheetUI | Goals 14, 18 |
| `differentiated_plan` | Differentiated | DifferentiatedUI | Goals 1, 7 (Foundation / Standard / Extension levels) |

Teacher-facing modes also built (not student chips): `quiz_generate`, `short_answer`, `long_answer`, `bloom_question`, `at_risk_summary`, `assignment_feedback`, `exam_explanation`, `exam_feedback`, `lesson_content`, `hinge_question`, `class_performance_summary`, `parent_report`, `exit_ticket_grade`, `idoweedo`, `misconception_report`, `differentiated_plan`.

---

### Bug Found — Translate Chip Not Wired

The `Translate` chip exists in `COMPANION_CHIPS` (`AITutorHomeScreen.jsx` line 2698) but is **missing from `CHIP_MODES`**. Clicking it sends `mode: undefined` to the backend → 400 error. Either add a `translate` mode to the backend + `CHIP_MODES`, or remove the chip until the mode is ready.

---

### What Is Still Not Built (Updated List)

| Feature | Goals | Priority |
|---|---|---|
| Gamification — badges, XP, streaks, leaderboard | 2, 11 | High |
| Voice / Speaking module | 14 (speaking + listening) | High |
| Vocabulary Builder (Word of the Day + quizzes) | 15 | High |
| Timed Quiz + Focus Mode | 4, 5 | Medium |
| Logic & Pattern Puzzles | 10, 13, 21 | Medium |
| Group Assignments / Collaborative Tasks | 19, 22 | Medium |
| Emotional Check-in (daily mood prompt) | 22 | Medium |
| Drag-and-drop exercises | 20 | Low |
| Debate / Structured Discussion | 16 | Low |
| Personalized Learning Path (interest-based) | 11 | Low |
| Fix: `Translate` chip → wire or remove | — | Immediate |

---

_Last updated: 2026-08-22_
