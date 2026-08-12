from app.modules.stem.verifier import verify_stem_question


def test_verifies_restricted_arithmetic():
    result = verify_stem_question("Please calculate 12 / 3 + 2")
    assert result is not None
    assert "6.0" in result


def test_rejects_function_calls_and_non_math_text():
    assert verify_stem_question("Run __import__('os').system('id')") is None
    assert verify_stem_question("Explain photosynthesis") is None


def test_rejects_division_by_zero():
    assert verify_stem_question("Calculate 5 / 0") is None


def test_solves_single_variable_algebra_with_restricted_sympy_adapter():
    result = verify_stem_question("Solve 2*x + 3 = 7")
    assert result is not None
    assert "x = 2" in result
