"""
Shared LLM factory used by all /generate/* routers.

Uses Ollama by default. When OPENROUTER_API_KEY is set in .env,
all LangChain-based generation switches to OpenRouter automatically.
Assessment endpoints (reading/writing) use their own httpx-based
_call_llm() with the same Ollama-first / OpenRouter-fallback pattern.
"""

import random

from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable
from langchain_ollama import ChatOllama

from app.core.config import settings

# Modes that produce long structured output need a higher token budget.
LONG_OUTPUT_MODES = {"mind_map", "notes", "flashcards", "summarize", "quiz", "visual_quiz", "visual_explain"}

MODE_TEMPERATURE: dict[str, float] = {
    "quiz":                  0.9,
    "visual_quiz":           0.7,
    "flashcards":            0.85,
    "practice_basic":        0.5,
    "practice_intermediate": 0.6,
    "practice_advanced":     0.65,
    "engagement_swap":       0.8,
    "explain":               0.6,
    "visual_explain":        0.5,
    "custom":                0.6,
    "homework_help":         0.6,
    "real_world":            0.7,
    "misconception":         0.5,
    "exam_explanation":      0.45,
    "exam_feedback":         0.55,
    "assignment_feedback":   0.5,
    "at_risk_summary":       0.4,
    "summarize":             0.4,
    "notes":                 0.3,
    "mind_map":              0.3,
}
DEFAULT_TEMPERATURE = 0.7

# Modes that need a stronger model than the default fast tutor model (llama3.2:3b) —
# e.g. visual_explain requires reliable structured Mermaid-diagram synthesis, which the
# 3b model produces unreliably. Reuses ollama_summary_model (qwen2.5:14b) already loaded
# for lesson summaries, rather than introducing another model into the VRAM budget.
MODE_MODEL_OVERRIDE: dict[str, str] = {
    "visual_explain": settings.ollama_summary_model,
}


def _model_for_mode(mode: str) -> str:
    return MODE_MODEL_OVERRIDE.get(mode, settings.ollama_model)


def active_model_name(mode: str = "") -> str:
    """Return the model identifier that _create_chain() will use."""
    return settings.openrouter_model if settings.openrouter_api_key else _model_for_mode(mode)


def create_chain(mode: str = "", temperature: float | None = None) -> Runnable:
    """
    Build a LangChain chain (LLM | StrOutputParser) for the given mode.

    OpenRouter is used when OPENROUTER_API_KEY is configured; otherwise
    falls back to local Ollama (with a per-mode model override where configured).
    """
    if temperature is None:
        temperature = MODE_TEMPERATURE.get(mode, DEFAULT_TEMPERATURE)

    if settings.openrouter_api_key:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            base_url=settings.openrouter_base_url,
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
            temperature=temperature,
            max_tokens=(
                settings.ollama_num_predict_extended
                if mode in LONG_OUTPUT_MODES
                else settings.ollama_num_predict
            ),
        )
    else:
        num_predict = (
            settings.ollama_num_predict_extended
            if mode in LONG_OUTPUT_MODES
            else settings.ollama_num_predict
        )
        llm = ChatOllama(
            base_url=settings.ollama_url,
            model=_model_for_mode(mode),
            num_ctx=settings.ollama_num_ctx,
            num_predict=num_predict,
            temperature=temperature,
            seed=random.randint(1, 2**31 - 1),
        )

    return llm | StrOutputParser()
