import asyncio
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

# hf_xet binary wheel is not compatible with Python 3.14; force HTTP fallback
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logger import setup_logging
from app.modules.admin.router import router as admin_router
from app.modules.assessment.router import router as assessment_router
from app.modules.chat.router import router as chat_router
from app.modules.documents.router import router as ingest_router
from app.modules.evaluator.router import router as evaluator_router
from app.modules.language_memory.router import router as memory_router
from app.modules.speech.router import router as speech_router
from app.modules.summaries.router import router as summaries_router

setup_logging()
logger = logging.getLogger(__name__)


def _warmup_models():
    """Load Whisper and wav2vec2 into GPU memory at startup."""
    try:
        from app.modules.speech.service import _get_whisper_model
        _get_whisper_model()
        logger.info("Whisper model warmed up.")
    except Exception as e:
        logger.warning("Whisper warmup failed: %s", e)

    try:
        from app.modules.speech.pronunciation import _get_model
        _get_model()
        logger.info("wav2vec2 pronunciation model warmed up.")
    except Exception as e:
        logger.warning("wav2vec2 warmup failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run model loading in a thread so it doesn't block the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _warmup_models)
    yield


app = FastAPI(title="EEC AI Service", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(summaries_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(speech_router)
app.include_router(assessment_router)
app.include_router(evaluator_router)
app.include_router(memory_router)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "message": "AI service is running",
        "ollama_url": settings.ollama_url,
        "ollama_model": settings.ollama_model,
        "embed_model": settings.ollama_embed_model,
    }
