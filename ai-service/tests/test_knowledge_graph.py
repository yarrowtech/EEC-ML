"""Knowledge-graph traversal — topological order, cycle detection, gap +
root-cause analysis, and prerequisite bridge-path construction."""

from app.modules.knowledge_graph.schemas import GraphAnalyzeRequest
from app.modules.knowledge_graph.service import (
    analyze,
    find_root_causes,
    topological_order,
)

TOPICS = [
    {"title": "Counting", "order": 1, "prerequisites": []},
    {"title": "Addition", "order": 2, "prerequisites": ["Counting"]},
    {"title": "Subtraction", "order": 3, "prerequisites": ["Addition"]},
    {"title": "Multiplication", "order": 4, "prerequisites": ["Addition"]},
    {"title": "Division", "order": 5, "prerequisites": ["Multiplication", "Subtraction"]},
]


def _req(**kw):
    return GraphAnalyzeRequest(topics=TOPICS, **kw)


def test_topological_order_respects_explicit_edges():
    order, cycles = topological_order(_req().topics)
    assert cycles == []
    assert order.index("Addition") < order.index("Multiplication")
    assert order.index("Multiplication") < order.index("Division")
    assert order.index("Subtraction") < order.index("Division")


def test_detects_a_cycle():
    topics = [
        {"title": "A", "order": 1, "prerequisites": ["B"]},
        {"title": "B", "order": 2, "prerequisites": ["A"]},
    ]
    result = analyze(GraphAnalyzeRequest(topics=topics))
    assert result.status == "has_cycle"
    assert result.cycles and set(result.cycles[0]) == {"A", "B"}


def test_gaps_and_root_causes():
    req = _req(mastery={"Counting": 90, "Addition": 45, "Subtraction": 70, "Multiplication": 30})
    result = analyze(req)
    assert {g.topic_title for g in result.gaps} == {"Addition", "Multiplication", "Division"}
    rc = {c.topic_title for c in result.root_causes}
    # Addition is weak and its only prerequisite (Counting) is mastered -> root cause.
    assert "Addition" in rc
    assert "Counting" not in rc
    cause = next(c for c in result.root_causes if c.topic_title == "Addition")
    assert "Division" in cause.blocked_topics and "Multiplication" in cause.blocked_topics


def test_bridge_path_to_target_excludes_mastered_prereqs():
    req = _req(
        mastery={"Counting": 95, "Addition": 40, "Subtraction": 72, "Multiplication": 88},
        target_topic="Division",
    )
    steps = analyze(req).bridge_path
    titles = [s.topic_title for s in steps]
    # Counting (95) and Multiplication (88) are mastered -> not in the bridge.
    assert titles == ["Addition", "Subtraction", "Division"]
    assert steps[0].action == "learn" and steps[0].is_root_cause_gap is True
    assert steps[1].action == "practice"
    assert steps[-1].is_target is True and steps[-1].action == "target"


def test_target_not_found():
    result = analyze(_req(target_topic="Calculus"))
    assert result.status == "target_not_found"


def test_edgeless_map_falls_back_to_order():
    topics = [{"title": f"T{i}", "order": i} for i in range(1, 5)]
    order, cycles = topological_order([GraphAnalyzeRequest(topics=topics).topics[0].__class__(**t) for t in topics])
    assert order == ["T1", "T2", "T3", "T4"]
    assert cycles == []


def test_ready_topics_and_no_topics_status():
    assert analyze(GraphAnalyzeRequest(topics=[])).status == "no_topics"
    result = analyze(_req(mastery={"Counting": 95, "Addition": 80}))
    assert set(result.ready_topics) == {"Counting", "Addition"}
