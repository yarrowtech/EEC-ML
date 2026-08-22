# EEC Teachers Portal — FLN Build Checklist
**Source:** CISCE Module II (Learning Outcomes) + Module III (Activities, Rhymes, Rubrics)
**Framework:** NIPUN Bharat / NEP 2020
**Target:** Teachers Portal (`/frontend/src/teachers/`, `/backend/routes/`)

---

## Legend
- `[ ]` Not started
- `[x]` Done
- `[~]` In progress
- `[!]` Blocked / needs decision

---

## Feature 1 — FLN Learning Outcome Tracker

> Digital replacement for paper-based classroom observation. Teachers rate each student against Module II's coded LOs (HW 1.1→HW 6.7, ECL, IL, ILM) using the built-in guiding questions.

### 1.1 Database — Models

- [ ] Create `FLNLearningOutcome.js` model
  - [ ] Fields: `code` (e.g. "HW 1.3"), `description`, `class_level` (PS-I/PS-II/PS-III/Class-I/Class-II/Class-III), `developmental_goal` (DG1/DG2/DG3), `sub_area` (Talking & Listening / Reading / Writing / Sensory / Numeracy), `guiding_questions: [String]`, `suggested_materials: [String]`
  - [ ] Index on `code` (unique), `class_level`, `developmental_goal`

- [ ] Create `FLNObservation.js` model
  - [ ] Fields: `studentId`, `teacherId`, `schoolId`, `lo_code`, `score` (1–5), `note` (optional anecdotal text), `term` (Term 1 / Term 2 / Term 3), `academic_year`, `observed_at`
  - [ ] Unique index: `{ studentId, lo_code, term, academic_year }`

### 1.2 Backend — Routes

- [ ] Create `/backend/routes/flnRoutes.js`
  - [ ] `GET /api/fln/outcomes` — list all LOs (filterable by `class_level`, `developmental_goal`, `sub_area`)
  - [ ] `GET /api/fln/outcomes/:code` — single LO with guiding questions
  - [ ] `POST /api/fln/observations` — teacher submits observation (score + optional note) for a student + LO
  - [ ] `PUT /api/fln/observations/:id` — update existing observation
  - [ ] `GET /api/fln/observations/student/:studentId` — all observations for a student (filterable by term, academic_year)
  - [ ] `GET /api/fln/observations/class/:classId` — all observations for a class (returns grid data)
  - [ ] `GET /api/fln/summary/student/:studentId` — per-student summary: % mastered per DG per term
  - [ ] `GET /api/fln/summary/class/:classId` — class-level heatmap data

- [ ] Mount routes in `/backend/routes/index.js` at `/api/fln`
- [ ] Protect all routes with `authTeacher` middleware

### 1.3 Data — Seed LO Content

- [ ] Create `/backend/data/fln_learning_outcomes.json`
  - [ ] PS-I DG1: HW 1.1 → HW 1.18 (18 LOs with guiding questions)
  - [ ] PS-I DG2: ECL1-1.1a → ECL1-2.15 (15+ LOs)
  - [ ] PS-I DG3: IL1.1 → IL1.4 (5 LOs)
  - [ ] PS-II DG1: HW 2.1 → HW 2.12 (12 LOs)
  - [ ] PS-II DG2: ECL2.x series
  - [ ] PS-II DG3: IL2.x series
  - [ ] PS-III DG1: HW 3.1 → HW 3.10 (10 LOs)
  - [ ] PS-III DG2: ECL3.x series
  - [ ] PS-III DG3: IL3.x series
  - [ ] Class I DG1: HW 4.1 → HW 4.7+ LOs
  - [ ] Class I DG2: ECL4.x series
  - [ ] Class I DG3: IL4.x / ILM4.x series
  - [ ] Class II DG1: HW 5.x series
  - [ ] Class II DG2: ECL5.x series
  - [ ] Class II DG3: ILM 5.1 → ILM 5.30 series
  - [ ] Class III DG1: HW 6.1 → HW 6.7+ LOs
  - [ ] Class III DG2: ECL6.x series
  - [ ] Class III DG3: ILM6.x series

- [ ] Create `/backend/scripts/seedFLNOutcomes.js` — one-time seed script
- [ ] Run seed and verify count in DB

### 1.4 Frontend — Observation Grid

