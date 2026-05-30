"""Agent API Routes - Chat with AI, manage thinking process"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from loguru import logger

from ..llm.manager import llm_manager
from ..llm.base import Message, TaskType
from ..harness.pipeline import harness_pipeline
from ..harness.engine import ExecutionMode, OrderIntent

router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChatRequest(BaseModel):
    message: str
    task_type: str = "chat"  # chat, trading_decision, market_analysis, etc.


class ChatResponse(BaseModel):
    content: str
    thinking_steps: list = []
    model: str = ""
    provider: str = ""


class OrderRequest(BaseModel):
    symbol: str
    action: str  # buy, sell
    price: float
    quantity: int
    reason: str = ""


class ModeRequest(BaseModel):
    mode: str  # dry_run | approval | auto


class OrderResponse(BaseModel):
    approved: bool
    mode: str
    final_action: str
    validation_results: list = []
    risk_warnings: list = []


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """Send a message to the AI trading agent."""
    logger.info(f"Chat: task_type={request.task_type}")

    task_type = TaskType(request.task_type) if request.task_type else TaskType.CHAT

    # Build messages
    messages = [
        Message(role="system", content="You are a professional trading assistant. Answer in Chinese."),
        Message(role="user", content=request.message),
    ]

    # Dynamic thinking steps based on actual skill invocations
    thinking_steps = []
    msg_lower = request.message.lower()

    # Detect market data requests and run relevant skills
    from ..agent.skills.base import skill_registry

    if any(kw in msg_lower for kw in ["行情", "指数", "大盘", "市场", "走势", "today", "分析"]):
        step = {"type": "skill", "title": "获取市场数据", "detail": "正在拉取实时指数行情..."}
        thinking_steps.append(step)
        try:
            skill = skill_registry.get("market_data")
            if skill:
                result = await skill.execute(data_type="indices")
                if result.success and result.data:
                    names = [d.get("name", "") for d in result.data[:3] if isinstance(d, dict)]
                    step["detail"] = f"已获取: {', '.join(names)}"
        except Exception as e:
            logger.debug(f"Market data skill skipped: {e}")

    if any(kw in msg_lower for kw in ["macd", "rsi", "boll", "均线", "技术", "指标"]):
        # Try to extract a symbol from the message
        symbol = "000001.SH"
        import re
        sym_match = re.search(r'\b(6\d{5}|0\d{5}|3\d{5})\b', request.message)
        if sym_match:
            symbol = f"{sym_match.group(1)}.SH" if sym_match.group(1).startswith("6") else f"{sym_match.group(1)}.SZ"

        step = {"type": "skill", "title": "技术分析计算", "detail": f"正在计算 {symbol} 技术指标..."}
        thinking_steps.append(step)
        try:
            skill = skill_registry.get("technical")
            if skill:
                result = await skill.execute(symbol=symbol, indicator="all")
                if result.success and result.data:
                    macd_data = result.data.get("macd", {}) or {}
                    rsi_val = (result.data.get("rsi", {}) or {}).get("rsi14")
                    ma_trend = (result.data.get("ma", {}) or {}).get("trend", "")
                    detail_parts = []
                    if macd_data.get("signal"):
                        detail_parts.append(f"MACD: {macd_data['signal']}")
                    if rsi_val:
                        detail_parts.append(f"RSI14: {rsi_val}")
                    if ma_trend:
                        detail_parts.append(f"趋势: {ma_trend}")
                    if detail_parts:
                        step["detail"] = " | ".join(detail_parts)
        except Exception as e:
            logger.debug(f"Technical skill skipped: {e}")

    # Always add reasoning step
    thinking_steps.append({
        "type": "reasoning",
        "title": "AI 推理中",
        "detail": "综合分析数据与用户意图...",
    })

    # ── RAG: search knowledge garden for relevant context ──
    knowledge_context = ""
    try:
        from ..knowledge.garden import get_garden
        garden = get_garden()
        kb_results = garden.search(request.message, top_k=3)
        if kb_results:
            context_parts = []
            for kr in kb_results:
                ctx = kr.get("snippet", "") or garden.get_entry(kr["id"]).get("content", "")[:300] if garden.get_entry(kr["id"]) else ""
                context_parts.append(f"【{kr['title']}】(标签:{','.join(kr.get('tags',[]))})\n{ctx}")
            knowledge_context = "\n\n".join(context_parts)
            thinking_steps.insert(-1, {
                "type": "skill",
                "title": "检索知识库",
                "detail": f"匹配到 {len(kb_results)} 篇相关知识",
            })
            logger.debug(f"RAG: injected {len(kb_results)} knowledge entries into prompt")
    except Exception as e:
        logger.debug(f"RAG knowledge search skipped: {e}")

    if not thinking_steps:
        thinking_steps = [
            {"type": "skill", "title": "分析请求", "detail": f"解析用户输入: {request.message[:50]}..."},
            {"type": "reasoning", "title": "AI 推理中", "detail": "综合分析..."},
        ]

    # Get LLM response
    try:
        # Build system prompt: base from active agent role + RAG context
        system_prompt = "你是一个专业的股票交易助手。请用中文简洁回答。"
        try:
            if _active_agent_role:
                from ..agent.roles import agent_registry
                role = agent_registry.get(_active_agent_role)
                if role and role.system_prompt:
                    system_prompt = role.system_prompt
        except Exception:
            pass
        if knowledge_context:
            system_prompt += f"\n\n📚 以下是知识库中与用户问题相关的参考知识，请结合这些知识来回答：\n\n{knowledge_context}"

        response = await llm_manager.chat(
            messages=messages,
            task_type=task_type,
            system_prompt=system_prompt,
        )
        return ChatResponse(
            content=response.content,
            thinking_steps=thinking_steps,
            model=response.model,
            provider=response.provider,
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            content=f"抱歉，AI 服务暂时不可用: {str(e)}",
            thinking_steps=thinking_steps,
        )


@router.get("/mode")
async def get_mode():
    """Get current execution mode."""
    return {"mode": harness_pipeline.mode.value}


@router.post("/mode")
async def set_mode(req: ModeRequest):
    """Set execution mode: dry_run, approval, auto."""
    harness_pipeline.set_mode(ExecutionMode(req.mode))
    return {"mode": harness_pipeline.mode.value}


@router.get("/skills")
async def list_skills():
    """List all available skills."""
    from ..agent.skills.base import skill_registry
    return {"skills": skill_registry.list_all()}


@router.get("/skills/detail")
async def list_skills_detail():
    """List all skills with detailed info for management UI."""
    from ..agent.skills.base import skill_registry

    skills = []
    for name, info in skill_registry.list_all().items():
        if info.get("_alias_for"):
            continue  # skip aliases
        skills.append({
            "name": info.get("name", name),
            "category": info.get("category", "unknown"),
            "description": info.get("description", ""),
            "enabled": True,
        })
    return {
        "skills": skills,
        "categories": [
            {"id": "market_data", "label": "行情数据"},
            {"id": "technical", "label": "技术分析"},
            {"id": "fundamental", "label": "基本面"},
            {"id": "nlp", "label": "自然语言"},
            {"id": "llm_reasoning", "label": "AI推理"},
            {"id": "execution", "label": "交易执行"},
        ],
    }


# ── Skills CRUD (Create with LLM, View/Edit source) ──

SKILLS_DIR = Path(__file__).resolve().parent.parent / "agent" / "skills"

SKILL_TEMPLATE_EXAMPLE = '''"""Trade Signal Scanner — scan stocks for entry/exit signals"""

from typing import Any
from loguru import logger

from .base import BaseSkill, SkillCategory, SkillResult, skill_registry


class TradeSignalScannerSkill(BaseSkill):
    """Description of what this skill does."""

    category = SkillCategory.TECHNICAL
    name = "trade_signal_scanner"
    description = "描述这个 Skill 的功能"

    async def execute(self, **kwargs) -> SkillResult:
        """Execute the skill with given parameters."""
        try:
            # 1. Parse parameters
            symbol = kwargs.get("symbol", "")
            # 2. Do the work
            # ...
            return SkillResult(success=True, data={"result": "..."})
        except Exception as e:
            logger.error(f"Skill error: {e}")
            return SkillResult(success=False, error=str(e))


# Auto-register
skill_registry.register(TradeSignalScannerSkill())
'''


@router.post("/skills/create")
async def create_skill(req: dict):
    """Create a new skill from natural language description using LLM."""
    description = req.get("description", "").strip()
    if not description:
        return {"status": "error", "message": "description is required"}

    # Build LLM prompt to generate skill code
    prompt = f"""你是一个 Python 交易系统专家。请根据用户的自然语言描述，生成一个完整的 Skill 实现代码。

