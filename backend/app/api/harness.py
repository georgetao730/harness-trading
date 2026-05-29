"""Harness API Routes - Safety harness management"""

from fastapi import APIRouter
from pydantic import BaseModel
from loguru import logger

from ..harness.pipeline import harness_pipeline
from ..harness.engine import ExecutionMode

router = APIRouter(prefix="/api/harness", tags=["harness"])


class ModeRequest(BaseModel):
    mode: str


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
async def set_mode(req: ModeRequest):
    """Change execution mode."""
    harness_pipeline.set_mode(ExecutionMode(req.mode))
    return {"mode": harness_pipeline.mode.value}


@router.get("/config")
async def get_harness_config():
    """Get full harness configuration, derived from the loaded yaml."""
    vc = harness_pipeline.validator_config or {}
    rc = harness_pipeline.risk_config or {}
    cb_cfg = harness_pipeline.circuit_breaker.config or {}

    def _section(key: str) -> dict:
        return vc.get(key) or {}

    price = _section("price_check")
    qty = _section("quantity_check")
    order_type = _section("order_type_check")
    time_chk = _section("time_check")
    freq = _section("frequency_limit")

    validator_rules = [
        {
            "id": "price_check",
            "name": "价格校验",
            "description": "订单价格偏离市价超过阈值时拦截",
            "enabled": bool(price.get("enabled", True)),
            "value": f"{price.get('max_deviation_pct', 3.0)}%",
            "type": "select",
            "options": ["1%", "2%", "3%", "5%", "10%"],
        },
        {
            "id": "qty_check",
            "name": "数量校验",
            "description": "单笔数量超过持仓上限时拦截",
            "enabled": bool(qty.get("enabled", True)),
            "value": f"{qty.get('max_single_order_pct', 10.0)}%",
            "type": "number",
        },
        {
            "id": "order_type_check",
            "name": "订单类型限制",
            "description": "仅允许配置中的订单类型",
            "enabled": bool(order_type.get("enabled", True)),
            "value": ", ".join(order_type.get("allowed_types", ["limit"])),
            "type": "toggle",
        },
        {
            "id": "time_check",
            "name": "交易时间校验",
            "description": "非交易时段自动拦截所有订单",
            "enabled": bool(time_chk.get("enabled", True)),
            "value": "启用" if time_chk.get("enabled", True) else "停用",
            "type": "toggle",
        },
        {
            "id": "freq_limit",
            "name": "频率限制",
            "description": "限制短时间内下单次数",
            "enabled": bool(freq.get("enabled", True)),
            "value": f"{freq.get('max_orders_per_window', 5)}笔/{freq.get('window_minutes', 30)}分钟",
            "type": "select",
            "options": ["3笔/30分钟", "5笔/30分钟", "10笔/30分钟"],
        },
    ]

    risk_controls = [
        {
            "id": "daily_loss",
            "name": "单日亏损上限",
            "description": "触及后自动熔断，当日禁止交易",
            "enabled": True,
            "value": f"{rc.get('daily_loss_limit_pct', 5.0)}%",
            "type": "select",
            "options": ["2%", "3%", "5%", "8%", "10%"],
        },
        {
            "id": "position_limit",
            "name": "持仓集中度",
            "description": "单只股票最大持仓占比",
            "enabled": bool(rc.get("position_concentration_pct")),
            "value": f"{rc.get('position_concentration_pct', 30.0)}%",
            "type": "select",
            "options": ["20%", "25%", "30%", "40%"],
        },
        {
            "id": "single_amount",
            "name": "单笔金额上限",
            "description": "单笔交易最大金额",
            "enabled": True,
            "value": f"{rc.get('single_order_amount_limit', 100000):,}",
            "type": "number",
        },
        {
            "id": "max_leverage",
            "name": "最大杠杆",
            "description": "融资融券最大杠杆倍数（暂未实现）",
            "enabled": False,
            "value": f"{rc.get('max_leverage', 1.0)}x",
            "type": "select",
            "options": ["1x", "1.5x", "2x"],
        },
    ]

    return {
        "mode": harness_pipeline.mode.value,
        "validator_rules": validator_rules,
        "risk_controls": risk_controls,
        "circuit_breaker": {
            "triggered": harness_pipeline.circuit_breaker.is_triggered,
            "reason": harness_pipeline.circuit_breaker.status["reason"],
            "cooldown_minutes": int(cb_cfg.get("cooldown_minutes", 1440)),
            "auto_reset": bool(cb_cfg.get("auto_reset", False)),
        },
    }
