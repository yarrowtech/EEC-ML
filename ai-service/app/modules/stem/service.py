# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

"""Deterministic STEM metadata extraction and retrieval helpers.

The functions in this module never replace the source text. They create compact
search metadata that improves retrieval of notation-heavy curriculum material.
"""

from __future__ import annotations

import re
from collections import Counter


_DISCIPLINE_ALIASES = {
    "mathematics": ("math", "mathematics", "algebra", "geometry", "calculus", "statistics"),
    "physics": ("physics", "physical science"),
    "chemistry": ("chemistry", "chemical science"),
    "biology": ("biology", "life science", "botany", "zoology"),
    "engineering": ("engineering", "robotics", "electronics", "mechanical", "civil"),
    "technology": ("technology", "computer science", "computing", "information technology", "coding"),
}

_STOPWORDS = {
    "about", "after", "again", "also", "because", "before", "being", "between", "chapter",
    "could", "does", "each", "from", "have", "into", "material", "more", "other", "should",
    "student", "students", "subject", "teacher", "than", "that", "their", "there", "these",
    "they", "this", "those", "through", "topic", "using", "what", "when", "where", "which",
    "with", "would", "your",
}

_FORMULA_LINE = re.compile(r"[^\n]{0,100}(?:=|≤|≥|≈|→|⇌|∑|√|∆|Δ|∫|×|÷)[^\n]{0,100}")
_CHEMICAL_FORMULA = re.compile(r"\b(?:[A-Z][a-z]?[₀-₉0-9]{0,3}){2,}(?:[⁺⁻+-]|\^?[0-9]*[+-])?\b")
_UNIT_TOKEN = re.compile(
    r"(?<![A-Za-z])(?:m/s(?:²|\^2|2)?|km/h|kg/m(?:³|\^3|3)|g/cm(?:³|\^3|3)|mol/L|"
    r"°[CF]|kg|mg|km|cm|mm|μm|nm|ms|mol|mL|Pa|Hz|m|g|s|h|K|A|V|W|J|N|C|Ω|L)(?![A-Za-z])"
)
_WORD = re.compile(r"\b[A-Za-z][A-Za-z-]{3,}\b")
_STEM_QUERY_TOKEN = re.compile(
    r"(?:[A-Za-z]+[₀-₉0-9]+|[A-Za-z0-9]+(?:\^|²|³)[A-Za-z0-9+-]*|"
    r"\d+(?:\.\d+)?(?:×10(?:\^|⁻)?\d+)?|[A-Za-z]+/[A-Za-z]+(?:²|³|\^\d+)?)"
)
_EQUATION_TOKEN = re.compile(
    r"(?:[A-Za-z][A-Za-z0-9]*(?:\s*[+\-*/]\s*[A-Za-z0-9.]+)*\s*"
    r"(?:=|≤|≥|≈|→|⇌)\s*[A-Za-z0-9.]+(?:\s*[+\-*/]\s*[A-Za-z0-9.]+)*)"
)


def normalize_list(values: list[str] | None, *, limit: int = 24) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values or []:
        normalized = " ".join(str(value or "").split()).strip()
        key = normalized.casefold()
        if not normalized or key in seen:
            continue
        seen.add(key)
        result.append(normalized)
        if len(result) >= limit:
            break
    return result


def detect_discipline(subject_name: str | None, explicit: str | None = None) -> str:
    if explicit and str(explicit).strip():
        return str(explicit).strip().lower()
    normalized = " ".join((subject_name or "").lower().replace("_", " ").split())
    for discipline, aliases in _DISCIPLINE_ALIASES.items():
        if any(alias in normalized for alias in aliases):
            return discipline
    if normalized in {"science", "general science", "stem"}:
        return "science"
    return "general"


