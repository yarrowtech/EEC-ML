"""Server-side Mermaid diagram validation and repair.

The tutor LLM emits Mermaid syntax as plain text inside a ```mermaid fence; the
frontend renders it with mermaid.js. Small local models routinely produce subtly
invalid syntax — unbalanced brackets, a reserved word used as a node id, unescaped
punctuation inside a label — which renders as an empty/broken diagram for the
student, with no server-side trace of why.

These helpers catch the common, cheap-to-detect failures before the response
leaves the service, so a single repair pass (or a clean text-only fallback) can
run. They intentionally do NOT try to be a full Mermaid parser — just enough to
distinguish "will almost certainly render" from "will almost certainly not", plus
one structural check: a flowchart that renders fine syntactically but is really a
pile of disconnected node-pairs is a useless diagram for a student, so it is
treated as invalid and sent back for a repair.
"""

from __future__ import annotations

import re

_MERMAID_BLOCK_RE = re.compile(r"```mermaid[ \t]*\r?\n(.*?)```", re.DOTALL | re.IGNORECASE)

# Lower-cased prefixes Mermaid accepts as the first token of a diagram.
_VALID_HEADERS = (
    "flowchart", "graph", "sequencediagram", "classdiagram", "statediagram",
    "statediagram-v2", "erdiagram", "journey", "gantt", "pie", "mindmap",
    "timeline", "quadrantchart", "gitgraph", "requirementdiagram", "c4context",
    "sankey-beta", "xychart-beta", "block-beta",
)

_OPEN_TO_CLOSE = {"[": "]", "(": ")", "{": "}"}
_CLOSE_TO_OPEN = {v: k for k, v in _OPEN_TO_CLOSE.items()}

# --- flowchart connectivity (best-effort structural check) --------------------
_LABEL_STRIP_RE = re.compile(r'"[^"]*"|\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\|[^|]*\|')
_ARROW_RE = re.compile(r"<?[-.=]{2,}[->xo]?|-{1,2}[xo]")
_IDENT_RE = re.compile(r"[A-Za-z0-9_]+")
_CONN_SKIP_PREFIXES = (
    "subgraph", "end", "direction", "classdef", "class ", "style ",
    "linkstyle", "%%", "click", "acctitle", "accdescr",
)


def _flowchart_fragmentation(code: str) -> tuple[int, int]:
    """(node_count, connected_component_count) for a flowchart/graph body.

    Best-effort: strips label text, treats any line with an arrow as connecting all
    identifiers on it, and union-finds the result. Good enough to tell "one coherent
    diagram" from "N disconnected pairs".
    """
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root

    def union(a: str, b: str) -> None:
        parent[find(a)] = find(b)

    nodes: set[str] = set()
    for raw in code.splitlines()[1:]:  # skip the header line
        line = raw.strip()
        if not line or line.lower().startswith(_CONN_SKIP_PREFIXES):
            continue
        stripped = _LABEL_STRIP_RE.sub(" ", line)
        idents = [i for i in _IDENT_RE.findall(stripped) if i.lower() != "end"]
        if not idents:
            continue
        if _ARROW_RE.search(stripped):
            for ident in idents:
                nodes.add(ident)
                find(ident)
            for a, b in zip(idents, idents[1:]):
                union(a, b)
        else:
            nodes.add(idents[0])
            find(idents[0])

    if not nodes:
        return (0, 0)
    return (len(nodes), len({find(n) for n in nodes}))


def extract_mermaid_block(text: str) -> str | None:
    """Return the contents of the first ```mermaid fence, or None if there isn't one."""
    match = _MERMAID_BLOCK_RE.search(text or "")
    if not match:
        return None
    return match.group(1).strip() or None


def validate_mermaid(code: str) -> str | None:
    """Return a short human-readable reason if *code* looks un-renderable, else None."""
    if not code or not code.strip():
        return "empty diagram"

    lines = [ln for ln in code.splitlines() if ln.strip()]
    header = lines[0].strip().lower()
    if not header.startswith(_VALID_HEADERS):
        return f"first line is not a Mermaid diagram declaration: {lines[0].strip()!r}"

    # Bracket / paren / brace balance across the whole block, ignoring quoted text.
    stack: list[str] = []
    in_quote = False
    for char in code:
        if char == '"':
            in_quote = not in_quote
            continue
        if in_quote:
            continue
        if char in _OPEN_TO_CLOSE:
            stack.append(char)
        elif char in _CLOSE_TO_OPEN:
            if not stack or stack.pop() != _CLOSE_TO_OPEN[char]:
                return f"unbalanced '{char}'"
    if in_quote:
        return "unbalanced double-quote"
    if stack:
        return f"unclosed '{stack[-1]}'"

    # Structural: a flowchart that fragments into many disconnected pieces is not a
    # diagram a student can follow, even though it renders.
    if header.startswith(("flowchart", "graph")):
        node_count, components = _flowchart_fragmentation(code)
        if node_count >= 6 and components >= 3:
            return (
                f"diagram is fragmented into {components} disconnected pieces — "
                "it must be ONE connected flow"
            )

    return None


_DIAGRAM_FENCE_RE = re.compile(
    r"DIAGRAM:\s*```mermaid[ \t]*\r?\n.*?```",
    re.DOTALL | re.IGNORECASE,
)


def replace_diagram_with_none(text: str) -> str:
    """Swap a visual_explain ``DIAGRAM: ```mermaid ...``` `` block for ``DIAGRAM: none``.

    The frontend treats ``DIAGRAM: none`` as "render the explanation only" — a clean
    degradation when a diagram cannot be made renderable.
    """
    return _DIAGRAM_FENCE_RE.sub("DIAGRAM: none", text, count=1)


_FENCE_RE = re.compile(r"\r?\n*```mermaid[ \t]*\r?\n.*?```[ \t]*\r?\n*", re.DOTALL | re.IGNORECASE)


def strip_mermaid_block(text: str) -> str:
    """Remove the first ```mermaid fence entirely — for a free-text answer whose
    diagram could not be made valid, a clean text answer beats a broken diagram."""
    return _FENCE_RE.sub("\n\n", text, count=1).strip()
