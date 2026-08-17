"""Learning outcome extractor for ingested documents.

Calls the lightweight clean model to extract 3-5 "Students will be able to..."
statements from the document text.  Returns an empty list on any failure so
the ingest pipeline is never blocked.
"""

import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_PROMPT = """\
You are a curriculum designer. Read the following educational text and extract 3 to 5 clear, measurable learning outcomes.

Rules:
- Each outcome must start with "Students will be able to"
- Use active verbs (identify, explain, calculate, compare, design, etc.)
- Keep each outcome to one sentence, under 20 words
- Output ONLY a numbered list, no headings or extra text

Subject: {subject}
Topic: {topic}

Text:
{sample}

Learning outcomes:"""

_OUTCOME_RE = re.compile(r"^\s*\d+[.)]\s*", re.MULTILINE)


def _parse_outcomes(raw: str) -> list[str]:
    lines = [_OUTCOME_RE.sub("", line).strip() for line in raw.strip().splitlines()]
    results = []
    for line in lines:
        line = line.strip("-• ").strip()
        if line and len(line) > 10:
            results.append(line)
    return results[:5]


def extract_learning_outcomes(
    text: str,
    subject: str = "",
    topic: str = "",
    timeout: int = 40,
) -> list[str]:
    """Return up to 5 learning outcome strings extracted from the document text.

    Returns an empty list on any error so the ingest pipeline never fails.
    """
    if not text or not text.strip():
        return []

    sample = text.strip()[:2500]
    prompt = _PROMPT.format(
        subject=subject or "General",
        topic=topic or "this document",
        sample=sample,
    )

    try:
        resp = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.ollama_clean_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.2, "num_predict": 300},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "")
        outcomes = _parse_outcomes(raw)
        if outcomes:
            return outcomes
        logger.warning("Learning outcome extractor returned no usable lines from: %r", raw[:200])
    except Exception as exc:
        logger.warning("Learning outcome extraction skipped: %s", exc)

    return []
