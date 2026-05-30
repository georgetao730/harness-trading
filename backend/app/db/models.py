"""SQLAlchemy ORM models for persistence.

Tables:
  - trade_records: logged paper/real trades
  - eval_results: eval suite run results
  - workflow_runs: workflow execution history
  - knowledge_docs: indexed knowledge documents
  - market_snapshots: periodic market data snapshots
"""

from __future__ import annotations

import datetime
from typing import Any, Optional

from sqlalchemy import Float, Integer, String, Text, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class TradeRecord(Base):
    """One row per trade (entry + exit are separate rows)."""

    __tablename__ = "trade_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_id: Mapped[str] = mapped_column(String(64), index=True, comment="ULID or UUID")
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    side: Mapped[str] = mapped_column(String(8), comment="buy / sell")
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)
    mode: Mapped[str] = mapped_column(String(16), default="dry_run", comment="dry_run / paper / live")
    status: Mapped[str] = mapped_column(String(16), default="filled")
    tags: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True,
    )

    def __repr__(self) -> str:
        return f"<TradeRecord {self.symbol} {self.side} {self.quantity}@{self.price}>"


class EvalResult(Base):
    """One row per eval suite run."""

    __tablename__ = "eval_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    suite_name: Mapped[str] = mapped_column(String(128), index=True)
    model: Mapped[str] = mapped_column(String(64))
    total: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON array of case results")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True,
    )


class WorkflowRun(Base):
    """One row per workflow execution."""

    __tablename__ = "workflow_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(64), index=True, comment="ULID")
    workflow_name: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    inputs_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stages_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON array of stage results")
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True,
    )


class KnowledgeDoc(Base):
    """One row per indexed knowledge document."""

    __tablename__ = "knowledge_docs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, comment="ULID")
    title: Mapped[str] = mapped_column(String(256))
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(256), default="manual")
    tags: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    indexed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True,
    )


class MarketSnapshot(Base):
    """Periodic market data snapshot for offline analysis."""

    __tablename__ = "market_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(64))
    price: Mapped[float] = mapped_column(Float)
    change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    volume: Mapped[int] = mapped_column(Integer, default=0)
    snapshot_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, index=True, comment="When this snapshot was taken",
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(),
    )


class WatchlistItem(Base):
    """User's watched stocks/symbols."""

    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(32), unique=True, index=True, comment="e.g. 600519.SH")
    name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="Stock name")
    note: Mapped[Optional[str]] = mapped_column(String(256), nullable=True, comment="User note")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(),
    )


class TradeJournal(Base):
    """Trade journal — full lifecycle from entry to exit with review."""

    __tablename__ = "trade_journal"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, comment="ULID")
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    direction: Mapped[str] = mapped_column(String(8), comment="long / short")

    entry_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    entry_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    entry_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    entry_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    exit_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    exit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exit_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="Realized P&L")
    pnl_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="open", comment="open / closed")

    review: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Post-trade review")
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="1-5 self rating")
    tags: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True,
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, nullable=True, onupdate=func.now(),
    )