- [ ] Create `/frontend/src/teachers/FLNTracker.jsx`
  - [ ] Class/section selector at top
  - [ ] Term and academic year selector
  - [ ] DG tab switcher (DG1 Health | DG2 Language | DG3 Numeracy)
  - [ ] Class level filter (PS-I → Class III)
  - [ ] Grid view: rows = students, columns = LO codes
  - [ ] Cell colour: white = not observed, yellow = 1–2 (emerging), green = 3–4 (developing), dark green = 5 (mastered)
  - [ ] Click cell → modal with guiding question + score slider (1–5) + optional text note
  - [ ] Save observation on modal submit (PATCH to API)
  - [ ] Bulk row view: expand a student row to see all LO scores in one view

- [ ] Add "FLN Tracker" to teachers sidebar navigation

---

## Feature 2 — Activity Library (Module III)

> Browsable library of 40 play activity cards + 22+ rhymes. All content is pre-written from Module III. Teachers can browse, filter, and attach activities to lesson plans.

### 2.1 Database — Models

- [ ] Create `FLNActivity.js` model
  - [ ] Fields: `name`, `type` (Play Activity / Rhyme / Worksheet), `developmental_goals: [String]` (DG1/DG2/DG3), `class_levels: [String]` (multi-level), `skills: [String]`, `objectives: [String]`, `materials_required: [String]`, `instructions: [String]` (steps), `variations: [String]`, `lo_codes: [String]` (linked LO codes)

### 2.2 Backend — Routes

- [ ] Create `/backend/routes/flnActivityRoutes.js`
  - [ ] `GET /api/fln/activities` — list activities (filterable by `type`, `developmental_goal`, `class_level`, `skill`)
  - [ ] `GET /api/fln/activities/:id` — single activity full detail
  - [ ] `GET /api/fln/activities/by-lo/:lo_code` — activities linked to a specific LO
  - [ ] `POST /api/fln/activities/used` — teacher marks an activity as "used in class" (date + class)

- [ ] Mount in index.js alongside fln routes
- [ ] Protect with `authTeacher`

### 2.3 Data — Seed Activity Content

- [ ] Create `/backend/data/fln_activities.json`

  **DG1 Activities (14 activities):**
  - [ ] Relay Race — gross motor, team spirit
  - [ ] Flowers and the Wind — gross motor, flower names, listening
  - [ ] Mimicry in Movement — gross motor, animal knowledge, imagination, creativity
  - [ ] The Cat and the Mice — gross motor, speaking, attention, alertness
  - [ ] Sorting Objects — classification, fine motor, object identification
  - [ ] Art Printing — fine motor, imagination, colour and object identification
  - [ ] Be Quick Tell Your Name — fine motor, family knowledge
  - [ ] My Family (Finger Rhyme) — fine motor, family awareness, social skills
  - [ ] Washing Day — gross + fine motor, speaking, imagination
  - [ ] Mango Tree — gross motor, hygiene habits, imagination
  - [ ] Musical Beats — gross motor, imagination, pattern recognition
  - [ ] Friendship Tree — matching, cultural respect, imagination
  - [ ] I Can Do — fine motor, confidence, self-esteem
  - [ ] Name a Food — gross motor, categorisation, food knowledge

  **DG2 Activities (activities 15–31 from Module III):**
  - [ ] All language/literacy activities from Module III (to be filled from full PDF read)

  **DG3 Activities (9 activities):**
  - [ ] Colour Domino — critical thinking, memory, colour recognition
  - [ ] Shape Domino — critical thinking, memory, shape recognition
  - [ ] Shape Visual Discrimination Cards — similarities/differences, observation
  - [ ] Solving Puzzles — decision-making, problem solving, reasoning
  - [ ] Self-Corrective Number Puzzles — number recognition, concentration
  - [ ] Pattern Making — problem solving, fine motor, sequencing
  - [ ] Sorting Cards — classification, fine motor, food categories
  - [ ] Food Riddles — problem solving, thinking skills, speaking
  - [ ] Fishing for Food — fine motor, food vocabulary

### 2.4 Data — Seed Rhymes Content

