import asyncio

from fastapi import HTTPException

from app.modules.documents import router
from app.modules.documents.schemas import MaterialPageRequest


REQUEST = MaterialPageRequest(
    material_id="material-1",
    page_number=4,
    school_id="school-1",
    class_id="class-1",
    section_id="section-1",
)


def test_material_page_returns_png_from_scoped_source(monkeypatch):
    captured = {}

    def fake_source(**kwargs):
        captured.update(kwargs)
        return {"source_url": "https://cdn.example.test/mathematics.pdf"}

    monkeypatch.setattr(router, "get_material_source", fake_source)
    monkeypatch.setattr(router, "render_source_pdf_page", lambda url, page: b"png-bytes")

    response = asyncio.run(router.render_material_page(REQUEST))

    assert response.body == b"png-bytes"
    assert response.media_type == "image/png"
    assert captured == {
        "material_id": "material-1",
        "school_id": "school-1",
        "class_id": "class-1",
        "section_id": "section-1",
    }


def test_material_page_rejects_source_outside_scope(monkeypatch):
    monkeypatch.setattr(router, "get_material_source", lambda **_: None)

    try:
        asyncio.run(router.render_material_page(REQUEST))
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("Expected a missing scoped source to return 404")
