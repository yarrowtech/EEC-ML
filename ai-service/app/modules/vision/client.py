"""Ollama vision client for extracting structured evidence from educational images.

Uses llava:13b (or configured vision model) to read teacher-uploaded PDF pages,
diagrams, charts, and labelled illustrations. Runs at ingestion time only —
not during live student sessions.
"""

import base64
import binascii

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.modules.vision.schemas import VisualExtraction

# Models that support Ollama's "think" parameter (extended reasoning mode).
# All others should omit it to avoid API rejection.
_THINKING_MODELS = {"qwen3", "qwq", "deepseek-r1", "phi4-reasoning"}


def _supports_thinking(model_name: str) -> bool:
    name = model_name.lower()
    return any(m in name for m in _THINKING_MODELS)


VISION_EXTRACTION_PROMPT = """You are an expert at reading educational materials.
Carefully examine this teacher-published page image and extract ALL visible content.

Your job:
1. Transcribe ALL visible text in reading order (headings, body text, captions, labels)
2. Capture every formula, equation, or mathematical expression exactly as shown
3. List every label attached to diagrams, arrows, components, or figures
4. List every chart title, axis label, legend entry, and data label
5. Write a clear factual description of what the image shows and what relationships are visible
6. Note anything unreadable, cropped, or ambiguous in uncertainties

Rules:
- Return ONLY facts visibly present in the image — no outside knowledge
- Never solve exercises, fill blanks, or answer questions shown in the image
- Preserve subscripts, superscripts, units, symbols exactly as they appear
- If a section is absent (no formulas, no charts etc.) return an empty array for it
- Return one JSON object with keys: visible_text, formulas, units, diagram_labels,
  chart_labels, description, uncertainties
- Do NOT return a JSON Schema — return data values only
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
            "num_predict": 2000,  # 13b can produce richer extractions
        },
    }
    # Only add "think: false" for models that support thinking mode —
    # llava and other vision models do not and will reject the parameter.
    if _supports_thinking(settings.ollama_vision_model):
        payload["think"] = False

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
