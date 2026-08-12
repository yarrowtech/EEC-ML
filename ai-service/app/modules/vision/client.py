"""Small Ollama client for extracting evidence from a single image.

This module is intentionally not connected to document ingestion. It establishes
the structured extraction contract used by the vision smoke test.
"""

import base64
import binascii

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.modules.vision.schemas import VisualExtraction


VISION_EXTRACTION_PROMPT = """You extract evidence from one teacher-published educational page image.
Return only facts visibly supported by the image. Never solve exercises, answer questions,
complete missing text, or use outside knowledge. Preserve formula symbols, subscripts,
superscripts, numbers, and units as accurately as possible. Put unreadable, cropped,
ambiguous, or low-confidence details in uncertainties instead of guessing. Use empty
arrays when a category is absent. Transcribe visible text in reading order and describe
only visible educational relationships. Return one JSON data object containing values for
visible_text, formulas, units, diagram_labels, chart_labels, description, and uncertainties.
Do not return a JSON Schema and do not include keys such as properties, required, type, or
additionalProperties.
"""


class VisionExtractionError(RuntimeError):
    """Raised when Ollama cannot produce a valid visual extraction."""


def _encode_image(image: bytes | str) -> str:
    if isinstance(image, bytes):
        if not image:
            raise ValueError("image bytes must not be empty")
        return base64.b64encode(image).decode("ascii")

    value = image.strip()
    if value.startswith("data:"):
        separator = value.find(",")
        if separator == -1 or ";base64" not in value[:separator]:
            raise ValueError("image data URL must contain base64 data")
        value = value[separator + 1 :]
    try:
        decoded = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("image string must be valid base64") from exc
    if not decoded:
        raise ValueError("image base64 must not be empty")
    return value


def _parse_extraction(content: str) -> VisualExtraction:
    """Validate JSON, tolerating model-added Markdown fences around the object."""

    value = content.strip()
    if value.startswith("```"):
        first_newline = value.find("\n")
        if first_newline != -1:
            value = value[first_newline + 1 :]
        if value.endswith("```"):
            value = value[:-3].rstrip()
    start = value.find("{")
    end = value.rfind("}")
    if start == -1 or end < start:
        raise ValueError("vision response does not contain a JSON object")
    return VisualExtraction.model_validate_json(value[start : end + 1])


def extract_visual_content(
    image: bytes | str,
    *,
    client: httpx.Client | None = None,
) -> VisualExtraction:
    """Extract structured, image-grounded evidence from one image."""

    encoded_image = _encode_image(image)
    schema = VisualExtraction.model_json_schema()
    payload = {
        "model": settings.ollama_vision_model,
        "think": False,
        "messages": [
            {
                "role": "user",
                "content": VISION_EXTRACTION_PROMPT,
                "images": [encoded_image],
            }
        ],
        "format": schema,
        "stream": False,
        "options": {
            "temperature": 0,
            "num_ctx": settings.ollama_vision_num_ctx,
            "num_predict": 1200,
        },
    }

    owns_client = client is None
    http_client = client or httpx.Client()
    try:
        response = http_client.post(
            f"{settings.ollama_url.rstrip('/')}/api/chat",
            json=payload,
            timeout=settings.ollama_vision_timeout,
        )
        response.raise_for_status()
        content = response.json()["message"]["content"]
        return _parse_extraction(content)
    except (httpx.HTTPError, KeyError, TypeError, ValueError, ValidationError) as exc:
        raise VisionExtractionError("Ollama vision extraction failed") from exc
    finally:
        if owns_client:
            http_client.close()
