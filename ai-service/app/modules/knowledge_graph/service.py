"""Deterministic knowledge-graph traversal.

The Node backend owns the graph data (CurriculumMap) and the mastery data
(MasteryScore); it passes both to this module, which does the pure graph work:
topological ordering, cycle detection, gap + root-cause analysis, and building a
prerequisite "bridge path" from a student's weakest gap up to a target topic.
"""

from __future__ import annotations

from collections import deque

from app.modules.knowledge_graph.schemas import (
    BridgeStep,
    GapTopic,
    GraphAnalyzeRequest,
    GraphAnalyzeResult,
    GraphTopic,
    RootCause,
)


def _norm(value: str) -> str:
    return " ".join(str(value or "").lower().split())


def _index(topics: list[GraphTopic]) -> dict[str, GraphTopic]:
    return {_norm(t.title): t for t in topics}


def _edges(topic: GraphTopic, by_title: dict[str, GraphTopic], ordered: list[GraphTopic]) -> list[GraphTopic]:
    """Prerequisites for a topic — explicit edges when present, otherwise every
    earlier topic in curriculum order (edge-less legacy maps)."""
    explicit = [by_title[_norm(p)] for p in topic.prerequisites if _norm(p) in by_title]
    if explicit:
        return explicit
    return [t for t in ordered if t.order < topic.order]


def topological_order(topics: list[GraphTopic]) -> tuple[list[str], list[list[str]]]:
    """Kahn's algorithm over explicit prerequisite edges. Returns (order, cycles).

    Topics with no explicit edges fall back to their numeric `order`.
    """
    by_title = _index(topics)
    has_explicit = any(t.prerequisites for t in topics)
    if not has_explicit:
        return [t.title for t in sorted(topics, key=lambda t: t.order)], []

    indeg: dict[str, int] = {_norm(t.title): 0 for t in topics}
    adj: dict[str, list[str]] = {_norm(t.title): [] for t in topics}
    for t in topics:
        for pre in t.prerequisites:
            p = _norm(pre)
            if p in by_title:
                adj[p].append(_norm(t.title))
                indeg[_norm(t.title)] += 1

    queue = deque(sorted((n for n, d in indeg.items() if d == 0),
                         key=lambda n: by_title[n].order))
    out: list[str] = []
    while queue:
        n = queue.popleft()
        out.append(by_title[n].title)
        for m in adj[n]:
            indeg[m] -= 1
            if indeg[m] == 0:
                queue.append(m)

    if len(out) < len(topics):
        remaining = [by_title[n].title for n, d in indeg.items() if d > 0]
        return out, [remaining]
    return out, []


def find_gaps(req: GraphAnalyzeRequest) -> list[GapTopic]:
    mastery = {_norm(k): v for k, v in req.mastery.items()}
    gaps: list[GapTopic] = []
    for t in sorted(req.topics, key=lambda t: t.order):
        score = mastery.get(_norm(t.title))
        if score is None or score < req.gap_threshold:
            gaps.append(GapTopic(topic_title=t.title, order=t.order, mastery_score=score))
    return gaps


def find_root_causes(req: GraphAnalyzeRequest) -> list[RootCause]:
    """For every weak topic, BFS back through prerequisites; the deepest
    unmastered prerequisite on that path is the root cause."""
    mastery = {_norm(k): v for k, v in req.mastery.items()}
    ordered = sorted(req.topics, key=lambda t: t.order)
    by_title = _index(req.topics)

    def weak(t: GraphTopic) -> bool:
        s = mastery.get(_norm(t.title))
        return s is None or s < req.gap_threshold

    weak_topics = [t for t in ordered if weak(t)]
    causes: dict[str, RootCause] = {}

    for start in weak_topics:
        seen: set[str] = {_norm(start.title)}
        frontier: deque[tuple[GraphTopic, int]] = deque((p, 1) for p in _edges(start, by_title, ordered))
        while frontier:
            node, depth = frontier.popleft()
            key = _norm(node.title)
            if key in seen:
                continue
            seen.add(key)
            parents = _edges(node, by_title, ordered)
            unmastered_parent = any(weak(p) for p in parents)
            if weak(node) and not unmastered_parent:
                existing = causes.get(key)
                blocked = sorted({w.title for w in weak_topics if w.order > node.order})
                if existing is None or depth > existing.depth:
                    causes[key] = RootCause(
                        topic_title=node.title,
                        order=node.order,
                        mastery_score=mastery.get(key),
                        depth=depth,
                        blocked_topics=blocked,
                    )
            for p in parents:
                frontier.append((p, depth + 1))

    return sorted(causes.values(), key=lambda c: c.order)


def bridge_path(req: GraphAnalyzeRequest) -> tuple[str, list[BridgeStep]]:
    """Ordered prerequisite chain from the student's gaps up to target_topic."""
    if not req.target_topic:
        return "ok", []
    by_title = _index(req.topics)
    ordered = sorted(req.topics, key=lambda t: t.order)
    mastery = {_norm(k): v for k, v in req.mastery.items()}

    target = by_title.get(_norm(req.target_topic))
    if target is None:
        target = next((t for t in ordered if _norm(req.target_topic) in _norm(t.title)), None)
    if target is None:
        return "target_not_found", []

    # Transitive prerequisites, de-duped, in curriculum order.
    chain: list[GraphTopic] = []
    seen: set[str] = set()

    def visit(topic: GraphTopic) -> None:
        if _norm(topic.title) in seen:
            return
        seen.add(_norm(topic.title))
        for pre in _edges(topic, by_title, ordered):
            visit(pre)
        if topic is not target:
            chain.append(topic)

    visit(target)
    chain.sort(key=lambda t: t.order)

    root_cause_titles = {_norm(c.topic_title) for c in find_root_causes(req)}
    steps: list[BridgeStep] = []
    idx = 0
    for t in [*chain, target]:
        score = mastery.get(_norm(t.title))
        is_target = t is target
        if not is_target and score is not None and score >= req.mastery_target:
            continue  # already mastered — leave it out of the bridge
        if is_target:
            action = "target"
        elif score is None or score < req.gap_threshold:
            action = "learn"
        elif score < req.mastery_target:
            action = "practice"
        else:
            action = "review"
        steps.append(BridgeStep(
            order=idx,
            topic_title=t.title,
            mastery_score=score,
            is_root_cause_gap=_norm(t.title) in root_cause_titles,
            is_target=is_target,
            action=action,
        ))
        idx += 1
    return "ok", steps


def analyze(req: GraphAnalyzeRequest) -> GraphAnalyzeResult:
    if not req.topics:
        return GraphAnalyzeResult(status="no_topics")

    topo, cycles = topological_order(req.topics)
    gaps = find_gaps(req)
    root_causes = find_root_causes(req)
    mastery = {_norm(k): v for k, v in req.mastery.items()}
    ready = [
        t.title for t in sorted(req.topics, key=lambda t: t.order)
        if (mastery.get(_norm(t.title)) or 0) >= req.mastery_target
    ]

    status = "has_cycle" if cycles else "ok"
    bridge_status, bridge = bridge_path(req)
    if bridge_status == "target_not_found":
        status = "target_not_found"

    return GraphAnalyzeResult(
        status=status,
        gaps=gaps,
        root_causes=root_causes,
        ready_topics=ready,
        topological_order=topo,
        cycles=cycles,
        bridge_path=bridge,
    )
