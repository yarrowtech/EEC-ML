from app.modules.documents import repository


class FakeQdrantClient:
    def __init__(self):
        self.kwargs = None

    def query_points(self, **kwargs):
        self.kwargs = kwargs

        class Response:
            points = []

        return Response()


class FakeScrollPoint:
    payload = {
        "source_url": "https://cdn.example.test/mathematics.pdf",
        "source_name": "mathematics.pdf",
    }


def _search(monkeypatch, **overrides) -> dict[str, str]:
    fake = FakeQdrantClient()
    monkeypatch.setattr(repository, "make_qdrant_client", lambda: fake)
    kwargs = {"query_vector": [0.1] * 4, "school_id": "school-1"}
    kwargs.update(overrides)
    repository.search_chunks(**kwargs)
    return {c.key: c.match.value for c in fake.kwargs["query_filter"].must}


def test_search_always_scopes_to_school(monkeypatch):
    assert _search(monkeypatch) == {"school_id": "school-1"}


def test_class_and_section_filters_applied(monkeypatch):
    conditions = _search(monkeypatch, class_id="class-1", section_id="section-a")
    assert conditions["class_id"] == "class-1"
    assert conditions["section_id"] == "section-a"


def test_chapter_filter_supersedes_subject(monkeypatch):
    conditions = _search(monkeypatch, chapter_title="Light", subject_name="science")
    assert conditions["chapter_title"] == "Light"
    assert "subject_name" not in conditions


def test_subject_filter_applies_without_chapter(monkeypatch):
    conditions = _search(monkeypatch, subject_name="science")
    assert conditions["subject_name"] == "science"


def test_ids_take_precedence_and_academic_year_is_scoped(monkeypatch):
    conditions = _search(
        monkeypatch,
        academic_year_id="year-1",
        subject_id="subject-1",
        subject_name="science",
    )
    assert conditions["academic_year_id"] == "year-1"
    assert conditions["subject_id"] == "subject-1"
    assert "subject_name" not in conditions


def test_search_failure_returns_empty_not_raise(monkeypatch):
    class BrokenClient:
        def query_points(self, **kwargs):
            raise ConnectionError("qdrant unreachable")

    monkeypatch.setattr(repository, "make_qdrant_client", lambda: BrokenClient())
    assert repository.search_chunks(query_vector=[0.1], school_id="school-1") == []


def test_material_source_lookup_keeps_student_scope(monkeypatch):
    class ScrollClient:
        kwargs = None

        def scroll(self, **kwargs):
            self.kwargs = kwargs
            return [FakeScrollPoint()], None

    fake = ScrollClient()
    monkeypatch.setattr(repository, "make_qdrant_client", lambda: fake)

    source = repository.get_material_source(
        material_id="material-1",
        school_id="school-1",
        class_id="class-1",
        section_id="section-1",
    )

    conditions = {c.key: c.match.value for c in fake.kwargs["scroll_filter"].must}
    assert conditions == {
        "material_id": "material-1",
        "school_id": "school-1",
        "class_id": "class-1",
        "section_id": "section-1",
    }
    assert source == {
        "source_url": "https://cdn.example.test/mathematics.pdf",
        "source_name": "mathematics.pdf",
    }
