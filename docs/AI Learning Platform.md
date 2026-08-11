# AI Learning Platform - Project Context

Version: 1.0
Status: Architecture Locked
Last Updated: July 2026

------------------------------------------------------------

# IMPLEMENTATION PROGRESS TRACKER

Last Synced: 2026-08-11
Overall Progress: ~55%

Legend: ✅ Done | 🔶 Partial | ❌ Not Started

------------------------------------------------------------

## TECH STACK STATUS

| Component         | Planned              | Status | Notes                                      |
|-------------------|----------------------|--------|--------------------------------------------|
| Frontend          | React + Tailwind     | ✅ Done | Vite + TailwindCSS, all role portals live  |
| Backend           | Node.js + Express    | ✅ Done | Express 5, JWT auth, RBAC middleware       |
| AI Services       | Python + FastAPI     | ✅ Done | ai-service running, multiple modules       |
| Primary Database  | MongoDB              | ✅ Done | 57 Mongoose models, multi-school isolation |
| Vector Database   | Qdrant               | ✅ Done | RAG chunks + language memory collections   |
| LLM               | Ollama / Qwen 3 14B  | 🔶 Partial | Qwen3 8B pulled; chat uses llama3.2:3b; assessment uses Qwen3 8B |
| Embedding Model   | nomic-embed-text     | ✅ Done | Active for all RAG ingestion               |
| OCR               | Tesseract OCR        | ✅ Done | PyMuPDF text-first + Tesseract fallback    |
| Deployment        | Ubuntu + Docker      | ❌ Not Started | No Docker Compose setup yet          |

------------------------------------------------------------

## AI ENGINES STATUS

| Engine                  | Status     | Progress | Built                                                         | Missing                                              |
|-------------------------|------------|----------|---------------------------------------------------------------|------------------------------------------------------|
| AI Orchestrator         | ❌ Not Started | 0%   | Node calls individual endpoints directly                      | Central orchestrator layer that routes all AI work   |
| RAG Engine              | ✅ Done    | 95%      | Full pipeline: OCR → chunk → embed → Qdrant → retrieve → LLM | Cross-session conversation memory not persisted      |
| OCR Engine              | ✅ Done    | 90%      | PyMuPDF text-extract + Tesseract; pdf2image; pptx/docx        | PaddleOCR not integrated (Tesseract only)            |
| Embedding Engine        | ✅ Done    | 95%      | nomic-embed-text via Ollama; chunk + upsert to Qdrant         | —                                                    |
| Retrieval Engine        | ✅ Done    | 90%      | Qdrant metadata filter (school/class/section/subject/chapter) | Hybrid search (semantic + keyword BM25) not yet done |
| Knowledge Graph Engine  | 🔶 Partial | 30%      | CurriculumMap.js model + curriculumMapRoutes.js               | No graph traversal logic; no auto-update on ingest   |
| Gap Detection Engine    | ❌ Not Started | 5%   | CurriculumMap prerequisite links exist in model               | No traversal to find root-cause weak topics          |
| Bloom Engine            | ❌ Not Started | 0%   | —                                                             | No Bloom-level tagging on questions or documents     |
| Mastery Engine          | 🔶 Partial | 50%      | MasteryScore.js model + masteryRoutes.js + MasteryView.jsx    | Not auto-updated after quiz/test; no recency decay   |
| Student Memory Engine   | 🔶 Partial | 60%      | language_memory module (Qdrant); StudentLanguageProfile.js    | Academic memory (past mistakes, weak topics) not built |
| Tutor Engine            | ✅ Done    | 90%      | RAG chat with Socratic homework mode; per-mode temperature    | No cross-session long-term conversation memory       |
| Question Generator      | 🔶 Partial | 50%      | Quiz mode from RAG; ExamQuestion.js + PracticeQuestion.js     | No Bloom-level generation; not saved permanently to bank |
| Answer Evaluator        | 🔶 Partial | 40%      | Language assessment eval (Qwen3 8B); rubric + score JSON      | Academic MCQ/written answer eval not wired           |
| Flashcard Generator     | ✅ Done    | 90%      | FlashcardUI (3D flip, keyboard nav, ratings); ai-service module | Ratings not persisted to mastery               |
| Summary Generator       | ✅ Done    | 90%      | Summarize mode + OCR summarize endpoint; per-mode prompt      | —                                                    |
| Mindmap Generator       | ✅ Done    | 90%      | MindMapUI (SVG bezier, animated branches, ResizeObserver)     | No export (PDF/image)                                |
| Recommendation Engine   | ❌ Not Started | 0%   | —                                                             | Needs mastery + gap data pipeline first              |
| Analytics Engine        | 🔶 Partial | 35%      | teacherAnalyticsRoutes.js + adminAnalyticsRoutes.js backend   | No AI-generated insights; no per-topic heatmap UI    |

