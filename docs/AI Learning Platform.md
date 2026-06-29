# AI Learning Platform - Project Context

Version: 1.0
Status: Architecture Locked
Last Updated: July 2026

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
