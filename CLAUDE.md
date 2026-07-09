# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Common Commands](#common-commands)
5. [Key Architecture Patterns](#key-architecture-patterns)
6. [Development Conventions](#development-conventions)
7. [Testing](#testing)

---

## Project Overview

**Project Name:** EEC (Electronic Educare)

**Purpose:** Multi-role educational management system supporting students, parents, teachers, administrators, principals, and super administrators.

**Core Modules:** Academic management, attendance, financial management (payments via Razorpay), real-time chat, notifications, AI tutoring, lesson planning, timetable management, and reporting.

**Type:** Full-stack React + Node.js/Express application with MongoDB and Socket.IO for real-time features, plus a Python FastAPI microservice (`/ai-service`) that powers RAG-based AI tutoring (document ingestion, OCR, embeddings, retrieval, LLM generation).

---

## Tech Stack

**Frontend:** React 18, Vite, TailwindCSS, React Router, Hooks + Context API, Socket.IO, Chart.js, Recharts, Three.js, Quill editor, Framer Motion, ShadCN UI components

**Backend:** Node.js, Express 5, MongoDB (Mongoose), JWT auth, bcryptjs, Socket.IO, Nodemailer, Multer, Cloudinary, Razorpay, Pino logging

**AI Service:** Python 3.11, FastAPI, LangChain (ChatOllama, RecursiveCharacterTextSplitter), Ollama (chat/summary/embedding models), Qdrant (vector store), MongoDB (motor), PyMuPDF, pytesseract/pdf2image (OCR), python-docx/python-pptx

**Testing:** Jest (both frontend and backend), Supertest for API testing, @testing-library/react, pytest (ai-service)

---

## Directory Structure

### Key Backend Paths
- **Routes:** `/backend/routes/` (47 role-based route files)
- **Models:** `/backend/models/` (57 Mongoose schemas for all entities)
- **Middleware:** `/backend/middleware/` (role-based auth, logging, rate limiting)
- **Utilities:** `/backend/utils/` (logger, mailer, payments, file uploads, notifications)
- **Tests:** `/backend/__tests__/`

### Key Frontend Paths
- **Shared components:** `/frontend/src/components/`
- **Role portals:** `/frontend/src/{admin,teachers,parents,principal,Super Admin}/`
- **Theme context:** `/frontend/src/contexts/ThemeContext.jsx`
- **Custom hooks:** `/frontend/src/hooks/` (notifications, feedback)
- **Tests:** `/frontend/src/__tests__/`
- **AI Tutor UI:** `/frontend/src/components/AITutorHomeScreen.jsx` (2300+ lines, all mode UIs live here)

### Key AI Service Paths (`/ai-service`)
- **App entry:** `app/main.py` (FastAPI app; root `main.py` re-exports it for uvicorn)
- **Settings:** `app/core/config.py` (pydantic-settings, reads `ai-service/.env`)
- **Feature modules:** `app/modules/{documents,parser,embeddings,retrieval,chat,summaries}/` — each with `router.py` / `service.py` / `schemas.py` as applicable
- **Maintenance scripts:** `scripts/` (e.g., `reingest_materials.py`)
- **Tests:** `tests/`

### Documentation
- `/docs/` - API endpoint maps for each role
- `TESTING_GUIDE.md` - Test writing standards
- `AGENTS.md` - Developer conventions
- `/ai-service/Docs/AI_Tutor_SaaS_Knowledge_Base.txt` - AI tutor vision/design doc

---

## Common Commands

### Backend (`cd backend`)
```bash
npm run dev              # Development server (auto-reload via nodemon)
npm start               # Production server
npm test                # Run all tests
npm run test:watch      # Watch mode for tests
npm test -- path/to/file.test.js  # Run single test file
npm run test:coverage   # Coverage report
npm run swagger:gen     # Generate API docs (http://localhost:5000/api/docs)
npm run security:suite  # Security testing
npm run push:keys       # Generate VAPID keys for web push notifications
```

### Frontend (`cd frontend`)
```bash
npm run dev             # Dev server (port 5173, Vite)
npm run build           # Production build (outputs to dist/)
npm run preview         # Preview production build
npm run lint            # ESLint
npm test                # Run all tests
npm run test:watch      # Watch mode for tests
npm test -- path/to/Component.test.jsx  # Run single test file
npm run test:coverage   # Coverage report
```

### AI Service (`cd ai-service`)
```bash
.venv/bin/uvicorn main:app --reload --port 8000   # Development server
.venv/bin/pytest                                   # Run all tests (mocked; no services needed)
.venv/bin/pytest tests/test_chunker.py             # Run single test file
RUN_AI_EVALS=1 .venv/bin/pytest -m eval            # Live RAG eval vs golden set (needs Ollama+Qdrant and tests/golden/golden_set.json)
.venv/bin/python scripts/reingest_materials.py     # Re-ingest all Qdrant materials after parser/chunker changes
```
Dependencies live in a local venv: `.venv/bin/pip install -r requirements.txt`. Requires Ollama running locally (chat + embedding models) and a reachable Qdrant instance.

---

## Configuration

### Backend `.env` (essential variables)
```env
MONGODB_URL=mongodb+srv://[user]:[password]@cluster.mongodb.net/
JWT_SECRET=<32-char hex key>
JWT_EXPIRES_IN=24H
PORT=5000
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
CORS_ORIGINS=http://localhost:5173,...
```

### Frontend `.env` (Vite variables prefixed with `VITE_`)
```env
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

### AI Service `.env` (defaults in `app/core/config.py`)
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b            # Tutor chat/quiz/flashcard/homework model
OLLAMA_EMBED_MODEL=nomic-embed-text # 768-dim embeddings
OLLAMA_SUMMARY_MODEL=qwen2.5:14b
QDRANT_URL=...                      # Qdrant Cloud or local
QDRANT_API_KEY=...
QDRANT_COLLECTION=teacher_documents
MONGO_URI=mongodb://localhost:27017
```

The Node backend reaches the AI service via `AI_SERVICE_URL` (defaults to `http://localhost:8000`).

Note: Never commit `.env` files; keep them locally only.

---

## Development Conventions

### Naming & Style
- **Frontend components:** PascalCase (e.g., `StudentDashboard.jsx`)
- **Frontend hooks:** camelCase with `use` prefix (e.g., `useAdminAuth.js`)
- **Backend routes:** `resourceRoute.js` or `resourceRoutes.js`
- **Backend models:** PascalCase (e.g., `StudentUser.js`)
- **Backend middleware:** Descriptive names (e.g., `authStudent.js`)
- **General:** Use `const`, arrow functions, async/await, template literals

### Git Workflow
- **Branch naming:** `feature/name`, `fix/description`, `hotfix/critical-issue`
- **Commits:** Use imperative mood ("Add feature" not "Added"), 50-char first line, reference issues

### Authentication & Authorization
The system uses **role-based JWT authentication** with role-specific middleware:
- Routes are protected by middleware: `authStudent`, `authTeacher`, `authParent`, `adminAuth`, `principalAuth`, `superAdminAuth`
- JWT tokens contain: `userId`, `role` (student|teacher|parent|admin|principal|superadmin), `schoolId`
- Every protected route has auth middleware that populates `req.userId` and `req.schoolId`

### Database Conventions
- **Collections:** Pluralized PascalCase (e.g., `StudentUsers`)
- **Fields:** camelCase (e.g., `firstName`)
- **References:** Use Mongoose ObjectId with `ref` for relationships
- **Indexes:** Add unique indexes for usernames/emails, compound indexes for frequent queries

### Logging Strategy
- Use **Pino** (structured JSON logging) via `/backend/utils/logger.js`
- Separate loggers: `securityEventLogger`, `authEventLogger`, `businessEventLogger`, `studentPortalLogger`
- Log security events (unauthorized access, failed logins); never log passwords/tokens
- All requests include correlation IDs for tracing

---

## Key Architecture Patterns

### API Route Base Paths
```
/api/admin/auth        - Admin authentication
/api/admin/users       - Admin user management
/api/admin/feedback    - Admin feedback handling
/api/student/auth      - Student authentication
/api/student           - Student-specific operations
/api/teacher/auth      - Teacher authentication
/api/teacher/dashboard - Teacher dashboard
/api/parent/auth       - Parent authentication
/api/principal/auth    - Principal authentication
/api/principal         - Principal dashboard
/api/auth              - Unified auth (cross-role)
/api/attendance        - Attendance tracking
/api/exam              - Exam management
/api/assignment        - Assignments
/api/chat              - Real-time chat
/api/notifications     - Push notifications
/api/fees              - Fee management
/api/timetable         - Timetable management
/api/lesson-plans      - Lesson planning
/api/docs              - Swagger UI documentation
```

### Request Flow
```
Request → Auth middleware (validates JWT, sets req.userId/schoolId)
        → Route handler
        → Database query via Mongoose
        → Response { success: bool, data, message }
```

Protected routes require corresponding middleware: `router.get('/path', authStudent, handler)`

### Frontend State Management
- **Auth:** JWT stored in `localStorage`, managed via custom hooks per role portal
- **Theme:** Global theme via `ThemeContext.jsx`
- **UI state:** Component-level hooks (useState, useEffect)
- **API calls:** Axios with interceptor that redirects to login on 401

### Real-time Communication (Socket.IO)
- **Server:** Listens for socket events and broadcasts to joined rooms (e.g., chat threads)
- **Client:** Emits events like `join_chat`, `send_message`; listens for `new_message` to update UI
- Both use connection URL from `process.env.VITE_API_URL`

### File Uploads
- **Local:** Multer stores files in `/backend/uploads/`
- **Cloud:** Cloudinary integration via `/backend/utils/cloudinaryUpload.js`

### Payment Processing (Razorpay)
- **Backend:** Create order with `razorpay.orders.create()`, convert amount to paise (multiply by 100)
- **Frontend:** Pass order details to Razorpay widget, handle response callback

### Error Handling
- **Backend:** Centralized error middleware + try-catch in async routes
- **Frontend:** Axios response interceptor for global error handling (401 → redirect to login)

### AI Tutor (RAG pipeline via `/ai-service`)
The Node backend proxies AI work to the FastAPI service; the Python service owns OCR, embeddings, vector search, and LLM calls, while mastery/gap/curriculum logic stays in Node.

**AI service endpoints:**
```
POST   /ingest/material              - Download, parse, chunk, embed, upsert into Qdrant
DELETE /ingest/material/{id}         - Remove a material's chunks from Qdrant
POST   /generate/tutor               - RAG tutor answer (retrieval + Ollama chat)
POST   /ocr                          - OCR an uploaded file
POST   /ocr/summarize                - OCR + summary
GET    /health                       - Service/model status
```

**Ingestion flow** (`app/modules/documents/service.py`): backend uploads teaching material to Cloudinary, then calls `/ingest/material` with the URL and metadata (`teachingMaterialRoutes.js`). The service downloads the file, picks a parser — PyMuPDF `get_text("text")` for text PDFs, Tesseract OCR for scanned PDFs (`is_text_pdf()` decides), python-docx/pptx for office files — then chunks via `chunk_text_with_offsets` (LangChain `RecursiveCharacterTextSplitter` with `add_start_index=True`), embeds via Ollama `nomic-embed-text`, and upserts to Qdrant with payload metadata (`school_id`, `class_id`, `section_id`, `subject_name`, `chapter_title`, `topic_title`, `material_id`, `start_char`).

**Retrieval flow** (`app/modules/retrieval/service.py`): tutor questions are embedded and searched in Qdrant with payload filters (school/class/section/subject, then chapter-scoped first with fallback to subject-wide + relevance threshold). Retrieved chunks are passed through `_strip_teacher_notes()` in `chat/router.py` before reaching the LLM — this sanitises old and new chunks alike without re-ingestion. An in-memory/lexical fallback in `chat/service.py` is used only when no `school_id` is present. Deleting a material in the backend also fire-and-forgets `DELETE /ingest/material/{id}` so Qdrant stays in sync.

**Teacher note stripping** (`app/modules/parser/cleaner.py`): `_strip_teacher_notes(text)` uses a line-by-line state machine. It triggers on any line matching `"Note to (the )?Teacher"` (handles plain text and Markdown headings like `## Note to the Teacher` or `**Note to the Teacher**`) and skips lines until the next recognisable section heading. Applied in `chat/router.py` on the joined context string so it works for chunks ingested before and after the fix.

**LLM generation** (`app/modules/chat/router.py`): uses LangChain `ChatOllama` via `_create_chain(mode)`. Each mode has a dedicated temperature to balance variety vs. consistency, plus a random `seed` per request to bust Ollama's KV-cache and ensure different outputs each call:

| Mode | Temperature | Token budget |
|------|-------------|--------------|
| `quiz` | 0.9 | standard |
| `flashcards` | 0.85 | extended |
| `explain` | 0.6 | standard |
| `homework_help` | 0.6 | standard |
| `summarize` | 0.4 | extended |
| `notes` | 0.3 | extended |
| `mind_map` | 0.3 | extended |

**Socratic homework help** (`app/modules/chat/service.py`): `MODE_INSTRUCTIONS["homework_help"]` enforces 7 explicit Socratic rules (never state the answer; always end with exactly one guiding question; give a clue on "I don't know"; confirm only after student states the answer). The constraint is also embedded in the system prompt as a `CRITICAL OVERRIDE` so it operates at both system and task levels.

---

## AI Tutor Frontend UI (`AITutorHomeScreen.jsx`)

All mode-specific renderers live in `/frontend/src/components/AITutorHomeScreen.jsx`. After streaming completes, `TutorResponseRenderer` dispatches to the correct component based on `msg.mode`.

### Response dispatcher
```
TutorResponseRenderer({ text, mode })
  → quiz          → QuizUI
  → flashcards    → FlashcardUI
  → mind_map      → MindMapUI
  → notes         → NotesUI
  → homework_help → HomeworkHelpUI
  → (default)     → TutorMessageContent
```

### QuizUI
- Parses `"1. Question\nA) ...\nAnswer: A"` format via `parseQuiz()`
- 5 MCQ questions with A–D options; animated progress dots (green=correct, red=wrong)
- `AnimatePresence` question transitions; "Check Answer" reveals highlighting; score screen with "Try Again"

### FlashcardUI
- Parses `"Q: ...\nA: ..."` format via `parseFlashcards()`
- 3D CSS flip card (`perspective`, `rotateY`, `backfaceVisibility`, `transformStyle: preserve-3d`)
- Keyboard nav: `←` / `→` to navigate, `Space` to flip
- "Got it! / Still learning" rating buttons appear after flip (via `AnimatePresence`)
- Known count tracker displayed in header; clickable progress dots

### MindMapUI
- Parses via `parseMindMap()`: detects `"Mind Map — Title"` header for root, 0-indent lines as branch headings, indented lines (any depth ≥1 space) as items — handles space-indented RAG output (no bullets required)
- 8-colour `BRANCH_PALETTE`; root displayed as dark rounded card at top
- Branch cards in 2-column grid with coloured title bars and scrollable item lists (max 6 items, overflow shown as `+N more…`)
- SVG cubic bezier paths connect root → each branch card, calculated via `getBoundingClientRect` + `ResizeObserver`; animated with `Motion.path` `pathLength` (staggered per branch); SVG uses CSS `width/height: 100%` + `overflow: visible` so lines never clip
- `recalc` fires 420ms after mount/branch change to let framer-motion entrance animations settle; also wired to `window resize`

### HomeworkHelpUI
- Parses via `parseHomeworkHelp()`: finds the last `?` in the response, walks back to the sentence boundary, splits into `{ content, question }`
- Main hint text fades in; guiding question springs in as a warm amber card 220ms later
- Amber gradient header bar with pulsing 💭 emoji; three bouncing dots nudge student to respond
- Bubble gets `border-amber-100 bg-amber-50/50` styling to visually distinguish from regular chat

### NotesUI
- Parses `**Heading**:` markers into sections, each rendered in a rotating 5-colour card palette with `Motion.div` staggered fade-in

---

## Testing

### Running Tests
```bash
# Backend
cd backend && npm test
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# Frontend
cd frontend && npm test
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# AI service
cd ai-service && .venv/bin/pytest
```

### Test File Locations
- Backend tests: `/backend/__tests__/` (API tests use Supertest)
- Frontend tests: `/frontend/src/**/__tests__/` (Components use Testing Library)
- AI service tests: `/ai-service/tests/` (pytest; all mocked — no live Ollama/Qdrant needed)

### Coverage Targets
- General code: 70-80%
- Critical paths (auth, payments, data): 90%+

See `TESTING_GUIDE.md` for detailed patterns and examples.

---

## API Response Format

All API responses follow this structure:
```json
{
  "success": true|false,
  "data": { ... },
  "message": "Optional string"
}
```

**Common headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Swagger docs:** `http://localhost:5000/api/docs` (auto-generated from code annotations)

---

## Additional Resources

- **API Maps:** `/docs/` (student, teacher, admin, super-admin endpoint documentation)
- **Testing Guides:** `TESTING_GUIDE.md`, `TEACHER_PORTAL_TESTING_GUIDE.md`, `MANUAL_TESTING_COMMANDS.md`
- **Developer Conventions:** `AGENTS.md`

---

**Last Updated:** 2026-07-09
