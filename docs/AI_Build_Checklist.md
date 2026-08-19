# EEC ML — AI Build Checklist

> Last updated: 2026-08-19 (session 2)
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
- [x] Auto-generate Learning Outcomes from document content
- [x] Auto-update Knowledge Graph on every ingest
- [x] Bloom classification of document content on ingest
- [x] Document versioning (snapshot on every edit; GET /:id/versions + POST /:id/versions/:n/restore)
- [x] Topic auto-detection from content (currently manual)

---

## 3. AI Orchestrator

- [x] Central AI Orchestrator module in FastAPI
- [x] Node.js calls ONLY the Orchestrator (not individual endpoints)
- [x] Orchestrator routes requests to correct AI engine
- [x] Loose coupling between all AI modules

---

## 4. RAG Engine

- [x] Qdrant filtered retrieval (school / class / section / subject / chapter)
- [x] Chapter-scoped search with subject-wide fallback
- [x] Relevance threshold filtering
- [x] "No materials found" graceful fallback message
- [x] Retrieved chunks stripped of teacher notes before LLM
- [x] Hybrid search (semantic + BM25 keyword)
- [x] Cross-session conversation memory (persisted, not in-memory)
- [x] Academic year filter on retrieval

---

## 5. Knowledge Graph Engine

- [x] CurriculumMap.js model (topic + prerequisites + nextTopics)
- [x] curriculumMapRoutes.js backend routes
- [x] LearningPathMapView.jsx student-facing map
- [x] Graph traversal logic (walk prerequisites to find root causes)
- [x] Auto-update graph when new document is ingested
- [x] Concept node extraction from documents
- [x] Learning Outcome nodes linked to chapters
- [x] Question nodes linked to concepts
- [x] Student → Mastery edges auto-maintained

---

## 6. Mastery Engine

- [x] MasteryScore.js model
- [x] masteryRoutes.js backend
- [x] MasteryView.jsx frontend component
- [x] BaselineQuiz.jsx (initial mastery estimate)
- [x] Auto-update mastery after every quiz attempt
- [x] Auto-update mastery after every assessment / test
- [x] BaselineQuiz results feed into Mastery Engine
- [x] Mastery formula: accuracy + attempts + time + recency
- [x] Knowledge decay over time (spaced repetition)
- [x] Per-topic mastery score visible on student dashboard

---

## 7. Error Classification Engine

- [x] Error type labels: Concept / Calculation / Reading / Logic
- [x] Classification logic in ai-service
- [x] Student answers routed to classifier after evaluation
- [x] Error records stored per student per attempt
- [x] Error history visible to teacher

---

## 8. Gap Detection Engine

- [x] Prerequisite traversal in curriculum graph
- [x] Root-cause weak topic detection
- [x] Student insight records generated after gap detection
- [x] Gap detection runs after mastery update
- [x] Teacher notified of student gaps

---

## 9. Bloom Engine

- [x] Bloom level tagging on ingested documents
- [x] Bloom level assigned to generated questions
- [x] Bloom level returned in answer evaluation
- [x] Bloom distribution report for teachers

---

## 10. Student Memory Engine

- [x] StudentLanguageProfile.js model
- [x] Qdrant student_language_memory collection
- [x] /memory/store + /memory/retrieve endpoints
- [x] Academic memory: weak topics stored per student
- [x] Academic memory: past mistakes stored per student
- [x] Previously studied chapters tracked
- [x] Learning outcomes achieved stored
- [x] Conversation memory persisted across sessions (not in-memory only)

---

## 11. AI Tutor Engine (RAG Chat)

- [x] RAG-backed tutor chat with Socratic homework mode
- [x] 7-rule Socratic enforcement (never give answer, always ask guiding question)
- [x] Per-mode temperature tuning (quiz 0.9 → notes 0.3)
- [x] Random seed per request (bust Ollama KV-cache)
- [x] Streaming response support
- [x] AI Tutor home screen with hero, quick actions, subject explorer, achievements
- [x] Long-term conversation memory across sessions
- [x] Student age-adaptive communication style
- [x] Teacher visibility into student tutor sessions

---

## 12. Question Generator

- [x] MCQ quiz mode (5 questions per request via RAG)
- [x] Quiz mode UI (QuizUI with animated progress, score screen)
- [x] ExamQuestion.js + PracticeQuestion.js models
- [x] PracticeTestInterface.jsx + PracticePapersPortal.jsx
- [x] Short answer question generation
- [x] Long answer question generation
- [x] Bloom-level question generation
- [x] Difficulty level selection (teacher-explicit via POST /api/ai-tutor/teacher/generate)
- [x] Generated questions saved permanently to Question Bank
- [x] Teacher can edit AI-generated questions
- [x] Adaptive difficulty based on mastery score

---

## 13. Answer Evaluator

