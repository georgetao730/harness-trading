"""Tests for Eval Harness — L1 assertions, parser, models."""

import asyncio

import pytest

from app.eval.engine import (
    EvalCase,
    EvalSuite,
    SuiteResult,
    CaseResult,
    MatrixResult,
    _l1_assert,
    load_suite,
)


class TestEvalModels:
    """Test data model construction and properties."""

    def test_case_result_defaults(self):
        cr = CaseResult(
            case_id="test-1", description="测试用例", level="L1",
            passed=True, model="default", duration_ms=100,
        )
        assert cr.passed is True
        assert cr.details == ""
        assert cr.error is None

    def test_suite_result_pass_rate(self):
        sr = SuiteResult(suite_name="demo", model="default", total=4, passed=3, failed=1)
        assert sr.pass_rate == 0.75

    def test_suite_result_zero_total(self):
        sr = SuiteResult(suite_name="empty", model="default", total=0, passed=0, failed=0)
        assert sr.pass_rate == 0.0

    def test_matrix_result_summary(self):
        sr = SuiteResult(suite_name="demo", model="claude", total=2, passed=2, failed=0, cases=[
            CaseResult(case_id="c1", description="case 1", level="L1", passed=True, model="claude", duration_ms=50),
            CaseResult(case_id="c2", description="case 2", level="L1", passed=True, model="claude", duration_ms=60),
        ])
        mr = MatrixResult(suites=[sr])
        summary = mr.summary()
        assert "# Eval Results" in summary
        assert "Pass rate: 2/2" in summary
        assert "c1" in summary
        assert "c2" in summary

    def test_eval_case_defaults(self):
        case = EvalCase(id="test", description="测试", level="L1")
        assert case.expected_contains is None
        assert case.rubric == ""
        assert case.min_sharpe is None


class TestL1Assertions:
    """Test L1 literal assertions (no LLM needed)."""

    def test_expected_contains_string(self):
        case = EvalCase(id="c1", description="test", level="L1",
                        expected_contains="bullish")
        passed, detail = _l1_assert(case, "Market is bullish today")
        assert passed is True
        assert "bullish" in detail

    def test_expected_contains_not_found(self):
        case = EvalCase(id="c1", description="test", level="L1",
                        expected_contains="bear")
        passed, detail = _l1_assert(case, "Market is bullish")
        assert passed is False
        assert "not found" in detail

    def test_expected_contains_dict_output(self):
        case = EvalCase(id="c1", description="test", level="L1",
                        expected_contains="success")
        passed, _ = _l1_assert(case, {"status": "success", "data": [1, 2, 3]})
        assert passed is True

    def test_regex_match_pass(self):
        case = EvalCase(id="r1", description="regex test", level="L1",
                        regex_match=r"MA\d+")
        passed, _ = _l1_assert(case, "Signal: MA5 crossed MA20")
        assert passed is True

    def test_regex_match_fail(self):
        case = EvalCase(id="r1", description="regex test", level="L1",
                        regex_match=r"MA\d+")
        passed, _ = _l1_assert(case, "Signal: RSI oversold")
        assert passed is False

    def test_no_assertions_default_pass(self):
        case = EvalCase(id="n1", description="no assertions", level="L1")
        passed, detail = _l1_assert(case, "anything")
        assert passed is True
        assert "no L1 assertions" in detail


class TestYAMLParser:
    """Test YAML eval case loading."""

    def test_load_empty_suite(self):
        import tempfile
        import os

        yaml_content = """
name: empty-suite
description: An empty test suite
cases: []
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            f.write(yaml_content)
            tmp_path = f.name

        try:
            from pathlib import Path
            suite = load_suite(Path(tmp_path))
            assert suite.name == "empty-suite"
            assert len(suite.cases) == 0
        finally:
            os.unlink(tmp_path)

    def test_load_suite_with_cases(self):
        import tempfile
        import os

        yaml_content = """
name: demo-suite
description: A test suite
cases:
  - id: c1
    description: L1 test
    level: L1
    expected_contains: "pass"
  - id: c2
    description: L2 test
    level: L2
    rubric: "Output should mention risk"
  - id: c3
    description: L3 test
    level: L3
    workflow: backtest
    min_sharpe: 0.5
    max_drawdown: 0.2
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            f.write(yaml_content)
            tmp_path = f.name

        try:
            from pathlib import Path
            suite = load_suite(Path(tmp_path))
            assert suite.name == "demo-suite"
            assert len(suite.cases) == 3
            assert suite.cases[0].level == "L1"
            assert suite.cases[0].expected_contains == "pass"
            assert suite.cases[1].level == "L2"
            assert suite.cases[1].rubric == "Output should mention risk"
            assert suite.cases[2].level == "L3"
            assert suite.cases[2].max_drawdown == 0.2
        finally:
            os.unlink(tmp_path)
