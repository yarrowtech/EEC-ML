from io import BytesIO

import fitz
from PIL import Image

from app.modules.parser.pdf import render_pdf_page_png, select_visual_pdf_pages


def test_selects_diagram_page_and_renders_within_bound(tmp_path):
    path = tmp_path / "visual.pdf"
    document = fitz.open()
    text_page = document.new_page()
    text_page.insert_text((50, 80), "A text-only explanation of place value. " * 8)
    diagram_page = document.new_page()
    diagram_page.insert_text((50, 80), "Number line")
    for offset in range(5):
        diagram_page.draw_line((80 + offset * 60, 200), (80 + offset * 60, 260))
    diagram_page.draw_line((80, 230), (380, 230))
    document.save(path)
    document.close()

    assert select_visual_pdf_pages(path, max_pages=2, min_text_chars=80) == [2]

    png = render_pdf_page_png(path, 2, max_dimension=800)
    image = Image.open(BytesIO(png))
    assert max(image.size) <= 800
