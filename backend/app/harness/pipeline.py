"""Harness Pipeline - Orchestrates validation + risk + circuit breaker"""

from pathlib import Path
from typing import Optional

import yaml
from loguru import logger

from .engine import (
    CircuitBreaker,
    ExecutionMode,
    OrderApproval,
    OrderIntent,
    RiskController,
    ValidatorChain,
    ValidationStatus,
)
from ..core.events import EventType, event_bus


def _load_harness_config(path: str = "config/harness.yaml") -> dict:
    p = Path(path)
    if not p.exists():
        p = Path(__file__).parent.parent.parent.parent / path
    if not p.exists():
        logger.warning(f"Harness config not found at {path}, using defaults")
        return {}
    try:
        return yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception as e:
        logger.warning(f"Failed to parse harness config: {e}")
        return {}


class HarnessPipeline:
    """Complete safety pipeline that all orders must pass through."""

    def __init__(
        self,
        validator_config: dict = None,
        risk_config: dict = None,
        circuit_config: dict = None,
        config_path: str = "config/harness.yaml",
    ):
        # Auto-load from yaml when callers don't pass explicit configs
        if validator_config is None or risk_config is None or circuit_config is None:
            full = _load_harness_config(config_path)
            validator_config = validator_config or full.get("validator_chain", {})
            risk_config = risk_config or full.get("risk_controller", {})
            circuit_config = circuit_config or full.get("circuit_breaker", {})

        self.mode = ExecutionMode.DRY_RUN
        self.validator_config = validator_config
        self.risk_config = risk_config
        self.validator = ValidatorChain(validator_config)
        self.risk_controller = RiskController(risk_config)
        self.circuit_breaker = CircuitBreaker(circuit_config)

    async def process_order(
        self,
        intent: OrderIntent,
        portfolio_value: Optional[float] = None,
        market_data: dict = None,
    ) -> OrderApproval:
        """Process an order through the entire safety pipeline."""

        # Step 0: Check circuit breaker
        if self.circuit_breaker.is_triggered:
            logger.warning("Circuit breaker active - rejecting all orders")
            await event_bus.publish(EventType.ORDER_REJECTED, {
                "symbol": intent.symbol,
                "reason": "Circuit breaker active",
            })
            return OrderApproval(
                intent=intent,
                approved=False,
                mode=self.mode,
                requires_approval=False,
                final_action="reject",
                risk_warnings=["熔断已触发，禁止交易"],
            )

        # Step 1: Validator Chain
        logger.info(f"Running validator chain for {intent.symbol} {intent.action}")
        validation_results = await self.validator.validate(intent, market_data)

        rejected = [r for r in validation_results if r.status == ValidationStatus.REJECT]
        if rejected:
            await event_bus.publish(EventType.VALIDATION_FAILED, {
                "symbol": intent.symbol,
                "checks": [{"name": r.check_name, "message": r.message} for r in rejected],
            })
            return OrderApproval(
                intent=intent,
                approved=False,
                mode=self.mode,
                requires_approval=False,
                validation_results=validation_results,
                final_action="reject",
            )

        # Step 2: Risk Controller - pull live portfolio snapshot
        portfolio_value, positions = self._snapshot_portfolio(portfolio_value)
        risk_warnings = await self.risk_controller.check(
            intent, portfolio_value=portfolio_value, positions=positions
        )

        # Step 3: Mode-based routing
        if self.mode == ExecutionMode.DRY_RUN:
            final_action = "dry_run_log"
            requires_approval = False
        elif self.mode == ExecutionMode.APPROVAL:
            final_action = "queue_for_approval"
            requires_approval = True
        else:  # AUTO
            # In auto mode, check risk warnings - escalate to approval if risky
            if risk_warnings:
                final_action = "queue_for_approval"
                requires_approval = True
            else:
                final_action = "execute"
                requires_approval = False

        logger.info(
            f"Order {intent.symbol} {intent.action}: "
            f"mode={self.mode.value}, action={final_action}, "
            f"warnings={len(risk_warnings)}"
        )

        return OrderApproval(
            intent=intent,
            approved=(final_action == "execute" or final_action == "dry_run_log"),
            mode=self.mode,
            requires_approval=requires_approval,
            validation_results=validation_results,
            risk_warnings=risk_warnings,
            final_action=final_action,
        )

    @staticmethod
    def _snapshot_portfolio(override_value: Optional[float]):
        """Get current portfolio value + per-symbol market values from paper engine."""
        try:
            # Local import avoids circular dep at module load
            from ..execution.paper_trading import paper_engine
            summary = paper_engine.get_portfolio_summary()
            value = override_value if override_value is not None else summary.get("total_value", 100000)
            positions = {sym: p.market_value for sym, p in paper_engine.positions.items()}
            return value, positions
        except Exception as e:
            logger.debug(f"Portfolio snapshot unavailable: {e}")
            return (override_value if override_value is not None else 100000), {}

    def set_mode(self, mode: ExecutionMode):
        self.mode = mode
        logger.info(f"Execution mode changed to {mode.value}")

    def trigger_circuit_breaker(self, reason: str = "Manual trigger"):
        self.circuit_breaker.trigger(reason)

    def reset_circuit_breaker(self):
        self.circuit_breaker.reset()


# Global harness instance with defaults
harness_pipeline = HarnessPipeline()
