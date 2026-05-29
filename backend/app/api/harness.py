"""Harness API Routes - Safety harness management"""

from fastapi import APIRouter
from loguru import logger

from ..harness.pipeline import harness_pipeline
from ..harness.engine import ExecutionMode

router = APIRouter(prefix="/api/harness", tags=["harness"])


@router.get("/status")
async def get_harness_status():
    """Get full harness status."""
    cb = harness_pipeline.circuit_breaker
    return {
        "mode": harness_pipeline.mode.value,
        "circuit_breaker": cb.status,
    }


@router.post("/circuit-breaker/trigger")
async def trigger_circuit_breaker(reason: str = "Manual trigger"):
    """Manually trigger the circuit breaker."""
    harness_pipeline.trigger_circuit_breaker(reason)
    return {"status": "triggered", "reason": reason}


@router.post("/circuit-breaker/reset")
async def reset_circuit_breaker():
    """Reset the circuit breaker."""
    harness_pipeline.reset_circuit_breaker()
    return {"status": "reset"}


@router.post("/mode")
async def set_mode(mode: str):
    """Change execution mode."""
    harness_pipeline.set_mode(ExecutionMode(mode))
    return {"mode": harness_pipeline.mode.value}


@router.get("/config")
async def get_harness_config():
    """Get full harness configuration (rules, risk controls, etc.)."""
    return {
        "mode": harness_pipeline.mode.value,
        "validator_rules": [
            {
                "id": "price_check",
                "name": "价格校验",
                "description": "订单价格偏离市价超过阈值时拦截",
                "enabled": True,
                "value": "3%",
                "type": "select",
                "options": ["1%", "2%", "3%", "5%", "10%"],
            },
            {
                "id": "qty_check",
                "name": "数量校验",
                "description": "单笔数量超过持仓上限时拦截",
                "enabled": True,
                "value": "10000股",
                "type": "number",
            },
            {
                "id": "market_order",
                "name": "禁止市价单",
                "description": "不允许提交市价单，强制限价单",
                "enabled": True,
                "value": "启用",
                "type": "toggle",
            },
            {
                "id": "time_check",
                "name": "交易时间校验",
                "description": "非交易时段自动拦截所有订单",
                "enabled": True,
                "value": "启用",
                "type": "toggle",
            },
            {
                "id": "freq_limit",
                "name": "频率限制",
                "description": "限制短时间内下单次数",
                "enabled": True,
                "value": "5笔/30分钟",
                "type": "select",
                "options": ["3笔/30分钟", "5笔/30分钟", "10笔/30分钟"],
            },
        ],
        "risk_controls": [
            {
                "id": "daily_loss",
                "name": "单日亏损上限",
                "description": "触及后自动熔断，当日禁止交易",
                "enabled": True,
                "value": "5%",
                "type": "select",
                "options": ["2%", "3%", "5%", "8%", "10%"],
            },
            {
                "id": "position_limit",
                "name": "持仓集中度",
                "description": "单只股票最大持仓占比",
                "enabled": True,
                "value": "30%",
                "type": "select",
                "options": ["20%", "25%", "30%", "40%"],
            },
            {
                "id": "single_amount",
                "name": "单笔金额上限",
                "description": "单笔交易最大金额",
                "enabled": True,
                "value": "100,000",
                "type": "number",
            },
            {
                "id": "max_leverage",
                "name": "最大杠杆",
                "description": "融资融券最大杠杆倍数",
                "enabled": False,
                "value": "1x",
                "type": "select",
                "options": ["1x", "1.5x", "2x"],
            },
        ],
        "circuit_breaker": {
            "triggered": harness_pipeline.circuit_breaker.is_triggered,
            "reason": harness_pipeline.circuit_breaker.status["reason"],
            "cooldown_minutes": 1440,
            "auto_reset": False,
        },
    }
