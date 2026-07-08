import pytest

from app.core.config import settings
from app.modules.retrieval import service


def _hit(text: str, score: float, index: int = 0) -> dict:
    return {
        "id": str(index),
        "score": score,
        "text": text,
        "chunk_index": index,
        "chapter_title": "",
        "topic_title": "",
    }


def _retrieve(**overrides) -> list[str]:
    kwargs = {
        "school_id": "school-1",
        "class_id": "class-1",
        "section_id": None,
        "subject": "Science",
        "chapter_title": "Light",
        "topic": "Reflection",
        "sub_topic": None,
        "question": None,
    }
    kwargs.update(overrides)
    return service.retrieve_from_qdrant(**kwargs)


@pytest.fixture(autouse=True)
def fake_embeddings(monkeypatch):
    monkeypatch.setattr(service, "embed_texts", lambda texts, *, kind="query": [[0.1] * 4 for _ in texts])


def test_chapter_scoped_hits_kept_in_document_order(monkeypatch):
    # Chapter filter guarantees provenance, so even low-score hits are kept.
    low = settings.rag_relevance_threshold - 0.3
    monkeypatch.setattr(
        service, "search_chunks",
        lambda **kw: [_hit("second part", low, 5), _hit("first part", low, 1)],
    )
    assert _retrieve() == ["first part", "second part"]


def test_falls_back_to_subject_search_with_threshold(monkeypatch):
    calls = []

    def fake_search(**kwargs):
        calls.append(kwargs)
        if kwargs["chapter_title"]:
            return []
        return [
            _hit("relevant", settings.rag_relevance_threshold + 0.1, 0),
            _hit("irrelevant", settings.rag_relevance_threshold - 0.1, 1),
        ]

    monkeypatch.setattr(service, "search_chunks", fake_search)
    assert _retrieve() == ["relevant"]
    assert calls[0]["chapter_title"] == "Light"
    assert calls[1]["chapter_title"] is None
    assert calls[1]["subject_name"] == "science"


def test_returns_empty_when_nothing_relevant(monkeypatch):
    monkeypatch.setattr(service, "search_chunks", lambda **kw: [])
    assert _retrieve() == []


def test_subject_filter_is_normalized(monkeypatch):
    calls = []

    def fake_search(**kwargs):
        calls.append(kwargs)
        return []

    monkeypatch.setattr(service, "search_chunks", fake_search)
    _retrieve(subject="  Social   Science ")
    assert all(call["subject_name"] == "social science" for call in calls)


def test_results_capped_at_max_context_chunks(monkeypatch):
    hits = [_hit(f"chunk {i}", 0.9, i) for i in range(10)]
    monkeypatch.setattr(service, "search_chunks", lambda **kw: hits)
    assert len(_retrieve()) == settings.max_context_chunks