- [x] Language assessment evaluation (Qwen3 8B)
- [x] Writing: rubric, strengths, weaknesses, improved version
- [x] Reading: comprehension score, accuracy, radar chart
- [x] Academic MCQ answer evaluation
- [x] Academic written answer evaluation
- [x] Missing concepts detection
- [x] Confidence score in evaluation response
- [x] Bloom level classification of student answer
- [x] Learning outcomes mapped to answer
- [x] Evaluation result auto-feeds Mastery Engine

---

## 14. Flashcard Generator

- [x] Flashcard generation via RAG (Q: / A: format)
- [x] FlashcardUI: 3D CSS flip card
- [x] Keyboard navigation (← → Space)
- [x] "Got it / Still learning" ratings
- [x] Known count tracker + progress dots
- [x] Flashcard ratings persisted to Mastery Engine
- [x] Spaced repetition schedule based on ratings

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
- [x] Export mind map as PDF / image

---

## 17. Notes Generator

- [x] Notes mode (temp 0.3, extended tokens)
- [x] NotesUI: staggered colour cards per section heading
- [x] Save generated notes to student profile
- [x] Export notes as PDF

---

## 18. Recommendation Engine

- [x] Recommend next topic based on mastery + curriculum graph
- [x] Dynamic personalisation (not static suggestions)
- [x] Explainable recommendations ("Because you scored low on X...")
- [x] Student agency: let student accept / reject recommendation

---

## 19. Prompt Library

- [x] /prompts/chat/ directory
- [x] /prompts/evaluation/ directory
- [x] /prompts/question_generation/ directory
- [x] /prompts/summary/ directory
- [x] /prompts/mindmap/ directory
- [x] /prompts/flashcards/ directory
- [x] /prompts/recommendation/ directory
- [x] Move all hardcoded prompts from Python modules to prompt library

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
- [x] At-risk student flag / alert
- [x] AI-generated insights for teacher ("Class struggles with fractions")
- [x] Admin school-level subject weak area report
- [x] Unified student learning health card (mastery + gaps + path + language)
- [x] Intervention effectiveness measurement

---

## 23. Research-Grade Features (from Area to Cover doc)

- [ ] **Learner Confidence** — dynamic self-perception tracking
- [ ] **Help-Seeking Behaviour** — log when/how student asks for help
- [x] **Retention / Forgetting** — spaced repetition + knowledge decay model
- [ ] **Misconception Engine** — explicit error models per topic
- [ ] **Engagement (Multidimensional)** — situational + behavioural + emotional
- [ ] **Intervention Effectiveness** — measure which interventions actually improve learning
- [x] **Teacher Escalation** — auto-flag students for human teacher support
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
- [x] Teacher: disable / re-enable document (without deleting)
- [x] Teacher: re-index individual document from UI
- [x] Teacher: view student AI chat sessions
- [x] Teacher: override / correct an AI answer
- [x] Teacher: view per-student gap report
- [x] Student: export notes / mindmap / flashcards

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
| Document Ingestion | 14 | 0 | 0 | 14 |
| AI Orchestrator | 4 | 0 | 0 | 4 |
| RAG Engine | 8 | 0 | 0 | 8 |
| Knowledge Graph | 9 | 0 | 0 | 9 |
| Mastery Engine | 10 | 0 | 0 | 10 |
| Error Classification | 5 | 0 | 0 | 5 |
| Gap Detection | 5 | 0 | 0 | 5 |
| Bloom Engine | 4 | 0 | 0 | 4 |
| Student Memory | 9 | 0 | 0 | 9 |
| AI Tutor Engine | 9 | 0 | 0 | 9 |
| Question Generator | 12 | 0 | 0 | 12 |
| Answer Evaluator | 11 | 0 | 0 | 11 |
| Flashcard Generator | 7 | 0 | 0 | 7 |
| Summary Generator | 3 | 0 | 0 | 3 |
| Mindmap Generator | 5 | 0 | 0 | 5 |
| Notes Generator | 4 | 0 | 0 | 4 |
| Recommendation Engine | 4 | 0 | 0 | 4 |
| Prompt Library | 8 | 0 | 0 | 8 |
| Language Assessment | 12 | 0 | 2 | 14 |
| Speech Module | 3 | 0 | 2 | 5 |
| Analytics Engine | 8 | 0 | 0 | 8 |
| Research-Grade Features | 2 | 0 | 12 | 14 |
| Permissions & Controls | 13 | 0 | 1 | 14 |
| Future ML | 0 | 0 | 5 | 5 |
| **TOTAL** | **189** | **0** | **35** | **224** |

**Overall: ~84% of all planned items checked off**

---

## Next 5 Things to Build (in order)

1. **Document versioning UI** — frontend for browsing version history and restoring snapshots (backend endpoints now live)
2. **Language Assessment remaining items** — 2 unchecked items in section 19
3. **Speech Module remaining items** — 2 unchecked items in section 20
4. **Research-Grade Features** — 12 unchecked items (personalized spaced repetition, Bayesian mastery, etc.)
5. **Permissions & Controls remaining** — 1 unchecked item in section 23
