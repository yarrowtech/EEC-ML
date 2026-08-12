import base64
import json

import pytest

from app.core.config import settings
from app.modules.vision.client import VisionExtractionError, extract_visual_content


VALID_EXTRACTION = {
    "visible_text": ["Ohm's law"],
    "formulas": ["V = IR"],
    "units": ["V (volt)", "I (ampere)", "R (ohm)"],
    "diagram_labels": ["R1", "battery"],
    "chart_labels": [],
    "description": "A labelled series circuit accompanies Ohm's law.",
    "uncertainties": ["One resistor value is blurred."],
}


class FakeResponse:
    def __init__(self, content):
        self.content = content

    def raise_for_status(self):
        return None

    def json(self):
        return {"message": {"content": self.content}}


class FakeClient:
    def __init__(self, content):
        self.content = content
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse(self.content)


def test_extract_visual_content_sends_one_image_and_schema():
    client = FakeClient(json.dumps(VALID_EXTRACTION))

    result = extract_visual_content(b"fake-png-bytes", client=client)

    assert result.formulas == ["V = IR"]
    assert result.uncertainties == ["One resistor value is blurred."]
    url, request = client.calls[0]
    assert url == f"{settings.ollama_url}/api/chat"
    payload = request["json"]
    assert payload["model"] == settings.ollama_vision_model
    assert payload["think"] is False
    assert payload["stream"] is False
    assert payload["options"]["temperature"] == 0
    assert payload["options"]["num_ctx"] == 16384
    assert payload["format"]["required"] == [
        "visible_text",
        "formulas",
        "units",
        "diagram_labels",
        "chart_labels",
        "description",
        "uncertainties",
    ]
    assert payload["messages"][0]["images"] == [
        base64.b64encode(b"fake-png-bytes").decode("ascii")
    ]
    assert "Never solve exercises" in payload["messages"][0]["content"]


def test_extract_visual_content_accepts_data_url():
    client = FakeClient(json.dumps(VALID_EXTRACTION))
    encoded = base64.b64encode(b"image").decode("ascii")

    extract_visual_content(f"data:image/png;base64,{encoded}", client=client)

    assert client.calls[0][1]["json"]["messages"][0]["images"] == [encoded]


def test_extract_visual_content_accepts_fenced_json():
    client = FakeClient(f"```json\n{json.dumps(VALID_EXTRACTION)}\n```")

    result = extract_visual_content(b"image", client=client)

    assert result.description.startswith("A labelled series circuit")


def test_extract_visual_content_normalizes_common_model_shape_drift():
    drifted = {
        **VALID_EXTRACTION,
        "diagram_labels": {"resistor": "R1 = 5 ohm", "source": "Battery: 10 V"},
        "description": ["A circuit is shown.", "An arrow marks current."],
    }

    result = extract_visual_content(
        b"image", client=FakeClient(json.dumps(drifted))
    )

    assert result.diagram_labels == [
        "resistor: R1 = 5 ohm",
        "source: Battery: 10 V",
    ]
    assert result.description == "A circuit is shown. An arrow marks current."


def test_extract_visual_content_normalizes_object_items_in_label_lists():
    drifted = {
        **VALID_EXTRACTION,
        "diagram_labels": [
            {"description": "A number line", "location": "bottom"},
        ],
    }

    result = extract_visual_content(b"image", client=FakeClient(json.dumps(drifted)))

    assert result.diagram_labels == ["description: A number line; location: bottom"]


@pytest.mark.parametrize("image", [b"", "", "not-base64!"])
def test_extract_visual_content_rejects_invalid_image(image):
    with pytest.raises(ValueError):
        extract_visual_content(image, client=FakeClient(json.dumps(VALID_EXTRACTION)))


def test_extract_visual_content_rejects_invalid_model_output():
    with pytest.raises(VisionExtractionError):
        extract_visual_content(b"image", client=FakeClient('{"visible_text": []}'))
