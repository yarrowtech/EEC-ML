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


def test_chapter_scroll_returns_single_merged_string(monkeypatch):
    # Scroll returns unordered chunks; they should be merged into one clean string.
    monkeypatch.setattr(
        service, "get_chapter_chunks",
        lambda **kw: [_hit("second part", 1.0, 5), _hit("first part", 1.0, 1)],
    )
    result = _retrieve()
    assert len(result) == 1
    # Document order: first part before second part
    assert result[0].index("first part") < result[0].index("second part")


def test_chapter_scroll_never_calls_search_chunks(monkeypatch):
    monkeypatch.setattr(
        service, "get_chapter_chunks",
        lambda **kw: [_hit("poem text", 1.0, 0)],
    )

    def forbidden(**kwargs):
        raise AssertionError("search_chunks must not be called when chapter scroll succeeds")

    monkeypatch.setattr(service, "search_chunks", forbidden)
    result = _retrieve()
    assert "poem text" in result[0]


def test_chapter_overlap_is_merged_not_duplicated(monkeypatch):
    # Simulate two chunks sharing a 30-char overlap at their boundary.
    shared = "shared overlap text here okay "  # 30 chars
    chunk0 = "start of chapter. " + shared
    chunk1 = shared + "rest of chapter."
    monkeypatch.setattr(
        service, "get_chapter_chunks",
        lambda **kw: [_hit(chunk0, 1.0, 0), _hit(chunk1, 1.0, 1)],
    )
    result = _retrieve()
    assert len(result) == 1
    merged = result[0]
    # The shared text must appear exactly once
    assert merged.count(shared.strip()) == 1
    assert merged == "start of chapter. " + shared + "rest of chapter."


def test_falls_back_to_subject_search_when_chapter_has_no_chunks(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])
    calls = []

    def fake_search(**kwargs):
        calls.append(kwargs)
        return [_hit("relevant", settings.rag_relevance_threshold + 0.1, 0)]

    monkeypatch.setattr(service, "search_chunks", fake_search)
    result = _retrieve()
    assert result == ["relevant"]
    assert len(calls) == 1
    assert calls[0]["chapter_title"] is None
    assert calls[0]["subject_name"] == "science"


def test_subject_fallback_applies_relevance_threshold(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])

    def fake_search(**kwargs):
        return [
            _hit("relevant", settings.rag_relevance_threshold + 0.1, 0),
            _hit("irrelevant", settings.rag_relevance_threshold - 0.1, 1),
        ]

    monkeypatch.setattr(service, "search_chunks", fake_search)
    assert _retrieve() == ["relevant"]


def test_returns_empty_when_nothing_relevant(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])
    monkeypatch.setattr(service, "search_chunks", lambda **kw: [])
    assert _retrieve() == []


def test_subject_filter_is_normalized(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])
    calls = []

    def fake_search(**kwargs):
        calls.append(kwargs)
        return []

    monkeypatch.setattr(service, "search_chunks", fake_search)
    _retrieve(subject="  Social   Science ")
    assert calls[0]["subject_name"] == "social science"


def test_chapter_capped_at_max_chapter_context_chunks(monkeypatch):
    cap = settings.max_chapter_context_chunks
    hits = [_hit(f"chunk{i}", 1.0, i) for i in range(cap + 5)]
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: hits)
    result = _retrieve()
    assert len(result) == 1
    # Content beyond the cap must not appear in the merged text
    assert f"chunk{cap}" not in result[0]
    assert f"chunk{cap - 1}" in result[0]


def test_subject_results_capped_at_max_context_chunks(monkeypatch):
    hits = [_hit(f"chunk {i}", 0.9, i) for i in range(10)]
    monkeypatch.setattr(service, "search_chunks", lambda **kw: hits)
    assert len(_retrieve(chapter_title=None)) == settings.max_context_chunks
