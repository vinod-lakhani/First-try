/**
 * Simplified Net Worth Chart
 * Net worth only, no assets/liabilities.
 */

"use client";

import { useRef, useEffect } from "react";

interface NetWorthChartProps {
  labels: string[];
  netWorth: number[];
  height?: number;
}

export function NetWorthChart({
  labels,
  netWorth,
  height = 220,
}: NetWorthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!canvasRef.current || netWorth.length === 0) return;

    import("chart.js/auto").then((ChartModule) => {
      const Chart = ChartModule.default;
      if (!canvasRef.current) return;

      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      chartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Net Worth",
              data: netWorth,
              borderColor: "#16a34a",
              backgroundColor: "rgba(22, 163, 74, 0.1)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: { parsed: { y: number | null } }) => {
                  const v = ctx.parsed.y ?? 0;
                  return v >= 1e6
                    ? `$${(v / 1e6).toFixed(2)}M`
                    : v >= 1e3
                    ? `$${(v / 1e3).toFixed(1)}K`
                    : `$${v.toLocaleString()}`;
                },
              },
            },
          },
          scales: {
            x: {
              display: true,
              grid: { display: false },
              ticks: { maxTicksLimit: 6, font: { size: 10 }, color: "#9ca3af" },
            },
            y: {
              display: true,
              grid: { color: "#f3f4f6" },
              ticks: {
                font: { size: 10 },
                color: "#9ca3af",
                callback: (v: unknown) => {
                  const n = Number(v);
                  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
                  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
                  return `$${n.toLocaleString()}`;
                },
              },
            },
          },
        },
      });

      return () => {
        if (chartRef.current) {
          (chartRef.current as { destroy: () => void }).destroy();
        }
      };
    });
  }, [labels, netWorth]);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
