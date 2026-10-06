"""Opt-in smoke test for locally running Ollama models.

This module must stay safe to collect as part of the normal offline test suite.
Run it explicitly with ``RUN_OLLAMA_CONNECTION_TESTS=1`` when Ollama is up.
"""

import os

import pytest
import ollama

models = [
    "llama3.2:3b",
    "qwen3:8b",
    "deepseek-r1:8b",
    "llama3.1:8b",
    
]

@pytest.mark.skipif(
    os.getenv("RUN_OLLAMA_CONNECTION_TESTS") != "1",
    reason="live Ollama smoke tests are opt-in",
)
def test_ollama_models_are_reachable():
    for model in models:
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": "say hello in one word"}],
        )
        assert response["message"]["content"].strip()
