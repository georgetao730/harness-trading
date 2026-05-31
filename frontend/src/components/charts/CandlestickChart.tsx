'use client';

import type { KlineBar } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

interface CandlestickChartProps {
  data: KlineBar[];
  symbol?: string;
  height?: number;
  className?: string;
}

const COLORS = {
  bg: '#14141f',
  text: '#64748b',
  border: '#2a2a3d',
  green: '#22c55e',
  red: '#ef4444',
  volumeUp: 'rgba(34, 197, 94, 0.3)',
  volumeDown: 'rgba(239, 68, 68, 0.3)',
};

export function CandlestickChart({
  data,
  symbol,
  height = 400,
  className,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
      },
      grid: {
        vertLines: { color: COLORS.border },
        horzLines: { color: COLORS.border },
      },
      rightPriceScale: {
        borderColor: COLORS.border,
      },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.green,
      downColor: COLORS.red,
      borderUpColor: COLORS.green,
      borderDownColor: COLORS.red,
      wickUpColor: COLORS.green,
      wickDownColor: COLORS.red,
    });

    const candleData = data.map((bar) => ({
      time: bar.date as any,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeries.setData(candleData);

    // Volume series (bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const volumeData = data.map((bar) => ({
      time: bar.date as any,
      value: bar.volume,
      color: bar.close >= bar.open ? COLORS.volumeUp : COLORS.volumeDown,
    }));

    volumeSeries.setData(volumeData);

    // Fit content
    chart.timeScale().fitContent();

    // Resize handler
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, height]);

  return (
    <div className={cn('relative', className)}>
      {symbol && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">
            {symbol}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">日K</span>
        </div>
      )}
      {data.length === 0 ? (
        <div
          className="flex items-center justify-center text-xs text-[var(--color-text-muted)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          style={{ height }}
        >
          暂无 K 线数据
        </div>
      ) : (
        <div
          ref={containerRef}
          className="rounded-xl overflow-hidden border border-[var(--color-border)]"
          style={{ height }}
        />
      )}
    </div>
  );
}
