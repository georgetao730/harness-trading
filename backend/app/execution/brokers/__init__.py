"""Broker adapters — pluggable broker implementations."""

from .base import BrokerAdapter
from .paper_adapter import PaperBrokerAdapter
from .eastmoney_adapter import EastMoneyBrokerAdapter

__all__ = [
    "BrokerAdapter",
    "PaperBrokerAdapter",
    "EastMoneyBrokerAdapter",
]
