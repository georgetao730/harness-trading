"""Channels — pluggable data/execution/alert pipelines (Phase 2).

Import path: from app.channels import channel_registry, BrokerChannel, ...
"""

from .protocol import AlertChannel, BrokerChannel, FeedChannel
from .registry import ChannelRegistry, channel_registry

__all__ = [
    "AlertChannel",
    "BrokerChannel",
    "ChannelRegistry",
    "FeedChannel",
    "channel_registry",
]
