import pytest

from app.core.config import settings
from app.modules.chat.schemas import TutorGenerateRequest

# Tests hit routers via TestClient without the X-Internal-Key header the Node
# backend sends in production; disable that check for the test session regardless
# of what's in the local .env, so the request-auth middleware doesn't 401 every test.
settings.ai_service_internal_key = ""


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
