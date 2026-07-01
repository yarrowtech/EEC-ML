from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logger import setup_logging
from app.modules.chat.router import router as chat_router
from app.modules.documents.router import router as ingest_router
from app.modules.summaries.router import router as summaries_router

setup_logging()

app = FastAPI(title="EEC AI Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(summaries_router)
app.include_router(chat_router)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "message": "AI service is running",
        "ollama_url": settings.ollama_url,
        "ollama_model": settings.ollama_model,
        "embed_model": settings.ollama_embed_model,
    }