要求：
1. 继承 BaseSkill 类，设置 category/name/description
2. name 使用 snake_case，英文命名
3. description 使用中文，简短描述功能
4. category 从以下选一个最合适的：market_data, technical, fundamental, nlp, llm_reasoning, execution
5. execute 方法必须实现具体逻辑，不能只返回空结果
6. 如果功能需要行情数据，可以 `from ...services.market_data import market_service` 调用 market_service.get_quote() / get_kline() / get_indices()
7. 代码末尾必须调用 skill_registry.register(YourSkill()) 自动注册
8. 不要包含 skill_registry.alias() 调用
9. 只输出 Python 代码，不要包含 markdown 代码块标记

参考模板：
{SKILL_TEMPLATE_EXAMPLE}

用户需求：
{description}
"""

    try:
        llm = llm_manager.get_provider()
        response = await llm.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="你是一个专业的 Python 量化交易系统开发者，擅长编写可运行的交易策略代码。只输出有效的 Python 代码，不要有任何解释。",
        )
        code = response.content.strip()
        # Strip markdown code blocks if LLM added them anyway
        if code.startswith("```"):
            lines = code.split("\n")
            code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    except Exception as e:
        logger.error(f"LLM generation failed: {e}")
        return {"status": "error", "message": f"LLM 生成失败: {e}"}

    # Extract skill name from code
    name_match = re.search(r'name\s*=\s*"([^"]+)"', code)
    if not name_match:
        return {"status": "error", "message": "无法从生成代码中提取 skill name"}
    skill_name = name_match.group(1)

    # Validate file name
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', skill_name).strip('_')
    if not safe_name:
        return {"status": "error", "message": f"无效的 skill name: {skill_name}"}

    # Check for duplicates
    filepath = SKILLS_DIR / f"{safe_name}.py"
    if filepath.exists():
        return {"status": "duplicate", "message": f"Skill '{safe_name}' 已存在", "name": safe_name}

    # Write file
    try:
        SKILLS_DIR.mkdir(parents=True, exist_ok=True)
        filepath.write_text(code, encoding="utf-8")
        logger.info(f"Created skill file: {filepath}")
    except Exception as e:
        return {"status": "error", "message": f"写入文件失败: {e}"}

    # Try to import and register
    try:
        import importlib.util
        module_name = f"app.agent.skills.{safe_name}"
        spec = importlib.util.spec_from_file_location(module_name, filepath)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            logger.info(f"Hot-loaded new skill: {safe_name}")
    except Exception as e:
        logger.warning(f"Skill hot-load failed (will load on restart): {e}")

    return {
        "status": "created",
        "name": safe_name,
        "file": f"skills/{safe_name}.py",
        "code": code,
    }


@router.get("/skills/{name}/source")
async def get_skill_source(name: str):
    """Get the source code of a skill."""
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', name).strip('_')
    filepath = SKILLS_DIR / f"{safe_name}.py"

    if not filepath.exists():
        return {"status": "not_found", "name": safe_name}

    return {
        "name": safe_name,
        "source": filepath.read_text(encoding="utf-8"),
        "file": f"skills/{safe_name}.py",
    }


@router.put("/skills/{name}")
async def update_skill(name: str, req: dict):
    """Update a skill's source code."""
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', name).strip('_')
    filepath = SKILLS_DIR / f"{safe_name}.py"

    if not filepath.exists():
        return {"status": "not_found", "name": safe_name}

    source = req.get("source", "")
    if not source.strip():
        return {"status": "error", "message": "source is required"}

    try:
        filepath.write_text(source, encoding="utf-8")
        logger.info(f"Updated skill: {safe_name}")

        # Try to reload
        try:
            import importlib.util
            module_name = f"app.agent.skills.{safe_name}"
            spec = importlib.util.spec_from_file_location(module_name, filepath)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                logger.info(f"Hot-reloaded skill: {safe_name}")
        except Exception as e:
            logger.warning(f"Skill reload failed (will load on restart): {e}")

        return {"status": "updated", "name": safe_name}
    except Exception as e:
        return {"status": "error", "message": f"写入文件失败: {e}"}


