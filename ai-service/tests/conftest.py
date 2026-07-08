import pytest

from app.modules.chat.schemas import TutorGenerateRequest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "eval: live evaluation against running Ollama/Qdrant (needs RUN_AI_EVALS=1 and tests/golden/golden_set.json)",
    )


@pytest.fixture
def make_request():
    def _make(**overrides) -> TutorGenerateRequest:
        base = {"mode": "explain", "subject": "Science", "topic": "Photosynthesis"}
        base.update(overrides)
        return TutorGenerateRequest(**base)

    return _make
