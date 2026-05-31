"""Broker adapters — pluggable broker implementations."""

from .base import BrokerAdapter
from .paper_adapter import PaperBrokerAdapter
from .eastmoney_adapter import EastMoneyBrokerAdapter
from .binance_adapter import BinanceBrokerAdapter

__all__ = [
    "BrokerAdapter",
    "PaperBrokerAdapter",
    "EastMoneyBrokerAdapter",
    "BinanceBrokerAdapter",
]
