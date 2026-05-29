"""Gateway method registrations — wire business logic to dispatcher."""

from loguru import logger

from .dispatcher import dispatcher


def _register_skill_invoke():
    """Register skill.invoke so ws-bridge can call skills by name."""

    async def handler(params: dict) -> dict:
        skill_name = params.get("skill", "")
        inputs = params.get("inputs", {})

        if not skill_name:
            return {"error": {"code": "INVALID_PARAMS", "message": "skill is required"}}

        from ..agent.skills.base import skill_registry

        skill = skill_registry.get(skill_name)
        if skill is None:
            return {"error": {"code": "SKILL_NOT_FOUND", "message": f"Unknown skill: {skill_name}"}}

        result = await skill.execute(**inputs)
        return {
            "success": result.success,
            "data": result.data,
            "error": result.error,
        }

    dispatcher.register("skill.invoke", handler)
    logger.info("Registered gateway method: skill.invoke")


def _register_broker_submit():
    """Register broker.submit for HarnessToken-gated paper trading."""

    async def handler(params: dict) -> dict:
        from ..channels.registry import channel_registry

        broker = channel_registry.get_broker(params.get("broker"))
        if broker is None:
            return {"error": {"code": "BROKER_NOT_FOUND", "message": "No broker configured"}}

        token = params.get("harness_token", "")
        if not token:
            return {"error": {"code": "INVALID_PARAMS", "message": "harness_token is required"}}

        symbol = str(params.get("symbol", ""))
        side = str(params.get("side", "buy"))
        quantity = int(params.get("quantity", 0))
        price = float(params["price"]) if params.get("price") else None

        if not symbol or quantity <= 0:
            return {"error": {"code": "INVALID_PARAMS", "message": "symbol and quantity required"}}

        try:
            result = await broker.submit(
                symbol=symbol,
                side=side,
                quantity=quantity,
                price=price,
                harness_token=token,
            )
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    dispatcher.register("broker.submit", handler)
    logger.info("Registered gateway method: broker.submit")


def _register_broker_queries():
    """Register broker.positions, broker.orders, broker.account."""

    async def positions(params: dict) -> dict:
        from ..channels.registry import channel_registry

        broker = channel_registry.get_broker(params.get("broker"))
        if broker is None:
            return {"error": {"code": "BROKER_NOT_FOUND", "message": "No broker configured"}}
        data = await broker.get_positions()
        return {"success": True, "data": data}

    async def orders(params: dict) -> dict:
        from ..channels.registry import channel_registry

        broker = channel_registry.get_broker(params.get("broker"))
        if broker is None:
            return {"error": {"code": "BROKER_NOT_FOUND", "message": "No broker configured"}}
        data = await broker.get_orders()
        return {"success": True, "data": data}

    async def account(params: dict) -> dict:
        from ..channels.registry import channel_registry

        broker = channel_registry.get_broker(params.get("broker"))
        if broker is None:
            return {"error": {"code": "BROKER_NOT_FOUND", "message": "No broker configured"}}
        data = await broker.get_account()
        return {"success": True, "data": data}

    dispatcher.register("broker.positions", positions)
    dispatcher.register("broker.orders", orders)
    dispatcher.register("broker.account", account)
    logger.info("Registered gateway methods: broker.positions, broker.orders, broker.account")


def _register_channels_snapshot():
    """Register channels.snapshot to list active channels."""

    async def handler(params: dict) -> dict:  # noqa: ARG001
        from ..channels.registry import channel_registry

        return {"success": True, "data": channel_registry.snapshot()}

    dispatcher.register("channels.snapshot", handler)
    logger.info("Registered gateway method: channels.snapshot")


