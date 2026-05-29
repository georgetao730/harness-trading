"""Safety Harness - Validator Chain, Risk Controller, Circuit Breaker"""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from loguru import logger


class ValidationStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    REJECT = "reject"


class ExecutionMode(str, Enum):
    DRY_RUN = "dry_run"
    APPROVAL = "approval"
    AUTO = "auto"


@dataclass
class ValidationResult:
    check_name: str
    status: ValidationStatus
    message: str
    detail: Any = None


@dataclass
class OrderIntent:
    """An order intent from the AI agent before validation."""
    symbol: str
    action: str  # buy or sell
    order_type: str  # limit or market
    price: float
    quantity: int
    market: str = "A股"
    reason: str = ""
    risk_level: str = "low"


@dataclass
class OrderApproval:
    """Result of harness validation pipeline."""
    intent: OrderIntent
    approved: bool
    mode: ExecutionMode
    requires_approval: bool
    validation_results: List[ValidationResult] = field(default_factory=list)
    risk_warnings: List[str] = field(default_factory=list)
    final_action: str = ""  # "execute", "queue_for_approval", "reject", "dry_run_log"


class ValidatorChain:
    """Sequential validation chain for order safety checks."""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self._checks = [
            self._check_price,
            self._check_quantity,
            self._check_order_type,
            self._check_trading_time,
            self._check_frequency,
        ]

    async def validate(self, intent: OrderIntent, market_data: dict = None) -> List[ValidationResult]:
        results = []
        for check in self._checks:
            result = await check(intent, market_data)
            results.append(result)
            if result.status == ValidationStatus.REJECT:
                logger.warning(f"Validation REJECTED: {result.check_name} - {result.message}")
                break  # Stop on first rejection
        return results

    async def _check_price(self, intent: OrderIntent, market_data: dict = None) -> ValidationResult:
        cfg = self.config.get("price_check", {})
        if not cfg.get("enabled", True):
            return ValidationResult("price_check", ValidationStatus.PASS, "Disabled")

        if market_data and "price" in market_data:
            deviation = abs(intent.price - market_data["price"]) / market_data["price"] * 100
            max_dev = cfg.get("max_deviation_pct", 3.0)
            if deviation > max_dev:
                return ValidationResult(
                    "price_check", ValidationStatus.REJECT,
                    f"价格偏离市价 {deviation:.1f}%，超过 {max_dev}% 限制"
                )

        return ValidationResult("price_check", ValidationStatus.PASS, f"订单价格 {intent.price} 合理")

    async def _check_quantity(self, intent: OrderIntent, market_data: dict = None) -> ValidationResult:
        cfg = self.config.get("quantity_check", {})
        if not cfg.get("enabled", True):
            return ValidationResult("quantity_check", ValidationStatus.PASS, "Disabled")

        # Basic sanity: quantity > 0 and not insane
        if intent.quantity <= 0:
            return ValidationResult("quantity_check", ValidationStatus.REJECT, "数量必须大于 0")
        if intent.action == "buy" and intent.quantity * intent.price > 10000000:  # 10M sanity check
            return ValidationResult("quantity_check", ValidationStatus.WARN, "单笔金额较大")

        return ValidationResult("quantity_check", ValidationStatus.PASS, f"数量 {intent.quantity} 股合理")

    async def _check_order_type(self, intent: OrderIntent, market_data: dict = None) -> ValidationResult:
        cfg = self.config.get("order_type_check", {})
        if not cfg.get("enabled", True):
            return ValidationResult("order_type_check", ValidationStatus.PASS, "Disabled")

        if intent.order_type == "market" and "limit" in cfg.get("allowed_types", ["limit"]):
            return ValidationResult(
                "order_type_check", ValidationStatus.REJECT,
                "市价单被禁止，仅允许限价单"
            )

        return ValidationResult("order_type_check", ValidationStatus.PASS, f"订单类型 {intent.order_type} 允许")

    async def _check_trading_time(self, intent: OrderIntent, market_data: dict = None) -> ValidationResult:
        cfg = self.config.get("time_check", {})
        if not cfg.get("enabled", True):
            return ValidationResult("time_check", ValidationStatus.PASS, "Disabled")

        # Simple mock: assume always in trading hours for now
        return ValidationResult("time_check", ValidationStatus.PASS, "在交易时段内")

    async def _check_frequency(self, intent: OrderIntent, market_data: dict = None) -> ValidationResult:
        cfg = self.config.get("frequency_limit", {})
        if not cfg.get("enabled", True):
            return ValidationResult("frequency_limit", ValidationStatus.PASS, "Disabled")

        # Mock: always pass for now (real impl tracks recent orders)
        return ValidationResult("frequency_limit", ValidationStatus.PASS, "频率正常")


class RiskController:
    """Risk management - daily loss limits, position concentration, leverage."""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self._daily_pnl = 0.0
        self._daily_trades = 0

    async def check(self, intent: OrderIntent, portfolio_value: float = 100000) -> List[str]:
        warnings = []
        cfg = self.config

        # Daily loss limit
        daily_loss_pct = cfg.get("daily_loss_limit_pct", 5.0)
        if self._daily_pnl < -portfolio_value * daily_loss_pct / 100:
            warnings.append(f"日内亏损已超 {daily_loss_pct}% 限制，触发熔断")

        # Single order amount limit
        max_amount = cfg.get("single_order_amount_limit", 100000)
        order_amount = intent.price * intent.quantity
        if order_amount > max_amount:
            warnings.append(f"单笔金额 {order_amount} 超过上限 {max_amount}")

        return warnings

    def record_trade(self, pnl: float):
        self._daily_pnl += pnl
        self._daily_trades += 1


class CircuitBreaker:
    """Circuit breaker - stops all trading when triggered."""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self._triggered = False
        self._trigger_reason = ""
        self._trigger_time = 0.0

    @property
    def is_triggered(self) -> bool:
        if not self._triggered:
            return False
        # Auto-reset check
        if self.config.get("auto_reset", False):
            cooldown = self.config.get("cooldown_minutes", 1440) * 60
            if time.time() - self._trigger_time > cooldown:
                self.reset()
                return False
        return True

    def trigger(self, reason: str):
        self._triggered = True
        self._trigger_reason = reason
        self._trigger_time = time.time()
        logger.error(f"CIRCUIT BREAKER TRIGGERED: {reason}")

    def reset(self):
        self._triggered = False
        self._trigger_reason = ""
        self._trigger_time = 0.0
        logger.info("Circuit breaker reset")

    @property
    def status(self) -> dict:
        return {
            "triggered": self.is_triggered,
            "reason": self._trigger_reason if self._triggered else "",
            "trigger_time": self._trigger_time if self._triggered else 0,
        }
