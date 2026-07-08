from fastapi.testclient import TestClient

from app.main import app
from app.modules.chat import router as chat_router
from app.modules.chat.service import NOT_FOUND_MESSAGE

client = TestClient(app)

PAYLOAD = {
    "mode": "explain",
    "subject": "Science",
    "topic": "Photosynthesis",
    "schoolId": "school-1",
}


class FakeOllamaClient:
    last_messages = None

    def __init__(self, host=None):
        pass

    def chat(self, model, messages):
        FakeOllamaClient.last_messages = messages
        return {"message": {"content": "Photosynthesis converts light energy."}}


def test_no_material_returns_safe_message_without_calling_llm(monkeypatch):
    monkeypatch.setattr(chat_router, "retrieve_relevant_chunks", lambda req: [])

    def forbidden(*args, **kwargs):
        raise AssertionError("Ollama must not be called when no material matched")

    monkeypatch.setattr(chat_router.ollama, "Client", forbidden)
    resp = client.post("/generate/tutor", json=PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["noMaterialFound"] is True
    assert body["groundedInMaterial"] is False
    assert body["content"] == NOT_FOUND_MESSAGE
    assert body["model"] is None


def test_grounded_answer_passes_chunks_to_llm(monkeypatch):
    monkeypatch.setattr(
        chat_router, "retrieve_relevant_chunks", lambda req: ["Chunk about photosynthesis."]
    )
    monkeypatch.setattr(chat_router.ollama, "Client", FakeOllamaClient)
    resp = client.post("/generate/tutor", json=PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["groundedInMaterial"] is True
    assert body["noMaterialFound"] is False
    assert body["content"] == "Photosynthesis converts light energy."

    system, user = (m["content"] for m in FakeOllamaClient.last_messages)
    assert "ONLY the retrieved course material" in system
    assert "Chunk about photosynthesis." in user


def test_ollama_failure_returns_502(monkeypatch):
    monkeypatch.setattr(chat_router, "retrieve_relevant_chunks", lambda req: ["chunk"])

    class BrokenClient:
        def __init__(self, host=None):
            pass

        def chat(self, model, messages):
            raise ConnectionError("connection refused")

    monkeypatch.setattr(chat_router.ollama, "Client", BrokenClient)
    resp = client.post("/generate/tutor", json=PAYLOAD)
    assert resp.status_code == 502


def test_unknown_mode_rejected_before_llm_call(monkeypatch):
    monkeypatch.setattr(chat_router, "retrieve_relevant_chunks", lambda req: ["chunk"])
    resp = client.post("/generate/tutor", json={**PAYLOAD, "mode": "poetry"})
    assert resp.status_code == 400
