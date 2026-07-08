import re

CHUNK_SIZE = 600
CHUNK_OVERLAP = 100
MIN_CHUNK_CHARS = 80


def _split_paragraphs(text: str) -> list[str]:
    paras = re.split(r"\n{2,}", text.strip())
    return [p.strip() for p in paras if p.strip()]


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks without breaking words."""
    text = text.strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    # A boundary is only accepted in the back half of the window, and the
    # cursor always advances by at least half a window; a separator right
    # after `start` can otherwise stall the loop into emitting hundreds of
    # tiny chunks shifted by one character.
    min_step = chunk_size // 2
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunk = text[start:].strip()
            if len(chunk) >= MIN_CHUNK_CHARS:
                chunks.append(chunk)
            break

        for separator in ["\n\n", "\n", ". ", " "]:
            boundary = text.rfind(separator, start + min_step, end)
            if boundary != -1:
                end = boundary + len(separator)
                break

        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_CHARS:
            chunks.append(chunk)

        start = max(end - overlap, start + min_step)

    return chunks
