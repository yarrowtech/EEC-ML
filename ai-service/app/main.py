import asyncio
import logging
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# hf_xet binary wheel is not compatible with Python 3.14; force HTTP fallback
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logger import setup_logging
from app.modules.admin.router import router as admin_router
from app.modules.assessment.router import router as assessment_router
from app.modules.chat.router import router as chat_router
from app.modules.documents.router import router as ingest_router
from app.modules.evaluator.router import router as evaluator_router
from app.modules.knowledge_graph.router import router as knowledge_graph_router
from app.modules.language_memory.router import router as memory_router
from app.modules.orchestrator.router import router as orchestrator_router
from app.modules.speech.router import router as speech_router
from app.modules.summaries.router import router as summaries_router
from app.modules.video.router import router as video_router
from app.modules.vision.router import router as vision_router

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
    if os.getenv("AI_WARMUP_MODELS", "true").lower() not in {"0", "false", "no", "off"}:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _warmup_models)
    yield


app = FastAPI(title="EEC AI Service", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # This service is only ever called server-to-server by the Node backend, never
    # directly from a browser — so no cross-origin access is legitimate.
    allow_origins=[],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-Internal-Key"],
)

_UNAUTHENTICATED_PATHS = {"/health"}


@app.middleware("http")
async def enforce_internal_key(request: Request, call_next):
    """Fail closed unless the backend supplies the configured service secret."""
    if request.url.path in _UNAUTHENTICATED_PATHS:
        return await call_next(request)

    expected = settings.ai_service_internal_key
    if not expected:
        return JSONResponse(status_code=503, content={"detail": "AI service authentication is not configured"})

    provided = request.headers.get("x-internal-key", "")
    if not secrets.compare_digest(provided.encode(), expected.encode()):
        return JSONResponse(status_code=401, content={"detail": "Missing or invalid X-Internal-Key"})

    return await call_next(request)


app.include_router(orchestrator_router)   # ← single unified entry point for all AI tasks
app.include_router(ingest_router)
app.include_router(summaries_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(speech_router)
app.include_router(assessment_router)
app.include_router(evaluator_router)
app.include_router(knowledge_graph_router)
app.include_router(memory_router)
app.include_router(vision_router)
app.include_router(video_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