def extract_formulas(text: str, *, limit: int = 20) -> list[str]:
    candidates: list[str] = []
    for match in _FORMULA_LINE.finditer(text or ""):
        value = " ".join(match.group(0).split()).strip(" .,:;")
        if 3 <= len(value) <= 180:
            candidates.append(value)
    candidates.extend(match.group(0) for match in _CHEMICAL_FORMULA.finditer(text or ""))
    return normalize_list(candidates, limit=limit)


def extract_units(text: str, *, limit: int = 20) -> list[str]:
    return normalize_list([match.group(0) for match in _UNIT_TOKEN.finditer(text or "")], limit=limit)


def extract_concepts(text: str, hints: list[str] | None = None, *, limit: int = 18) -> list[str]:
    hinted = normalize_list(hints, limit=6)
    words = [word.lower() for word in _WORD.findall(text or "")]
    counts = Counter(word for word in words if word not in _STOPWORDS)
    frequent = [word for word, count in counts.most_common(limit * 2) if count >= 2]
    return normalize_list([*hinted, *frequent], limit=limit)


def build_stem_metadata(
    text: str,
    *,
    subject_name: str = "",
    discipline: str = "",
    chapter_title: str = "",
    topic_title: str = "",
    concepts: list[str] | None = None,
    formulas: list[str] | None = None,
    units: list[str] | None = None,
) -> dict[str, str | list[str]]:
    resolved_discipline = detect_discipline(subject_name, discipline)
    return {
        "discipline": resolved_discipline,
        "concepts": normalize_list([
            *(concepts or []),
            *extract_concepts(text, [chapter_title, topic_title]),
        ]),
        "formulas": normalize_list([*(formulas or []), *extract_formulas(text)]),
        "units": normalize_list([*(units or []), *extract_units(text)]),
    }


def build_embedding_text(
    chunk: str,
    *,
    subject_name: str,
    discipline: str,
    chapter_title: str,
    topic_title: str,
    concepts: list[str],
    formulas: list[str],
    units: list[str],
) -> str:
    fields = [
        f"Subject: {subject_name}" if subject_name else "",
        f"Discipline: {discipline}" if discipline and discipline != "general" else "",
        f"Chapter: {chapter_title}" if chapter_title else "",
        f"Topic: {topic_title}" if topic_title else "",
        f"Concepts: {', '.join(concepts)}" if concepts else "",
        f"Formulas: {'; '.join(formulas)}" if formulas else "",
        f"Units: {', '.join(units)}" if units else "",
    ]
    header = "\n".join(field for field in fields if field)
    return f"{header}\n\n{chunk}" if header else chunk


def stem_query_tokens(text: str | None) -> set[str]:
    source = text or ""
    tokens = {match.group(0).casefold() for match in _STEM_QUERY_TOKEN.finditer(source)}
    tokens.update(item.casefold() for item in extract_units(source))
    tokens.update(item.casefold() for item in _CHEMICAL_FORMULA.findall(source))
    tokens.update("".join(item.split()).casefold() for item in _EQUATION_TOKEN.findall(source))
    return {token for token in tokens if len(token) >= 2}


def rerank_stem_hits(query: str, hits: list[dict]) -> list[dict]:
    query_tokens = stem_query_tokens(query)
    reranked: list[dict] = []
    for hit in hits:
        searchable = " ".join([
            str(hit.get("text", "")),
            " ".join(hit.get("formulas", []) or []),
            " ".join(hit.get("units", []) or []),
            " ".join(hit.get("concepts", []) or []),
        ]).casefold()
        compact_searchable = "".join(searchable.split())
        overlap = sum(
            1 for token in query_tokens
            if token in searchable or "".join(token.split()) in compact_searchable
        )
        lexical_bonus = min(0.12, overlap * 0.06)
        dense_score = float(hit.get("score", 0) or 0)
        reranked.append({
            **hit,
            "dense_score": dense_score,
            "exact_stem_matches": overlap,
            "score": min(1.0, dense_score + lexical_bonus),
        })
    return sorted(reranked, key=lambda item: (item["score"], item["dense_score"]), reverse=True)
