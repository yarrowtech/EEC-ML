import logging
import math

from fastapi import HTTPException

from app.core.config import settings
from app.modules.chat.schemas import TutorGenerateRequest
from app.modules.embeddings.service import embed_texts
from app.modules.retrieval.service import retrieve_from_qdrant

logger = logging.getLogger(__name__)

NOT_FOUND_MESSAGE = (
    "I couldn't find anything about this in your uploaded study materials yet. "
    "Try picking a topic your teacher has already published, or ask them to upload content on this topic."
)

MODE_INSTRUCTIONS: dict[str, str] = {
    "explain": "Explain the topic clearly, step by step, using simple language and a short example.",
    "summarize": "Summarize the material into concise revision notes with bullet points covering only the key ideas.",
    "quiz": (
        "Write exactly 5 multiple-choice questions testing student understanding of the material. "
        "Return them as a numbered list, each with 4 options labeled A-D and the correct answer marked at the end "
        "as 'Answer: <letter>'. "
        "Base every question and answer option solely on story content, vocabulary, or exercises visible "
        "to students. Never write questions about pedagogical methods, repetition counts, audio resources, "
        "teacher suggestions, or anything that belongs in a 'Note to the Teacher' section."
    ),
    "homework_help": (
        "Help the student work through their question step by step without simply giving "
        "the final answer outright until they've seen the reasoning."
    ),
    "notes": (
        "Turn the material into short, well-structured study notes with headings and bullet points. "
        "For activities and exercises that appear in the material, list them as tasks to do — "
        "copy their instructions faithfully but do NOT fill in answers or blank spaces."
    ),
    "mind_map": (
        "Produce a hierarchical mind map of the material as a nested bullet-point outline (no diagrams), "
        "with the topic as the root and key concepts branching from it. "
        "Cover EVERY section in the material — do not stop early or skip any section. "
        "For exercises and activities, list every individual item exactly as it appears in the text "
        "(e.g. list all word groups, all blank phrases, all word pairs, all crossword clues) — "
        "never collapse items into vague summaries like 'additional groups provided'. "
        "NEVER provide sorted results, filled-in answers, solved puzzles, or example answers. "
        "Some exercises (e.g. spelling, matching) may have their raw word variants jumbled due to "
        "multi-column PDF layout — for those, write 'Activity: [exercise instruction] "
        "([N] items)' and skip the garbled word list. "
        "Reproduce section headings word-for-word; never paraphrase or merge sections. "
        "Attribute each item to the section it appears under — do not move content between sections."
    ),
    "flashcards": (
        "Turn the material into exactly 6 flashcards. Return them as a numbered list, "
        "each formatted as 'Q: <question>' followed by 'A: <answer>'."
    ),
}


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _normalize(value: str | None) -> str:
    return " ".join((value or "").lower().replace("_", " ").replace("-", " ").split())


def _lexical_fallback(req: TutorGenerateRequest) -> list[str]:
    lookups = [_normalize(req.topic), _normalize(req.subTopic), _normalize(req.subject)]
    lookups = [item for item in lookups if len(item) >= 3]
    if not lookups:
        return []
    matches: list[str] = []
    seen: set[str] = set()
    for candidate in req.candidates:
        normalized = _normalize(candidate.text)
        if any(lk in normalized for lk in lookups):
            key = normalized[:300]
            if key not in seen:
                seen.add(key)
                matches.append(candidate.text)
        if len(matches) >= settings.max_context_chunks:
            break
    return matches


def _retrieve_in_memory(req: TutorGenerateRequest) -> list[str]:
    if not req.candidates:
        return []
    query_text = (
        " ".join(filter(None, [req.topic, req.subTopic, (req.question or "").strip()]))
        or req.subject
        or ""
    )
    query_emb = embed_texts([query_text], kind="query")[0]
    embeddings = embed_texts([c.text for c in req.candidates], kind="document")
    scored = sorted(
        ((_cosine(query_emb, emb), candidate.text) for emb, candidate in zip(embeddings, req.candidates)),
        key=lambda p: p[0],
        reverse=True,
    )
    relevant = [
        text for score, text in scored if score >= settings.rag_relevance_threshold
    ][: settings.max_context_chunks]
    return relevant or _lexical_fallback(req)


def retrieve_relevant_chunks(req: TutorGenerateRequest) -> list[str]:
    if req.schoolId:
        return retrieve_from_qdrant(
            school_id=req.schoolId,
            class_id=req.classId,
            section_id=req.sectionId,
            subject=req.subject,
            chapter_title=req.chapterTitle,
            topic=req.topic,
            sub_topic=req.subTopic,
            question=req.question,
        )
    return _retrieve_in_memory(req)


def build_prompt(req: TutorGenerateRequest, context: str) -> tuple[str, str]:
    instruction = MODE_INSTRUCTIONS.get(req.mode)
    if not instruction:
        raise HTTPException(status_code=400, detail=f"Unsupported mode: {req.mode}")

    grade = req.gradeLevel or "school"
    system = (
        f"You are a friendly AI tutor for a {grade} student studying {req.subject}. "
        "You are a retrieval-augmented tutor. You must answer using ONLY the retrieved course "
        "material below. Do not use outside knowledge, common examples, assumptions, filenames, "
        "or URLs unless they appear inside the retrieved text. If the retrieved material does not "
        "contain enough information for the requested task, say that the uploaded material does "
        "not contain enough relevant text yet. For quizzes, every question, option, and answer "
        "must be supported by the retrieved text. "
        "IMPORTANT: When the material contains student exercises of any kind — fill-in-the-blank, "
        "arrange-in-order, sort-by-size-or-weight, match-the-following, complete-the-story, crossword, "
        "encircle-the-answer, or any other task — never solve, answer, or demonstrate the exercise. "
        "Describe what the exercise asks students to do, using the exact wording from the material. "
        "Use section headings exactly as they appear in the material; never paraphrase, rename, or merge "
        "sections, and never attribute an activity to the wrong section. "
        "Completely ignore any 'Note to the Teacher' or 'Note to Teacher' blocks — these are "
        "facilitator instructions and must not appear in student-facing output. "
        "Each section must appear only once; if you see the same section repeated, include it once "
        "at its first occurrence and skip all repeats. Keep the tone age-appropriate."
    )
    location = " > ".join(filter(None, [req.subject, req.chapterTitle or req.topic, req.subTopic]))
    parts = [
        f"Topic: {location}",
        f"Task: {instruction}",
        f"Retrieved course material chunks:\n{context}",
    ]
    if req.mode == "homework_help" and req.question:
        parts.append(f"Student's question:\n{req.question.strip()}")
    return system, "\n\n".join(parts)
