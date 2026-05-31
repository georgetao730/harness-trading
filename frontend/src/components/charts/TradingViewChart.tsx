'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  className?: string;
}

// Symbol format conversion: project → TradingView
const SYMBOL_MAP: Record<string, string> = {
  // Stock indices
  '000001.SH': 'SSE:000001',
  '399001.SZ': 'SZSE:399001',
  '399006.SZ': 'SZSE:399006',
  '000688.SH': 'SSE:000688',
  // Default conversions by prefix
};

/** Convert project symbol to TradingView symbol format */
function toTvSymbol(symbol: string): string {
  // Check exact match first
  if (SYMBOL_MAP[symbol]) return SYMBOL_MAP[symbol];

  // Crypto: BTCUSDT → BINANCE:BTCUSDT
  if (/^[A-Z]+USDT$/.test(symbol)) {
    return `BINANCE:${symbol}`;
  }

  // A股: 600519.SH → SSE:600519, 000858.SZ → SZSE:000858
  if (symbol.endsWith('.SH')) {
    return `SSE:${symbol.replace('.SH', '')}`;
  }
  if (symbol.endsWith('.SZ')) {
    return `SZSE:${symbol.replace('.SZ', '')}`;
  }

  return symbol;
}

const CHART_THEME = {
  bg: '#14141f',
  grid: '#1e1e30',
  text: '#64748b',
};

export function TradingViewChart({
  symbol,
  height = 400,
  className,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const tvSymbol = toTvSymbol(symbol);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous widget
    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch {}
      widgetRef.current = null;
    }

    // Clear container for re-render
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (!containerRef.current) return;

      try {
        widgetRef.current = new (window as any).TradingView.widget({
          container: containerRef.current,
          symbol: tvSymbol,
          interval: 'D',
          theme: 'dark',
          style: '1',           // 1=candles, 2=area, 3=bars
          locale: 'zh_CN',
          toolbar_bg: CHART_THEME.bg,
          width: '100%',
          height,
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          save_image: true,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
          ],
          overrides: {
            'paneProperties.background': CHART_THEME.bg,
            'paneProperties.backgroundGradientStart': CHART_THEME.bg,
            'paneProperties.backgroundGradientEnd': CHART_THEME.bg,
            'paneProperties.vertGridProperties.color': CHART_THEME.grid,
            'paneProperties.horzGridProperties.color': CHART_THEME.grid,
          },
        });
      } catch (e) {
        console.warn('TradingView widget failed to load:', e);
      }
    };

    containerRef.current.appendChild(script);

    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvSymbol, height]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={containerRef}
        className="tradingview-widget-container rounded-xl overflow-hidden border border-[var(--color-border)]"
        style={{ height }}
      />
    </div>
  );
}
