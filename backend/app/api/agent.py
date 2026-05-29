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

    # Simulate thinking steps (would be streamed via WebSocket in production)
    thinking_steps = [
        {"type": "skill", "title": "分析请求", "detail": f"解析用户输入: {request.message[:50]}..."},
        {"type": "reasoning", "title": "AI推理中", "detail": "综合分析..."},
    ]

    # Get LLM response
    try:
        response = await llm_manager.chat(
            messages=messages,
            task_type=task_type,
            system_prompt="你是一个专业的股票交易助手。请用中文简洁回答。",
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
async def set_mode(mode: str):
    """Set execution mode: dry_run, approval, auto."""
    harness_pipeline.set_mode(ExecutionMode(mode))
    return {"mode": harness_pipeline.mode.value}


@router.get("/skills")
async def list_skills():
    """List all available skills."""
    from ..agent.skills.base import skill_registry
    return {"skills": skill_registry.list_all()}


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
