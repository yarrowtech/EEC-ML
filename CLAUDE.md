# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Repository Layout](#repository-layout)
4. [Common Commands](#common-commands)
5. [Configuration](#configuration)
6. [Key Architecture Patterns](#key-architecture-patterns)
7. [AI Service (`/ai-service`)](#ai-service-ai-service)
8. [AI Tutor Frontend UI](#ai-tutor-frontend-ui-aitutorhomescreenjsx)
9. [Testing](#testing)
10. [API Response Format](#api-response-format)

---

## Project Overview

**Project Name:** EEC (Electronic Educare)

**Purpose:** Multi-role, multi-tenant educational management SaaS supporting students, parents, teachers, staff, administrators, principals, and super administrators.

**Core modules:** Academic management, attendance, exams/assignments/rubrics, timetable & lesson planning, financial management (pluggable payment gateways), real-time chat, push notifications, spaced-repetition practice, mastery/gap analytics, and a RAG-based AI tutor with speech, vision, and assessment features.

**Type:** Full-stack **React (Vite)** frontend + **Node.js/Express 5 + MongoDB (Mongoose)** backend with **Socket.IO** (Redis-backed) for real-time, plus a **Python FastAPI microservice** (`/ai-service`) that owns all AI work — document ingestion, OCR, vision, embeddings, vector retrieval, LLM generation, speech transcription/pronunciation, and answer evaluation.

**Multi-tenancy:** Each school is an `Organization` served on its own subdomain (`<slug>.<ROOT_DOMAIN>`). Tenant isolation is enforced at the Mongoose layer, not per-query — see [Multi-tenancy](#multi-tenancy-organizations).

---

## Tech Stack

**Frontend:** React 18, Vite 6, TailwindCSS **v4** (`@tailwindcss/vite`, no `tailwind.config` — theme in CSS), React Router **v7**, Hooks + Context API, `socket.io-client`, Chart.js + Recharts, Three.js, **mermaid** (diagram rendering), **Jodit** + Quill rich-text editors, jsPDF + html2canvas (PDF export), Framer Motion, Radix UI + `class-variance-authority` (shadcn-style components), Phosphor + Lucide icons, `react-hot-toast` + SweetAlert2.

**Backend:** Node.js, Express 5, MongoDB (Mongoose 8), JWT auth, bcryptjs, Socket.IO 4 + `@socket.io/redis-adapter`, Redis (`redis` v6 — adapter, rate limiting, caching), Helmet, `express-mongo-sanitize`, `express-rate-limit`, `isomorphic-dompurify`, Nodemailer, Multer, Cloudinary, `web-push`, `node-cron`, Pino logging, `swagger-autogen`, `xlsx`.

**AI Service:** **Python 3.14**, FastAPI, LangChain (`langchain-ollama`, `langchain-openai`, `RecursiveCharacterTextSplitter`), Ollama (chat / summary / embedding / vision / diagram / assessment models), **OpenRouter** (fallback LLM), Qdrant (vector store, `qdrant-client`), MongoDB (`motor`), PyMuPDF, `pytesseract`/`pdf2image` (OCR), `faster-whisper` (`large-v3-turbo` transcription), `torchaudio` + wav2vec2 (pronunciation scoring), python-docx/python-pptx.

**Testing:** Jest 30 (frontend + backend), Supertest (API), `@testing-library/react`, `pytest` (ai-service, fully mocked).

---

## Repository Layout

Top-level dirs that matter: `backend/`, `frontend/`, `ai-service/`, `docs/`. Everything else in the repo root (`*.md`, `*.xlsx`, `*.csv`, `Ref/`, `scripts/`) is research/planning material and **not** application code. The root `package.json` only pulls in `opencode-ai` and is not part of any app.

### Backend (`/backend`)
- **`index.js`** — app bootstrap: production-config guard → Pino → Redis connect → middleware chain → `routes/index.js` → Socket.IO. The Razorpay/webhook route is mounted here *before* `express.json()` so it receives the raw body.
- **`routes/`** (73 files) + **`routes/index.js`** — the single route registry; `registerRoutes(app, { ...limiters, adminActionLogger, requireOrganizationDomain })` mounts every `/api/*` path grouped by domain, attaching the right rate limiter and the org-domain guard per group.
- **`models/`** (95 Mongoose schemas). All get `organizationId` + tenant scoping via the global plugin unless `schema.options.skipTenantScope` is set.
- **`middleware/`** — role auth (`authStudent`, `authTeacher`, `authParent`, `authStaff`, `adminAuth`, `principalAuth`, `superAdminAuth`, `authAnyUser`, `internalAuth`), `authFactory` (builds role middleware), `tenantResolver`, `validateTokenTenant`, `paymentGatewayResolver`, `rateLimit`, `requestLogger`, `tokenReplayTelemetry`, `adminActionLogger`, `portalActionLogger`.
- **`services/`** — cross-cutting engines: `masteryEngine` / `masteryRouter`, `gapDetectionEngine`, `recommendationEngine`, `engagementScorer`, `mlEngine`, `developmentProfileService`, `errorClassifier`, `feeService`, `paymentLifecycleService`, `organizationProvisioningService`.
- **`controllers/`** — only where logic is large (`paymentWebhookController`, `paymentSettingsController`, `wellbeingController`); most routes keep handlers inline.
- **`plugins/tenantPlugin.js`**, **`utils/registerTenantPlugin.js`** — global Mongoose tenant enforcement (required at the very top of `index.js`).
- **`utils/tenantContext.js`** — `AsyncLocalStorage`-based tenant context (`runWithTenant`, `getTenantContext`).
- **`config/`** — `database.js`, `socketServer.js`, `workflowThresholds.js`.
- **`schedulers/spacedRepetitionCron.js`**, **`errors/AppError.js`**, **`__tests__/`**, **`uploads/`**, **`logs/`**, **`docs/`** (Swagger output).

### Frontend (`/frontend/src`)
- **Role portals:** `admin/`, `teachers/`, `parents/`, `principal/`, `Super Admin/` (note the space), plus `pages/`, `404/`, `games/`, `tryout/` (experiments).
- **`components/`** — shared UI; **`components/tutor/`** holds extracted AI-tutor pieces (`MermaidBlock`, `TutorMessageContent`, `QuizUI`, `FlashcardUI`, `MindMapUI`, `NotesUI`, `HomeworkHelpUI`, `TutorGeneratedVisuals`, `TutorVisualSources`, `TutorAnswerActions`).
- **`components/AITutorHomeScreen.jsx`** — 5700+ lines; still contains its own copies of the mode renderers and `TutorResponseRenderer` dispatcher (see [AI Tutor Frontend UI](#ai-tutor-frontend-ui-aitutorhomescreenjsx)).
- **`context/TenantContext.jsx`** (subdomain → organization) and **`contexts/ThemeContext.jsx`** (theme) — two directories, do not confuse them.
- **`hooks/`**, **`lib/`**, **`utils/`**, **`config/`**, **`__tests__/`**.

### AI Service (`/ai-service`) — see [dedicated section](#ai-service-ai-service)

### Docs
- `/docs/` — per-role API endpoint maps.
- `AGENTS.md` — developer conventions (some parts aspirational; trust the code where it differs).
- `TESTING_GUIDE.md`, `TEACHER_PORTAL_TESTING_GUIDE.md`, `MANUAL_TESTING_COMMANDS.md`.
- `ai-service/Docs/AI_Tutor_SaaS_Knowledge_Base.txt` — AI tutor vision/design doc.

---

## Common Commands

### Backend (`cd backend`)
```bash
npm run dev                       # nodemon dev server (default port 5000)
npm start                         # production server
npm test                          # Jest (testEnvironment: node, 10s timeout)
npm test -- path/to/file.test.js  # single test file
npm run test:watch                # watch mode
npm run test:coverage             # coverage report
npm run swagger:gen               # regenerate swagger-output.json  → /api/docs
npm run security:suite            # productionSecurityAttackSuite.js
npm run push:keys                 # generate VAPID keys for web push

# Data migrations (dry-run first, then :apply to write)
npm run tenant:migrate            # backfill Organization docs from schools
npm run payments:migrate          # migrate to pluggable payment gateways
npm run payments:migrate-modes    # payment gateway test/live modes
npm run assignments:migrate-sessions  # backfill assignment academic years
```

### Frontend (`cd frontend`)
```bash
npm run dev                       # Vite dev server (port 5173, HTTPS via basic-ssl)
npm run build                     # production build → dist/
npm run preview                   # preview production build
npm run lint                      # ESLint (flat config, eslint.config.js)
npm test                          # Jest (jsdom, babel-jest, "@/" → src/)
npm test -- path/to/Component.test.jsx
npm run test:coverage
```

### AI Service (`cd ai-service`)
```bash
.venv/bin/uvicorn main:app --reload --port 8000   # dev server (main.py re-exports app.main:app)
.venv/bin/pytest                                   # all tests (fully mocked — no Ollama/Qdrant needed)
.venv/bin/pytest tests/test_chunker.py             # single test file
RUN_AI_EVALS=1 .venv/bin/pytest -m eval            # live RAG eval vs tests/golden/golden_set.json (needs Ollama + Qdrant)
.venv/bin/python scripts/reingest_materials.py     # re-ingest all Qdrant materials after parser/chunker changes
```
Deps live in a local venv: `.venv/bin/pip install -r requirements.txt` (Python 3.14). Running the service (not the tests) requires Ollama (chat + embed + vision models pulled) and a reachable Qdrant. `hf_xet` is force-disabled (`HF_HUB_DISABLE_XET=1`) because its wheel is incompatible with 3.14.

---

## Configuration

Never commit `.env` files. `.env.example` exists for `backend/` and `ai-service/`.

### Backend `.env` (essentials)
```env
MONGODB_URL=mongodb+srv://...
JWT_SECRET=<>=32 chars; must be a real secret in production>
JWT_EXPIRES_IN=24H
PORT=5000
NODE_ENV=development
ROOT_DOMAIN=electroniceducare.com   # tenant subdomains resolve against this
CORS_ORIGINS=http://localhost:5173,...
CORS_ALLOW_LAN=true                 # dev-only: allow 10.x/192.168.x/172.16-31 origins
REDIS_URL=redis://localhost:6379
PAYMENT_ENCRYPTION_KEY=<required in production; encrypts stored gateway keys>
CLOUDINARY_CLOUD_NAME=... / CLOUDINARY_API_KEY=... / CLOUDINARY_API_SECRET=...
RAZORPAY_KEY_ID=rzp_test_... / RAZORPAY_KEY_SECRET=...   # default gateway; others stored per-org
AI_SERVICE_URL=http://localhost:8000
```
`index.js` hard-fails on boot in `NODE_ENV=production` if `JWT_SECRET` is weak/placeholder or `PAYMENT_ENCRYPTION_KEY` is unset.

### Frontend `.env` (Vite — `VITE_` prefix)
```env
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

### AI Service `.env` (defaults in `app/core/config.py`)
Model IDs drift — **read `ai-service/.env` for the actual runtime models**; the `.env` has historically carried duplicate keys (last one wins). Config surface:
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b                 # tutor chat / quiz / flashcards / homework
OLLAMA_EMBED_MODEL=nomic-embed-text      # 768-dim
OLLAMA_SUMMARY_MODEL=qwen2.5:14b
OLLAMA_CLEAN_MODEL / OLLAMA_QUERY_REWRITE_MODEL=llama3.2:3b
OLLAMA_DIAGRAM_MODEL=qwen2.5-coder:7b    # renders mermaid; planner: OLLAMA_DIAGRAM_PLANNER_MODEL
OLLAMA_VISION_MODEL=qwen2.5vl:7b         # reads labels/formulas/layout in teacher PDFs
OLLAMA_ASSESS_MODEL=qwen3:8b             # reading/writing evaluation
WHISPER_MODEL_SIZE=large-v3-turbo / WHISPER_DEVICE=cuda / WHISPER_COMPUTE_TYPE=float16
QDRANT_URL=... / QDRANT_API_KEY=... / QDRANT_COLLECTION=teacher_documents
QDRANT_LANGUAGE_COLLECTION=student_language_memory
MONGO_URI=mongodb://localhost:27017 / MONGO_DATABASE=eec_ai
OPENROUTER_API_KEY=... / OPENROUTER_MODEL=google/gemini-flash-1.5
```

---

## Key Architecture Patterns

### Multi-tenancy (Organizations)
- **Every request:** `tenantResolver` middleware derives the tenant. On a tenant subdomain it resolves the `Organization` by slug; on the main/API host it reads the org from the authenticated token scope. It then wraps the request in `runWithTenant(org, next)`.
- **Every DB query:** `plugins/tenantPlugin.js` (registered globally via `utils/registerTenantPlugin` — the first `require` in `index.js`) adds `organizationId` to every schema, auto-filters all reads, stamps it on all writes via `$setOnInsert`, and throws `TENANT_SCOPE_VIOLATION` (403) if code tries to change or cross it. The tenant comes from `AsyncLocalStorage` (`utils/tenantContext.js`), so handlers never pass `organizationId` manually.
- **Opt out** with `schema.options.skipTenantScope = true` (global collections: `Organization`, super-admin data, etc.).
- **`requireOrganizationDomain`** guards portal routes so they only work on a real tenant subdomain.
- `services/organizationProvisioningService.js` + `npm run tenant:migrate` backfill orgs from legacy `schoolId`-only data. JWTs still carry `schoolId`; `organizationId` is the authority.

### Route registry & rate limiting
`routes/index.js` is the map of the whole API. Handlers are mounted with a named limiter: `generalApiLimiter`, `authApiLimiter`, `aiApiLimiter`, `uploadApiLimiter`, `writeHeavyApiLimiter` (all Redis-backed via `middleware/rateLimit.js`). To add an endpoint, add the route file and one `app.use(...)` line in the right domain group.

### Authentication & Authorization
Role-based JWT. Tokens contain `userId`, `role` (`student|teacher|parent|staff|admin|principal|superadmin`), `schoolId`, and org scope. Role middleware (`authStudent`, `adminAuth`, …) populates `req.userId` / `req.schoolId`; `validateTokenTenant` / `tokenReplayTelemetry` add tenant-binding and replay checks. Frontend stores the JWT in `localStorage` per portal; an Axios response interceptor redirects to login on 401.

### Real-time (Socket.IO)
`config/socketServer.js` sets up the server with the **Redis adapter** so multiple backend instances share rooms. Clients emit `join_chat` / `send_message` and listen for `new_message`; connection URL is `VITE_API_URL`.

### Payments (pluggable gateways)
Razorpay is the built-in default, but each organization can configure its own gateway + mode (test/live) via `/api/settings/payment`. Stored gateway credentials are encrypted with `PAYMENT_ENCRYPTION_KEY`. `middleware/paymentGatewayResolver.js` picks the active gateway per request; `controllers/paymentWebhookController.js` (raw-body route, mounted before `express.json()`) verifies webhook signatures; `services/paymentLifecycleService.js` owns order/payment state. Amounts are in paise (×100).

### Frontend state
Auth via per-portal custom hooks over `localStorage`; theme via `contexts/ThemeContext.jsx`; tenant via `context/TenantContext.jsx`; everything else is component-level `useState`/`useEffect`. API calls go through Axios with the 401 interceptor.

### File uploads
Multer → `backend/uploads/` for local; `utils/cloudinaryUpload.js` for cloud. Teaching materials are uploaded to Cloudinary, then their URL is handed to the AI service for ingestion.

### Error handling
Backend: `errors/AppError.js` + centralized error middleware + try/catch in async handlers. Frontend: global Axios interceptor.

---

## AI Service (`/ai-service`)

The Node backend proxies **all** AI work to this FastAPI service. Mastery / gap / curriculum / recommendation logic stays in Node (`backend/services/`); OCR, vision, embeddings, vector search, LLM calls, speech, and evaluation live here.

### Layout
- **`main.py`** — one line: `from app.main import app` (uvicorn target).
- **`app/main.py`** — `FastAPI(title="EEC AI Service", version="2.0.0")`; a `lifespan` hook warms Whisper + wav2vec2 into GPU memory at startup; includes all module routers.
- **`app/core/`** — `config.py` (pydantic-settings), `llm.py`, `logger.py`, `mongodb.py`, `qdrant.py`.
- **`app/modules/`** — one dir per feature, each with `router.py` / `service.py` / `schemas.py` as applicable:
  | Module | Purpose |
  |---|---|
  | `orchestrator` | **single unified entry point** — `POST /orchestrate` |
  | `documents` | ingest / delete teaching material (`POST /ingest/material`, `POST /ingest/material-page`, `DELETE /ingest/material/{id}`) |
  | `parser` | `pdf`, `ocr`, `office`, `chunker`, `cleaner` (teacher-note stripping) |
  | `embeddings` | Ollama `nomic-embed-text` |
  | `retrieval` | Qdrant search with payload filters (`repository`, `service`) |
  | `chat` | RAG tutor generation, all modes (`POST /generate/tutor`, `/generate/teacher`, `/generate/learning-path`, `/generate/summarize-session`) |
  | `summaries` | `POST /ocr`, `POST /ocr/summarize` |
  | `speech` | `POST /speech/transcribe` (faster-whisper), `POST /speech/pronunciation` (wav2vec2) |
  | `vision` | `POST /vision/explain-image` + PDF-page vision during ingestion (`client.py`) |
  | `assessment` | `POST /reading/evaluate`, `POST /writing/evaluate` (no prefix) |
  | `evaluator` | `POST /evaluate/answer` — MCQ / written answer scoring |
  | `language_memory` | `POST /memory/store` + `POST /memory/retrieve` (Qdrant `student_language_memory`) |
  | `classifier` | `bloom.py`, `outcomes.py`, `topic.py` (no router — imported by other modules) |
  | `stem` | `service.py` + `verifier.py` — math answer verification (no router) |
  | `quiz`, `flashcards` | mode-specific helpers (no router) |
  | `admin` | `POST /generate/admin-insights` |
- **`app/workers/`** — background job workers.
- **`prompts/`** — file-based prompt library (`loader.py`), grouped by feature (`chat/`, `evaluation/`, `flashcards/`, `mindmap/`, `question_generation/`, `recommendation/`, `summary/`). A matching file here **overrides** the hardcoded `MODE_INSTRUCTIONS` in `chat/service.py`.
- **`scripts/`** — maintenance (`reingest_materials.py`, …). **`tests/`** — pytest, all mocked; `tests/golden/` for live evals.

### The Orchestrator
`POST /orchestrate` with `{ task_type, payload }` is how Node calls the service. `orchestrator/service.py::dispatch()` routes to the right module and returns the underlying endpoint's response shape unchanged. `task_type` ∈ `generate` (RAG tutor, all modes), `generate_questions` (teacher question gen with difficulty), `evaluate` (MCQ/written), `summarize_session` (rolling memory), `class_performance` (AI narrative report). Other endpoints (ingest, OCR, speech, vision) are still called directly.

### Ingestion flow (`documents/service.py`)
Download from Cloudinary → pick a parser (`is_text_pdf()` decides PyMuPDF text vs Tesseract OCR; vision model reads diagram-heavy pages up to `OLLAMA_VISION_MAX_PAGES`; python-docx/pptx for office) → `chunk_text_with_offsets` (LangChain `RecursiveCharacterTextSplitter`, `add_start_index=True`) → embed via `nomic-embed-text` → upsert to Qdrant with payload (`school_id`, `class_id`, `section_id`, `subject_name`, `chapter_title`, `topic_title`, `material_id`, `start_char`). Deleting a material in Node fire-and-forgets `DELETE /ingest/material/{id}`.

### Retrieval flow (`retrieval/service.py`)
Embed the question → Qdrant search with payload filters (school/class/section/subject; chapter-scoped first, fallback to subject-wide + relevance threshold). Retrieved chunks pass through `_strip_teacher_notes()` and `_strip_injection_attempts()` in `chat/service.py` before reaching the LLM (sanitises old and new chunks without re-ingestion). A lexical fallback in `chat/service.py` is used only when no `school_id` is present.

### Teacher-note stripping (`parser/cleaner.py`)
`_strip_teacher_notes(text)` is a line-by-line state machine: triggers on any line matching `Note to (the )?Teacher` (plain text or Markdown headings like `## Note to the Teacher` / `**Note to the Teacher**`), skips until the next recognisable section heading. Applied to the joined context string in `chat/service.py` so it covers chunks ingested before and after the fix.

### LLM generation (`app/core/llm.py`)
`create_chain(mode, temperature=None, model=None)` builds a LangChain `ChatOllama` chain. Each mode has a dedicated temperature from `MODE_TEMPERATURE` (fallback `DEFAULT_TEMPERATURE = 0.7`) plus a random per-request `seed` to bust Ollama's KV-cache and vary outputs. `LONG_OUTPUT_MODES` get the extended token budget.

| Mode | Temperature | Token budget |
|------|-------------|--------------|
| `quiz` | 0.9 | standard |
| `flashcards` | 0.85 | extended |
| `explain` | 0.6 | standard |
| `homework_help` | 0.6 | standard |
| `summarize` | 0.4 | extended |
| `notes` | 0.3 | extended |
| `mind_map` | 0.3 | extended |

Extended budget = `OLLAMA_NUM_PREDICT_EXTENDED` (3000) vs standard `OLLAMA_NUM_PREDICT` (1500).

### Socratic homework help (`chat/service.py`)
`MODE_INSTRUCTIONS["homework_help"]` enforces 7 explicit Socratic rules (never state the answer; always end with exactly one guiding question; give a clue on "I don't know"; confirm only after the student states the answer). Also embedded in the system prompt as a `CRITICAL OVERRIDE` so it binds at both system and task level.

---

## AI Tutor Frontend UI (`AITutorHomeScreen.jsx`)

After streaming completes, `TutorResponseRenderer({ text, mode })` dispatches to the mode component. The renderers exist both inline in `AITutorHomeScreen.jsx` and as standalone files under `components/tutor/` — when editing, check which one the screen actually imports.

```
TutorResponseRenderer({ text, mode })
  → quiz          → QuizUI
  → flashcards    → FlashcardUI
  → mind_map      → MindMapUI
  → notes         → NotesUI
  → homework_help → HomeworkHelpUI
  → (default)     → TutorMessageContent   (markdown + ```mermaid``` fenced blocks via MermaidBlock)
```

- **QuizUI** — parses `"1. Q\nA) ...\nAnswer: A"` via `parseQuiz()`; 5 MCQs, A–D, animated progress dots (green/red), `AnimatePresence` transitions, score screen with retry.
- **FlashcardUI** — parses `"Q: ...\nA: ..."` via `parseFlashcards()`; 3D CSS flip card; keyboard nav (`←`/`→`, `Space` to flip); "Got it / Still learning" rating; known-count tracker.
- **MindMapUI** — `parseMindMap()` detects `"Mind Map — Title"` header, 0-indent lines as branches, indented lines as items (handles space-indented RAG output, no bullets needed); 8-colour `BRANCH_PALETTE`; 2-column branch cards; SVG cubic-bezier root→branch connectors via `getBoundingClientRect` + `ResizeObserver`, animated `Motion.path` `pathLength`; `recalc` fires ~420ms after mount and on window resize.
- **HomeworkHelpUI** — `parseHomeworkHelp()` finds the last `?`, walks back to the sentence boundary, splits into `{ content, question }`; hint fades in, guiding question springs in as an amber card ~220ms later; pulsing 💭 header, bouncing dots.
- **NotesUI** — parses `**Heading**:` markers into sections, each in a rotating 5-colour card with staggered `Motion.div` fade-in.
- **MermaidBlock** — renders ```mermaid``` fences natively; `TutorGeneratedVisuals` / `TutorVisualSources` show AI-generated diagrams and their source chunks.

---

## Testing

```bash
cd backend    && npm test                 # Jest, testEnvironment: node
cd frontend   && npm test                 # Jest, jsdom, "@/" alias, CSS→identity-obj-proxy, images→fileMock
cd ai-service && .venv/bin/pytest          # pytest, all mocked
```

- **Backend tests:** `/backend/__tests__/` — API tests use Supertest; 10s default timeout.
- **Frontend tests:** `/frontend/src/**/__tests__/` and `components/tutor/__tests__/` — Testing Library, assert user-visible behavior.
- **AI service tests:** `/ai-service/tests/` — no live Ollama/Qdrant; `RUN_AI_EVALS=1 pytest -m eval` runs the golden-set RAG eval against real services.
- **Coverage targets:** general 70–80%; auth / payments / tenant isolation / data 90%+.
- Follow Arrange-Act-Assert; see `TESTING_GUIDE.md`.

---

## API Response Format

```json
{ "success": true, "data": { }, "message": "optional" }
```
Headers: `Authorization: Bearer <JWT>`, `Content-Type: application/json`. Swagger UI at `http://localhost:5000/api/docs` (run `npm run swagger:gen` after changing annotated routes).

---

## Development Conventions

- **Frontend:** components PascalCase (`StudentDashboard.jsx`), hooks camelCase `use*`. ESLint flat config; no unused vars except `UPPER_SNAKE_CASE` constants.
- **Backend:** CommonJS, 2-space indent, `const` + arrow + async/await, filenames mirror exports (`attendanceRoutes.js`). Route logging goes through `utils/logger.js` (Pino) — never `console` directly (it's bound to the logger anyway). Separate loggers: `securityEventLogger`, `authEventLogger`, `businessEventLogger`, `studentPortalLogger`. Never log passwords/tokens.
- **DB:** collections pluralized PascalCase, fields camelCase, ObjectId refs with `ref`, unique indexes on usernames/emails, compound indexes for hot queries. Do **not** add `organizationId` filters by hand — the plugin does it.
- **Git:** branches `feature/…`, `fix/…`, `hotfix/…`; commits in imperative mood, short subject, mention the touched surface; call out new `.env` keys in PRs.

---

**Last Updated:** 2026-09-01
