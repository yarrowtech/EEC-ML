import logging
import math
import os

import ollama
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.routers.ingest import router as ingest_router
from app.routers.ocr import router as ocr_router
from app.services.qdrant_service import search_chunks


load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr_router)
app.include_router(ingest_router)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
RELEVANCE_THRESHOLD = float(os.getenv("RAG_RELEVANCE_THRESHOLD", "0.55"))
MAX_CONTEXT_CHUNKS = 4
ollama_client = ollama.Client(host=OLLAMA_URL)

NOT_FOUND_MESSAGE = (
    "I couldn't find anything about this in your uploaded study materials yet. "
    "Try picking a topic your teacher has already published, or ask them to upload content on this topic."
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "message": "AI service is running",
        "ollama_url": OLLAMA_URL,
        "ollama_model": OLLAMA_MODEL,
        "embed_model": EMBED_MODEL,
    }


class Candidate(BaseModel):
    id: str
    text: str


class TutorGenerateRequest(BaseModel):
    mode: str
    subject: str
    topic: str
    subTopic: str | None = None
    gradeLevel: str | None = None
    question: str | None = None
    candidates: list[Candidate] = []
    # Qdrant-based retrieval fields (set by Node backend when material is indexed)
    schoolId: str | None = None
    chapterTitle: str | None = None


MODE_INSTRUCTIONS = {
    "explain": "Explain the topic clearly, step by step, using simple language and a short example.",
    "summarize": "Summarize the material into concise revision notes with bullet points covering only the key ideas.",
    "quiz": (
        "Write exactly 5 multiple-choice questions testing understanding of the material. "
        "Return them as a numbered list, each with 4 options labeled A-D and the correct answer marked at the end "
        "as 'Answer: <letter>'."
    ),
    "homework_help": "Help the student work through their question step by step without simply giving the final answer outright until they've seen the reasoning.",
    "notes": "Turn the material into short, well-structured study notes with headings and bullet points.",
    "mind_map": "Produce a hierarchical mind map of the material as a nested bullet-point outline (no diagrams), with the topic as the root and key concepts branching from it.",
    "flashcards": "Turn the material into exactly 6 flashcards. Return them as a numbered list, each formatted as 'Q: <question>' followed by 'A: <answer>'.",
}


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def normalize_lookup_text(value: str | None) -> str:
    return " ".join((value or "").lower().replace("_", " ").replace("-", " ").split())


def lexical_fallback_chunks(req: TutorGenerateRequest) -> list[str]:
    lookups = [
        normalize_lookup_text(req.topic),
        normalize_lookup_text(req.subTopic),
        normalize_lookup_text(req.subject),
    ]
    lookups = [item for item in lookups if len(item) >= 3]
    if not lookups:
        return []

    matches = []
    seen = set()
    for candidate in req.candidates:
        candidate_text = candidate.text
        normalized_candidate = normalize_lookup_text(candidate_text)
        if any(lookup in normalized_candidate for lookup in lookups):
            key = normalized_candidate[:300]
            if key in seen:
                continue
            seen.add(key)
            matches.append(candidate_text)
        if len(matches) >= MAX_CONTEXT_CHUNKS:
            break
    return matches


def retrieve_from_in_memory(req: TutorGenerateRequest) -> list[str]:
    """Embed-based retrieval over in-memory candidates (legacy path)."""
    if not req.candidates:
        return []

    query_text = " ".join(
        filter(None, [req.mode, req.subject, req.topic, req.subTopic, (req.question or "").strip()])
    )
    texts = [query_text] + [c.text for c in req.candidates]
    try:
        response = ollama_client.embed(model=EMBED_MODEL, input=texts)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding request failed: {exc}") from exc

    embeddings = response["embeddings"]
    query_embedding = embeddings[0]
    scored = sorted(
        ((cosine(query_embedding, emb), candidate.text) for emb, candidate in zip(embeddings[1:], req.candidates)),
        key=lambda pair: pair[0],
        reverse=True,
    )
    relevant = [text for score, text in scored if score >= RELEVANCE_THRESHOLD][:MAX_CONTEXT_CHUNKS]
    return relevant or lexical_fallback_chunks(req)


def retrieve_from_qdrant(req: TutorGenerateRequest) -> list[str]:
    """Semantic search over Qdrant-indexed chapter content."""
    query_text = " ".join(
        filter(None, [req.subject, req.topic, req.subTopic, (req.question or "").strip()])
    )
    try:
        embed_resp = ollama_client.embed(model=EMBED_MODEL, input=[query_text])
        query_vector = embed_resp["embeddings"][0]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {exc}") from exc

    hits = search_chunks(
        query_vector=query_vector,
        school_id=req.schoolId,
        chapter_title=req.chapterTitle or None,
        subject_name=req.subject or None,
        limit=MAX_CONTEXT_CHUNKS + 2,
    )
    return [hit["text"] for hit in hits if hit["text"]][:MAX_CONTEXT_CHUNKS]


def retrieve_relevant_chunks(req: TutorGenerateRequest) -> list[str]:
    # Prefer Qdrant when the school context is available
    if req.schoolId:
        try:
            qdrant_chunks = retrieve_from_qdrant(req)
            if qdrant_chunks:
                return qdrant_chunks
        except Exception as exc:
            logger.warning("Qdrant retrieval failed, falling back to in-memory: %s", exc)

    return retrieve_from_in_memory(req)


def build_prompt(req: TutorGenerateRequest, context: str) -> tuple[str, str]:
    instruction = MODE_INSTRUCTIONS.get(req.mode)
    if not instruction:
        raise HTTPException(status_code=400, detail=f"Unsupported mode: {req.mode}")

    grade = req.gradeLevel or "school"
    system = (
        f"You are a friendly AI tutor for a {grade} student studying {req.subject}. "
        "You must answer using ONLY the course material provided below. Do not use any outside "
        "knowledge, even if you are confident about the answer. If the material genuinely doesn't "
        "cover something the student asks, say so honestly instead of filling the gap yourself. "
        "Keep the tone encouraging and age-appropriate. If the student asks for uploaded material, "
        "documents, PDFs, PPTs, worksheets, or files, return the matching material titles and URLs "
        "from the course material."
    )

    location = " > ".join(filter(None, [req.subject, req.chapterTitle or req.topic, req.subTopic]))
    parts = [f"Topic: {location}", f"Task: {instruction}", f"Course material:\n{context}"]
    if req.mode == "homework_help" and req.question:
        parts.append(f"Student's question:\n{req.question.strip()}")

    return system, "\n\n".join(parts)


@app.post("/generate/tutor")
async def generate_tutor_content(req: TutorGenerateRequest):
    relevant_chunks = retrieve_relevant_chunks(req)
    if not relevant_chunks:
        return {
            "mode": req.mode,
            "model": None,
            "content": NOT_FOUND_MESSAGE,
            "groundedInMaterial": False,
            "noMaterialFound": True,
        }

    system, user_prompt = build_prompt(req, "\n\n".join(relevant_chunks))
    try:
        response = ollama_client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {exc}") from exc

    return {
        "mode": req.mode,
        "model": OLLAMA_MODEL,
        "content": response["message"]["content"],
        "groundedInMaterial": True,
        "noMaterialFound": False,
    }
