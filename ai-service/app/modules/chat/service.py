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
    "summarize": (
        "Summarize the material into concise revision notes with bullet points covering only the key ideas. "
        "For any exercises, activities, or practice questions in the material (fill-in-the-blanks, "
        "complete-the-sentence, grammar drills, collective-noun tables, etc.), list them as tasks the "
        "student still has to do — keep the blanks and questions intact and NEVER fill in, solve, or "
        "reveal the answer to any of them."
    ),
    "quiz": (
        "Write exactly 10 multiple-choice questions testing student understanding of the material. "
        "Cover a broad range of concepts across the whole material — do not repeat or rephrase the same question. "
        "Return them as a numbered list, each with 4 options labeled A-D and the correct answer marked at the end "
        "as 'Answer: <letter>'. "
        "Base every question and answer option solely on story content, vocabulary, or exercises visible "
        "to students. Never write questions about pedagogical methods, repetition counts, audio resources, "
        "teacher suggestions, or anything that belongs in a 'Note to the Teacher' section."
    ),
    "misconception": (
        "A student answered a quiz question incorrectly. Your job is to:\n"
        "1. Gently acknowledge the mistake without making the student feel bad.\n"
        "2. Explain WHY the wrong answer seems attractive (common misconception or reasoning trap).\n"
        "3. Clearly explain the correct concept using a simple analogy or real-world example from the material.\n"
        "4. Give one follow-up tip so the student remembers the correct answer in future.\n"
        "Keep the tone warm, encouraging, and concise — no more than 4 short paragraphs."
    ),
    "real_world": (
        "Show the student how the topic they are learning connects to real everyday life. "
        "Using ONLY details from the retrieved material:\n"
        "1. Give 3 concrete real-world examples or applications of the concept.\n"
        "2. For each example, write one sentence explaining the connection to the topic.\n"
        "3. End with a fun 'Did you know?' fact or a question that makes the student curious.\n"
        "Keep language simple, vivid, and exciting — suitable for a school student."
    ),
    "homework_help": (
        "You are a Socratic tutor. Your ONLY job is to ask questions that lead the student to discover the answer themselves. "
        "STRICT RULES — never break these:\n"
        "1. NEVER state the answer, even partially. Never say 'The text says…', 'According to the material…', "
        "or any sentence that reveals what the student should find out.\n"
        "2. ALWAYS end every response with exactly ONE short guiding question — nothing after it.\n"
        "3. Break the original question into the smallest possible sub-question the student can answer by thinking or re-reading.\n"
        "4. If the student says 'I don't know', 'idk', 'not sure', or similar: "
        "give ONE small clue (e.g. 'Look at the last verse of the poem') and ask the guiding question again — do not answer it.\n"
        "5. When the student gives a correct or partial answer, praise them briefly and ask the NEXT guiding question.\n"
        "6. Only after the student has stated the correct answer themselves may you confirm it and move on.\n"
        "7. Keep responses SHORT — 2 to 4 sentences maximum, then end with the guiding question."
    ),
    "notes": (
        "Turn the material into short, well-structured student study notes. Use this exact structure: "
        "a title, short chapter section headings with 1-3 simple bullet points each, a 'New Words' section, "
        "and a 'Tasks to Do' section. For activities and exercises that appear in the material, list them "
        "as tasks to do — copy their student-facing instructions faithfully but do NOT fill in answers or "
        "blank spaces. Do not include teacher guidance, classroom facilitation notes, repeated activities, "
        "or the same task group more than once."
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
    "practice_basic": (
        "You are generating FOUNDATION-level practice for a student who is still learning this topic.\n"
        "Create 5 very simple questions that test basic recall and recognition.\n"
        "Rules:\n"
        "- Questions must be answerable directly from the material with one sentence.\n"
        "- Use simple vocabulary appropriate for a beginner.\n"
        "- Include the correct answer after each question as 'Answer: <answer>'.\n"
        "- Do NOT include trick questions or inference — only direct recall."
    ),
    "practice_intermediate": (
        "You are generating STANDARD-level practice for a student with developing understanding.\n"
        "Create 5 questions that mix recall with application and short explanation.\n"
        "Rules:\n"
        "- Mix MCQ and short-answer formats.\n"
        "- At least 2 questions should require the student to apply or connect concepts.\n"
        "- Include the correct answer after each question as 'Answer: <answer>'.\n"
        "- Avoid trivially obvious questions."
    ),
    "practice_advanced": (
        "You are generating EXTENSION-level practice for a student approaching mastery.\n"
        "Create 5 challenging questions that require analysis, inference, and critical thinking.\n"
        "Rules:\n"
        "- Questions must require the student to synthesise across multiple parts of the material.\n"
        "- Include at least one 'why/how' question and one scenario-based question.\n"
        "- Include the correct answer or a model answer for each.\n"
        "- Use precise academic language appropriate for this grade level."
    ),
    "engagement_swap": (
        "The student seems disengaged with this topic. Your job is to re-spark their curiosity.\n"
        "Using ONLY the retrieved material:\n"
        "1. Find the single most surprising or counter-intuitive fact in the material.\n"
        "2. Present it as a compelling 'Did you know?' hook (2-3 sentences).\n"
        "3. Follow with ONE thought-provoking question to pull the student back in.\n"
        "4. Suggest ONE specific activity or challenge from the material they could try right now.\n"
        "Keep the tone energetic and playful — like a friend who loves this topic."
    ),
    "exam_explanation": (
        "A student got a question WRONG on their exam. Your job is to help them understand why.\n"
        "The question, the student's wrong answer, and the correct answer will be provided.\n"
        "Your response must:\n"
        "1. Start with a warm, encouraging opener (1 sentence) — never shame the student.\n"
        "2. Explain WHY the correct answer is correct — using simple language and a real-world example if possible.\n"
        "3. Explain WHY the student's answer is wrong — the specific misconception or reasoning gap.\n"
        "4. Give ONE memory trick or tip to remember the correct concept next time.\n"
        "5. End with a single confidence-building sentence.\n"
        "Keep the total response under 150 words. Use warm, encouraging language throughout."
    ),
    "assignment_feedback": (
        "You are an expert teacher writing constructive feedback on a student assignment submission.\n"
        "Based on the submission content provided, write professional, encouraging, and specific feedback.\n"
        "Structure your feedback as:\n"
        "**What was done well**: 2-3 specific strengths from the submission.\n"
        "**Areas to improve**: 2 specific, actionable improvement points.\n"
        "**Suggested next step**: One concrete action the student should take.\n"
        "Rules:\n"
        "- Be specific — reference actual content from the submission.\n"
        "- Keep total under 150 words.\n"
        "- Use warm, encouraging language. Never shame or discourage.\n"
        "- Do not repeat the question back to the student."
    ),
    "at_risk_summary": (
        "You are an educational data analyst. Given a student's at-risk profile "
        "(attendance percentage, average exam score, score trend), write a brief, "
        "professional teacher-facing risk summary.\n"
        "Structure:\n"
        "**Risk Level**: [Critical/High/Medium] — one sentence why.\n"
        "**Key Signals**: 2-3 bullet points of the strongest risk indicators.\n"
        "**Recommended Actions**: 2 specific, practical intervention steps the teacher can take this week.\n"
        "Keep total under 120 words. Be direct and actionable — this is for a teacher, not the student."
    ),
    "exam_feedback": (
        "A student has just received their exam results. Based on their score and subject, "
        "write a personalised, motivating post-exam feedback message.\n"
        "The feedback MUST:\n"
        "1. Acknowledge the score warmly (do not shame low scores — always find something positive).\n"
        "2. Identify 2 specific strengths based on their performance.\n"
        "3. Identify 1-2 areas for improvement with concrete next steps (e.g. 'review Chapter 3 on photosynthesis').\n"
        "4. Recommend the single best next action (e.g. 'Try a medium quiz on this topic in AI Tutor').\n"
        "5. End with a short motivational closing line tailored to their score.\n"
        "Structure the response with clear headings: "
        "**What you did well**, **Where to improve**, **Your next step**, **Keep going!**\n"
        "Tone: warm, specific, teacher-like. Keep total under 200 words."
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

    base_system = (
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

    # Reinforce Socratic constraint at system level for homework_help so the LLM cannot ignore it.
    if req.mode == "homework_help":
        system = (
            base_system
            + " CRITICAL OVERRIDE FOR THIS SESSION: You are operating in Socratic tutoring mode. "
            "You are FORBIDDEN from stating, implying, or hinting at any answer. "
            "Every response you produce MUST end with a single guiding question and nothing after it. "
            "If you find yourself about to write the answer, stop and replace it with a question that "
            "points the student toward finding it themselves."
        )
    else:
        system = base_system

    # For quiz mode, prepend difficulty level to instruction when provided.
    if req.mode == "quiz" and req.difficulty:
        diff = req.difficulty.strip().lower()
        difficulty_note = {
            "easy": "Focus on basic recall and comprehension — suitable for beginners.",
            "medium": "Mix recall with some application and inference questions.",
            "hard": "Emphasise analysis, critical thinking, and inference. Avoid trivially obvious questions.",
        }.get(diff, f"Difficulty level: {req.difficulty}.")
        instruction = f"{instruction} {difficulty_note}"

    location = " > ".join(filter(None, [req.subject, req.chapterTitle or req.topic, req.subTopic]))
    parts = [
        f"Topic: {location}",
        f"Task: {instruction}",
        f"Retrieved course material chunks:\n{context}",
    ]
    if req.mode == "homework_help" and req.question:
        parts.append(f"Student's question:\n{req.question.strip()}")
    if req.mode == "misconception" and req.wrongAnswer and req.question:
        parts.append(
            f"Quiz question the student got wrong:\n{req.question.strip()}\n"
            f"Student's wrong answer: {req.wrongAnswer.strip()}"
        )
    return system, "\n\n".join(parts)
