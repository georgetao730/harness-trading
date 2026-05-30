"""Trade Journal API — full lifecycle trade tracking and review."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ..db.database import get_db
from ..db.models import TradeJournal

router = APIRouter(prefix="/api/journal", tags=["journal"])


class JournalEntryOut(BaseModel):
    id: int
    journal_id: str
    symbol: str
    name: Optional[str] = None
    direction: str
    entry_date: Optional[str] = None
    entry_price: Optional[float] = None
    entry_quantity: Optional[int] = None
    entry_reason: Optional[str] = None
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    status: str
    review: Optional[str] = None
    rating: Optional[int] = None
    tags: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class CreateEntryRequest(BaseModel):
    symbol: str
    name: str | None = None
    direction: str = "long"
    entry_price: float | None = None
    entry_quantity: int | None = None
    entry_reason: str | None = None
    tags: str | None = None


class UpdateEntryRequest(BaseModel):
    exit_price: float | None = None
    exit_reason: str | None = None
    review: str | None = None
    rating: int | None = None
    tags: str | None = None


def _to_out(item: TradeJournal) -> JournalEntryOut:
    return JournalEntryOut(
        id=item.id,
        journal_id=item.journal_id,
        symbol=item.symbol,
        name=item.name,
        direction=item.direction,
        entry_date=item.entry_date.isoformat() if item.entry_date else None,
        entry_price=item.entry_price,
        entry_quantity=item.entry_quantity,
        entry_reason=item.entry_reason,
        exit_date=item.exit_date.isoformat() if item.exit_date else None,
        exit_price=item.exit_price,
        exit_reason=item.exit_reason,
        pnl=item.pnl,
        pnl_pct=item.pnl_pct,
        status=item.status,
        review=item.review,
        rating=item.rating,
        tags=item.tags,
        created_at=item.created_at.isoformat() if item.created_at else None,
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
    )


# ── CRUD ──

@router.get("")
async def list_journal(
    status: str | None = Query(None, description="Filter: open / closed"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List trade journal entries, newest first."""
    q = select(TradeJournal).order_by(TradeJournal.created_at.desc()).limit(limit)
    if status:
        q = q.where(TradeJournal.status == status)
    result = await db.execute(q)
    items = result.scalars().all()
    return {"entries": [_to_out(item) for item in items], "count": len(items)}


@router.post("")
async def create_entry(req: CreateEntryRequest, db: AsyncSession = Depends(get_db)):
    """Create a new trade journal entry (open a position)."""
    jid = str(uuid.uuid4())[:12]

    entry = TradeJournal(
        journal_id=jid,
        symbol=req.symbol,
        name=req.name,
        direction=req.direction,
        entry_date=datetime.now(),
        entry_price=req.entry_price,
        entry_quantity=req.entry_quantity,
        entry_reason=req.entry_reason,
        tags=req.tags,
        status="open",
    )
    db.add(entry)
    await db.flush()

    logger.info(f"Trade journal created: {jid} {req.symbol} {req.direction}")
    return _to_out(entry)


@router.put("/{journal_id}")
async def update_entry(journal_id: str, req: UpdateEntryRequest, db: AsyncSession = Depends(get_db)):
    """Update a journal entry (close position, add review)."""
    result = await db.execute(
        select(TradeJournal).where(TradeJournal.journal_id == journal_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return {"status": "not_found"}

    if req.exit_price is not None and entry.entry_price:
        entry.exit_price = req.exit_price
        entry.exit_date = datetime.now()
        entry.exit_reason = req.exit_reason
        entry.status = "closed"

        # Calculate PnL
        if entry.entry_quantity:
            if entry.direction == "long":
                entry.pnl = (req.exit_price - entry.entry_price) * entry.entry_quantity
            else:
                entry.pnl = (entry.entry_price - req.exit_price) * entry.entry_quantity
            if entry.entry_price > 0:
                entry.pnl_pct = round((req.exit_price - entry.entry_price) / entry.entry_price * 100, 2)

    if req.review is not None:
        entry.review = req.review
    if req.rating is not None:
        entry.rating = max(1, min(5, req.rating))
    if req.tags is not None:
        entry.tags = req.tags

    entry.updated_at = datetime.now()
    await db.flush()

    logger.info(f"Trade journal updated: {journal_id} status={entry.status}")
    return _to_out(entry)


@router.delete("/{journal_id}")
async def delete_entry(journal_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a journal entry."""
    result = await db.execute(
        select(TradeJournal).where(TradeJournal.journal_id == journal_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return {"status": "not_found"}
    await db.delete(entry)
    return {"status": "deleted", "journal_id": journal_id}


@router.get("/stats")
async def journal_stats(db: AsyncSession = Depends(get_db)):
    """Get journal summary statistics."""
    result = await db.execute(select(TradeJournal))
    all_entries = result.scalars().all()

    closed = [e for e in all_entries if e.status == "closed"]
    open_entries = [e for e in all_entries if e.status == "open"]

    wins = [e for e in closed if (e.pnl or 0) > 0]
    losses = [e for e in closed if (e.pnl or 0) < 0]

    total_pnl = sum(e.pnl or 0 for e in closed)
    avg_rating = sum(e.rating or 0 for e in closed if e.rating) / max(len([e for e in closed if e.rating]), 1)

    return {
        "total_trades": len(closed),
        "open_positions": len(open_entries),
        "win_count": len(wins),
        "loss_count": len(losses),
        "win_rate": round(len(wins) / max(len(closed), 1) * 100, 1),
        "total_pnl": round(total_pnl, 2),
        "avg_pnl": round(total_pnl / max(len(closed), 1), 2),
        "avg_rating": round(avg_rating, 1),
        "best_trade": max((e.pnl or 0 for e in closed), default=0),
        "worst_trade": min((e.pnl or 0 for e in closed), default=0),
    }
