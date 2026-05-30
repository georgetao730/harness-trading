"""Tests for Workflow Engine — parser, registry, engine execution."""

import asyncio
import os
import tempfile
from pathlib import Path

import pytest

from app.workflows.engine import (
    Stage,
    Workflow,
    WorkflowEngine,
    WorkflowRegistry,
    WorkflowRun,
    StageResult,
    load_workflow,
)


class TestWorkflowModels:
    """Test data model construction."""

    def test_workflow_creation(self):
        wf = Workflow(
            name="test-wf", display_name="测试工作流",
            description="A test workflow",
            stages=[
                Stage(id="s1", title="Stage 1", skill="market-scan"),
                Stage(id="s2", title="Stage 2", skill="technical-analysis"),
            ],
        )
        assert wf.name == "test-wf"
        assert len(wf.stages) == 2
        assert wf.stages[0].skill == "market-scan"
        assert wf.on_failure == "rollback"

    def test_workflow_run_to_dict(self):
        wf = Workflow(name="demo", display_name="Demo", description="", stages=[])
        run = WorkflowRun(workflow=wf, inputs={"idea": "test"}, status="ok")
        run.stages = [
            StageResult(stage_id="s1", title="S1", status="ok"),
            StageResult(stage_id="s2", title="S2", status="failed", error="oops"),
        ]
        d = run.to_dict()
        assert d["workflow"] == "demo"
        assert d["status"] == "ok"
        assert len(d["stages"]) == 2
        assert d["stages"][0]["status"] == "ok"
        assert d["stages"][1]["error"] == "oops"

    def test_stage_defaults(self):
        stage = Stage(id="s1", title="Test Stage")
        assert stage.skill == ""
        assert stage.agent == ""
        assert stage.gate == ""
        assert stage.timeout_s == 300
        assert stage.needs == []