# ── Agent Roles ──

_active_agent_role: str = ""  # empty = default


@router.get("/roles")
async def list_agent_roles():
    """List all registered agent roles."""
    from ..agent.roles import agent_registry
    return {
        "roles": [
            {
                "name": name,
                "display_name": role.display_name,
                "description": role.description,
                "allowed_skills": role.allowed_skills,
                "allowed_channels": role.allowed_channels,
                "safety": role.safety,
            }
            for name, role in sorted(agent_registry._agents.items())
        ],
        "active": _active_agent_role or "default",
    }


@router.post("/role")
async def set_agent_role(req: dict):
    """Switch the active agent role."""
    global _active_agent_role
    role_name = req.get("role", "")
    from ..agent.roles import agent_registry

    if role_name == "" or role_name == "default":
        _active_agent_role = ""
        logger.info("Agent role reset to default")
        return {"role": "default"}

    role = agent_registry.get(role_name)
    if role is None:
        return {"error": f"Role not found: {role_name}"}

    _active_agent_role = role_name
    logger.info(f"Agent role switched to: {role_name} ({role.display_name})")
    return {"role": role_name, "display_name": role.display_name}


@router.get("/workflows")
async def list_workflows():
    """List all registered workflows."""
    from ..workflows.engine import workflow_registry
    return workflow_registry.list_all()


