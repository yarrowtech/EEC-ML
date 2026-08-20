"""Vision router — live image explanation endpoint for the AI tutor.

POST /vision/explain-image
  Student sends a base64 image (e.g. a rendered PDF page) and a question.
  llava:13b reads the image and answers directly — no Qdrant retrieval needed.
  Used by the visual_explain mode when the student taps a specific PDF page.
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.modules.vision.client import VisionExtractionError, _encode_image, _supports_thinking

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vision", tags=["Vision"])

_SAFETY_PREFIX = (
    "You are a school tutor explaining an educational image to a student aged 6–18. "
    "Only describe and explain what is visibly shown in the image. "
    "Never generate harmful, adult, or inappropriate content. "
    "If the image is not educational, say so and stop.\n\n"
)


class ImageExplainRequest(BaseModel):
    image: str          # base64-encoded PNG/JPEG or data URL
    question: str       # student's question about the image
    grade_level: str | None = None
    subject: str | None = None


class ImageExplainResponse(BaseModel):
    explanation: str
    model_used: str


@router.post("/explain-image", response_model=ImageExplainResponse)
async def explain_image(req: ImageExplainRequest) -> ImageExplainResponse:
    """Use llava:13b to directly explain a diagram or image to a student."""

    if not settings.ollama_vision_enabled:
        raise HTTPException(status_code=503, detail="Vision model is disabled.")

    try:
        encoded = _encode_image(req.image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    grade = req.grade_level or "school"
    subject = req.subject or "this subject"

    system_prompt = (
        f"{_SAFETY_PREFIX}"
        f"You are explaining an educational diagram or image to a {grade} student studying {subject}. "
        "Look carefully at the image and answer the student's question using ONLY what is visible. "
        "Use simple, age-appropriate language. "
        "If the image shows a diagram, describe the parts and their relationships. "
        "If it shows a chart, read the data accurately. "
        "Keep your answer focused and under 150 words."
    )

    payload = {
        "model": settings.ollama_vision_model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": req.question,
                "images": [encoded],
            },
        ],
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_ctx": settings.ollama_vision_num_ctx,
            "num_predict": 600,
        },
    }

    if _supports_thinking(settings.ollama_vision_model):
        payload["think"] = False

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_vision_timeout) as client:
            response = await client.post(
                f"{settings.ollama_url.rstrip('/')}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["message"]["content"]
    except (httpx.HTTPError, KeyError, TypeError) as exc:
        logger.error("Vision explain failed: %s", exc)
        raise HTTPException(status_code=502, detail="Vision model unavailable.") from exc

    return ImageExplainResponse(
        explanation=content.strip(),
        model_used=settings.ollama_vision_model,
    )
