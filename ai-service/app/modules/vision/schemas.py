import json

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VisualExtraction(BaseModel):
    """Searchable evidence transcribed from one source image."""

    model_config = ConfigDict(extra="forbid")

    visible_text: list[str] = Field(
        description="Verbatim readable text, in reading order."
    )
    formulas: list[str] = Field(
        description="Visible mathematical or scientific formulas, transcribed exactly."
    )
    units: list[str] = Field(
        description="Visible units together with their values or quantities where available."
    )
    diagram_labels: list[str] = Field(
        description="Labels attached to diagrams, figures, axes, arrows, or components."
    )
    chart_labels: list[str] = Field(
        description="Chart titles, legends, axis labels, categories, and data labels."
    )
    description: str = Field(
        description="Factual description of visible educational content and relationships."
    )
    uncertainties: list[str] = Field(
        description="Specific unreadable, cropped, ambiguous, or low-confidence content."
    )

    @field_validator(
        "visible_text",
        "formulas",
        "units",
        "diagram_labels",
        "chart_labels",
        "uncertainties",
        mode="before",
    )
    @classmethod
    def normalize_string_lists(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, dict):
            return [f"{key}: {item}" for key, item in value.items()]
        if isinstance(value, list):
            normalized = []
            for item in value:
                if isinstance(item, dict):
                    normalized.append("; ".join(f"{key}: {part}" for key, part in item.items()))
                else:
                    normalized.append(str(item))
            return normalized
        return value

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value):
        if isinstance(value, list):
            return " ".join(str(item) for item in value)
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False, sort_keys=True)
        return value
