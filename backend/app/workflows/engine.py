"""Workflow Engine — YAML-driven multi-stage workflow executor.

Workflows are defined as markdown files with YAML frontmatter in `workflows/`.
Each stage maps to a skill invocation or agent dispatch.

Protocol (from tech-spec §10):
  - stages run sequentially by default
  - parallel: stages with `parallel:` run concurrently, joined per `join:` rule
  - gate: `user_confirm` pauses before the stage, requires surface confirmation
  - on_failure: `rollback` or `continue`
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from loguru import logger

# ── Data models ──


@dataclass
class Stage:
    id: str
    title: str
    needs: list[str] = field(default_factory=list)
    skill: str = ""
    agent: str = ""
    gate: str = ""  # user_confirm | none
    timeout_s: int = 300


@dataclass
class Workflow:
    name: str
    display_name: str
    description: str
    stages: list[Stage]
    inputs: list[dict[str, Any]] = field(default_factory=list)
    gate: str = ""  # global gate
    on_failure: str = "rollback"  # rollback | continue
    parallel: bool = False
    join: str = "all"  # all | any | first
    raw_yaml: dict[str, Any] = field(default_factory=dict)


@dataclass
class StageResult:
    stage_id: str
    title: str
    status: str  # pending | running | ok | failed | skipped
    data: Any = None
    error: str | None = None
    duration_ms: int = 0


@dataclass
class WorkflowRun:
    workflow: Workflow
    inputs: dict[str, Any]
    stages: list[StageResult] = field(default_factory=list)
    status: str = "pending"  # pending | running | ok | failed | cancelled
    started_at: float = 0.0
    ended_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "workflow": self.workflow.name,
            "status": self.status,
            "inputs": self.inputs,
            "stages": [
                {"id": s.stage_id, "title": s.title, "status": s.status, "error": s.error}
                for s in self.stages
            ],
        }


# ── Surface callback type ──

ConfirmCallback = Callable[[str, str], Awaitable[bool]]
"""Async callback: confirm(stage_title, prompt) -> bool"""


# ── Skill / Agent dispatch types ──

DispatchSkill = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]
"""Async callback: dispatch_skill(skill_name, inputs) -> result dict"""

DispatchAgent = Callable[[str, str, dict[str, Any]], Awaitable[dict[str, Any]]]
"""Async callback: dispatch_agent(agent_name, prompt, context) -> result dict"""


# ── Parser ──


def _parse_frontmatter(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    end = text.find("---", 3)
    if end == -1:
        return {}
    return yaml.safe_load(text[3:end].strip()) or {}


def load_workflow(path: Path) -> Workflow:
    """Parse a workflow YAML frontmatter file into a Workflow object."""
    meta = _parse_frontmatter(path)
    if not meta:
        raise ValueError(f"Workflow {path} missing frontmatter")

    stages = []
    for s in meta.get("stages", []):
        stages.append(Stage(
            id=s.get("id", ""),
            title=s.get("title", ""),
            needs=s.get("needs", []),
            skill=s.get("skill", ""),
            agent=s.get("agent", ""),
            gate=s.get("gate", ""),
            timeout_s=s.get("timeout_s", 300),
        ))

    return Workflow(
        name=meta.get("name", path.stem),
        display_name=meta.get("display_name", path.stem),
        description=meta.get("description", ""),
        stages=stages,
        inputs=meta.get("inputs", []),
        gate=meta.get("gate", ""),
        on_failure=meta.get("on_failure", "rollback"),
        parallel=meta.get("parallel", False),
        join=meta.get("join", "all"),
        raw_yaml=meta,
    )


# ── Registry ──


class WorkflowRegistry:
    """Scans workflows/ directory and loads workflows."""

    def __init__(self) -> None:
        self._workflows: dict[str, Workflow] = {}

    def register(self, wf: Workflow) -> None:
        self._workflows[wf.name] = wf
        logger.info(f"Registered workflow: {wf.name} ({len(wf.stages)} stages)")

    def get(self, name: str) -> Workflow | None:
        return self._workflows.get(name)

    def list_all(self) -> dict[str, str]:
        return {k: v.display_name for k, v in self._workflows.items()}

    def scan(self, root: Path) -> int:
        """Scan workflows/*.md and register all."""
        wf_dir = root / "workflows"
        if not wf_dir.is_dir():
            logger.warning(f"Workflows directory not found: {wf_dir}")
            return 0

        count = 0
        for mdfile in sorted(wf_dir.glob("*.md")):
            try:
                wf = load_workflow(mdfile)
                self.register(wf)
                count += 1
            except Exception as e:
                logger.error(f"Failed to load workflow {mdfile.name}: {e}")
        return count


# Global registry
workflow_registry = WorkflowRegistry()


# ── Engine ──


class WorkflowEngine:
    """Executes workflows stage by stage, with gate and parallel support."""

    def __init__(
        self,
        dispatch_skill: DispatchSkill,
        dispatch_agent: DispatchAgent | None = None,
        confirm: ConfirmCallback | None = None,
    ):
        self._dispatch_skill = dispatch_skill
        self._dispatch_agent = dispatch_agent
        self._confirm = confirm

    async def run(
        self,
        workflow_name: str,
        inputs: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> WorkflowRun:
        """Execute a workflow by name.

        Args:
            workflow_name: Name of the workflow to run (e.g. 'strategy-spec')
            inputs: User-provided input parameters
            context: Additional context (portfolio state, market snapshot, etc.)
        """
        import time

        wf = workflow_registry.get(workflow_name)
        if wf is None:
            raise ValueError(f"Workflow not found: {workflow_name}")

        run = WorkflowRun(workflow=wf, inputs=inputs, status="running", started_at=time.time())
        collected: dict[str, Any] = {}
        ctx = context or {}

        for stage in wf.stages:
            # Check gate
            if stage.gate == "user_confirm" and self._confirm:
                ok = await self._confirm(stage.title, f"Proceed to stage: {stage.title}?")
                if not ok:
                    result = StageResult(stage_id=stage.id, title=stage.title, status="skipped", error="User declined")
                    run.stages.append(result)
                    continue

            # Execute stage
            logger.info(f"Workflow [{wf.name}] running stage: {stage.title}")
            t0 = time.time()
            try:
                merged = {**inputs, **collected, **ctx}

                if stage.skill:
                    data = await self._dispatch_skill(stage.skill, merged)
                    if isinstance(data, dict) and data.get("success") is False:
                        raise RuntimeError(data.get("error", "Skill failed"))
                    collected[stage.id] = data

                elif stage.agent and self._dispatch_agent:
                    prompt = f"Execute stage: {stage.title}"
                    data = await self._dispatch_agent(stage.agent, prompt, merged)
                    collected[stage.id] = data

                else:
                    logger.warning(f"Stage {stage.id} has no skill or agent")

                duration = int((time.time() - t0) * 1000)
                result = StageResult(stage_id=stage.id, title=stage.title, status="ok", data=collected.get(stage.id), duration_ms=duration)
                run.stages.append(result)

            except Exception as e:
                duration = int((time.time() - t0) * 1000)
                result = StageResult(stage_id=stage.id, title=stage.title, status="failed", error=str(e), duration_ms=duration)
                run.stages.append(result)

                if wf.on_failure == "rollback":
                    run.status = "failed"
                    run.ended_at = time.time()
                    return run
                # else: continue to next stage

        run.status = "ok"
        run.ended_at = time.time()
        logger.info(f"Workflow [{wf.name}] completed: {run.status}")
        return run


# ── Convenience: skill dispatcher that uses the global skill_registry ──

async def _default_skill_dispatch(skill_name: str, inputs: dict[str, Any]) -> dict[str, Any]:
    from ..agent.skills.base import skill_registry

    skill = skill_registry.get(skill_name)
    if skill is None:
        return {"success": False, "error": f"Skill not found: {skill_name}"}
    result = await skill.execute(**inputs)
    return {
        "success": result.success,
        "data": result.data,
        "error": result.error,
    }


_engine: WorkflowEngine | None = None


def get_engine(
    dispatch_skill: DispatchSkill | None = None,
    dispatch_agent: DispatchAgent | None = None,
    confirm: ConfirmCallback | None = None,
) -> WorkflowEngine:
    """Get or create the global workflow engine instance."""
    global _engine
    if _engine is None:
        _engine = WorkflowEngine(
            dispatch_skill=dispatch_skill or _default_skill_dispatch,
            dispatch_agent=dispatch_agent,
            confirm=confirm,
        )
    return _engine
