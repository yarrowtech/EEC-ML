"""Bloom taxonomy classifier for ingested documents.

Uses the lightweight clean model (llama3.2:3b by default) to produce a
single-word Bloom level from a short text sample.  The call is best-effort:
any failure returns "understand" as a safe default.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BLOOM_LEVELS = {"remember", "understand", "apply", "analyse", "evaluate", "create"}
DEFAULT_LEVEL = "understand"

_PROMPT = """\
You are a curriculum expert. Classify the educational level of the following text using exactly ONE word from this list:
remember | understand | apply | analyse | evaluate | create

Definitions:
- remember: recalls facts, definitions, lists
- understand: explains, summarises, describes concepts
- apply: uses knowledge to solve problems or demonstrate procedures
- analyse: breaks down information, compares, draws connections
- evaluate: justifies decisions, critiques, assesses evidence
- create: designs, produces, composes new work

Text sample:
{sample}

Respond with ONLY one word from the list above, nothing else."""


def classify_bloom(text: str, timeout: int = 20) -> str:
    """Return a Bloom taxonomy level string for the given document text.

    Falls back to DEFAULT_LEVEL on any error so the ingest pipeline never fails.
    """
    if not text or not text.strip():
        return DEFAULT_LEVEL

    sample = text.strip()[:1500]
    prompt = _PROMPT.format(sample=sample)

    try:
        resp = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.ollama_clean_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.05, "num_predict": 5},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip().lower().split()[0]
        level = raw.rstrip(".,;")
        if level in BLOOM_LEVELS:
            return level
        logger.warning("Bloom classifier returned unexpected value %r; using default", raw)
    except Exception as exc:
        logger.warning("Bloom classification skipped: %s", exc)

    return DEFAULT_LEVEL
