# STEM RAG Resume Checkpoint

**Saved:** 2026-08-11  
**Status:** Text-based STEM RAG and the bounded PDF-vision vertical slice are complete.

## Completed

- STEM discipline, formula, scientific-unit, and concept extraction.
- Enriched document embeddings while preserving original source chunks.
- Qdrant metadata for school, class, section, academic year, subject, curriculum, formulas, units, and concepts.
- Hybrid semantic and exact-notation retrieval.
- Mathematics, physics, chemistry, biology, engineering, and technology tutor rules.
- Restricted arithmetic and single-variable algebra verification using SymPy.
- Safe responsive inline and block STEM notation rendering.
- Existing Qdrant materials re-ingested: **19 succeeded, 0 failed**.
- Focused validation: **71 AI-service tests and 2 frontend tests passed**.
- Frontend production build and backend/Python syntax checks passed.

## Vision model checkpoint

The local Ollama model is downloaded and verified in `ollama list`:

```text
qwen3.5:9b-q8_0    441ec31e4d2a    10 GB
```

The model is installed. An isolated structured extraction client and smoke-test CLI now
exist. Vision remains **disconnected from automatic ingestion** while page selection,
rendering limits, metadata, and retrieval integration are developed.

## Vision Step 1 result (2026-08-12)

The controlled single-image smoke test passed with `qwen3.5:9b-q8_0`. The page contained
Ohm's law text, `V = I x R`, amperes/ohms/volts, and a labelled series circuit. The model
returned all required structured fields, correctly transcribed the formula and example,
captured the resistor and battery labels, described the visible circuit, and returned an
empty uncertainty list.

The first runs exposed two local-model deviations that are now covered by tests: fenced
JSON and object/list variations for label and description fields. The client normalizes
those narrow variations into a strict `VisualExtraction` application model.

## Vision vertical-slice result (2026-08-12)

PDF ingestion now detects visually significant pages, renders one bounded page at a time,
extracts structured evidence with `qwen3.5:9b-q8_0`, and stores visual chunks in Qdrant with
the original material/source URL, page number, tenant, class, section, academic year,
subject, curriculum, and chapter metadata. Retrieval ranks relevant visual pages alongside
text while preserving all isolation filters. The student AI Tutor receives those citations
and displays an expandable, authenticated PNG rendering of the cited PDF page labelled
as teacher material. The browser never fetches an arbitrary citation URL for previews;
the backend resolves the material again inside the student's school/class/section scope.

The live `eemm101.pdf` pilot selected and indexed six pages: **1, 7, 8, 10, 11, and 12**.
These include the number-line comparison, rounding activity, travel-distance data, and
pebble diagram. A live rounding query retrieved four visual contexts and ranked pages 7
and 8 first. The original 34 text chunks remained available.

The protected page-rendering path was live-tested against page 8: it returned a 205,910-byte
`image/png`, and the number-line diagrams and rounding table were visually confirmed.
Page images are loaded lazily only after a student expands a citation. Current focused
validation passes **92 AI-service tests and 5 frontend tests**, plus backend syntax checking
and the Vite production build.

Tutor prompting now has explicit page-linked visual pedagogy. Explain mode uses a
`Look → Notice → Connect` walkthrough, quiz mode creates a newly authored observation
question labelled with the cited page, and homework-help mode remains Socratic. Visual
retrieval keeps only the strongest matching page and a bounded nearby text window for the
local 16K-context tutor. A guarded rewrite removes calculated answers or completed blanks
when the cited visual is itself a student workbook exercise.

The Student AI Tutor action bar now exposes first-class **Custom Chat**, **Visual Explain**,
and **Visual Quiz** inputs. Custom Chat is the default composer mode rather than silently
forcing every typed question through `Explain Like I'm 10`. The two visual modes are
accepted by Express and FastAPI, use page-aware prompting, render through the existing
explanation/quiz interfaces, and retain authenticated visual-page citations.

Visual Explain can now return safe, structured code-rendered teaching visuals in addition
to prose and cited PDF pages. The first renderer covers **Angles as Turns** as responsive,
accessible SVG cards with rays, curved direction arrows, degree labels, and angle names.
The visual facts are derived deterministically from retrieved chapter evidence and are also
fed back into the tutor prompt so the prose cannot contradict the diagram. This allows older
text-indexed chapters such as Mathematics Chapter 003 to show a real visual even when their
existing Qdrant records do not yet contain vision-page chunks.

Visual Explain is now student-customizable. The composer exposes **Simple**, **Detailed**,
and **Deep lesson** depth plus **Understand**, **Exam revision**, and **Guided practice** goals;
the student's own free-text instruction is sent alongside these controls. Detailed/deep
visual responses receive the extended model output budget and explicit section structures.
The angle renderer also includes a degree/type/fraction comparison table. A post-generation
precision guard detects unsupported degree values and revealed self-check answers, then asks
the model to correct the response against retrieved and deterministically verified facts.

## Start here next

Evaluate the pilot UI on desktop and mobile, then expand the teacher-approved pilot to
geometry figures, graphs, tables, circuits, scanned equations, chemistry structures, and
biology diagrams. Add page-region highlighting only after page-level citations are stable.

## Remaining vision stages

- [x] 1. Add vision configuration and single-image smoke test.
- [x] 2. Detect PDF pages that need vision processing.
- [x] 3. Render selected PDF pages to bounded-resolution images.
- [x] 4. Extract structured visual content with `qwen3.5:9b-q8_0`.
- [x] 5. Store visual chunks with material ID, source file, page number, and tenant/curriculum metadata.
- [x] 6. Retrieve visual and text chunks together without weakening school/class/subject isolation.
- [x] 7. Add failure handling, timeouts, page limits, and image-size limits.
- [ ] 8. Add unit, integration, and mobile rendering tests. (Unit, protected-page route, and component coverage added; physical mobile QA remains.)
- [x] 9. Re-ingest a small teacher-approved STEM pilot set (`eemm101.pdf`, six visual pages).
- [ ] 10. Evaluate diagrams, graphs, tables, geometry figures, circuits, and scanned equations before wider rollout.

## Important safety and performance constraints

- Process one PDF page image at a time.
- Start with a 16K context window; do not use the advertised 256K context by default.
- Limit page resolution and total pages processed per material.
- Keep `nomic-embed-text` as the embedding model.
- Keep the original source page and page number for citations.
- Vision output is searchable evidence, not permission to answer outside teacher-published material.
- Never allow visual extraction to weaken school, class, section, academic-year, or subject filters.

## Related plan

See `docs/STEM_RAG_IMPLEMENTATION_PLAN.md` for the completed text-STEM implementation and validation record.