class TestWorkflowParser:
    """Test YAML frontmatter parsing."""

    def test_load_workflow_from_md(self):
        content = """---
name: demo-workflow
display_name: 演示工作流
description: A demo
stages:
  - id: fetch
    title: 获取数据
    skill: market-scan
  - id: analyze
    title: 技术分析
    skill: technical-analysis
    gate: user_confirm
on_failure: continue
---
# Demo Workflow

This is the body text.
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
            f.write(content)
            tmp_path = f.name

        try:
            wf = load_workflow(Path(tmp_path))
            assert wf.name == "demo-workflow"
            assert wf.display_name == "演示工作流"
            assert len(wf.stages) == 2
            assert wf.stages[0].skill == "market-scan"
            assert wf.stages[1].gate == "user_confirm"
            assert wf.on_failure == "continue"
        finally:
            os.unlink(tmp_path)

    def test_load_workflow_no_frontmatter(self):
        content = "# No frontmatter here"
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
            f.write(content)
            tmp_path = f.name

        try:
            with pytest.raises(ValueError, match="missing frontmatter"):
                load_workflow(Path(tmp_path))
        finally:
            os.unlink(tmp_path)


class TestWorkflowRegistry:
    """Test registry registration and lookup."""

    def test_register_and_get(self):
        reg = WorkflowRegistry()
        wf = Workflow(name="wf1", display_name="WF1", description="", stages=[])
        reg.register(wf)

        assert reg.get("wf1") is wf
        assert reg.get("non-existent") is None

    def test_list_all(self):
        reg = WorkflowRegistry()
        reg.register(Workflow(name="a", display_name="Alpha", description="", stages=[]))
        reg.register(Workflow(name="b", display_name="Beta", description="", stages=[]))

        all_wf = reg.list_all()
        assert all_wf == {"a": "Alpha", "b": "Beta"}


class TestWorkflowEngine:
    """Test engine execution with mock dispatchers."""

    async def _mock_skill_dispatch(self, skill_name: str, inputs: dict) -> dict:
        return {"success": True, "data": {"skill": skill_name, "inputs": inputs}}

    def test_run_simple_workflow(self):
        engine = WorkflowEngine(dispatch_skill=self._mock_skill_dispatch)

        # Register a workflow
        wf = Workflow(
            name="simple", display_name="Simple",
            description="Simple workflow",
            stages=[Stage(id="s1", title="Step 1", skill="market-scan")],
        )
        from app.workflows.engine import workflow_registry
        workflow_registry.register(wf)

        async def run():
            return await engine.run("simple", {"symbol": "600519"})

        result = asyncio.run(run())
        assert result.status == "ok"
        assert len(result.stages) == 1
        assert result.stages[0].status == "ok"

    def test_run_workflow_not_found(self):
        engine = WorkflowEngine(dispatch_skill=self._mock_skill_dispatch)

        async def run():
            return await engine.run("non-existent", {})

        with pytest.raises(ValueError, match="Workflow not found"):
            asyncio.run(run())

    def test_run_skill_failure_with_rollback(self):
        async def failing_dispatch(skill_name: str, inputs: dict) -> dict:
            return {"success": False, "error": "Skill execution failed"}

        engine = WorkflowEngine(dispatch_skill=failing_dispatch)

        wf = Workflow(
            name="fail-wf", display_name="Fail WF",
            description="Will fail",
            stages=[Stage(id="s1", title="Bad Step", skill="broken")],
            on_failure="rollback",
        )
        from app.workflows.engine import workflow_registry
        workflow_registry.register(wf)

        async def run():
            return await engine.run("fail-wf", {})

        result = asyncio.run(run())
        assert result.status == "failed"
        assert result.stages[0].status == "failed"
        assert "Skill execution failed" in str(result.stages[0].error)

    def test_run_skill_failure_with_continue(self):
        async def mixed_dispatch(skill_name: str, inputs: dict) -> dict:
            if skill_name == "broken":
                return {"success": False, "error": "fail"}
            return {"success": True, "data": "ok"}

        engine = WorkflowEngine(dispatch_skill=mixed_dispatch)

        wf = Workflow(
            name="continue-wf", display_name="Continue WF",
            description="Continue on failure",
            stages=[
                Stage(id="s1", title="Bad", skill="broken"),
                Stage(id="s2", title="Good", skill="ok-skill"),
            ],
            on_failure="continue",
        )
        from app.workflows.engine import workflow_registry
        workflow_registry.register(wf)

        async def run():
            return await engine.run("continue-wf", {})

        result = asyncio.run(run())
        assert result.status == "ok"  # should continue
        assert len(result.stages) == 2
        assert result.stages[0].status == "failed"
        assert result.stages[1].status == "ok"

    def test_gate_user_confirm_accepted(self):
        async def confirm(title: str, prompt: str) -> bool:
            return True

        engine = WorkflowEngine(
            dispatch_skill=self._mock_skill_dispatch,
            confirm=confirm,
        )

        wf = Workflow(
            name="gated", display_name="Gated",
            description="Has user confirm gate",
            stages=[Stage(id="s1", title="Confirm Step", skill="ok-skill", gate="user_confirm")],
        )
        from app.workflows.engine import workflow_registry
        workflow_registry.register(wf)

        async def run():
            return await engine.run("gated", {})

        result = asyncio.run(run())
        assert result.stages[0].status == "ok"

    def test_gate_user_confirm_declined(self):
        async def confirm(title: str, prompt: str) -> bool:
            return False

        engine = WorkflowEngine(
            dispatch_skill=self._mock_skill_dispatch,
            confirm=confirm,
        )

        wf = Workflow(
            name="gated2", display_name="Gated2",
            description="User declines",
            stages=[Stage(id="s1", title="Blocked Step", skill="ok-skill", gate="user_confirm")],
        )
        from app.workflows.engine import workflow_registry
        workflow_registry.register(wf)

        async def run():
            return await engine.run("gated2", {})

        result = asyncio.run(run())
        assert result.stages[0].status == "skipped"
        assert "User declined" in str(result.stages[0].error)