@router.post("/workflows/run")
async def run_workflow(req: dict):
    """Run a workflow by name with inputs."""
    from ..workflows.engine import get_engine, workflow_registry

    wf_name = req.get("workflow", "")
    inputs = req.get("inputs", {})

    if not wf_name:
        return {"error": "workflow name required"}

    wf = workflow_registry.get(wf_name)
    if wf is None:
        return {"error": f"Workflow not found: {wf_name}"}

    engine = get_engine()
    try:
        run = await engine.run(wf_name, inputs)
        return run.to_dict()
    except Exception as e:
        return {"status": "failed", "error": str(e), "stages": []}


@router.get("/channels")
async def list_channels():
    """List all active channels with feed health stats."""
    from ..channels.registry import channel_registry
    from ..channels.feed_runner import feed_status

    snapshot = channel_registry.snapshot()

    # Enhance feeds with runner status
    fs = feed_status()
    enhanced_feeds = {}
    for name, cls_name in snapshot.get("feeds", {}).items():
        enhanced_feeds[name] = {
            "class": cls_name,
            "healthy": fs.get(name, {}).get("running", False),
        }

    return {
        "feeds": enhanced_feeds,
        "alerts": {
            name: {"class": cls_name}
            for name, cls_name in snapshot.get("alerts", {}).items()
        },
        "brokers": {
            name: {"class": cls_name}
            for name, cls_name in snapshot.get("brokers", {}).items()
        },
        "stats": {
            "feed_runners": {k: v["running"] for k, v in fs.items()},
        },
    }


# ── Channels CRUD ──

