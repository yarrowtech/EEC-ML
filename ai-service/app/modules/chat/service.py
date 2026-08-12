# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

import logging
import math
import re

from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.core.config import settings
from app.core.llm import active_model_name, create_chain
from app.modules.chat.schemas import TutorGenerateRequest
from app.modules.chat.visuals import build_tutor_visuals, visual_prompt_context
from app.modules.embeddings.service import embed_texts
from app.modules.parser.cleaner import _strip_injection_attempts, _strip_teacher_notes
from app.modules.retrieval.service import retrieve_from_qdrant
from app.modules.stem.service import detect_discipline
from app.modules.stem.verifier import verify_stem_question

# Safety guardrail prepended to every student-facing tutor system prompt.
_SAFETY_PREFIX = (
    "You are a school tutor for students aged 6–18. "
    "You must ONLY answer questions directly related to the study material provided below. "
    "If asked anything unrelated to the material — personal questions, political topics, "
    "adult content, violence, or any topic outside the provided text — respond with: "
    "'I can only help with your study material. Please ask your teacher about anything else.' "
    "Never generate harmful, adult, or inappropriate content under any circumstances.\n\n"
)

logger = logging.getLogger(__name__)

NOT_FOUND_MESSAGE = (
    "I couldn't find anything about this in your uploaded study materials yet. "
    "Try picking a topic your teacher has already published, or ask them to upload content on this topic."
)

STEM_INSTRUCTIONS: dict[str, str] = {
    "mathematics": (
        "Preserve mathematical notation, show grade-appropriate steps, define symbols, and clearly label "
        "exact versus approximate results. Do not invent a formula absent from the retrieved material."
    ),
    "physics": (
        "Define every variable used, carry units through each calculation, check dimensional consistency, "
        "and distinguish measured values from assumptions."
    ),
    "chemistry": (
        "Preserve element capitalization, subscripts, superscripts, charges, states, and reaction arrows. "
        "Do not claim an equation is balanced unless the retrieved material supports it."
    ),
    "biology": (
        "Clearly distinguish structures, biological processes, observations, evidence, and causal claims. "
        "Avoid implying that correlation alone proves causation."
    ),
    "engineering": (
        "State inputs, outputs, assumptions, constraints, trade-offs, and relevant safety considerations."
    ),
    "technology": (
        "State inputs, outputs, assumptions, constraints, and safety or privacy considerations where relevant."
    ),
}

_VISUAL_PAGE_PATTERN = re.compile(r"Visual evidence from source PDF page\s+(\d+)", re.IGNORECASE)
_VISUAL_FOCUS_STOP_WORDS = {
    "about", "explain", "from", "have", "help", "how", "into", "page", "show", "that",
    "the", "this", "using", "visual", "what", "when", "where", "which", "with",
}


