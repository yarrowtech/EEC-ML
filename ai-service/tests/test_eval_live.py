"""Live evaluation of the tutor pipeline against running Ollama + Qdrant.

Opt-in, from the ai-service root:

    RUN_AI_EVALS=1 .venv/bin/pytest -m eval tests/test_eval_live.py -v

Reads golden cases from tests/golden/golden_set.json (copy golden_set.example.json
and fill it with questions about materials actually ingested for your school).
For each case it checks, in order of failure likelihood:

1. retrieval finds chunks from the expected material (or nothing, for
   out-of-scope cases),
2. other schools cannot retrieve the same material (tenant isolation),
3. the generated answer is grounded: correct flags, mentions the expected keywords.
"""

import json
import os
from pathlib import Path

import pytest

pytestmark = pytest.mark.eval

GOLDEN_PATH = Path(__file__).parent / "golden" / "golden_set.json"

if os.environ.get("RUN_AI_EVALS") != "1":
    pytest.skip("set RUN_AI_EVALS=1 to run live evals", allow_module_level=True)
if not GOLDEN_PATH.exists():
    pytest.skip(
        "tests/golden/golden_set.json not found (copy golden_set.example.json and fill it in)",
        allow_module_level=True,
    )

CASES = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))["cases"]
CASE_IDS = [case["name"] for case in CASES]


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _request(case):
    from app.modules.chat.schemas import TutorGenerateRequest

    return TutorGenerateRequest(**case["request"])


@pytest.mark.parametrize("case", CASES, ids=CASE_IDS)
def test_retrieval_finds_expected_material(case):
    from app.modules.chat.service import retrieve_relevant_chunks

    chunks = retrieve_relevant_chunks(_request(case))
    if case.get("expect_no_material"):
        assert chunks == [], f"expected no material but retrieved {len(chunks)} chunks"
        return

    assert chunks, "retrieval returned nothing for an in-scope question"
    joined = " ".join(chunks).lower()
    keywords = [k.lower() for k in case.get("retrieval_any_of", [])]
    if keywords:
        assert any(k in joined for k in keywords), (
            f"none of {keywords} appear in the retrieved chunks: {joined[:400]}..."
        )


def test_other_school_cannot_retrieve_material():
    from app.modules.chat.service import retrieve_relevant_chunks

    in_scope = [case for case in CASES if not case.get("expect_no_material")]
    if not in_scope:
        pytest.skip("no in-scope golden cases to test isolation with")
    req = _request(in_scope[0]).model_copy(update={"schoolId": "eval-nonexistent-school"})
    assert retrieve_relevant_chunks(req) == [], "chunks leaked across the school boundary"


@pytest.mark.parametrize("case", CASES, ids=CASE_IDS)
def test_answer_is_grounded_in_material(client, case):
    resp = client.post("/generate/tutor", json=case["request"])
    assert resp.status_code == 200, resp.text
    body = resp.json()

    if case.get("expect_no_material"):
        assert body["noMaterialFound"] is True
        assert body["groundedInMaterial"] is False
        return

    assert body["noMaterialFound"] is False
    assert body["groundedInMaterial"] is True
    answer = body["content"].lower()
    keywords = [k.lower() for k in case.get("answer_any_of", [])]
    if keywords:
        assert any(k in answer for k in keywords), (
            f"answer mentions none of {keywords}: {body['content'][:400]}..."
        )
