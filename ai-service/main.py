from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import math
import ollama

load_dotenv()

app = FastAPI(title="AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    mode: str  # explain | summarize | quiz | homework_help | notes | mind_map | flashcards
    subject: str
    topic: str
    subTopic: str | None = None
    gradeLevel: str | None = None
    question: str | None = None  # student's own free-text question
    candidates: list[Candidate] = []  # real chunks pulled from teacher-published material by Node


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


def retrieve_relevant_chunks(req: TutorGenerateRequest) -> list[str]:
    """Embeds the query and every candidate chunk, keeps only chunks that pass
    RELEVANCE_THRESHOLD. This is the hard gate that keeps answers grounded in
    teacher-uploaded material instead of the model's general knowledge."""
    if not req.candidates:
        return []

    query_text = (req.question or "").strip() or " ".join(filter(None, [req.subject, req.topic, req.subTopic]))
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
    return [text for score, text in scored if score >= RELEVANCE_THRESHOLD][:MAX_CONTEXT_CHUNKS]


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
        "Keep the tone encouraging and age-appropriate."
    )

    location = " > ".join(filter(None, [req.subject, req.topic, req.subTopic]))
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