def _focused_visual_context(req: TutorGenerateRequest, chunks: list[str], limit: int = 3500) -> str:
    """Keep relevant visual evidence and a bounded nearby chapter-text window."""

    visual_chunks = [chunk for chunk in chunks if _VISUAL_PAGE_PATTERN.search(chunk)]
    if not visual_chunks:
        return "\n\n".join(chunks)

    text = "\n\n".join(chunk for chunk in chunks if not _VISUAL_PAGE_PATTERN.search(chunk))
    if len(text) > limit:
        query = " ".join(filter(None, [req.topic, req.subTopic, req.question]))
        terms = sorted({
            token for token in re.findall(r"[a-z0-9]+", query.casefold())
            if len(token) >= 4 and token not in _VISUAL_FOCUS_STOP_WORDS
        }, key=len, reverse=True)
        normalized_text = text.casefold()
        focus = next(
            (position for term in terms if (position := normalized_text.find(term)) >= 0),
            0,
        )
        start = max(0, focus - (limit // 3))
        text = text[start:start + limit]

    # The local tutor runs with a 16K context window. One tightly bounded page plus
    # nearby text leaves enough room for safety/teaching instructions and the answer.
    selected = ([text] if text.strip() else []) + [visual_chunks[0][:5000]]
    return "\n\n".join(selected)


def _visual_grounding_instruction(context: str, mode: str) -> str | None:
    """Tell the tutor how to teach from retrieved page images without inventing visuals."""

    pages = sorted({int(page) for page in _VISUAL_PAGE_PATTERN.findall(context)})
    if not pages:
        return None

    page_list = ", ".join(str(page) for page in pages)
    shared = (
        f"VISUAL EVIDENCE RULES: Retrieved teacher-material visual evidence is available for PDF page(s) {page_list}. "
        "Refer to a visual as 'page N' so the student can open the matching Visual evidence card below the answer. "
        "Use only objects, labels, values, formulas, spatial relationships, and uncertainties explicitly described "
        "in the retrieved visual evidence. Never claim to see an element that is not described, never invent a new "
        "diagram, and never treat a filename as evidence. VISIBLE-LABEL FIDELITY: do not add an inferred endpoint, "
        "tick, value, symbol, colour, or label merely because it would normally appear in such a diagram. "
        "SOURCE-EXERCISE LOCK: a visual description may contain a printed student exercise. Never fill its blanks, "
        "select its answer, calculate its requested distances/results, or reveal its solution, even when the student "
        "asks for an explanation. Teach the method without completing the printed task. "
    )
    if mode in {"explain", "visual_explain"}:
        return shared + (
            "Include a short 'Visual walkthrough' section using this sequence: Look (where to focus on the cited page), "
            "Notice (the important visible labels or relationship), and Connect (how that visual supports the concept). "
            "Use unsolved language such as 'compare the distance to each labelled endpoint' rather than stating the "
            "result of the printed exercise."
        )
    if mode in {"quiz", "visual_quiz"}:
        return shared + (
            "When an explanatory diagram, graph, number line, table, circuit, or labelled structure supports it, include "
            "at least one newly authored question labelled 'Visual question — use page N'. The question must require the "
            "student to inspect that cited visual. If the retrieved visual is itself an exercise, ask only a non-solving "
            "observation question about visible labels or structure; do not copy, solve, or reveal its answer."
        )
    if mode == "homework_help":
        return shared + (
            "Use the cited visual only to direct the student's attention with a Socratic clue, then ask one guiding "
            "question. Do not state the answer or complete any printed exercise."
        )
    return shared + (
        "Briefly point out the relevant visible feature when it materially improves understanding. Do not solve any "
        "exercise printed on the source page."
    )


def _visual_explanation_reveals_exercise_answer(context: str, content: str) -> bool:
    """Detect common local-model failures after an exercise-page explanation."""

    if not _VISUAL_PAGE_PATTERN.search(context):
        return False
    exercise_markers = ("____", "fill in the", "which of", "which number", "should the")
    if not any(marker in context.casefold() for marker in exercise_markers):
        return False
    answer_patterns = (
        r"\banswer\s+is\b",
        r"\bnearest\s+(?:ten|hundred|thousand)\s+is\b",
        r"\bdistance\s*(?:=|is)\s*\d",
        r"\b\d[\d,]*\s+(?:units?|jumps?)\s+(?:away|from|to)\b",
    )
    return any(re.search(pattern, content, re.IGNORECASE) for pattern in answer_patterns)


def _safe_visual_explanation(req: TutorGenerateRequest, context: str) -> str:
    pages = sorted({int(page) for page in _VISUAL_PAGE_PATTERN.findall(context)})
    page = pages[0] if pages else 1
    return (
        f"### Visual walkthrough — page {page}\n\n"
        f"- **Look:** Open the Visual evidence card for page {page} and locate the value or object the question highlights.\n"
        "- **Notice:** Identify the two labelled endpoints or comparison points around it. Keep the printed blanks unsolved.\n"
        f"- **Connect:** For {req.topic}, compare the highlighted position with each labelled endpoint and choose the "
        "closer one yourself. The visual turns the rule into a distance comparison without revealing the workbook answer."
    )


def _visual_quiz_reuses_source_exercise(context: str, content: str) -> bool:
    if not _VISUAL_PAGE_PATTERN.search(context):
        return False
    if not any(marker in context.casefold() for marker in ("____", "fill in the", "which number", "should the")):
        return False
    copied_task_patterns = (
        r"\bwhat\s+is\s+the\s+nearest\s+(?:ten|hundred|thousand)\s+of\b",
        r"\bwhich\s+number\b[^?\n]*\bnearest\s+(?:ten|hundred|thousand)\b",
        r"\bround\s+[\d,]+\s+to\s+the\s+nearest\b",
        r"\bnearest\s+(?:ten|hundred|thousand)s?\b[^?\n]*\?",
    )
    return any(re.search(pattern, content, re.IGNORECASE) for pattern in copied_task_patterns)


def _safe_visual_question(context: str) -> str:
    pages = sorted({int(page) for page in _VISUAL_PAGE_PATTERN.findall(context)})
    page = pages[0] if pages else 1
    return (
        f"### Visual question — use page {page}\n\n"
        "Without calculating or filling any blank, identify two labels you can see in the visual and describe where "
        "each one appears. Then explain how the layout helps you understand the topic."
    )


def _generated_visual_precision_issues(visuals: list[dict], context: str, content: str) -> list[str]:
    if not visuals:
        return []
    allowed_degrees = {int(value) for value in re.findall(r"(\d{1,4})\s*°", context)}
    for visual in visuals:
        for item in visual.get("items", []):
            if isinstance(item.get("degrees"), int):
                allowed_degrees.add(item["degrees"])
    used_degrees = {int(value) for value in re.findall(r"(\d{1,4})\s*°", content)}
    issues = []
    unsupported = sorted(used_degrees - allowed_degrees)
    if unsupported:
        issues.append("unsupported degree values: " + ", ".join(f"{value}°" for value in unsupported))
    self_check = re.search(r"self[- ]check", content, re.IGNORECASE)
    if self_check and re.search(r"(?:answer|solution)\s*:", content[self_check.start():], re.IGNORECASE):
        issues.append("self-check answers were revealed")
    if any(visual.get("type") == "fraction_wholes" for visual in visuals):
        if re.search(r"\bgrid\s+[abc]\b[^.\n]{0,45}\b\d+\s*[x×]\s*\d+", content, re.IGNORECASE):
            issues.append("invented dimensions for source activity grids")
        if re.search(r"\bgrid\s+[abc]\b[^.\n]{0,55}\b(?:already\s+)?shaded\b", content, re.IGNORECASE):
            issues.append("described a blank source activity grid as shaded")
        outside_examples = sorted({
            token for token in ("pizza", "ribbon") if re.search(rf"\b{token}\b", content, re.IGNORECASE)
        })
        if outside_examples:
            issues.append("introduced unsupported outside examples: " + ", ".join(outside_examples))
    return issues


def _safe_fraction_visual_explanation(visual: dict) -> str:
    first, second = visual["items"]
    return (
        "### Core idea\n\n"
        "A fraction describes a part of a particular whole. Fractions such as 1/2 and 1/3 can be compared directly "
        "only when their wholes are the same size. When the wholes differ, compare the actual represented amounts.\n\n"
        "### Visual walkthrough\n\n"
        f"- **Look:** The generated visual shows the {first['label'].lower()} as a {first['rows']}×{first['columns']} "
        f"chocolate and the {second['label'].lower()} as a {second['rows']}×{second['columns']} chocolate.\n"
        f"- **Notice:** 1/2 of the smaller chocolate highlights {first['highlighted_blocks']} equal blocks. "
        f"1/3 of the larger chocolate highlights {second['highlighted_blocks']} equal blocks.\n"
        "- **Connect:** The blocks have the same visual unit size, so compare the highlighted block counts: "
        f"{first['highlighted_blocks']} < {second['highlighted_blocks']}. Therefore, in this picture, 1/3 of the "
        "larger chocolate represents more chocolate than 1/2 of the smaller chocolate.\n\n"
        "### Why this does not contradict 1/2 > 1/3\n\n"
        "For one same-sized whole, 1/2 is greater than 1/3. Here, however, the two chocolates are different sizes. "
        "The fraction and the size of its whole both affect the actual amount.\n\n"
        "### Verified relationship\n\n"
        f"- Smaller chocolate: {first['rows'] * first['columns']} equal blocks; 1/2 = "
        f"{first['highlighted_blocks']} blocks.\n"
        f"- Larger chocolate: {second['rows'] * second['columns']} equal blocks; 1/3 = "
        f"{second['highlighted_blocks']} blocks.\n"
        f"- Picture comparison: {first['highlighted_blocks']} blocks < {second['highlighted_blocks']} blocks.\n\n"
        "### Important source-page detail\n\n"
        "The separate grids labelled A, B, and C are blank activities for the student to shade. They are not the "
        "2×2 and 3×3 chocolate diagrams, and they should not be described as already shaded.\n\n"
        "### Common misconception\n\n"
        "A larger denominator does not by itself tell us which physical amount is bigger when the wholes have "
        "different sizes. First check whether the wholes are equal.\n\n"
        "### Try it yourself\n\n"
        "1. Point to the two highlighted blocks representing 1/2 in the smaller chocolate.\n"
        "2. Point to the three highlighted blocks representing 1/3 in the larger chocolate.\n"
        "3. Explain why the same-whole rule is necessary without completing the blank grid activities."
    )


def _safe_balance_visual_explanation(visual: dict) -> str:
    problem_lines = []
    for problem in visual["problems"]:
        left_total = problem["left_total"]
        right_total = problem["right_total"]
        steps = []
        for left_value, right_value in problem["example_swaps"]:
            left_total = left_total - left_value + right_value
            right_total = right_total - right_value + left_value
            steps.append(f"swap {left_value} ↔ {right_value} → totals {left_total} and {right_total}")
        problem_lines.append(
            f"#### Problem ({problem['label']})\n\n"
            f"- Left operands: {', '.join(map(str, problem['left']))}; total = {problem['left_total']}.\n"
            f"- Right operands: {', '.join(map(str, problem['right']))}; total = {problem['right_total']}.\n"
            f"- Gap: {problem['right_total']} − {problem['left_total']} = {problem['gap']}.\n"
            f"- Required net transfer: {problem['gap']} ÷ 2 = {problem['required_transfer']}.\n"
            f"- Verified demonstration: {'; '.join(steps)}.\n"
            f"- Least number of moves: {problem['minimum_moves']}."
        )
    return (
        "### Core idea\n\n"
        "Each problem has two groups of addends and a printed total below each group. The totals are results, not "
        "numbers that may be swapped. A swap removes one value from each group and puts it into the other group.\n\n"
        "### Visual walkthrough\n\n"
        "- **Look:** Read only the number tiles above each horizontal line as group members.\n"
        "- **Notice:** The number below the line is the total. Compare the two totals to find the gap.\n"
        "- **Connect:** A swap changes both totals at once, so only half of the total gap needs to be transferred from "
        "the larger-sum group to the smaller-sum group.\n\n"
        "### Exact swap rule\n\n"
        "Let the right total exceed the left by D. If x moves from the left group and y moves from the right group,\n\n"
        "- new left total = old left total − x + y\n"
        "- new right total = old right total − y + x\n\n"
        "For one swap to balance the groups, y − x must equal D/2. Swapping equal values changes neither total; it "
        "cannot fix a non-zero gap.\n\n"
        "### Verified demonstrations\n\n"
        + "\n\n".join(problem_lines)
        + "\n\n### Source prompt check\n\n"
        "In problem (a), swapping 2 and 5 does **not** balance the groups: the totals become 22 and 18. The prompt "
        "asks the student to observe this and then search for a pair that works.\n\n"
        "### Common misconception\n\n"
        "Do not include 19, 21, 39, 47, 68, 76, 314, or 330 inside the groups. Those values are printed totals. "
        "Also, the one-swap condition concerns the **difference** between exchanged values: y − x = D/2.\n\n"
        "### Try it yourself\n\n"
        "Choose another pair in problem (a), apply both update equations, and check whether the two new totals match."
    )


def _citations_used_in_context(citations: list[dict], context: str) -> list[dict]:
    used_pages = {int(page) for page in _VISUAL_PAGE_PATTERN.findall(context)}
    if not used_pages:
        return citations
    filtered = []
    for citation in citations:
        copy = {**citation}
        copy["visual_pages"] = [
            page for page in citation.get("visual_pages", [])
            if page.get("page_number") in used_pages
        ]
        filtered.append(copy)
    return filtered

MODE_INSTRUCTIONS: dict[str, str] = {
    "custom": (
        "Answer the student's custom question directly and conversationally. Follow the student's requested format "
        "when possible, but use only the retrieved teacher-published material."
    ),
    "explain": "Explain the topic clearly, step by step, using simple language and a short example.",
    "visual_explain": (
        "Explain the requested concept through retrieved visual evidence. Guide the student through what to look at, "
        "what to notice, and how the visible relationship supports the concept. If no relevant visual page is "
        "available, say so and provide a concise material-grounded text explanation instead."
    ),
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
    "visual_quiz": (
        "Create a short quiz grounded in retrieved teacher material and visual evidence. Include at least one newly "
        "authored observation question that requires opening the cited page. Do not copy, solve, or reveal an exercise "
        "already printed in the source material."
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
    "lesson_content": (
        "You are an expert curriculum designer generating lesson introduction and explanation content for a teacher.\n"
        "Based on the topic and subject provided, generate:\n"
        "**Hook / Introduction** (2-3 sentences): A compelling opener that activates prior knowledge and sparks curiosity.\n"
        "**Key Concepts** (bullet points): 3-5 core ideas students must understand.\n"
        "**Step-by-Step Explanation**: Walk through the topic in 4-6 clear teaching steps a teacher can follow.\n"
        "**Quick Recap**: 2-3 bullet points summarising what was covered.\n"
        "Use clear, grade-appropriate language. Format with markdown headings."
    ),
    "hinge_question": (
        "You are a formative assessment expert. Generate 4 hinge questions for the given topic.\n"
        "A hinge question is a single diagnostic MCQ that reveals whether a student has grasped the core concept "
        "or holds a specific misconception.\n"
        "For each question:\n"
        "- Write the question stem\n"
        "- Provide 4 options (A–D) where each wrong option represents a REAL misconception\n"
        "- Mark the correct answer as 'Answer: <letter>'\n"
        "- Add one sentence: 'Diagnostic: <what wrong choices reveal about student thinking>'\n"
        "Format as a numbered list. Keep language age-appropriate."
    ),
    "class_performance_summary": (
        "You are an educational data analyst writing a teacher-facing class performance summary.\n"
        "Based on the data provided (attendance, exam scores, subject performance), write a concise professional report:\n"
        "**Overall Performance**: 1-2 sentences summarising class standing.\n"
        "**Strengths**: 2 specific subjects or skills where the class is performing well.\n"
        "**Areas of Concern**: 2-3 specific weaknesses needing attention, with brief reasoning.\n"
        "**Recommended Focus Areas**: 2-3 actionable teaching priorities for next week.\n"
        "**Students Needing Immediate Attention**: Mention any patterns (not individual names unless provided).\n"
        "Keep total under 200 words. Professional, data-driven tone."
    ),
    "parent_report": (
        "You are a school teacher writing a progress report for a parent/guardian.\n"
        "Based on the student data provided, write a warm, professional, and honest report:\n"
        "**Academic Progress**: How the student is performing across subjects (use provided scores).\n"
        "**Strengths**: 2 specific academic or behavioural strengths to highlight.\n"
        "**Areas for Growth**: 1-2 areas needing attention, framed constructively.\n"
        "**Home Support Tips**: 2 practical things the parent can do to support learning at home.\n"
        "**Encouragement**: End with a motivating sentence tailored to the student.\n"
        "Tone: warm, honest, parent-friendly. Avoid jargon. Keep under 180 words."
    ),
    "exit_ticket_grade": (
        "You are a teacher reviewing a student's exit ticket response.\n"
        "Based on the question asked and the student's response provided:\n"
        "1. **Understanding Level**: Rate as 'Got it', 'Partially got it', or 'Needs support' — with one sentence explanation.\n"
        "2. **What they understood correctly**: 1-2 specific points.\n"
        "3. **What they missed or misunderstood**: 1-2 specific gaps.\n"
        "4. **Next step for this student**: One concrete teaching recommendation.\n"
        "Keep total under 100 words. Be specific about the content, not generic."
    ),
    "idoweedo": (
        "You are an expert lesson designer using the I Do / We Do / You Do (Gradual Release) model.\n"
        "For the given topic and subject, generate a structured lesson flow with 4 phases:\n"
        "**HOOK** (5-10 min): Attention-grabbing opener to activate prior knowledge.\n"
        "**I DO** (10-15 min): Teacher modelling — describe what the teacher demonstrates and says aloud.\n"
        "**WE DO** (15-20 min): Guided practice — describe a collaborative activity teacher and students do together.\n"
        "**YOU DO** (15-20 min): Independent practice — describe what students do alone to demonstrate understanding.\n"
        "For each phase include: duration, teacher actions, student actions, and one example activity.\n"
        "Return as structured markdown with clear headings."
    ),
    "quiz_generate": (
        "You are an assessment expert generating quiz questions for a teacher.\n"
        "Generate exactly 5 multiple-choice questions on the given topic.\n"
        "Return ONLY valid JSON — no explanation, no markdown, no extra text.\n"
        "Format:\n"
        "[\n"
        "  {\n"
        '    "questionText": "...",\n'
        '    "options": [\n'
        '      {"text": "...", "isCorrect": false},\n'
        '      {"text": "...", "isCorrect": true},\n'
        '      {"text": "...", "isCorrect": false},\n'
        '      {"text": "...", "isCorrect": false}\n'
        "    ],\n"
        '    "explanation": "Brief explanation of correct answer",\n'
        '    "difficulty": "easy|medium|hard"\n'
        "  }\n"
        "]\n"
        "Ensure exactly one option per question has isCorrect: true. Vary difficulty across questions."
    ),
    "differentiated_plan": (
        "You are a differentiation expert. Generate content on the given topic at THREE levels:\n"
        "**FOUNDATION** (for students still developing understanding):\n"
        "- Simple vocabulary, visual cues, concrete examples\n"
        "- 3 basic recall questions with scaffolded sentence starters\n\n"
        "**STANDARD** (for students with developing understanding):\n"
        "- Grade-level vocabulary and concepts\n"
        "- 3 questions mixing recall and application\n\n"
        "**EXTENSION** (for students approaching mastery):\n"
        "- Challenge vocabulary and higher-order thinking\n"
        "- 3 analysis/synthesis questions requiring critical thinking\n\n"
        "For each level also include one short activity. Use clear markdown headings."
    ),
    "misconception_report": (
        "You are an educational analyst identifying student misconceptions from quiz/exam data.\n"
        "Based on the wrong answer patterns provided, generate a class misconception report:\n"
        "**Most Common Misconceptions** (top 3-5):\n"
        "- Topic: <topic name>\n"
        "- Misconception: <what students incorrectly believe>\n"
        "- Evidence: <percentage/count of students with this pattern>\n"
        "- Root Cause: <likely reason for this misconception>\n"
        "- Teaching Fix: <specific re-teaching strategy>\n\n"
        "**Priority Topics to Reteach**: List in order of urgency.\n"
        "Keep professional and data-driven. Under 250 words."
    ),
    "intervention_recommendation": (
        "You are an educational intervention specialist. Given a student's performance data "
        "(subject, average score, consistency, trend), generate specific, actionable intervention recommendations.\n"
        "Structure your response as:\n"
        "**Diagnosis**: One sentence on the core learning gap.\n"
        "**Priority Topics to Revisit** (3-5 bullet points): Specific topics within the subject that need re-teaching, "
        "based on the performance level. Be concrete — name actual topics, not generic advice.\n"
        "**Recommended Intervention Activities** (3 activities): Specific activities the teacher can assign this week "
        "(e.g. 'Practice 10 fraction word problems at Foundation level', 'Watch explanation video on photosynthesis stages').\n"
        "**Suggested Approach**: One teaching strategy suited to this student's pattern (e.g. spaced repetition, peer tutoring, visual aids).\n"
        "Keep under 200 words. Be specific and actionable — no generic advice."
    ),
    "curriculum_alignment": (
        "You are a curriculum alignment specialist. Given a lesson plan or teaching content and the curriculum standard/objective provided, "
        "assess how well the content aligns with the standard.\n"
        "Structure your response as:\n"
        "**Alignment Score**: X/10 — one sentence rationale.\n"
        "**Well Aligned Elements** (bullet points): Specific parts of the content that directly address the curriculum standard.\n"
        "**Gaps Identified** (bullet points): Learning objectives in the standard that are missing or insufficiently covered.\n"
        "**Recommendations to Strengthen Alignment** (3 concrete suggestions): Specific additions or modifications.\n"
        "**Bloom's Taxonomy Level**: Identify the cognitive level of the content (Remember/Understand/Apply/Analyse/Evaluate/Create) "
        "and whether it matches the curriculum expectation.\n"
        "Keep professional and specific. Under 250 words."
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
    "worksheet": (
        "You are an expert teacher creating a printable classroom worksheet on the given topic.\n"
        "Generate a complete worksheet with the following sections:\n"
        "**Section A — Fill in the Blanks** (5 questions): Sentences with one key word missing. "
        "Write the word bank at the top of this section.\n"
        "**Section B — Short Answer** (4 questions): Questions requiring 1-3 sentence answers.\n"
        "**Section C — Match the Column** (5 pairs): Left column of terms, right column of definitions in shuffled order.\n"
        "**Section D — True or False** (4 statements): Mix of correct and incorrect statements.\n"
        "**Bonus Challenge** (1 question): A higher-order thinking question requiring the student to apply or evaluate.\n"
        "Format clearly with section headers. Use grade-appropriate vocabulary. "
        "Do NOT include answers — this is a student-facing worksheet."
    ),
    "progress_summary": (
        "You are a teacher writing a concise academic progress summary for a student's record.\n"
        "Based on the student data provided (subjects, scores, trends, intervention level), write:\n"
        "**Academic Standing**: 1-2 sentences summarising overall performance and grade level.\n"
        "**Subject Highlights**: For each subject provided, one bullet noting the score, trend, and a specific observation.\n"
        "**Key Strengths**: 2 specific academic strengths with evidence from the data.\n"
        "**Areas Needing Support**: 1-2 subjects or skills requiring attention, with brief reasoning.\n"
        "**Recommended Next Steps**: 2-3 concrete, actionable steps the teacher should take.\n"
        "**Risk Flag**: If any metric indicates at-risk status (score < 50, declining trend, high intervention level), "
        "flag it in bold at the top.\n"
        "Tone: professional, data-driven, teacher-facing. Keep under 220 words."
    ),
    "home_support": (
        "You are a warm, supportive school counselor writing home support tips for a parent.\n"
        "Given the student's weak academic areas (subject, topic, score), generate 4-6 practical, "
        "actionable tips parents can use at home — no specialist knowledge required.\n"
        "Format each tip group as:\n"
        "SUBJECT — Topic\n"
        "• Specific tip 1\n"
        "• Specific tip 2\n\n"
        "Keep tips encouraging, concrete, and achievable. End with one general motivational sentence for the parent."
    ),
    "progress_digest": (
        "You are a friendly school assistant writing a weekly progress digest for a parent.\n"
        "Based on the student's recent exam results, mastery updates, and attendance, write a brief, "
        "warm weekly summary a parent can read in 30 seconds.\n"
        "Structure exactly as:\n"
        "Weekly Highlights: (2-3 bullet points about what happened this week)\n"
        "Academic Standing: (one sentence per subject covered)\n"
        "Something to Celebrate: (one specific positive)\n"
        "Focus Area This Week: (one thing the student should work on)\n"
        "Keep under 180 words. Tone: warm, encouraging, parent-friendly."
    ),
    "monthly_report": (
        "You are a school's AI academic advisor generating a monthly progress report for parents.\n"
        "Based on exam trends, mastery scores, attendance, and teacher remarks, write a structured report.\n"
        "Use these sections:\n"
        "## Monthly Overview\n"
        "## Subject Performance\n"
        "## Attendance Summary\n"
        "## Strengths\n"
        "## Areas Needing Support\n"
        "## Recommended Home Activities\n"
        "## Teacher's Note\n"
        "Tone: professional but warm. Be specific, data-backed, and encouraging. Keep under 350 words."
    ),
    "intervention_plan": (
        "You are an experienced educational intervention coordinator. Based on the flagged student data, "
        "re-teach lessons, and low-mastery subjects provided, generate a structured class-wide intervention plan.\n"
        "Structure your response as:\n"
        "## Priority Intervention Areas\n"
        "List the top 3 subjects/topics that need immediate attention based on the data, with brief reasoning.\n\n"
        "## Student Grouping Strategy\n"
        "Recommend how to group students (e.g. 3 tiers: foundation, core, extension) with a one-line rationale.\n\n"
        "## Week-by-Week Action Plan (2 weeks)\n"
        "For each week: 2-3 specific teaching activities or strategies to address the flagged gaps.\n\n"
        "## Re-teaching Priorities\n"
        "For each flagged lesson, name one specific re-teaching technique (e.g. worked examples, peer teaching, visual models).\n\n"
        "## Quick Wins\n"
        "2-3 actions the teacher can take this week to immediately support the most at-risk students.\n\n"
        "Be concrete and actionable. Keep under 350 words. Professional, teacher-facing tone."
    ),
    "rubric_generate": (
        "You are an expert assessment designer. Based on the subject and task provided, generate a complete assessment rubric.\n"
        "Return ONLY valid JSON — no explanation, no markdown fences, no extra text.\n"
        "Format:\n"
        "{\n"
        '  "title": "Rubric title",\n'
        '  "description": "What this rubric evaluates",\n'
        '  "criteria": [\n'
        "    {\n"
        '      "name": "Criterion name",\n'
        '      "description": "What this criterion measures",\n'
        '      "maxScore": 4,\n'
        '      "levels": [\n'
        '        {"label": "Excellent", "score": 4, "descriptor": "Specific description of excellent performance"},\n'
        '        {"label": "Good", "score": 3, "descriptor": "Specific description of good performance"},\n'
        '        {"label": "Developing", "score": 2, "descriptor": "Specific description of developing performance"},\n'
        '        {"label": "Beginning", "score": 1, "descriptor": "Specific description of beginning performance"}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Include 4-5 criteria relevant to the subject and task. Make descriptors specific and measurable."
    ),
    "rubric_grade": (
        "You are an expert teacher grading a student assignment using the supplied rubric.\n"
        "Score EACH criterion separately based on the student's submission.\n"
        "Return ONLY valid JSON in this exact shape (no markdown fences, no extra text):\n"
        "{\n"
        '  "criteria": [\n'
        '    {"name": "<criterion name>", "score": <integer>, "maxScore": <integer>, "comment": "<1-2 sentence specific comment>"}\n'
        "  ],\n"
        '  "totalScore": <integer>,\n'
        '  "maxTotalScore": <integer>,\n'
        '  "overallFeedback": "<2-3 sentence overall feedback to the student — what they did well and what to improve>",\n'
        '  "strengths": ["<specific strength>"],\n'
        '  "improvements": ["<specific improvement area>"]\n'
        "}\n"
        "Be specific and reference the student's actual submission text in comments. "
        "Do not award full marks unless the criterion is fully met."
    ),
}

_VISUAL_DEPTH_INSTRUCTIONS = {
    "simple": (
        "Keep the explanation compact and child-friendly: one core idea, a Look–Notice–Connect walkthrough, "
        "one grounded example, and one quick self-check question."
    ),
    "detailed": (
        "Give a thorough explanation with these sections: Core idea; Visual walkthrough (Look, Notice, Connect); "
        "Verified labels and relationships; Step-by-step reasoning; two grounded examples; common misconception; "
        "and two unsolved self-check questions. Define every mathematical term and symbol used."
    ),
    "deep": (
        "Give an in-depth lesson with these sections: Learning objective; prerequisite idea; Core idea; detailed "
        "Visual walkthrough; Verified labels and relationships; derivation or reasoning; three progressively harder "
        "grounded examples; comparison table; common misconceptions; real-world connection supported by the material; "
        "summary; and three unsolved self-check questions. Clearly distinguish facts visible in the diagram from "
        "deductions. Examples must use only quantities and situations explicitly supported by retrieved material or "
        "the verified generated visual; do not invent extension calculations merely to make examples harder."
    ),
}

_LEARNING_GOAL_INSTRUCTIONS = {
    "understand": "Prioritise intuition and explain why each visible relationship works.",
    "revision": "Prioritise precise definitions, key facts, memory cues, and a compact exam-ready recap.",
    "practice": "Prioritise guided application and finish with unsolved, newly authored practice prompts.",
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
            academic_year_id=req.academicYearId,
            subject_id=req.subjectId,
            subject=req.subject,
            chapter_title=req.chapterTitle,
            topic=req.topic,
            sub_topic=req.subTopic,
            question=req.question,
        )
    return _retrieve_in_memory(req)


def retrieve_relevant_chunks_with_citations(req: TutorGenerateRequest) -> tuple[list[str], list[dict]]:
    """Return (text_chunks, citations) where each citation has source_name and material_id."""
    if req.schoolId:
        from app.modules.retrieval.service import retrieve_from_qdrant_with_meta
        return retrieve_from_qdrant_with_meta(
            school_id=req.schoolId,
            class_id=req.classId,
            section_id=req.sectionId,
            academic_year_id=req.academicYearId,
            subject_id=req.subjectId,
            subject=req.subject,
            chapter_title=req.chapterTitle,
            topic=req.topic,
            sub_topic=req.subTopic,
            question=req.question,
        )
    return _retrieve_in_memory(req), []


def _quiz_instruction_for_type(question_type: str, default: str, count: int | None = None) -> str:
    type_labels = {
        "mcq": "Write multiple-choice questions with 4 options labeled A-D and the correct answer marked as 'Answer: <letter>'.",
        "cloze_dropdown": (
            "Write fill-in-the-blank questions with one blank per item. "
            "Provide a dropdown list of answer choices for each blank and mark the correct dropdown option."
        ),
        "cloze_text": (
            "Write fill-in-the-blank questions with one blank per item. "
            "Expect the student to type the missing word or phrase as their answer."
        ),
        "cloze_drag_drop": (
            "Write drag-and-drop style fill-in-the-blank questions where the student matches terms to blanks. "
            "List the blanks and draggable options clearly."
        ),
        "choice_matrix": (
            "Write matrix questions with multiple statements and answer columns such as True/False or Yes/No. "
            "Label each row and column clearly."
        ),
        "match_list": (
            "Write matching questions where students pair items from one list to another. "
            "Provide both lists and indicate correct pairings."
        ),
        "sort_list": (
            "Write ordering questions where students sort items into the correct sequence. "
            "Provide the list of items and make clear the correct order."
        ),
        "plain_text": (
            "Write short-answer questions that require a text response. "
            "Do not provide multiple-choice options."
        ),
        "rich_text": (
            "Write a student-facing response question that asks for a detailed written explanation. "
            "The student should answer in full sentences."
        ),
        "file_upload": (
            "Write a task that asks the student to upload a file as the answer, such as a drawing or document."
        ),
        "image_highlighter": (
            "Write an image-based task that asks the student to identify or highlight a part of an image."
        ),
    }
    detail = type_labels.get(question_type)
    if not detail:
        return default

    count_prefix = f"Write exactly {count} " if count else "Write a set of "
    return (
        f"{count_prefix}{question_type.replace('_', ' ')} questions. {detail} "
        "Base every question and answer option solely on student-facing course material. "
        "Do not solve or answer any exercise from the source material."
    )


def build_prompt(
    req: TutorGenerateRequest,
    context: str,
    verification_context: str | None = None,
    generated_visuals: list[dict] | None = None,
) -> tuple[str, str]:
    instruction = MODE_INSTRUCTIONS.get(req.mode)
    if not instruction:
        raise HTTPException(status_code=400, detail=f"Unsupported mode: {req.mode}")

    if req.mode == "visual_explain":
        depth = (req.responseDepth or "detailed").strip().lower()
        goal = (req.learningGoal or "understand").strip().lower()
        instruction = " ".join(filter(None, [
            instruction,
            _VISUAL_DEPTH_INSTRUCTIONS.get(depth, _VISUAL_DEPTH_INSTRUCTIONS["detailed"]),
            _LEARNING_GOAL_INSTRUCTIONS.get(goal, _LEARNING_GOAL_INSTRUCTIONS["understand"]),
        ]))

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

    # Inject student learning profile into system prompt for personalised responses.
    # This is placed after the base rules so the LLM applies it as a behavioural lens.
    if req.studentContext:
        base_system = (
            base_system
            + f"\n\n{req.studentContext}\n\n"
            "PERSONALISATION RULE: Use the student profile above to calibrate your response. "
            "Match complexity, vocabulary, and depth to the student's current TIER. "
            "Do not mention the profile or scores to the student — just let it shape how you explain."
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

    discipline = detect_discipline(req.subject, req.discipline)
    stem_instruction = STEM_INSTRUCTIONS.get(discipline)
    if stem_instruction:
        system = f"{system} STEM RESPONSE RULES ({discipline}): {stem_instruction}"

    visual_instruction = _visual_grounding_instruction(context, req.mode)
    if visual_instruction:
        system = f"{system} {visual_instruction}"
    generated_visual_context = visual_prompt_context(generated_visuals or [])
    if generated_visual_context:
        system = (
            f"{system} GENERATED ON-SCREEN VISUAL RULE: A safe code-rendered diagram will be shown below your answer. "
            "Do not say that no visual is available. Describe how the student should use the rendered diagram, and do "
            "not contradict its verified labels."
        )

    # For quiz mode, override the default MCQ instruction when a specific question type is requested.
    if req.mode in {"quiz", "visual_quiz"} and req.questionType:
        instruction = _quiz_instruction_for_type(req.questionType, instruction, None)

    # For quiz mode, prepend difficulty level to instruction when provided.
    if req.mode in {"quiz", "visual_quiz"} and req.difficulty:
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
    if req.question and req.mode not in {"homework_help", "misconception"}:
        parts.append(f"Extra instructions:\n{req.question.strip()}")
    if verification_context and req.mode != "homework_help":
        parts.append(
            "Deterministic verification context (use only to check arithmetic; it does not expand the "
            f"retrieved curriculum scope):\n{verification_context}"
        )
    if visual_instruction:
        parts.append(
            "FINAL VISUAL RESPONSE CONSTRAINT — apply this after reading the material and the student's request:\n"
            f"{visual_instruction}"
        )
    if generated_visual_context:
        parts.append(f"Generated on-screen visual specification:\n{generated_visual_context}")
    return system, "\n\n".join(parts)


def generate_tutor_response(req: TutorGenerateRequest) -> dict:
    """Full RAG pipeline for student tutor requests.

    Owns: retrieval → sanitization → prompt building → LLM invocation → response shaping.
    The router endpoint delegates entirely to this function.
    """
    chunks, citations = retrieve_relevant_chunks_with_citations(req)
    if not chunks:
        return {
            "mode": req.mode,
            "model": None,
            "content": NOT_FOUND_MESSAGE,
            "groundedInMaterial": False,
            "noMaterialFound": True,
            "citations": [],
        }

    full_visual_context = _strip_injection_attempts(_strip_teacher_notes("\n\n".join(chunks)))
    raw_context = _strip_teacher_notes(_focused_visual_context(req, chunks))
    context = _strip_injection_attempts(raw_context)
    visuals = build_tutor_visuals(req, full_visual_context)
    citations = _citations_used_in_context(citations, context)

    verification_context = verify_stem_question(req.question) if req.mode != "homework_help" else None
    system, user_prompt = build_prompt(req, context, verification_context, visuals)
    system = _SAFETY_PREFIX + system

    messages: list = [SystemMessage(content=system)]
    if req.conversationHistory:
        for turn in req.conversationHistory:
            if turn.role == "assistant":
                messages.append(AIMessage(content=turn.text))
            else:
                messages.append(HumanMessage(content=turn.text))
    messages.append(HumanMessage(content=user_prompt))

    chain = create_chain(mode=req.mode)
    try:
        content = chain.invoke(messages)
        if req.mode in {"explain", "visual_explain"} and _visual_explanation_reveals_exercise_answer(context, content):
            revision = HumanMessage(content=(
                "Rewrite the draft as a concise Look–Notice–Connect visual explanation. The draft revealed answers "
                "to a printed student exercise. Remove every calculated distance, rounded result, selected endpoint, "
                "and filled blank. Preserve only the general method and exact visible labels. Refer to the source as "
                "'page N'. Return only the corrected explanation."
            ))
            content = chain.invoke(messages + [AIMessage(content=content), revision])
            if _visual_explanation_reveals_exercise_answer(context, content):
                content = _safe_visual_explanation(req, context)
        elif req.mode in {"quiz", "visual_quiz"} and _visual_quiz_reuses_source_exercise(context, content):
            revision = HumanMessage(content=(
                "Rewrite the quiz because the draft copied and answered exercises printed on the cited page. Remove "
                "every question that asks for a rounded result, filled blank, calculated distance, or completed table "
                "from the source page. Keep other grounded questions. Include one newly authored item labelled "
                "'Visual question — use page N' that asks only about visible labels, objects, or layout and requires "
                "opening the cited page. Return only the corrected quiz."
            ))
            content = chain.invoke(messages + [AIMessage(content=content), revision])
            if _visual_quiz_reuses_source_exercise(context, content):
                content = _safe_visual_question(context)
        precision_issues = _generated_visual_precision_issues(visuals, full_visual_context, content)
        if precision_issues:
            content = chain.invoke(messages + [AIMessage(content=content), HumanMessage(content=(
                "Correct the draft while preserving its useful structure and level of detail. Remove these precision "
                f"violations: {'; '.join(precision_issues)}. Use only degree values and relationships explicitly present "
                "in the retrieved material or generated visual specification. Leave all self-check and practice "
                "questions unsolved. Return only the corrected lesson."
            ))])
            remaining_issues = _generated_visual_precision_issues(visuals, full_visual_context, content)
            fraction_visual = next((visual for visual in visuals if visual.get("type") == "fraction_wholes"), None)
            if remaining_issues and fraction_visual:
                content = _safe_fraction_visual_explanation(fraction_visual)
        balance_visual = next((visual for visual in visuals if visual.get("type") == "balance_swaps"), None)
        if balance_visual:
            content = _safe_balance_visual_explanation(balance_visual)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc

    return {
        "mode": req.mode,
        "model": active_model_name(),
        "content": content,
        "groundedInMaterial": True,
        "noMaterialFound": False,
        "citations": citations,
        "visuals": visuals,
    }
