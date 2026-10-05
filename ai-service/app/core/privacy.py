"""Conservative contact/identifier redaction at the external provider boundary.

This is data minimisation, not anonymisation: unlabeled names, narrative context
and uncommon identifier formats still require a reviewed privacy policy.
"""
import re
from langchain_core.messages import BaseMessage

_PATTERNS = (
    (re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I), "[EMAIL]"),
    (re.compile(r"(?<!\w)(?:\+\d{1,3}[- .]?)?(?:\(?\d{3}\)?[- .])\d{3}[- .]\d{4}(?!\w)"), "[PHONE]"),
    (re.compile(r"(?<!\w)\+?\d{10,15}(?!\w)"), "[IDENTIFIER]"),
    (re.compile(r"(?<!\d)\d{4}[ -]\d{4}[ -]\d{4}(?!\d)"), "[IDENTIFIER]"),
)
_LABEL = re.compile(
    r"(?im)\b(student name|child name|parent name|guardian name|student id|student_id|admission number|"
    r"student|child|parent|guardian|phone|mobile|address|date of birth|dob|aadhaar|aadhar)\s*[:=]\s*[^\n;|]+"
)


def redact_text(text: str) -> str:
    text = _LABEL.sub(lambda match: match.group(1) + ": [REDACTED]", text)
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact_value(value):
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, dict):
        sensitive = {"studentname", "childname", "parentname", "guardianname", "studentid",
                     "email", "phone", "mobile", "address", "dateofbirth", "dob", "aadhaar"}
        return {key: "[REDACTED]" if re.sub(r"[^a-z]", "", key.lower()) in sensitive
                else redact_value(item) for key, item in value.items()}
    return value


def redact_model_input(value):
    """Handle LangChain message, string and prompt inputs without mutating them."""
    if hasattr(value, "to_messages"):
        value = value.to_messages()
    if isinstance(value, list):
        return [item.model_copy(update={"content": redact_value(item.content),
                                      "additional_kwargs": redact_value(item.additional_kwargs)})
                if isinstance(item, BaseMessage) else redact_value(item) for item in value]
    return redact_value(value)
