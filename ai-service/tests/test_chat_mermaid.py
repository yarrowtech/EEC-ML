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


def test_fragmented_flowchart_is_rejected():
    fragmented = (
        "flowchart TD\n"
        'A["Group 1"] --> B[2, 5, 8]\n'
        'C["Group 2"] --> D[3, 4, 6]\n'
        'E["Swap"] --> F[2, 3, 8]\n'
        'G["Total"] --> H[13]\n'
        'I["Difference"] --> J[2]\n'
        'K["Moves"] --> L[1]\n'
    )
    reason = validate_mermaid(fragmented)
    assert reason is not None and "fragmented" in reason


def test_connected_flowchart_passes_structural_check():
    connected = (
        "flowchart TD\n"
        'A["Start"] --> B["Step one"]\n'
        'B --> C["Step two"]\n'
        'C --> D["Step three"]\n'
        'D --> E["Result"]\n'
        'E --> F["Why it matters"]\n'
    )
    assert validate_mermaid(connected) is None


def test_comparison_joined_to_shared_node_passes():
    diagram = (
        "flowchart LR\n"
        'Q["Which is bigger?"] --> A["one half"]\n'
        'Q --> B["one third"]\n'
        'A --> C["one half wins"]\n'
        "B --> C\n"
    )
    assert validate_mermaid(diagram) is None


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