CHANNEL_TYPES = {
    "feeds": {
        "eastmoney": {
            "label": "东方财富",
            "desc": "A股实时行情数据推送",
            "fields": ["poll_interval"],
        },
    },
    "alerts": {
        "dingtalk": {
            "label": "钉钉",
            "desc": "钉钉群机器人 Webhook 推送",
            "fields": ["webhook_url"],
        },
        "feishu": {
            "label": "飞书",
            "desc": "飞书群机器人 Webhook 推送（交互式卡片）",
            "fields": ["webhook_url"],
        },
        "wecom": {
            "label": "企业微信",
            "desc": "企业微信群机器人 Webhook 推送",
            "fields": ["webhook_url"],
        },
    },
    "brokers": {
        "paper": {
            "label": "模拟券商",
            "desc": "本地模拟交易撮合引擎",
            "fields": ["initial_cash"],
        },
        "eastmoney": {
            "label": "东方财富模拟",
            "desc": "东方财富模拟交易接口",
            "fields": ["initial_cash"],
        },
    },
}


@router.get("/channels/types")
async def get_channel_types():
    """List supported channel types with their descriptions."""
    return {"types": CHANNEL_TYPES}


@router.get("/channels/config")
async def get_channels_config():
    """Return current channels.yaml configuration."""
    from pathlib import Path
    import yaml

    config_path = Path(__file__).resolve().parent.parent.parent.parent / "config" / "channels.yaml"
    if not config_path.exists():
        return {"config": {}}

    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

    # Mask webhook URLs for security
    masked = {}
    for section in ("feeds", "alerts", "brokers"):
        masked[section] = {}
        for name, cfg in (config.get(section, {}) or {}).items():
            if isinstance(cfg, dict):
                c = dict(cfg)
                if "webhook_url" in c and c["webhook_url"]:
                    u = c["webhook_url"]
                    c["webhook_url"] = u[:30] + "***" if len(u) > 30 else "***"
                masked[section][name] = c
            else:
                masked[section][name] = cfg
    return {"config": masked}


@router.put("/channels/config")
async def update_channels_config(req: dict):
    """Update a channel config entry in channels.yaml (partial update)."""
    from pathlib import Path
    import yaml

    section = req.get("section", "")  # feeds / alerts / brokers
    name = req.get("name", "")
    settings = req.get("settings", {})

    if not section or not name:
        return {"status": "error", "message": "section and name required"}

    config_path = Path(__file__).resolve().parent.parent.parent.parent / "config" / "channels.yaml"
    current = {}
    if config_path.exists():
        try:
            current = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        except Exception:
            current = {}

    # Ensure sections exist
    for s in ("feeds", "alerts", "brokers"):
        if s not in current:
            current[s] = {}

    # Update the specific channel
    if name not in current[section]:
        current[section][name] = {}
    current[section][name].update(settings)

    # Write back
    config_path.write_text(yaml.dump(current, allow_unicode=True, default_flow_style=False), encoding="utf-8")

    logger.info(f"Channel config updated: {section}/{name} → {settings}")
    return {"status": "ok", "section": section, "name": name}


@router.post("/channels/test")
async def test_channel(req: dict):
    """Send a test alert to a specific channel."""
    from ..channels.registry import channel_registry

    channel_type = req.get("type", "")  # alert / feed / broker
    channel_name = req.get("name", "")

    if channel_type == "alert":
        ch = channel_registry.get_alert(channel_name)
        if ch:
            ok = await ch.send("🧪 测试消息", "这是一条来自 Harness Trading 的测试消息，如果您看到此消息，说明告警通道配置成功！", "info")
            return {"status": "sent" if ok else "failed", "channel": channel_name}
        return {"status": "not_found", "channel": channel_name}

    return {"status": "unsupported", "message": f"Test not supported for channel type: {channel_type}"}


@router.get("/knowledge/search")
async def search_knowledge(q: str = "", top_k: int = 5):
    """Search knowledge garden with BM25."""
    from ..knowledge.garden import get_garden
    g = get_garden()
    return {"query": q, "results": g.search(q, top_k)}


