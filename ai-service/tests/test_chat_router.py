from fastapi.testclient import TestClient

from app.main import app
import app.modules.chat.service as chat_service
from app.modules.chat.service import NOT_FOUND_MESSAGE

client = TestClient(app)

PAYLOAD = {
    "mode": "explain",
    "subject": "Science",
    "topic": "Photosynthesis",
    "schoolId": "school-1",
}


class FakeChain:
    last_messages = None

    def invoke(self, messages):
        FakeChain.last_messages = messages
        return "Photosynthesis converts light energy."


def test_no_material_returns_safe_message_without_calling_llm(monkeypatch):
    # Patch retrieval in the service (where it now lives)
    monkeypatch.setattr(chat_service, "retrieve_relevant_chunks_with_citations", lambda req: ([], []))

    def forbidden(*args, **kwargs):
        raise AssertionError("LLM must not be called when no material matched")

    monkeypatch.setattr(chat_service, "create_chain", forbidden)
    resp = client.post("/generate/tutor", json=PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["noMaterialFound"] is True
    assert body["groundedInMaterial"] is False
    assert body["content"] == NOT_FOUND_MESSAGE
    assert body["model"] is None


_RICH_CHUNK = (
    "Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy "
    "into chemical energy stored in glucose. This process takes place mainly in the chloroplasts of plant "
    "cells, where the green pigment chlorophyll absorbs sunlight. During photosynthesis, carbon dioxide "
    "from the air and water from the soil are combined using light energy to produce glucose and oxygen. "
    "The overall equation is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2. Photosynthesis is essential "
    "for life on Earth because it produces the oxygen we breathe and forms the base of most food chains."
)


def test_grounded_answer_passes_chunks_to_llm(monkeypatch):
    monkeypatch.setattr(
        chat_service,
        "retrieve_relevant_chunks_with_citations",
        lambda req: ([_RICH_CHUNK], []),
    )
    fake = FakeChain()
    monkeypatch.setattr(chat_service, "create_chain", lambda mode, **_: fake)
    resp = client.post("/generate/tutor", json=PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["groundedInMaterial"] is True
    assert body["noMaterialFound"] is False
    assert body["content"] == "Photosynthesis converts light energy."

    # System message should contain the safety prefix and RAG instruction
    system_msg = FakeChain.last_messages[0]
    user_msg = FakeChain.last_messages[-1]
    assert "ONLY" in system_msg.content
    assert "Photosynthesis is the process" in user_msg.content


def test_llm_failure_returns_502(monkeypatch):
    monkeypatch.setattr(
        chat_service,
        "retrieve_relevant_chunks_with_citations",
        lambda req: ([_RICH_CHUNK], []),
    )

    class BrokenChain:
        def invoke(self, messages):
            raise ConnectionError("connection refused")

    monkeypatch.setattr(chat_service, "create_chain", lambda mode, **_: BrokenChain())
    resp = client.post("/generate/tutor", json=PAYLOAD)
    assert resp.status_code == 502


def test_unknown_mode_rejected_before_llm_call(monkeypatch):
    monkeypatch.setattr(
        chat_service,
        "retrieve_relevant_chunks_with_citations",
        lambda req: ([_RICH_CHUNK], []),
    )
    resp = client.post("/generate/tutor", json={**PAYLOAD, "mode": "poetry"})
    assert resp.status_code == 400
