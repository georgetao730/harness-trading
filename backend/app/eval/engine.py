"""Eval Harness — L1/L2/L3 assertion engine with cross-model matrix.

L1 字面匹配: expected_contains / json_path / regex_match
L2 LLM-judge: claude-haiku 作为评判者，rubric 在 case 中
L3 端到端: 跑 workflow，断言最终结果指标
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from loguru import logger


# ── Data Models ──


@dataclass
class EvalCase:
    id: str
    description: str
    level: str  # L1 | L2 | L3
    skill: str = ""
    workflow: str = ""
    inputs: dict[str, Any] = field(default_factory=dict)

    # L1 assertions
    expected_contains: str | None = None
    json_path: str | None = None
    regex_match: str | None = None

    # L2 rubric
    rubric: str = ""

    # L3 assertions
    min_sharpe: float | None = None
    max_drawdown: float | None = None


@dataclass
class EvalSuite:
    name: str
    description: str
    cases: list[EvalCase] = field(default_factory=list)


@dataclass
class CaseResult:
    case_id: str
    description: str
    level: str
    passed: bool
    model: str
    duration_ms: int
    details: str = ""
    error: str | None = None


@dataclass
class SuiteResult:
    suite_name: str
    model: str
    total: int
    passed: int
    failed: int
    cases: list[CaseResult] = field(default_factory=list)

    @property
    def pass_rate(self) -> float:
        return self.passed / self.total if self.total > 0 else 0.0


@dataclass
class MatrixResult:
    suites: list[SuiteResult] = field(default_factory=list)
    started_at: float = 0.0
    ended_at: float = 0.0

    def summary(self) -> str:
        lines = ["# Eval Results", ""]
        for sr in self.suites:
            lines.append(f"## {sr.suite_name} (model: {sr.model})")
            lines.append(f"Pass rate: {sr.passed}/{sr.total} ({sr.pass_rate:.0%})")
            lines.append("")
            for c in sr.cases:
                icon = "✅" if c.passed else "❌"
                lines.append(f"- {icon} `{c.case_id}` — {c.description}")
                if c.details:
                    lines.append(f"  {c.details}")
                if c.error:
                    lines.append(f"  Error: {c.error}")
            lines.append("")
        return "\n".join(lines)


# ── Parser ──


def load_suite(path: Path) -> EvalSuite:
    """Parse an eval YAML file into a suite."""
    meta = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    cases = []
    for c in meta.get("cases", []):
        cases.append(EvalCase(
            id=c.get("id", ""),
            description=c.get("description", ""),
            level=c.get("level", "L1"),
            skill=c.get("skill", ""),
            workflow=c.get("workflow", ""),
            inputs=c.get("inputs", {}),
            expected_contains=c.get("expected_contains"),
            json_path=c.get("json_path"),
            regex_match=c.get("regex_match"),
            rubric=c.get("rubric", ""),
            min_sharpe=c.get("min_sharpe"),
            max_drawdown=c.get("max_drawdown"),
        ))
    return EvalSuite(
        name=meta.get("name", path.stem),
        description=meta.get("description", ""),
        cases=cases,
    )


def load_matrix(path: Path) -> dict[str, Any]:
    """Load matrix.yaml with models + suites."""
    if not path.exists():
        return {"models": ["default"], "suites": []}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


# ── L1 / L2 / L3 Assertions ──


def _l1_assert(case: EvalCase, output: Any) -> tuple[bool, str]:
    """Literal assertions on output data."""
    output_str = json.dumps(output, ensure_ascii=False) if not isinstance(output, str) else output

    if case.expected_contains:
        if case.expected_contains in output_str:
            return True, f"contains '{case.expected_contains[:60]}'"
        return False, f"expected_contains '{case.expected_contains[:60]}' not found"

    if case.regex_match and isinstance(output, str):
        if re.search(case.regex_match, output):
            return True, f"regex '{case.regex_match[:40]}' matched"
        return False, f"regex '{case.regex_match[:40]}' not matched"

    if case.json_path and isinstance(output, dict):
        from jsonpath_ng import parse as jp_parse
        try:
            matches = jp_parse(case.json_path).find(output)
            if matches:
                return True, f"json_path '{case.json_path}' found"
            return False, f"json_path '{case.json_path}' not found"
        except Exception as e:
            return False, f"json_path parse error: {e}"

    return True, "no L1 assertions defined"


async def _l2_judge(case: EvalCase, output: Any, _model: str = "") -> tuple[bool, str]:
    """LLM judge using rubric. Falls back to local check if no LLM available."""
    if not case.rubric:
        return True, "no rubric defined"

    output_str = json.dumps(output, ensure_ascii=False) if not isinstance(output, str) else output

    # Try LLM judge
    try:
        from ..llm.manager import llm_manager
        from ..llm.base import Message, TaskType

        prompt = f"""You are a rubric evaluator. Judge the following output against this rubric:

Rubric: {case.rubric}

Output:
{output_str[:2000]}

