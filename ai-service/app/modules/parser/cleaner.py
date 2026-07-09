import re
import logging

from langchain_core.documents import Document
from langchain_core.documents.transformers import BaseDocumentTransformer
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama

from app.core.config import settings

logger = logging.getLogger(__name__)

_NOTE_HEADER_RE = re.compile(r"note\s+to\s+(?:the\s+)?teacher", re.IGNORECASE)
# Patterns that signal the start of the next student-facing section:
# a markdown heading (#, ##, ...) or known section keywords at line start.
_NEXT_SECTION_RE = re.compile(
    r"^(?:#{1,6}\s+|(?:Let us|Just for Fun|Unit\s+\d+|[A-Z]\.\s+[A-Z])\b)",
    re.IGNORECASE,
)


def _strip_teacher_notes(text: str) -> str:
    """Remove 'Note to the Teacher' blocks from plain-text or Markdown input.

    Works for both pymupdf4llm Markdown (## headings) and legacy plain-text
    extraction — the old single-regex approach missed Markdown headings entirely.
    """
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    skipping = False
    for line in lines:
        # Strip leading markdown heading markers and bold/italic wrappers before
        # testing whether this line IS the teacher-note heading.
        bare = re.sub(r"^#{1,6}\s*|\*{1,2}", "", line).strip()
        if _NOTE_HEADER_RE.match(bare):
            skipping = True
            continue
        if skipping:
            # Resume output as soon as we reach the next section heading.
            if _NEXT_SECTION_RE.match(line.strip()):
                skipping = False
                out.append(line)
            # Otherwise still inside the teacher-note block — discard.
        else:
            out.append(line)
    return "".join(out)

_CLEAN_SYSTEM = (
    "You are a document text cleaner for educational PDF textbooks. "
    "The text may have OCR errors or garbled column order caused by multi-column PDF layout. "
    "Your job: fix the reading order so content flows naturally top-to-bottom. "
    "Rules: preserve ALL original words and section headings exactly — do not add, remove, "
    "or rephrase anything. Return only the cleaned text, no commentary."
)

# A page is considered garbled when more than 40 % of its non-empty lines are
# very short (1–2 words) — the signature of multi-column extraction gone wrong.
_GARBLE_THRESHOLD = 0.40
_GARBLE_MIN_LINES = 8


def _is_garbled(text: str) -> bool:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines) < _GARBLE_MIN_LINES:
        return False
    short = sum(1 for ln in lines if len(ln.split()) <= 2)
    return (short / len(lines)) > _GARBLE_THRESHOLD


class RuleBasedCleaner(BaseDocumentTransformer):
    """Fast, deterministic cleaning applied to every ingested document."""

    def transform_documents(self, documents, **kwargs):
        return [
            Document(page_content=self._clean(doc.page_content), metadata=doc.metadata)
            for doc in documents
        ]

    async def atransform_documents(self, documents, **kwargs):
        return self.transform_documents(documents, **kwargs)

    def _clean(self, text: str) -> str:
        # Strip teacher-only instruction blocks
        text = _strip_teacher_notes(text)
        # Fix page numbers concatenated onto section headings (e.g. "7Let us" → "Let us")
        text = re.sub(r"(?<!\w)\d{1,3}(?=[A-Z][a-z])", "", text)
        # Collapse runs of 3+ blank lines down to two
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


class LLMStructureCleaner(BaseDocumentTransformer):
    """Use a small LLM to fix garbled multi-column text detected after rule-based cleaning."""

    def transform_documents(self, documents, **kwargs):
        results = []
        llm = None  # lazy-init — only instantiated when a garbled page is found

        for doc in documents:
            if not _is_garbled(doc.page_content):
                results.append(doc)
                continue

            if llm is None:
                llm = ChatOllama(
                    base_url=settings.ollama_url,
                    model=settings.ollama_clean_model,
                )
                chain = llm | StrOutputParser()

            logger.info(
                "LLM cleaning triggered for document chunk (%d chars)", len(doc.page_content)
            )
            try:
                cleaned = chain.invoke([
                    SystemMessage(content=_CLEAN_SYSTEM),
                    HumanMessage(content=doc.page_content),
                ])
                results.append(Document(page_content=cleaned, metadata=doc.metadata))
            except Exception as exc:
                logger.warning("LLM cleaning failed, keeping original: %s", exc)
                results.append(doc)

        return results

    async def atransform_documents(self, documents, **kwargs):
        return self.transform_documents(documents, **kwargs)


def clean_document_text(text: str, use_llm: bool = True) -> str:
    """Run extracted text through the full cleaning pipeline and return cleaned string."""
    doc = Document(page_content=text)
    (doc,) = RuleBasedCleaner().transform_documents([doc])
    if use_llm:
        (doc,) = LLMStructureCleaner().transform_documents([doc])
    return doc.page_content
