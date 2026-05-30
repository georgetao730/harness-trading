"""Tests for MarketDataService — indices, quotes, kline, caching."""

import asyncio
import time

import pytest

from app.services.market_data import (
    IndexData,
    KlineBar,
    MarketDataService,
    StockQuote,
)


class TestMarketDataService:
    """Unit tests for MarketDataService (no network, pure logic)."""

    def test_cache_operations(self):
        svc = MarketDataService(cache_ttl=60)
        assert not svc._is_cached("key1")

        svc._set_cache("key1", "value1")
        assert svc._is_cached("key1")
        assert svc._get_cache("key1") == "value1"

    def test_cache_expiry(self):
        svc = MarketDataService(cache_ttl=0)  # instant expiry
        svc._set_cache("key1", "value1")
        assert not svc._is_cached("key1")

    def test_resolve_sina_symbol_sh(self):
        assert MarketDataService._resolve_sina_symbol("600519") == "sh600519"
        assert MarketDataService._resolve_sina_symbol("600519.SH") == "sh600519"
        assert MarketDataService._resolve_sina_symbol("sh600519") == "sh600519"

    def test_resolve_sina_symbol_sz(self):
        assert MarketDataService._resolve_sina_symbol("000001.SZ") == "sz000001"
        assert MarketDataService._resolve_sina_symbol("sz000001") == "sz000001"
        assert MarketDataService._resolve_sina_symbol("300750") == "sz300750"

    def test_resolve_sina_symbol_unknown(self):
        assert MarketDataService._resolve_sina_symbol("HK.0700") is None
        assert MarketDataService._resolve_sina_symbol("AAPL") is None

    def test_get_indices_fallback(self):
        """When API fails, fallback indices should be returned."""
        svc = MarketDataService(cache_ttl=0)

        async def run():
            return await svc.get_indices()

        indices = asyncio.run(run())
        assert len(indices) > 0
        # Should contain at least the A-share indices
        names = {i.name for i in indices}
        assert "上证指数" in names
        assert "深证成指" in names
        # All should have reasonable values
        for idx in indices:
            assert idx.price > 0
            assert isinstance(idx.change_pct, float)

    def test_index_data_model(self):
        idx = IndexData(name="上证指数", code="000001.SH", price=4068.57, change_pct=-0.73)
        assert idx.name == "上证指数"
        assert idx.price == 4068.57
        assert idx.change_pct == -0.73
        assert idx.volume == 0  # default

    def test_stock_quote_model(self):
        sq = StockQuote(
            symbol="600519.SH", name="贵州茅台", price=1326.0,
            change=0, change_pct=0, open=1270.0, high=1329.0,
            low=1270.0, volume=7647805, market="A股",
        )
        assert sq.symbol == "600519.SH"
        assert sq.market == "A股"

    def test_kline_bar_model(self):
        bar = KlineBar(date="2026-05-29", open=4080.0, high=4110.0,
                       low=4055.0, close=4068.0, volume=731597710)
        assert bar.date == "2026-05-29"
        assert bar.close == 4068.0

    def test_fetch_url_with_bad_url(self):
        """_fetch_url should return None for invalid URLs."""
        svc = MarketDataService(cache_ttl=0)

        async def run():
            return await svc._fetch_url("http://invalid-host-that-does-not-exist.local/test")

        result = asyncio.run(run())
        assert result is None
