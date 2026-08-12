# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

"""Restricted deterministic verification for simple STEM expressions.

Only a small arithmetic/algebra grammar is accepted. Arbitrary names, function
calls, attributes, indexing, strings, and Python statements are rejected.
"""

from __future__ import annotations

import ast
import operator
import re


_EXPRESSION = re.compile(r"(?<![\w.])(?:\d+(?:\.\d+)?|[xyz])(?:\s*[+\-*/^()]\s*(?:\d+(?:\.\d+)?|[xyz]|\([^\n]{1,60}\)))+(?:\s*=\s*[^\n?]{1,60})?")
_ALLOWED = re.compile(r"^[0-9xyzXYZ+\-*/^().=\s]+$")
_BINARY = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}


def _safe_number(expression: str) -> float | int:
    def evaluate(node: ast.AST) -> float | int:
        if isinstance(node, ast.Expression):
            return evaluate(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in {int, float}:
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
            value = _BINARY[type(node.op)](evaluate(node.left), evaluate(node.right))
            if abs(float(value)) > 1e100:
                raise ValueError("result outside verification bounds")
            return value
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
            return _UNARY[type(node.op)](evaluate(node.operand))
        raise ValueError("unsupported expression")

    tree = ast.parse(expression.replace("^", "**"), mode="eval")
    return evaluate(tree)


def _verify_algebra(expression: str) -> str | None:
    try:
        import sympy  # Optional at development time; pinned for deployment.
    except ImportError:
        return None

    left, right = expression.split("=", 1)
    symbols = {name: sympy.Symbol(name) for name in "xyz"}
    lhs = sympy.sympify(left.replace("^", "**"), locals=symbols, evaluate=True)
    rhs = sympy.sympify(right.replace("^", "**"), locals=symbols, evaluate=True)
    variables = sorted((lhs - rhs).free_symbols, key=str)
    if len(variables) != 1:
        return None
    solutions = sympy.solve(sympy.Eq(lhs, rhs), variables[0])
    return f"{variables[0]} = {', '.join(map(str, solutions))}" if solutions else "no solution"


def verify_stem_question(question: str | None) -> str | None:
    """Return bounded verification context for the first safe explicit expression."""
    match = _EXPRESSION.search(question or "")
    if not match:
        return None
    expression = " ".join(match.group(0).split()).strip()
    if len(expression) > 120 or not _ALLOWED.fullmatch(expression):
        return None
    try:
        if "=" in expression and any(name in expression.lower() for name in "xyz"):
            result = _verify_algebra(expression.lower())
        elif "=" not in expression and not any(name in expression.lower() for name in "xyz"):
            result = str(_safe_number(expression))
        else:
            result = None
    except (ArithmeticError, SyntaxError, TypeError, ValueError):
        return None
    if result is None:
        return None
    return f"Restricted verifier checked `{expression}` and obtained `{result}`."
