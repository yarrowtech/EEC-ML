from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
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
ollama_client = ollama.Client(host=OLLAMA_URL)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "message": "AI service is running",
        "ollama_url": OLLAMA_URL,
        "ollama_model": OLLAMA_MODEL,
    }


class TutorGenerateRequest(BaseModel):
    mode: str  # explain | summarize | quiz | homework_help | notes
    subject: str
    topic: str
    subTopic: str | None = None
    gradeLevel: str | None = None
    context: str = ""  # real teaching material text fetched by Node, grounds the answer
    question: str | None = None  # student's own question, used for homework_help


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


def build_prompt(req: TutorGenerateRequest) -> tuple[str, str]:
    instruction = MODE_INSTRUCTIONS.get(req.mode)
    if not instruction:
        raise HTTPException(status_code=400, detail=f"Unsupported mode: {req.mode}")

    grade = req.gradeLevel or "school"
    system = (
        f"You are a friendly AI tutor for a {grade} student studying {req.subject}. "
        "Ground your answer strictly in the provided course material when it is given. "
        "If no course material is given, rely on standard curriculum knowledge for the subject and grade level. "
        "Keep the tone encouraging and age-appropriate."
    )

    location = " > ".join(filter(None, [req.subject, req.topic, req.subTopic]))
    parts = [f"Topic: {location}", f"Task: {instruction}"]
    if req.context.strip():
        parts.append(f"Course material:\n{req.context.strip()}")
    if req.mode == "homework_help" and req.question:
        parts.append(f"Student's question:\n{req.question.strip()}")

    return system, "\n\n".join(parts)


@app.post("/generate/tutor")
async def generate_tutor_content(req: TutorGenerateRequest):
    system, user_prompt = build_prompt(req)
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
        "groundedInMaterial": bool(req.context.strip()),
    }