------------------------------------------------------------

## DOCUMENT WORKFLOW STATUS

| Step                        | Status     | Notes                                                        |
|-----------------------------|------------|--------------------------------------------------------------|
| Teacher uploads PDF         | ✅ Done    | Cloudinary upload via Multer                                 |
| OCR                         | ✅ Done    | Tesseract + PyMuPDF                                          |
| Extract Text                | ✅ Done    | All formats: PDF / DOCX / PPTX                               |
| Chunking                    | ✅ Done    | LangChain RecursiveCharacterTextSplitter with start_index    |
| Embedding                   | ✅ Done    | nomic-embed-text → Qdrant upsert                             |
| Store in Qdrant             | ✅ Done    | With full tenant metadata payload                            |
| Generate Metadata           | ✅ Done    | school_id / class_id / section_id / subject / chapter / topic |
| Generate Learning Outcomes  | ❌ Not Started | Not implemented; planned as part of Knowledge Graph Engine |
| Knowledge Graph Update      | ❌ Not Started | CurriculumMap model exists; auto-update on ingest not wired  |
| Bloom Classification        | ❌ Not Started | No Bloom tagging in ingestion pipeline                       |
| Document Versioning         | ❌ Not Started | No version field on documents; old versions not retained     |
| Ready for Retrieval         | ✅ Done    | Qdrant filtered retrieval active                             |

------------------------------------------------------------

## KNOWLEDGE GRAPH STATUS

| Node Level        | Status     | Notes                                                        |
|-------------------|------------|--------------------------------------------------------------|
| Organization      | 🔶 Partial | School model exists; no org-level tenant model               |
| School            | ✅ Done    | School isolation enforced in every Qdrant query              |
| Class             | ✅ Done    | Class filter on retrieval                                    |
| Subject           | ✅ Done    | Subject filter on retrieval                                  |
| Chapter           | ✅ Done    | Chapter filter on retrieval                                  |
| Learning Outcome  | ❌ Not Started | Not generated from documents yet                           |
| Concept           | ❌ Not Started | No concept node extraction                                 |
| Question → Mastery | 🔶 Partial | Questions exist; mastery link not auto-updated               |
| Student → Mastery | 🔶 Partial | MasteryScore.js exists; not fully wired                      |

------------------------------------------------------------

## STUDENT MEMORY STATUS

| Memory Type              | Status     | Notes                                                        |
|--------------------------|------------|--------------------------------------------------------------|
| Conversation Memory      | 🔶 Partial | In-memory per request only; not persisted across sessions    |
| Weak Topics              | ❌ Not Started | No gap detection feeding weak topic memory yet             |
| Mastery Levels           | 🔶 Partial | MasteryScore.js; not auto-updated after every assessment     |
| Previously Studied       | ❌ Not Started | No study session log                                       |
| Learning Outcomes        | ❌ Not Started | Outcomes not extracted from content yet                    |
| Past Mistakes            | ❌ Not Started | Errors not classified or stored per student                |
| Language Profile Memory  | ✅ Done    | StudentLanguageProfile.js + Qdrant student_language_memory   |

------------------------------------------------------------

## QUESTION GENERATION STATUS

| Capability           | Status     | Notes                                                        |
|----------------------|------------|--------------------------------------------------------------|
| MCQ                  | ✅ Done    | RAG quiz mode generates 5 MCQs per request                  |
| Short Answer         | 🔶 Partial | Homework help mode covers this                               |
| Long Answer          | ❌ Not Started | —                                                          |
| Difficulty Levels    | ❌ Not Started | No difficulty param in question generation                 |
| Bloom Levels         | ❌ Not Started | No Bloom tagging on generated questions                    |
| Saved to Question Bank | ❌ Not Started | Generated questions not persisted; ephemeral per session  |
| Teacher Editable     | ❌ Not Started | No teacher question review / edit UI for AI-generated Qs  |

------------------------------------------------------------

## ANSWER EVALUATION STATUS