- [ ] Create `/backend/data/fln_rhymes.json` (22+ rhymes from Module III)
  - [ ] When You're Happy and You Know It — emotional awareness
  - [ ] The Ants Go Marching — counting, gross motor
  - [ ] Five Little Ducks — counting down, subtraction readiness
  - [ ] Found a Peanut — sequencing, storytelling, health
  - [ ] Grey Squirrel — body awareness, fine motor
  - [ ] Green Grass Grew All Around — sequencing, nature vocabulary, memory
  - [ ] Head Shoulders Knees and Toes — body parts, gross motor, listening
  - [ ] Row Row Row Your Boat — rhythm, listening
  - [ ] Here We Go Round the Mulberry Bush — hygiene habits, movement
  - [ ] Incy Wincy Spider — weather, perseverance
  - [ ] Old McDonald Had a Farm — animal names, sounds
  - [ ] Wheels on the Bus — transport vocabulary, movement
  - [ ] If You're Happy and You Know It — emotions, movement
  - [ ] Twinkle Twinkle — night/stars, imagination
  - [ ] Fire Fighter — safety, community helpers
  - [ ] Traffic Light — safety, colours
  - [ ] [ ] Rhymes 17–22+ (to be confirmed from full PDF)

- [ ] Create `/backend/scripts/seedFLNActivities.js`
- [ ] Run seed and verify

### 2.5 Frontend — Activity Library UI

- [ ] Create `/frontend/src/teachers/FLNActivityLibrary.jsx`
  - [ ] Top filter bar: Type (Activity / Rhyme / Worksheet) | DG (DG1 / DG2 / DG3) | Class Level | Skill tag
  - [ ] Card grid: each card shows name, type badge, DG badge, skills tags, brief objective
  - [ ] Click card → Activity Detail drawer/modal with full info (objectives, materials, steps, variations, linked LOs)
  - [ ] "Mark as Used" button in detail view — records date + class
  - [ ] "Add to Lesson Plan" button — opens lesson plan selector
  - [ ] Teacher's "Used" activity history tab

- [ ] Add "Activity Library" to teachers sidebar navigation

---

## Feature 3 — AI Lesson Plan Generator (LO-Aware)

> Extends the existing AI teacher infrastructure. Teacher selects class level + DG + LO code → AI generates a complete lesson plan using Module II's 3-column structure as a prompt scaffold. Suggests Module III activities as the practice section.

### 3.1 Backend — AI Route Enhancement

- [ ] In `/backend/routes/aiTeacherRoutes.js`
  - [ ] Add `POST /api/teacher/ai/lesson-plan/fln` endpoint
  - [ ] Request body: `{ class_level, developmental_goal, lo_code, lo_description, guiding_question, duration_minutes, class_size }`
  - [ ] Fetch full LO detail from DB (materials, guiding questions)
  - [ ] Fetch 1–2 matching Module III activities by LO code from DB
  - [ ] Build prompt injecting: LO description, suggested materials, pedagogical processes, assessment question, relevant activity
  - [ ] Call AI service (`/generate/tutor` or a dedicated teacher generation endpoint)
  - [ ] Return structured lesson plan: Objective, Materials, Introduction (5 min), Main Activity (20 min), Practice (10 min), Assessment / Guiding Questions, Variations

- [ ] Add `fln_lesson_plan` as an allowed mode in `ALLOWED_MODES` in `aiTutorRoutes.js` (or keep in teacher routes)

### 3.2 AI Service — Prompt (if new mode needed)

- [ ] In `/ai-service/app/modules/chat/service.py`
  - [ ] Add `MODE_INSTRUCTIONS["fln_lesson_plan"]` entry
  - [ ] Prompt enforces Module II 3-column output format
  - [ ] Temperature: 0.5 (structured output, not creative)

### 3.3 Frontend — Lesson Plan Generator UI

- [ ] In `/frontend/src/teachers/AssignmentPortal.jsx` or new `FLNLessonPlanner.jsx`
  - [ ] Step 1: Select class level → DG → LO code (cascading dropdowns)
  - [ ] LO description auto-fills on LO selection
  - [ ] Step 2: Set duration (30 / 45 / 60 min) and class size
  - [ ] Step 3: "Generate Lesson Plan" button → streaming AI response
  - [ ] Step 4: Lesson plan renders in structured sections (Objective, Materials, Steps, Assessment, Variations)
  - [ ] "Save Lesson Plan" → stores to existing lesson plans DB
  - [ ] "Attach Activity" → picker for Module III activities to embed in plan
  - [ ] "Print / Export PDF" button

