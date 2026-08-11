# EEC ML — AI Build Checklist

> Last updated: 2026-08-11
> Legend: ✅ Done | 🔶 Partial | ❌ Not Started

---

## 1. Infrastructure & Tech Stack

- [x] React + Tailwind frontend (Vite, all role portals)
- [x] Node.js + Express 5 backend (JWT auth, RBAC middleware)
- [x] Python FastAPI AI service running
- [x] MongoDB with 57+ Mongoose models
- [x] Qdrant vector database (RAG chunks + language memory)
- [x] Ollama running locally (llama3.2:3b + Qwen3 8B + nomic-embed-text)
- [x] Tesseract OCR + PyMuPDF text extraction
- [x] Cloudinary file storage
- [x] Socket.IO real-time chat
- [x] Razorpay payment integration
- [ ] Docker Compose deployment setup
- [ ] Production Ubuntu server deployment
- [ ] PaddleOCR integration (Tesseract only for now)

---

## 2. Document Ingestion Pipeline

- [x] Teacher uploads PDF / DOCX / PPTX
- [x] OCR for scanned PDFs (Tesseract)
- [x] Text extraction for digital PDFs (PyMuPDF)
- [x] Text chunking (LangChain RecursiveCharacterTextSplitter)
- [x] Embedding generation (nomic-embed-text via Ollama)
- [x] Store chunks in Qdrant with tenant metadata
- [x] Metadata payload: school_id / class_id / section_id / subject / chapter / topic
- [x] Delete material from Qdrant when teacher deletes it
- [x] Teacher note stripping from chunks (`_strip_teacher_notes`)
- [ ] Auto-generate Learning Outcomes from document content
- [ ] Auto-update Knowledge Graph on every ingest
- [ ] Bloom classification of document content on ingest
- [ ] Document versioning (retain old versions, never auto-delete)
- [ ] Topic auto-detection from content (currently manual)

---

## 3. AI Orchestrator

- [ ] Central AI Orchestrator module in FastAPI
- [ ] Node.js calls ONLY the Orchestrator (not individual endpoints)
- [ ] Orchestrator routes requests to correct AI engine
- [ ] Loose coupling between all AI modules

> **Note:** Node currently calls individual AI endpoints directly — this violates the architecture.

---

## 4. RAG Engine

- [x] Qdrant filtered retrieval (school / class / section / subject / chapter)
- [x] Chapter-scoped search with subject-wide fallback
- [x] Relevance threshold filtering
- [x] "No materials found" graceful fallback message
- [x] Retrieved chunks stripped of teacher notes before LLM
- [ ] Hybrid search (semantic + BM25 keyword)
- [ ] Cross-session conversation memory (persisted, not in-memory)
- [ ] Academic year filter on retrieval

---

## 5. Knowledge Graph Engine

- [x] CurriculumMap.js model (topic + prerequisites + nextTopics)
- [x] curriculumMapRoutes.js backend routes
- [x] LearningPathMapView.jsx student-facing map
- [ ] Graph traversal logic (walk prerequisites to find root causes)
- [ ] Auto-update graph when new document is ingested
- [ ] Concept node extraction from documents
- [ ] Learning Outcome nodes linked to chapters
- [ ] Question nodes linked to concepts
- [ ] Student → Mastery edges auto-maintained

---

## 6. Mastery Engine

- [x] MasteryScore.js model
- [x] masteryRoutes.js backend
- [x] MasteryView.jsx frontend component
- [x] BaselineQuiz.jsx (initial mastery estimate)
- [ ] Auto-update mastery after every quiz attempt
- [ ] Auto-update mastery after every assessment / test
- [ ] BaselineQuiz results feed into Mastery Engine
- [ ] Mastery formula: accuracy + attempts + time + recency
- [ ] Knowledge decay over time (spaced repetition)
- [ ] Per-topic mastery score visible on student dashboard

---

## 7. Error Classification Engine

- [ ] Error type labels: Concept / Calculation / Reading / Logic
- [ ] Classification logic in ai-service
- [ ] Student answers routed to classifier after evaluation
- [ ] Error records stored per student per attempt
- [ ] Error history visible to teacher

---

## 8. Gap Detection Engine

- [ ] Prerequisite traversal in curriculum graph
- [ ] Root-cause weak topic detection
- [ ] Student insight records generated after gap detection
- [ ] Gap detection runs after mastery update
- [ ] Teacher notified of student gaps

---

## 9. Bloom Engine

- [ ] Bloom level tagging on ingested documents
- [ ] Bloom level assigned to generated questions
- [ ] Bloom level returned in answer evaluation
- [ ] Bloom distribution report for teachers

---

## 10. Student Memory Engine

- [x] StudentLanguageProfile.js model
- [x] Qdrant student_language_memory collection
- [x] /memory/store + /memory/retrieve endpoints
- [ ] Academic memory: weak topics stored per student
- [ ] Academic memory: past mistakes stored per student
- [ ] Previously studied chapters tracked
- [ ] Learning outcomes achieved stored
- [ ] Conversation memory persisted across sessions (not in-memory only)

