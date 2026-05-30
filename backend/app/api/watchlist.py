"""Watchlist API — manage watched stocks and get real-time quotes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ..db.database import get_db
from ..db.models import WatchlistItem
from ..services.market_data import market_service

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class AddSymbolRequest(BaseModel):
    symbol: str
    name: str | None = None
    note: str | None = None


class UpdateNoteRequest(BaseModel):
    note: str | None = None


# ── CRUD ──

@router.get("")
async def list_watchlist(db: AsyncSession = Depends(get_db)):
    """Get all watched symbols with live quotes."""
    result = await db.execute(
        select(WatchlistItem).order_by(WatchlistItem.sort_order, WatchlistItem.created_at)
    )
    items = result.scalars().all()

    symbols = [item.symbol for item in items]
    quotes_map: dict[str, dict] = {}

    # Fetch live quotes for all symbols
    if symbols:
        try:
            for sym in symbols:
                q = await market_service.get_quote(sym)
                if q:
                    quotes_map[sym] = {
                        "price": q.price,
                        "change_pct": q.change_pct,
                        "change": q.change,
                        "name": q.name,
                    }
        except Exception as e:
            logger.warning(f"Quote fetch error: {e}")

    return {
        "items": [
            {
                "id": item.id,
                "symbol": item.symbol,
                "name": item.name or quotes_map.get(item.symbol, {}).get("name", item.symbol),
                "note": item.note,
                "sort_order": item.sort_order,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "quote": quotes_map.get(item.symbol),
            }
            for item in items
        ],
        "count": len(items),
    }


@router.post("")
async def add_symbol(req: AddSymbolRequest, db: AsyncSession = Depends(get_db)):
    """Add a symbol to watchlist."""
    # Check duplicates
    existing = await db.execute(
        select(WatchlistItem).where(WatchlistItem.symbol == req.symbol)
    )
    if existing.scalar_one_or_none():
        return {"status": "duplicate", "message": f"{req.symbol} 已在自选列表中"}

    # Get next sort order
    result = await db.execute(select(WatchlistItem).order_by(WatchlistItem.sort_order.desc()).limit(1))
    last = result.scalar_one_or_none()
    next_order = (last.sort_order + 1) if last else 0

    item = WatchlistItem(
        symbol=req.symbol,
        name=req.name,
        note=req.note,
        sort_order=next_order,
    )
    db.add(item)
    await db.flush()

    # Auto-subscribe feed to this symbol
    try:
        from ..channels.registry import channel_registry
        for feed_name in channel_registry.list_feeds():
            feed = channel_registry.get_feed(feed_name)
            if feed:
                await feed.subscribe([req.symbol])
    except Exception as e:
        logger.debug(f"Feed subscribe skipped: {e}")

    logger.info(f"Watchlist added: {req.symbol}")
    return {"status": "added", "symbol": req.symbol, "id": item.id}


@router.delete("/{symbol}")
async def remove_symbol(symbol: str, db: AsyncSession = Depends(get_db)):
    """Remove a symbol from watchlist."""
    # URL-encoded symbols may have '.' → need to handle
    symbol = symbol.strip()
    await db.execute(delete(WatchlistItem).where(WatchlistItem.symbol == symbol))
    logger.info(f"Watchlist removed: {symbol}")
    return {"status": "removed", "symbol": symbol}


@router.put("/{symbol}/note")
async def update_note(symbol: str, req: UpdateNoteRequest, db: AsyncSession = Depends(get_db)):
    """Update user note for a watched symbol."""
    result = await db.execute(
        select(WatchlistItem).where(WatchlistItem.symbol == symbol.strip())
    )
    item = result.scalar_one_or_none()
    if not item:
        return {"status": "not_found"}
    item.note = req.note
    await db.flush()
    return {"status": "updated", "symbol": symbol}
