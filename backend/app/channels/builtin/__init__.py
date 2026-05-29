"""Builtin channel implementations."""

from .dingtalk_alert import DingTalkAlert
from .eastmoney_feed import EastMoneyFeed

__all__ = ["DingTalkAlert", "EastMoneyFeed"]