- [ ] Add "FLN Lesson Planner" link to existing lesson planning section in teachers sidebar

---

## Feature 4 — Student Development Profile Dashboard (LO View)

> Per-student view of LO mastery across all 3 DGs and 6 class levels. Visual progress bars, term-by-term tracking. Teacher sees the whole class on one screen.

### 4.1 Backend — Analytics Endpoints

- [ ] In `/backend/routes/flnRoutes.js` (or new `flnAnalyticsRoutes.js`)
  - [ ] `GET /api/fln/profile/:studentId` — returns:
    - per-DG mastery % (DG1, DG2, DG3)
    - per-term progress (Term 1, Term 2, Term 3)
    - list of mastered LOs (score ≥ 4)
    - list of in-progress LOs (score 2–3)
    - list of not-started LOs (no observation)
    - current class level inferred from school data
  - [ ] `GET /api/fln/class-heatmap/:classId` — returns grid data: students × LO codes × avg score (for heatmap rendering)

### 4.2 Frontend — Student Profile Enhancement

- [ ] Add "FLN Progress" tab to existing student detail view in teachers portal
  - [ ] Three DG progress bars (DG1 / DG2 / DG3) showing % LOs observed and % mastered
  - [ ] Term selector to compare Term 1 vs Term 2 vs Term 3
  - [ ] LO list view: colour-coded chips per LO (green = mastered, yellow = developing, grey = not observed)
  - [ ] Click any LO chip → shows guiding question + teacher's last observation note

- [ ] Create `/frontend/src/teachers/FLNClassHeatmap.jsx`
  - [ ] Grid: rows = students, columns = LO codes (abbreviated)
  - [ ] Cell colours: green (≥4), yellow (2–3), white (0/not observed), red (1 = at risk)
  - [ ] Hover cell → tooltip with LO description + score
  - [ ] Filter by DG, class level, term
  - [ ] Export as CSV button

---

## Feature 5 — At-Risk Flagging from Observation Data

> Automatically flags students scoring low on attention, self-regulation, and language LOs across two or more consecutive terms.

### 5.1 Backend — At-Risk Detection Logic

- [ ] In `/backend/utils/masteryEngine.js` or new `/backend/utils/flnAtRiskEngine.js`
  - [ ] Define at-risk LO set (attention/self-regulation markers):
    - HW x.4 (following instructions)
    - HW x.6 (attention span / task completion)
    - HW x.7 (emotion expression)
    - ECL DG2 reading LOs below PS-II level for age
    - IL memory LOs (IL1.3a, IL2.x memory)
  - [ ] Function `runFLNAtRiskCheck(studentId)`:
    - query last 2 terms of observations
    - if score ≤ 2 on ≥ 3 at-risk LOs in both terms → flag as at-risk
    - create or update `AtRiskAlert` record with: reason codes (list of LO codes), severity (mild / moderate / high)
  - [ ] Schedule: run weekly or trigger after each batch of observations saved
  - [ ] `GET /api/fln/at-risk/class/:classId` — list at-risk students with reason LO codes

### 5.2 Frontend — At-Risk Indicators

- [ ] In FLN Tracker grid: show red border on student row if at-risk flag active
- [ ] In class roster view: add "FLN At-Risk" badge on student card
- [ ] At-risk detail panel: list the specific LOs causing concern with guiding questions + suggested intervention activity from Module III
- [ ] Teacher can dismiss flag with a note (e.g., "child was unwell, re-assess next term")
- [ ] Notify teacher via in-app notification when a new at-risk flag is generated

---

## Feature 6 — Rhymes & Songs Library

> Module III's 22+ rhymes as a browsable, assignable resource. Teacher marks rhymes used in class and can push them to the parent portal as take-home activities.

### 6.1 Backend

- [ ] Rhymes already seeded in Feature 2 (`fln_rhymes.json`)
- [ ] Add `GET /api/fln/activities?type=rhyme` (filter of existing endpoint)
- [ ] Add `POST /api/fln/rhymes/:id/assign-home` — push rhyme to parent portal
  - [ ] Creates a `ParentHomeActivity` record linked to studentId + rhyme content

