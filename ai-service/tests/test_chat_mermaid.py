from app.modules.chat.mermaid import (
    extract_mermaid_block,
    replace_diagram_with_none,
    strip_mermaid_block,
    validate_mermaid,
)

VALID = 'flowchart TD\n  A["Water heats up"] --> B["Vapour rises"]\n  B --> C["Cloud forms"]'


def test_extract_returns_fenced_block():
    text = f"DIAGRAM:\n```mermaid\n{VALID}\n```\n\nEXPLANATION:\n**Overview:** ..."
    assert extract_mermaid_block(text) == VALID


def test_extract_returns_none_when_no_fence():
    assert extract_mermaid_block("DIAGRAM: none\n\nEXPLANATION: ...") is None


def test_valid_diagram_passes():
    assert validate_mermaid(VALID) is None


def test_empty_is_rejected():
    assert validate_mermaid("   ") == "empty diagram"


def test_missing_header_is_rejected():
    assert "not a Mermaid diagram declaration" in validate_mermaid('A --> B\nB --> C')


def test_unbalanced_bracket_is_rejected():
    assert validate_mermaid('flowchart TD\n  A["missing close --> B["ok"]') is not None


def test_unbalanced_quote_is_rejected():
    assert validate_mermaid('flowchart TD\n  A["open only] --> B') == "unbalanced double-quote"


def test_brackets_inside_quotes_are_ignored():
    assert validate_mermaid('flowchart TD\n  A["f(x) = y"] --> B["done"]') is None


def test_sequence_diagram_header_accepted():
    assert validate_mermaid("sequenceDiagram\n  A->>B: hello") is None


def test_replace_diagram_with_none_swaps_only_the_fence():
    text = f"DIAGRAM:\n```mermaid\n{VALID}\n```\n\nEXPLANATION:\n**Overview:** keep me"
    out = replace_diagram_with_none(text)
    assert "```mermaid" not in out
    assert out.startswith("DIAGRAM: none")
    assert "**Overview:** keep me" in out


def test_strip_mermaid_block_removes_fence_keeps_prose():
    text = f"Here is how it works:\n\n```mermaid\n{VALID}\n```\n\nThe key idea is evaporation."
    out = strip_mermaid_block(text)
    assert "```" not in out
    assert "Here is how it works:" in out
    assert "The key idea is evaporation." in out