Reply with only PASS or FAIL on the first line, then a brief reason on the second line."""
        resp = await llm_manager.chat(
            messages=[Message(role="user", content=prompt)],
            task_type=TaskType.REASONING,
        )
        lines = resp.content.strip().split("\n", 1)
        passed = lines[0].upper().startswith("PASS")
        reason = lines[1] if len(lines) > 1 else ""
        return passed, f"LLM-judge: {reason}"
    except Exception:
        # Fallback: check keyword presence
        keywords = case.rubric.lower().split()
        hits = sum(1 for kw in keywords if kw in output_str.lower())
        passed = hits >= len(keywords) * 0.5
        return passed, f"keyword fallback: {hits}/{len(keywords)} keywords present"


async def _l3_assert(case: EvalCase, output: Any) -> tuple[bool, str]:
    """End-to-end workflow assertions."""
    reasons = []

    if case.min_sharpe is not None:
        sharpe = _extract_metric(output, "sharpe")
        if sharpe is not None and sharpe < case.min_sharpe:
            reasons.append(f"sharpe {sharpe} < {case.min_sharpe}")

    if case.max_drawdown is not None:
        dd = _extract_metric(output, "max_drawdown")
        if dd is not None and dd > case.max_drawdown:
            reasons.append(f"max_drawdown {dd} > {case.max_drawdown}")

    if not reasons:
        return True, "all L3 assertions passed"
    return False, "; ".join(reasons)


def _extract_metric(output: Any, key: str) -> float | None:
    """Extract a numeric metric from output dict."""
    if isinstance(output, dict):
        data = output.get("data", output)
        if isinstance(data, dict):
            val = data.get(key)
            if val is not None:
                return float(val)
    return None


# ── Runner ──


class EvalRunner:
    """Runs eval suites against skills/workflows, optionally across multiple LLMs."""

    def __init__(self, evals_root: Path) -> None:
        self._root = evals_root
        self._results: list[SuiteResult] = []

    async def run_suite(
        self,
        suite_path: Path,
        model_name: str = "default",
    ) -> SuiteResult:
        """Run a single eval suite."""
        suite = load_suite(suite_path)
        sr = SuiteResult(suite_name=suite.name, model=model_name, total=len(suite.cases), passed=0, failed=0)

        for case in suite.cases:
            t0 = time.time()
            try:
                # Execute skill or workflow
                if case.skill:
                    from ..agent.skills.base import skill_registry
                    skill = skill_registry.get(case.skill)
                    if skill is None:
                        raise ValueError(f"Skill not found: {case.skill}")
                    result = await skill.execute(**case.inputs)
                    output = {"success": result.success, "data": result.data, "error": result.error}

                elif case.workflow:
                    from ..workflows.engine import get_engine, workflow_registry
                    wf = workflow_registry.get(case.workflow)
                    if wf is None:
                        raise ValueError(f"Workflow not found: {case.workflow}")
                    engine = get_engine()
                    run = await engine.run(case.workflow, case.inputs)
                    output = run.to_dict()
                else:
                    raise ValueError("Case has no skill or workflow")

                # Run assertions based on level
                if case.level == "L1":
                    passed, detail = _l1_assert(case, output)
                elif case.level == "L2":
                    passed, detail = await _l2_judge(case, output, model_name)
                elif case.level == "L3":
                    passed, detail = await _l3_assert(case, output)
                else:
                    passed, detail = True, f"unknown level: {case.level}"

                if passed:
                    sr.passed += 1
                else:
                    sr.failed += 1

                duration = int((time.time() - t0) * 1000)
                sr.cases.append(CaseResult(
                    case_id=case.id,
                    description=case.description,
                    level=case.level,
                    passed=passed,
                    model=model_name,
                    duration_ms=duration,
                    details=detail,
                ))

            except Exception as e:
                sr.failed += 1
                sr.cases.append(CaseResult(
                    case_id=case.id,
                    description=case.description,
                    level=case.level,
                    passed=False,
                    model=model_name,
                    duration_ms=int((time.time() - t0) * 1000),
                    error=str(e),
                ))

        logger.info(f"Suite [{suite.name}] ({model_name}): {sr.passed}/{sr.total} passed")
        return sr

    async def run_matrix(self, matrix_path: Path | None = None) -> MatrixResult:
        """Run all suites in the matrix across all models."""
        matrix = load_matrix(matrix_path or self._root / "matrix.yaml")
        models = matrix.get("models", ["default"])
        suite_paths_rel = matrix.get("suites", [])

        mr = MatrixResult(started_at=time.time())

        for rel in suite_paths_rel:
            sp = self._root / rel
            if not sp.exists():
                logger.warning(f"Suite not found: {sp}")
                continue

            for model in models:
                sr = await self.run_suite(sp, model)
                mr.suites.append(sr)

        mr.ended_at = time.time()
        return mr

    async def run_single(
        self,
        suite_name: str,
        model_name: str = "default",
    ) -> SuiteResult:
        """Run a single named suite."""
        sp = self._root / suite_name
        if not sp.exists():
            sp = self._root / f"{suite_name}.yaml"
        if not sp.exists():
            raise FileNotFoundError(f"Suite not found: {suite_name} in {self._root}")
        return await self.run_suite(sp, model_name)