@router.get("/knowledge/candidates")
async def list_knowledge_candidates():
    """List knowledge entries with status=candidate."""
    from ..knowledge.garden import get_garden
    return {"candidates": get_garden().list_candidates()}


@router.post("/knowledge/promote")
async def promote_knowledge(req: dict):
    """Promote a candidate knowledge entry."""
    from ..knowledge.garden import get_garden
    entry_id = req.get("id", "")
    if not entry_id:
        return {"error": "id required"}
    ok = get_garden().promote(entry_id)
    return {"id": entry_id, "promoted": ok}


@router.get("/knowledge/stats")
async def knowledge_stats():
    """Get knowledge garden statistics."""
    from ..knowledge.garden import get_garden
    return get_garden().stats


@router.get("/knowledge/list")
async def list_knowledge():
    """List all knowledge entries."""
    from ..knowledge.garden import get_garden
    return {"entries": get_garden().list_all()}


@router.get("/knowledge/{entry_id}")
async def get_knowledge_entry(entry_id: str):
    """Get full content of a knowledge entry."""
    from ..knowledge.garden import get_garden
    entry = get_garden().get_entry(entry_id)
    if not entry:
        return {"error": "not_found"}
    return entry


@router.post("/knowledge/create")
async def create_knowledge(req: dict):
    """Create a new knowledge entry."""
    from ..knowledge.garden import get_garden
    from uuid import uuid4

    title = req.get("title", "").strip()
    content = req.get("content", "").strip()
    if not title or not content:
        return {"error": "title and content required"}

    entry_id = req.get("id") or str(uuid4())[:12]
    tags = req.get("tags", [])
    category = req.get("category", "")
    source = req.get("source", "")

    ok = get_garden().create_entry(
        entry_id=entry_id,
        title=title,
        content=content,
        tags=tags,
        category=category,
        source=source,
    )
    return {"id": entry_id, "created": ok}


@router.delete("/knowledge/{entry_id}")
async def delete_knowledge(entry_id: str):
    """Delete a knowledge entry."""
    from ..knowledge.garden import get_garden
    ok = get_garden().delete_entry(entry_id)
    return {"id": entry_id, "deleted": ok}


@router.get("/providers")
async def list_providers():
    """List all configured LLM providers."""
    providers = []
    for pid, p in llm_manager._providers.items():
        providers.append({
            "id": pid,
            "provider": p.__class__.__name__.replace("Provider", ""),
            "model": getattr(p, "model", ""),
            "enabled": getattr(p, "enabled", True),
        })
    routing = llm_manager._routing
    return {"providers": providers, "routing": routing if routing else {}}


@router.websocket("/ws")
async def agent_websocket(websocket: WebSocket):
    """WebSocket for real-time agent communication."""
    await websocket.accept()
    logger.info("WebSocket client connected")

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "chat")

            if msg_type == "chat":
                # Simulate thinking steps
                steps = [
                    {"type": "skill", "title": "获取市场数据", "detail": "正在拉取实时行情..."},
                    {"type": "skill", "title": "技术分析", "detail": "计算MACD、RSI..."},
                    {"type": "reasoning", "title": "AI推理", "detail": "综合分析中..."},
                ]

                for step in steps:
                    await websocket.send_json({
                        "type": "thinking_step",
                        "data": step,
                    })
                    import asyncio
                    await asyncio.sleep(0.8)

                # Try LLM response
                try:
                    messages = [
                        Message(role="user", content=data.get("message", "")),
                    ]
                    response_text = ""
                    async for token in llm_manager.stream(
                        messages=messages,
                        task_type=TaskType.CHAT,
                        system_prompt="你是专业交易助手，用中文回答。",
                    ):
                        response_text += token

                    await websocket.send_json({
                        "type": "response",
                        "data": response_text,
                    })
                except Exception as e:
                    await websocket.send_json({
                        "type": "response",
                        "data": f"当前使用本地Mock模式: {str(e)}",
                    })

                await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