| Field in Response    | Status     | Notes                                                        |
|----------------------|------------|--------------------------------------------------------------|
| Marks                | ✅ Done    | Language assessment returns numeric scores                   |
| Rubric               | 🔶 Partial | Writing assessment returns criteria breakdown                |
| Strengths            | ✅ Done    | Reading + Writing ScoreCards show strength areas             |
| Weaknesses           | ✅ Done    | Radar chart shows weak dimensions                            |
| Missing Concepts     | ❌ Not Started | Not returned by academic answer evaluator                  |
| Suggestions          | ✅ Done    | WritingScoreCard shows improved version + suggestions        |
| Bloom Level          | ❌ Not Started | Not classified                                             |
| Learning Outcomes    | ❌ Not Started | Not mapped to outcomes                                     |
| Confidence Score     | ❌ Not Started | Not implemented                                            |
| Mastery Update       | ❌ Not Started | Evaluation result does not feed mastery engine             |

------------------------------------------------------------

## PERMISSIONS STATUS

| Permission                     | Status     | Notes                                                    |
|--------------------------------|------------|----------------------------------------------------------|
| Teacher: Upload documents      | ✅ Done    | Multer + Cloudinary + ingest pipeline                    |
| Teacher: Delete documents      | ✅ Done    | Deletes from Cloudinary + Qdrant                         |
| Teacher: Disable documents     | ❌ Not Started | No enable/disable toggle on materials                  |
| Teacher: Re-index documents    | 🔶 Partial | reingest_materials.py script exists (manual only)        |
| Teacher: View AI analytics     | 🔶 Partial | Basic routes exist; no full analytics UI                 |
| Teacher: View student chats    | ❌ Not Started | No chat visibility for teachers                        |
| Teacher: Override AI answers   | ❌ Not Started | No override/correction mechanism                       |
| Student: Chat                  | ✅ Done    | Full AI tutor chat with RAG                              |
| Student: Generate Questions    | ✅ Done    | Quiz mode                                                |
| Student: Generate Notes        | ✅ Done    | Notes mode                                               |
| Student: Flashcards            | ✅ Done    | Flashcard mode with 3D flip UI                           |
| Student: Mindmaps              | ✅ Done    | MindMap mode with SVG layout                             |
| Student: Summaries             | ✅ Done    | Summarize mode                                           |
| Student: Practice Tests        | ✅ Done    | PracticeTestInterface + PracticePapersPortal             |

------------------------------------------------------------

## PROMPT LIBRARY STATUS

| Prompt Directory     | Status     | Notes                                                        |
|----------------------|------------|--------------------------------------------------------------|
| /prompts/chat/       | ❌ Not Started | Prompts hardcoded in chat/router.py MODE_INSTRUCTIONS      |
| /prompts/evaluation/ | ❌ Not Started | Prompts hardcoded in assessment/service.py                 |
| /prompts/question_generation/ | ❌ Not Started | Prompts inline in quiz mode                       |
| /prompts/summary/    | ❌ Not Started | Prompts inline in summaries module                         |
| /prompts/mindmap/    | ❌ Not Started | Prompts inline in chat/router.py                           |
| /prompts/flashcards/ | ❌ Not Started | Prompts inline in flashcards module                        |
| /prompts/recommendation/ | ❌ Not Started | Recommendation engine not built yet                    |

Note: Prompt externalisation is an architectural requirement — all prompts should be moved to a library.

------------------------------------------------------------

## ADDITIONAL MODULES BUILT (Beyond Original Plan)

| Module                     | Status     | Notes                                                        |
|----------------------------|------------|--------------------------------------------------------------|
| Language Assessment (Reading) | ✅ Done | ReadingMaterial + ReadingAssessment models; /reading/evaluate; ReadingPracticePage.jsx + ReadingScoreCard.jsx |
| Language Assessment (Writing) | ✅ Done | WritingPrompt + WritingAssessment models; /writing/evaluate; WritingPracticePage.jsx + WritingScoreCard.jsx |
| Speech / Pronunciation     | 🔶 Partial | faster-whisper transcription + SpeechBrain pronunciation; needs real-device mic testing |
| Baseline Quiz              | 🔶 Partial | BaselineQuiz.jsx; results not yet feeding Mastery Engine     |
| Teacher Language Manager   | ✅ Done    | LanguagePracticeManager.jsx; create/publish passages + prompts |

------------------------------------------------------------

## TOP REMAINING PRIORITIES