---

## 11. AI Tutor Engine (RAG Chat)

- [x] RAG-backed tutor chat with Socratic homework mode
- [x] 7-rule Socratic enforcement (never give answer, always ask guiding question)
- [x] Per-mode temperature tuning (quiz 0.9 → notes 0.3)
- [x] Random seed per request (bust Ollama KV-cache)
- [x] Streaming response support
- [x] AI Tutor home screen with hero, quick actions, subject explorer, achievements
- [ ] Long-term conversation memory across sessions
- [ ] Student age-adaptive communication style
- [ ] Teacher visibility into student tutor sessions

---

## 12. Question Generator

- [x] MCQ quiz mode (5 questions per request via RAG)
- [x] Quiz mode UI (QuizUI with animated progress, score screen)
- [x] ExamQuestion.js + PracticeQuestion.js models
- [x] PracticeTestInterface.jsx + PracticePapersPortal.jsx
- [ ] Short answer question generation
- [ ] Long answer question generation
- [ ] Bloom-level question generation
- [ ] Difficulty level selection
- [ ] Generated questions saved permanently to Question Bank
- [ ] Teacher can edit AI-generated questions
- [ ] Adaptive difficulty based on mastery score

---

## 13. Answer Evaluator

- [x] Language assessment evaluation (Qwen3 8B)
- [x] Writing: rubric, strengths, weaknesses, improved version
- [x] Reading: comprehension score, accuracy, radar chart
- [ ] Academic MCQ answer evaluation
- [ ] Academic written answer evaluation
- [ ] Missing concepts detection
- [ ] Confidence score in evaluation response
- [ ] Bloom level classification of student answer
- [ ] Learning outcomes mapped to answer
- [ ] Evaluation result auto-feeds Mastery Engine

---

## 14. Flashcard Generator

- [x] Flashcard generation via RAG (Q: / A: format)
- [x] FlashcardUI: 3D CSS flip card
- [x] Keyboard navigation (← → Space)
- [x] "Got it / Still learning" ratings
- [x] Known count tracker + progress dots
- [ ] Flashcard ratings persisted to Mastery Engine
- [ ] Spaced repetition schedule based on ratings

---

## 15. Summary Generator

- [x] Summarize mode (extended token budget, temp 0.4)
- [x] OCR + summarize endpoint (/ocr/summarize)
- [x] Per-chapter summary generation

---

## 16. Mindmap Generator

- [x] MindMapUI: SVG cubic bezier paths, animated branches
- [x] 8-colour branch palette, 2-column grid layout
- [x] ResizeObserver + staggered path animation
- [x] parseMindMap(): handles space-indented RAG output
- [ ] Export mind map as PDF / image

---

## 17. Notes Generator

- [x] Notes mode (temp 0.3, extended tokens)
- [x] NotesUI: staggered colour cards per section heading
- [ ] Save generated notes to student profile
- [ ] Export notes as PDF

---

## 18. Recommendation Engine

- [ ] Recommend next topic based on mastery + curriculum graph
- [ ] Dynamic personalisation (not static suggestions)
- [ ] Explainable recommendations ("Because you scored low on X...")
- [ ] Student agency: let student accept / reject recommendation

---

## 19. Prompt Library

- [ ] /prompts/chat/ directory
- [ ] /prompts/evaluation/ directory
- [ ] /prompts/question_generation/ directory
- [ ] /prompts/summary/ directory
- [ ] /prompts/mindmap/ directory
- [ ] /prompts/flashcards/ directory
- [ ] /prompts/recommendation/ directory
- [ ] Move all hardcoded prompts from Python modules to prompt library

> **Note:** All prompts currently hardcoded inline — architectural violation.

---

## 20. Language Assessment Module *(Extra — beyond original plan)*

- [x] ReadingMaterial.js + ReadingAssessment.js models
- [x] WritingPrompt.js + WritingAssessment.js models
- [x] readingAssessmentRoutes.js + writingAssessmentRoutes.js
- [x] /reading/evaluate + /writing/evaluate endpoints (Qwen3 8B)
- [x] ReadingPracticePage.jsx (browse, record, results)
- [x] WritingPracticePage.jsx (rich editor, autosave, results)
- [x] ReadingScoreCard.jsx (circular score ring, radar chart)
- [x] WritingScoreCard.jsx (score bars, corrections, improved version)
- [x] LanguageRadarChart.jsx shared component
- [x] LanguagePracticeManager.jsx (teacher: create/edit/publish)
- [x] Sub-tabs inside PracticePapersPortal
- [ ] Teacher review dashboard polish for reading/writing results
- [ ] Bulk upload of multiple passages

---

## 21. Speech & Pronunciation Module *(Extra — beyond original plan)*

- [x] faster-whisper transcription service
- [x] SpeechBrain pronunciation scoring
- [x] /speech/transcribe + /speech/pronunciation endpoints
- [ ] Real-device mic latency testing
- [ ] Pronunciation score integrated into reading assessment score

