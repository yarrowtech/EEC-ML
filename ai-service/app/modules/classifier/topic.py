"""Topic auto-detector for documents uploaded without a topic label.

Uses the lightweight clean model to suggest a short topic title (2-6 words)
from the first portion of the document text.  Returns an empty string on any
failure so callers can choose their own fallback.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_PROMPT = """\
You are a curriculum expert. Read the following educational text and write a short topic title for it.

Rules:
- 2 to 6 words only
- No punctuation at the end
- Title case (e.g. "Photosynthesis and Cellular Respiration")
- Do NOT repeat the subject name if it is given

Subject: {subject}
Chapter: {chapter}

Text:
{sample}

Topic title:"""


def detect_topic(
    text: str,
    subject: str = "",
    chapter: str = "",
    timeout: int = 20,
) -> str:
    """Return a short topic title inferred from the document text.

    Returns an empty string on any error or empty input.
    """
    if not text or not text.strip():
        return ""

    sample = text.strip()[:1500]
    prompt = _PROMPT.format(
        subject=subject or "General",
        chapter=chapter or "Unknown chapter",
        sample=sample,
    )

    try:
        resp = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.ollama_clean_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 20},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip()
        # Take only the first line and cap at 80 characters
        topic = raw.splitlines()[0].strip().strip('"').strip("'")[:80]
        if topic:
            return topic
    except Exception as exc:
        logger.warning("Topic auto-detection skipped: %s", exc)

    return ""