| # | What | Why It's Blocking                              |
|---|------|------------------------------------------------|
| 1 | AI Orchestrator | Node calls AI endpoints directly — violates architecture |
| 2 | Error Classification Engine | Required before Gap Detection can work |
| 3 | Gap Detection Engine | Core intelligence; unlocks personalised paths  |
| 4 | Mastery Engine auto-update | Must fire after every quiz / evaluation        |
| 5 | Knowledge Graph — learning outcomes + concept nodes | Powers recommendations and adaptive learning |
| 6 | Prompt Library | Architecture mandates no hardcoded prompts     |
| 7 | Document Versioning | Architecture mandates version retention        |
| 8 | Bloom Engine | Required for Bloom-level question generation and evaluation |
| 9 | Recommendation Engine | Needs mastery + gap data pipeline first        |
| 10 | Docker Compose deployment setup | Required for production                       |

------------------------------------------------------------

---

# IMPORTANT

This file contains the architectural decisions for the entire project.

Before implementing ANY feature, ALWAYS read this file.

Do NOT redesign the architecture.

Do NOT simplify the architecture.

Do NOT replace technologies unless explicitly instructed.

If a requested implementation conflicts with this document,
ask for clarification instead of changing the architecture.

------------------------------------------------------------

# PROJECT VISION

This is NOT a chatbot.

This is NOT a simple RAG application.

This is an Enterprise AI Learning Platform capable of serving multiple educational organizations.

The system is designed to support:

- AI Tutor
- AI Chat over uploaded documents
- Question Generation
- Answer Evaluation
- Student Mastery Tracking
- Knowledge Graph
- Gap Detection
- Flashcards
- Mindmaps
- Notes
- Summaries
- Practice Tests
- Analytics
- Learning Recommendations

RAG is only ONE engine inside the platform.

------------------------------------------------------------

# TECHNOLOGY STACK

Frontend
---------
React

Backend
--------
Node.js
Express

AI Services
-----------
Python
FastAPI

Primary Database
----------------
MongoDB

Vector Database
---------------
Qdrant

LLM
----
Ollama

Embedding Model
---------------
nomic-embed-text

Primary LLM
-----------
Qwen 3 14B
(or newer compatible Qwen model)

OCR
---
Tesseract OCR

Deployment
----------
Ubuntu Server

Docker Compose

Everything runs locally.

No cloud AI services.

------------------------------------------------------------

# HIGH LEVEL ARCHITECTURE

React

↓

Node Backend

↓

FastAPI AI Services

↓

AI Orchestrator

↓

Individual AI Engines

↓

MongoDB
Qdrant
Ollama

Node.js NEVER communicates directly with AI engines.

Node communicates ONLY with the AI Orchestrator.

The Orchestrator coordinates every AI workflow.

------------------------------------------------------------

# MULTI TENANT STRUCTURE

Organization

↓

School

↓

Academic Year

↓

Class

↓

Subject

↓

Chapter

Tenant isolation MUST exist.

Schools must NEVER access documents from another school.

Every query MUST include tenant context.

------------------------------------------------------------

# DOCUMENT ORGANIZATION

Teacher uploads documents.

Documents belong to

Organization
School
Academic Year
Class
Subject
Chapter

Example

Physics Notes.pdf

↓

Class 8

↓

Science

↓

Chapter:
Motion

Force

Energy

------------------------------------------------------------

# DOCUMENT VERSIONING

Documents support versions.

Example

Physics.pdf

Version 1

Version 2

Version 3

Older versions remain searchable.

Never delete old versions automatically.

------------------------------------------------------------

# DOCUMENT WORKFLOW

Teacher uploads PDF

↓

OCR

↓

Extract Text

↓

Chunking

↓

Embedding

↓

Store in Qdrant

↓

Generate Metadata

↓

Generate Learning Outcomes

↓

Knowledge Graph Update

↓

Bloom Classification

↓

Ready for Retrieval

This workflow is automatic.

------------------------------------------------------------

# AI PERSONALITY

The AI Tutor should be

- Friendly
- Adaptive
- Socratic

The tutor should guide students rather than immediately giving answers whenever appropriate.

Difficulty and communication style should adapt based on student age.

------------------------------------------------------------

# AI ENGINES

The AI Service contains multiple modules.

Modules include:

AI Orchestrator

RAG Engine

OCR Engine

Embedding Engine

Retrieval Engine

Knowledge Graph Engine

Gap Detection Engine

Bloom Engine