### 6.2 Frontend

- [ ] Create `/frontend/src/teachers/FLNRhymesLibrary.jsx`
  - [ ] Card grid with rhyme title, concept tags (counting, emotions, body parts, seasons), DG badge
  - [ ] Click card → full lyrics + action instructions
  - [ ] "Mark Used in Class" button (records date)
  - [ ] "Send to Parents" button — opens student/class selector → sends to parent portal
  - [ ] Filter by concept, DG, class level

- [ ] In parent portal: show "Today's Activity from Teacher" section with rhyme card

---

## Feature 7 — Observation Rubric Generator

> Teacher selects LOs to assess → system generates a printable rubric in the Module III Section 4 format (criteria × achievement levels).

### 7.1 Backend

- [ ] Add `POST /api/fln/rubric/generate` endpoint
  - [ ] Request: `{ lo_codes: [], class_level, term }`
  - [ ] Response: structured rubric object with criteria rows and 4-level achievement descriptors (Beginning / Developing / Achieving / Extending)
  - [ ] Generate using AI (mode: `rubric_generate`) or template-based for speed

### 7.2 Frontend

- [ ] Add "Generate Rubric" button in FLN Tracker
- [ ] Rubric previews in a print-friendly modal
- [ ] Export as PDF

---

## Cross-Cutting Tasks

### Navigation & Routing

- [ ] Add FLN section to teachers sidebar with sub-items:
  - [ ] LO Tracker
  - [ ] Activity Library
  - [ ] Lesson Planner (FLN)
  - [ ] Class Heatmap
  - [ ] Rhymes Library
- [ ] Protect all new routes with teacher auth guard

### Testing

- [ ] Backend: write tests in `/backend/__tests__/fln.test.js`
  - [ ] `GET /api/fln/outcomes` returns LOs filtered by class_level
  - [ ] `POST /api/fln/observations` creates observation
  - [ ] `GET /api/fln/profile/:studentId` returns correct mastery %
  - [ ] At-risk check triggers correctly on low-score data
- [ ] Frontend: write tests for FLNTracker grid cell interaction

### Data Quality

- [ ] All 90+ LO entries in DB verified against Module II PDF
- [ ] All 40+ activities verified against Module III PDF
- [ ] All 22+ rhymes verified against Module III PDF
- [ ] LO codes cross-referenced — activities tagged with correct LO codes
- [ ] Guiding questions stored accurately per LO (not paraphrased)

---

## Build Order (Recommended)

| Sprint | Feature | Deliverable |
|---|---|---|
| **Sprint 1** | Feature 2 (data) | Seed all activities + rhymes into DB |
| **Sprint 1** | Feature 1.1–1.3 (data + backend) | LO seed + observation API |
| **Sprint 2** | Feature 1.4 (frontend) | FLN Tracker grid UI |
| **Sprint 2** | Feature 2.5 (frontend) | Activity Library UI |
| **Sprint 3** | Feature 3 (AI Lesson Planner) | LO-aware lesson plan generation |
| **Sprint 3** | Feature 4 (dashboards) | Student profile LO view + class heatmap |
| **Sprint 4** | Feature 5 (at-risk) | Auto-flagging logic + UI badges |
| **Sprint 4** | Feature 6 (rhymes) | Rhymes library + parent push |
| **Sprint 5** | Feature 7 (rubrics) | Rubric generator + PDF export |
| **Sprint 5** | Testing + QA | Full test coverage |

---

## Progress Summary

| Feature | Backend | Frontend | Data | Status |
|---|---|---|---|---|
| 1 — FLN LO Tracker | [ ] | [ ] | [ ] | Not started |
| 2 — Activity Library | [ ] | [ ] | [ ] | Not started |
| 3 — AI Lesson Planner | [ ] | [ ] | — | Not started |
| 4 — Dev Profile Dashboard | [ ] | [ ] | — | Not started |
| 5 — At-Risk Flagging | [ ] | [ ] | — | Not started |
| 6 — Rhymes Library | [ ] | [ ] | [ ] | Not started |
| 7 — Rubric Generator | [ ] | [ ] | — | Not started |

---

*Created: 2026-08-22 | Source: Module-II.pdf + Module-III.pdf (CISCE RDCD, November 2022)*
