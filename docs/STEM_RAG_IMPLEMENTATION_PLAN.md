# STEM-Aware RAG Implementation Plan

## Objective

Extend the existing FastAPI, Qdrant, Ollama/OpenRouter, Express, MongoDB, and React stack so STEM answers remain grounded in teacher-published material while preserving formulas, units, curriculum scope, and source citations.

## Delivery checklist

- [x] 1. Document the current pipeline, implementation order, and acceptance criteria.
- [x] 2. Add STEM metadata to ingestion and Qdrant payloads.
- [x] 3. Preserve and extract formulas, scientific units, and concept terms during ingestion.
- [x] 4. Enrich document embeddings without changing the source text shown to the model.
- [x] 5. Add hybrid semantic and exact-token retrieval for equations and scientific notation.
- [x] 6. Add discipline-specific tutor instructions for mathematics, physics, chemistry, biology, engineering, and technology.
- [x] 7. Add deterministic arithmetic/algebra verification using a restricted SymPy adapter.
- [x] 8. Render common inline and block STEM notation safely in tutor responses.
- [x] 9. Add ingestion, retrieval, prompt, verification, and rendering tests.
- [ ] 10. Re-ingest existing published materials and run a teacher-approved STEM evaluation set. Re-ingestion is complete; teacher review remains.

## Implementation record — 2026-08-11

- Added tenant/curriculum/STEM metadata across Express ingestion, FastAPI schemas, and Qdrant payloads.
- Added deterministic discipline detection plus formula, unit, and concept extraction.
- Added enriched embedding input while keeping stored citation chunks unchanged.
- Added hybrid dense/exact-token reranking with a bounded relevance rescue floor.
- Added mathematics, physics, chemistry, biology, engineering, and technology response rules.
- Added restricted numeric and single-variable algebra verification; homework-help mode never receives verifier answers.
- Consolidated tutor message rendering and added safe responsive inline/block notation containers.
- Passed 71 focused AI-service tests, 2 frontend notation tests, backend syntax checks, Python compilation, and the Vite production build.
- Re-ingested 19 recoverable Qdrant attachment sources: 19 succeeded and 0 failed.
- Remaining external step: a subject teacher must supply/approve real STEM golden questions and expected evidence for the live evaluation.

## Existing pipeline

1. Express publishes a teaching-material attachment.
2. FastAPI downloads and extracts text from PDF, DOCX, or PPTX files.
3. Extracted text is split into overlapping chunks.
4. `nomic-embed-text` generates document vectors.
5. Qdrant stores vectors plus school/class/section/subject/chapter metadata.
6. A student query retrieves chapter content or subject-similar chunks.
7. Ollama or OpenRouter generates an answer restricted to the retrieved material.

## Implementation stages

### Stage 1 — Metadata and source preservation

Add optional fields without breaking existing ingestion callers:

- `academic_year_id`
- `subject_id`
- `discipline`
- `curriculum_code`
- `concepts`
- `formulas`
- `units`

The original extracted chunk remains the authoritative citation text. Search enrichment is used only to create the embedding vector.

Acceptance criteria:

- Existing non-STEM documents still ingest successfully.
- Every new Qdrant point remains school scoped.
- Available subject, curriculum, formula, unit, and concept metadata is searchable and returned with citations.

### Stage 2 — STEM-aware extraction and embeddings

- Normalize Unicode math symbols without converting them to unrelated ASCII text.
- Detect equation-like lines, chemical formula tokens, scientific units, and high-signal concept terms.
- Prepend a compact metadata/search header only to text sent to the embedding model.
- Keep the stored `chunk_text` unchanged for grounded generation and citations.

Acceptance criteria:

- Expressions such as `F = ma`, `x²`, `H₂O`, `m/s²`, and `3.0 × 10⁸` survive ingestion.
- Embedding input contains useful subject and STEM signals.
- Retrieved context contains the untouched source chunk.

### Stage 3 — Hybrid retrieval

- Retrieve a wider dense candidate set from Qdrant.
- Combine vector similarity with exact overlap for formulas, symbols, units, topic terms, and concept metadata.
- Keep the configured relevance threshold as a minimum semantic safety boundary, with a narrowly bounded exact-token rescue path.
- Continue enforcing school, class, section, subject, and chapter filters.

Acceptance criteria:

- Formula queries prefer chunks containing the same formula or symbols.
- Unit-bearing queries prefer chunks containing compatible unit tokens.
- Cross-school content remains inaccessible.

### Stage 4 — STEM prompting and verification

- Mathematics: preserve notation, show grade-appropriate steps, and distinguish exact from approximate results.
- Physics: define variables, carry units through steps, and perform dimensional checks.
- Chemistry: preserve element capitalization, subscripts, charges, and equation balance.
- Biology: distinguish structures, processes, evidence, and causal claims.
- Engineering/technology: state assumptions, constraints, inputs, outputs, and safety considerations.
- Use a restricted SymPy adapter only for explicit arithmetic/algebra expressions; never execute arbitrary code.
- Treat tool output as verification context, not as permission to answer unsupported curriculum questions.

Acceptance criteria:

- Numeric results are checked independently when a safe expression can be extracted.
- Homework-help mode remains Socratic and does not reveal answers.
- Unsupported calculations are left to the grounded model with a clear uncertainty instruction.

### Stage 5 — Frontend rendering

- Render common `$...$` and `$$...$$` notation as readable STEM blocks.
- Preserve safe plain-text fallback when notation cannot be parsed.
- Do not render arbitrary HTML from model output.

Acceptance criteria:

- Formulas wrap on mobile without overflowing the message container.
- URLs, bold text, lists, and quiz formatting continue to work.

### Stage 6 — Evaluation and rollout

Build a teacher-reviewed evaluation set covering:

- Direct factual retrieval
- Equation and unit retrieval
- Multi-step numerical reasoning
- Diagram-dependent questions
- Insufficient-source refusal
- Wrong-subject and cross-school isolation
- Citation correctness
- Mobile formula rendering

Run retrieval metrics (Recall@K and source accuracy) separately from answer metrics (groundedness, numerical correctness, unit correctness, and pedagogical quality).

## Deferred multimodal stage

The existing text pipeline cannot reliably interpret graphs, circuit diagrams, geometry figures, handwritten equations, or chemical structures. A later stage should add page-image extraction and a vision-capable model, while retaining the same tenant metadata, citations, and teacher-published-material boundary.

Vision implementation and the bounded mathematics pilot are recorded in
`docs/STEM_RAG_RESUME_CHECKPOINT.md`. The local `qwen3.5:9b-q8_0` model now extracts
selected PDF pages into page-linked Qdrant visual chunks, and the student tutor displays
retrieved source pages as authenticated teacher-material PNG evidence. The preview route
rechecks the student's school, class, and section before resolving the source in Qdrant.

## Operational rollout

1. Deploy schema and optional metadata changes.
2. Run unit tests and the STEM evaluation set.
3. Re-ingest published materials with `ai-service/scripts/reingest_materials.py`.
4. Compare retrieval results before and after re-ingestion.
5. Enable STEM verification for a pilot class.
6. Review failures with subject teachers before wider rollout.