Mastery Engine

Student Memory Engine

Tutor Engine

Question Generator

Answer Evaluator

Flashcard Generator

Summary Generator

Mindmap Generator

Recommendation Engine

Analytics Engine

Every module has a single responsibility.

------------------------------------------------------------

# AI ORCHESTRATOR

The AI Orchestrator is the ONLY component that coordinates AI workflows.

Node.js calls ONLY the AI Orchestrator.

The Orchestrator calls AI modules.

Modules NEVER directly depend on Node.js.

Modules should remain loosely coupled.

------------------------------------------------------------

# STUDENT MEMORY

The platform maintains:

Conversation Memory

Student Learning Memory

Weak Topics

Mastery Levels

Previously Studied Chapters

Learning Outcomes

Past Mistakes

Memory is long-term.

------------------------------------------------------------

# RAG

Use metadata filtering.

Retrieval must consider:

Tenant

School

Academic Year

Class

Subject

Chapter

Student permissions

Never retrieve documents from another tenant.

If no relevant documents exist:

Return

"I couldn't find this in your school's learning materials."

Then optionally allow the user to request an answer from the model's general knowledge.

------------------------------------------------------------

# KNOWLEDGE GRAPH

Build a complete educational graph.

Organization

↓

School

↓

Class

↓

Subject

↓

Chapter

↓

Learning Outcome

↓

Concept

↓

Question

↓

Student

↓

Mastery

The Knowledge Graph powers:

Recommendations

Gap Detection

Mastery Tracking

Adaptive Learning

------------------------------------------------------------

# QUESTION GENERATION

Generate questions using

Selected Chapter

Selected Learning Outcomes

Bloom's Taxonomy

Support:

MCQ

Short

Long

Difficulty Levels

Bloom Levels

Generated questions are saved permanently.

Teachers can edit them.

------------------------------------------------------------

# ANSWER EVALUATION

Evaluation should return

Marks

Rubric

Strengths

Weaknesses

Missing Concepts

Suggestions

Bloom Level

Learning Outcomes

Confidence Score

Mastery Update

------------------------------------------------------------

# PERMISSIONS

Teachers

--------

Upload documents

Delete documents

Disable documents

Re-index documents

View AI analytics

View student chats

Override AI answers

Students

--------

Chat

Generate Questions

Generate Notes

Flashcards

Mindmaps

Summaries

Practice Tests

------------------------------------------------------------

# CODING PRINCIPLES

Use Clean Architecture where appropriate.

Use SOLID principles.

Keep modules independent.

Avoid circular dependencies.

Prefer dependency injection.

Separate:

API

Business Logic

Persistence

AI Logic

Configuration

------------------------------------------------------------

# API DESIGN

Node.js is the public API.

FastAPI is an internal AI API.

React NEVER communicates directly with AI Services.

------------------------------------------------------------

# DATABASE RESPONSIBILITIES

MongoDB stores

Users

Schools

Courses

Documents

Document Metadata

Chats

Student Progress

Mastery

Analytics

Question Banks

Evaluations

Qdrant stores

Embeddings

Knowledge Chunks

Concept Embeddings

Student Memory Embeddings

------------------------------------------------------------

# PROMPTS

Never hardcode prompts.

Create a prompt library.

Example

/prompts

chat/

evaluation/

question_generation/

summary/

mindmap/

flashcards/

recommendation/

------------------------------------------------------------

# FUTURE FEATURES

Architecture must remain extensible for

Voice Tutor

Image Understanding

Video Understanding

Code Tutor

Math Solver

Speech Recognition

Vision Models

Hybrid Search

External APIs

------------------------------------------------------------

# IMPORTANT RULES FOR CODE GENERATION

Before implementing any feature:

1. Understand which module owns the responsibility.

2. Do NOT duplicate logic.

3. Reuse existing services.

4. Follow existing architecture.

5. Keep code modular.

6. Write production-ready code.

7. Keep functions small.

8. Add proper typing.

9. Add logging.

10. Add error handling.

11. Add validation.

12. Keep security in mind.

13. Respect tenant isolation.

14. Respect RBAC.

15. Never expose internal AI services to the frontend.

------------------------------------------------------------

# PROJECT PHILOSOPHY

This project prioritizes

Maintainability

Scalability

Extensibility

Security

Readability

Testability

Enterprise-grade architecture

The goal is to build a production-ready AI Learning Platform rather than a prototype.

End of Document.
