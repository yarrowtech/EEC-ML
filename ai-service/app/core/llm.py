"""
Shared LLM factory used by all /generate/* routers.

Uses Ollama by default. When OPENROUTER_API_KEY is set in .env,
all LangChain-based generation switches to OpenRouter automatically.
Assessment endpoints (reading/writing) use their own httpx-based
_call_llm() with the same Ollama-first / OpenRouter-fallback pattern.
"""

import random

from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable, RunnableLambda
from app.core.privacy import redact_model_input
from langchain_ollama import ChatOllama

from app.core.config import settings

# Modes that produce long structured output need a higher token budget.
LONG_OUTPUT_MODES = {"mind_map", "notes", "flashcards", "summarize", "quiz", "visual_quiz", "visual_explain", "math_solver"}

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
    "code_help":             0.35,
    "math_solver":           0.2,
}
DEFAULT_TEMPERATURE = 0.7

# Modes whose output is structured diagram code (Mermaid) rather than prose. The default
# tutor model produces broken Mermaid often enough that the diagram fails to render for the
# student, so route these to a code-tuned model (see settings.ollama_diagram_model) which is
# markedly more reliable at bracket/quote/keyword correctness. A server-side validate+repair
# pass in chat/service.py is the second line of defence.
MODE_MODEL_OVERRIDE: dict[str, str] = {
    "visual_explain": settings.ollama_diagram_model,
    "diagram": settings.ollama_diagram_model,
}


def _model_for_mode(mode: str) -> str:
    return MODE_MODEL_OVERRIDE.get(mode, settings.ollama_model)


def active_model_name(mode: str = "") -> str:
    """Return the model identifier that _create_chain() will use."""
    return settings.openrouter_model if settings.openrouter_api_key else _model_for_mode(mode)


def create_chain(
    mode: str = "",
    temperature: float | None = None,
    model: str | None = None,
    force_provider: str | None = None,
) -> Runnable:
    """
    Build a LangChain chain (LLM | StrOutputParser) for the given mode.

    OpenRouter is used when OPENROUTER_API_KEY is configured; otherwise
    falls back to local Ollama (with a per-mode model override where configured).
    An explicit ``model`` overrides both the mode default and the per-mode override
    (Ollama only; ignored when OpenRouter is active).
    ``force_provider`` ("openrouter" | "ollama") overrides the normal provider
    selection — used by :func:`invoke_with_fallback` to retry on the other
    provider after the primary one fails.
    """
    if temperature is None:
        temperature = MODE_TEMPERATURE.get(mode, DEFAULT_TEMPERATURE)

    if force_provider == "ollama":
        use_openrouter = False
    else:
        use_openrouter = bool(settings.openrouter_api_key)

    if use_openrouter:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            base_url=settings.openrouter_base_url,
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
            temperature=temperature,
            timeout=60,
            max_retries=1,
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
            model=model or _model_for_mode(mode),
            num_ctx=settings.ollama_num_ctx,
            num_predict=num_predict,
            temperature=temperature,
            seed=random.randint(1, 2**31 - 1),
            # Bounded client-side timeout so a stalled local Ollama call fails fast
            # instead of hanging the request indefinitely (OpenRouter already has
            # its own `timeout=60` above).
            client_kwargs={"timeout": 60.0},
            async_client_kwargs={"timeout": 60.0},
        )

    # One bounded retry on either provider so a single dropped connection or
    # transient 5xx doesn't surface as a hard failure to the caller.
    llm = llm.with_retry(stop_after_attempt=2)

    if use_openrouter:
        return RunnableLambda(redact_model_input) | llm | StrOutputParser()
    return llm | StrOutputParser()