---

## 22. Analytics Engine

- [x] teacherAnalyticsRoutes.js (basic class performance)
- [x] adminAnalyticsRoutes.js (basic school-level data)
- [ ] Per-topic mastery heatmap for teacher
- [ ] At-risk student flag / alert
- [ ] AI-generated insights for teacher ("Class struggles with fractions")
- [ ] Admin school-level subject weak area report
- [ ] Unified student learning health card (mastery + gaps + path + language)
- [ ] Intervention effectiveness measurement

---

## 23. Research-Grade Features (from Area to Cover doc)

- [ ] **Learner Confidence** — dynamic self-perception tracking
- [ ] **Help-Seeking Behaviour** — log when/how student asks for help
- [ ] **Retention / Forgetting** — spaced repetition + knowledge decay model
- [ ] **Misconception Engine** — explicit error models per topic
- [ ] **Engagement (Multidimensional)** — situational + behavioural + emotional
- [ ] **Intervention Effectiveness** — measure which interventions actually improve learning
- [ ] **Teacher Escalation** — auto-flag students for human teacher support
- [ ] **Student Agency** — learner control over their own learning path
- [ ] **Explainable AI** — show student why AI said what it said
- [ ] **Social / Belonging Dimension** — peer interaction, belonging signals
- [ ] **Evidence Testing** — prove the platform actually improves outcomes
- [ ] **Equity / Bias Monitoring** — detect if model performs unevenly across cohorts
- [ ] **Wellbeing Safeguards** — human support boundary, child protection layer
- [ ] **AI / Data Ethics** — child-centered ethical use framework (beyond RBAC)

---

## 24. Permissions & Teacher Controls

- [x] Teacher: upload documents
- [x] Teacher: delete documents (Cloudinary + Qdrant)
- [x] Teacher: create reading/writing content (LanguagePracticeManager)
- [x] Student: chat with AI tutor
- [x] Student: generate quiz, notes, flashcards, mindmap, summary
- [x] Student: practice tests + practice papers
- [x] Student: reading + writing assessment
- [ ] Teacher: disable / re-enable document (without deleting)
- [ ] Teacher: re-index individual document from UI
- [ ] Teacher: view student AI chat sessions
- [ ] Teacher: override / correct an AI answer
- [ ] Teacher: view per-student gap report
- [ ] Student: export notes / mindmap / flashcards

---

## 25. Future ML Features

- [ ] At-risk student prediction (dropout / failure risk)
- [ ] Performance forecasting (predicted score on next test)
- [ ] Learning style detection (visual / reading / quiz preference)
- [ ] Topic failure prediction (before the test happens)
- [ ] Knowledge decay prediction (when will student forget X)

---

## Progress Summary

| Category | Done | Partial | Not Started | Total |
|---|---|---|---|---|
| Infrastructure | 10 | 0 | 3 | 13 |
| Document Ingestion | 9 | 0 | 5 | 14 |
| AI Orchestrator | 0 | 0 | 4 | 4 |
| RAG Engine | 5 | 0 | 3 | 8 |
| Knowledge Graph | 3 | 0 | 6 | 9 |
| Mastery Engine | 4 | 0 | 6 | 10 |
| Error Classification | 0 | 0 | 5 | 5 |
| Gap Detection | 0 | 0 | 5 | 5 |
| Bloom Engine | 0 | 0 | 4 | 4 |
| Student Memory | 3 | 0 | 6 | 9 |
| AI Tutor Engine | 6 | 0 | 3 | 9 |
| Question Generator | 5 | 0 | 7 | 12 |
| Answer Evaluator | 4 | 0 | 7 | 11 |
| Flashcard Generator | 5 | 0 | 2 | 7 |
| Summary Generator | 3 | 0 | 0 | 3 |
| Mindmap Generator | 4 | 0 | 1 | 5 |
| Notes Generator | 2 | 0 | 2 | 4 |
| Recommendation Engine | 0 | 0 | 4 | 4 |
| Prompt Library | 0 | 0 | 8 | 8 |
| Language Assessment | 12 | 0 | 2 | 14 |
| Speech Module | 3 | 0 | 2 | 5 |
| Analytics Engine | 2 | 0 | 6 | 8 |
| Research-Grade Features | 0 | 0 | 14 | 14 |
| Permissions & Controls | 7 | 0 | 7 | 14 |
| Future ML | 0 | 0 | 5 | 5 |
| **TOTAL** | **97** | **0** | **127** | **224** |

**Overall: ~43% of all planned items checked off**

---

## Next 5 Things to Build (in order)

1. **Error Classification Engine** — classify wrong answers before anything else can work
2. **Mastery Engine auto-update** — wire quiz + evaluation results to update mastery after every attempt
3. **Gap Detection Engine** — traverse curriculum graph to find root-cause weak topics
4. **AI Orchestrator** — fix the architectural violation (Node calling endpoints directly)
5. **Prompt Library** — externalise all hardcoded prompts (architectural requirement)