def _register_workflow_methods():
    """Register workflow.run, workflows.list."""

    async def run_workflow(params: dict) -> dict:
        from ..workflows.engine import get_engine, workflow_registry

        wf_name = str(params.get("workflow", ""))
        inputs = params.get("inputs", {})
        if not wf_name:
            return {"error": {"code": "INVALID_PARAMS", "message": "workflow name required"}}

        wf = workflow_registry.get(wf_name)
        if wf is None:
            return {"error": {"code": "WORKFLOW_NOT_FOUND", "message": f"Unknown workflow: {wf_name}"}}

        engine = get_engine()
        try:
            run = await engine.run(wf_name, inputs)
            return {"success": True, "data": run.to_dict()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_workflows(params: dict) -> dict:  # noqa: ARG001
        from ..workflows.engine import workflow_registry
        return {"success": True, "data": workflow_registry.list_all()}

    dispatcher.register("workflow.run", run_workflow)
    dispatcher.register("workflows.list", list_workflows)
    logger.info("Registered gateway methods: workflow.run, workflows.list")


def _register_agent_methods():
    """Register agents.list, agent.describe."""

    async def list_agents(params: dict) -> dict:  # noqa: ARG001
        from ..agent.roles import agent_registry
        return {"success": True, "data": agent_registry.list_all()}

    async def describe_agent(params: dict) -> dict:
        from ..agent.roles import agent_registry

        name = str(params.get("agent", ""))
        role = agent_registry.get(name)
        if role is None:
            return {"error": {"code": "AGENT_NOT_FOUND", "message": f"Unknown agent: {name}"}}
        return {"success": True, "data": role.to_dict()}

    dispatcher.register("agents.list", list_agents)
    dispatcher.register("agent.describe", describe_agent)
    logger.info("Registered gateway methods: agents.list, agent.describe")


def _register_eval_methods():
    """Register eval.run, eval.suites."""

    async def run_eval(params: dict) -> dict:
        from pathlib import Path
        from ..eval.engine import EvalRunner

        suite_name = str(params.get("suite", "all"))
        model = str(params.get("model", "default"))

        evals_root = Path(__file__).parent.parent.parent.parent / "evals"
        runner = EvalRunner(evals_root)

        try:
            if suite_name == "all":
                result = await runner.run_matrix(evals_root / "matrix.yaml")
                return {"success": True, "data": result.summary()}
            else:
                sr = await runner.run_single(suite_name, model)
                return {
                    "success": True,
                    "data": {
                        "suite_name": sr.suite_name,
                        "total": sr.total,
                        "passed": sr.passed,
                        "failed": sr.failed,
                        "pass_rate": sr.pass_rate,
                        "cases": [
                            {
                                "case_id": c.case_id,
                                "description": c.description,
                                "level": c.level,
                                "passed": c.passed,
                                "details": c.details,
                                "error": c.error,
                            }
                            for c in sr.cases
                        ],
                    },
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    dispatcher.register("eval.run", run_eval)
    logger.info("Registered gateway method: eval.run")


def _register_knowledge_methods():
    """Register knowledge.search, knowledge.promote."""

    async def search_knowledge(params: dict) -> dict:
        from ..knowledge.garden import get_garden

        query = str(params.get("query", ""))
        top_k = int(params.get("top_k", 5))
        results = get_garden().search(query, top_k)
        return {"success": True, "data": {"query": query, "results": results}}

    async def promote_knowledge(params: dict) -> dict:
        from ..knowledge.garden import get_garden

        entry_id = str(params.get("id", ""))
        if not entry_id:
            return {"error": {"code": "INVALID_PARAMS", "message": "id required"}}
        ok = get_garden().promote(entry_id)
        return {"success": True, "data": {"id": entry_id, "promoted": ok}}

    dispatcher.register("knowledge.search", search_knowledge)
    dispatcher.register("knowledge.promote", promote_knowledge)
    logger.info("Registered gateway methods: knowledge.search, knowledge.promote")


def register_all_builtin_methods():
    """Call this during startup to register all gateway methods."""
    _register_skill_invoke()
    _register_broker_submit()
    _register_broker_queries()
    _register_channels_snapshot()
    _register_workflow_methods()
    _register_agent_methods()
    _register_eval_methods()
    _register_knowledge_methods()
