from pydantic import BaseModel, Field


class GraphTopic(BaseModel):
    title: str
    order: int = 0
    prerequisites: list[str] = Field(default_factory=list)
    concepts: list[str] = Field(default_factory=list)


class GraphAnalyzeRequest(BaseModel):
    topics: list[GraphTopic]
    # topic title (case-insensitive) -> mastery score 0..100. Missing = not started.
    mastery: dict[str, float] = Field(default_factory=dict)
    target_topic: str | None = None
    gap_threshold: float = 60.0
    mastery_target: float = 75.0


class RootCause(BaseModel):
    topic_title: str
    order: int
    mastery_score: float | None = None
    depth: int                      # how many prerequisite hops back from a weak topic
    blocked_topics: list[str] = Field(default_factory=list)


class GapTopic(BaseModel):
    topic_title: str
    order: int
    mastery_score: float | None = None


class BridgeStep(BaseModel):
    order: int
    topic_title: str
    mastery_score: float | None = None
    is_root_cause_gap: bool = False
    is_target: bool = False
    action: str                     # learn | practice | review | target


class GraphAnalyzeResult(BaseModel):
    status: str = "ok"              # ok | no_topics | target_not_found | has_cycle
    gaps: list[GapTopic] = Field(default_factory=list)
    root_causes: list[RootCause] = Field(default_factory=list)
    ready_topics: list[str] = Field(default_factory=list)
    topological_order: list[str] = Field(default_factory=list)
    cycles: list[list[str]] = Field(default_factory=list)
    bridge_path: list[BridgeStep] = Field(default_factory=list)
