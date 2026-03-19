/**
 * Net Worth Comparison Chart
 * Two curves: current plan vs recommended plan
 */

"use client";

import { useRef, useEffect } from "react";

interface NetWorthComparisonChartProps {
  labels: string[];
  currentNetWorth: number[];
  recommendedNetWorth: number[];
  height?: number;
}

const CURRENT_COLOR = "#94a3b8"; // slate-400
const RECOMMENDED_COLOR = "#16a34a"; // green-600

function formatTooltipValue(v: number) {
  return v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toLocaleString()}`;
}

export function NetWorthComparisonChart({
  labels,
  currentNetWorth,
  recommendedNetWorth,
  height = 260,
}: NetWorthComparisonChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!canvasRef.current || currentNetWorth.length === 0) return;

    const container = canvasRef.current.parentElement;
    if (!container) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    const initChart = () => {
      if (cancelled || !canvasRef.current) return;
      import("chart.js/auto").then((ChartModule) => {
        if (cancelled || !canvasRef.current) return;
        const Chart = ChartModule.default;

        if (chartRef.current) {
          (chartRef.current as { destroy: () => void }).destroy();
          chartRef.current = null;
        }

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const chart = new Chart(ctx, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Current plan",
                data: currentNetWorth,
                borderColor: CURRENT_COLOR,
                backgroundColor: "rgba(148, 163, 184, 0.0)",
                borderWidth: 2,
                borderDash: [6, 4],
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
              },
              {
                label: "Recommended plan",
                data: recommendedNetWorth,
                borderColor: RECOMMENDED_COLOR,
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
              legend: {
                display: true,
                position: "top",
                labels: {
                  usePointStyle: true,
                  font: { size: 11 },
                  padding: 12,
                },
              },
              tooltip: {
                callbacks: {
                  label: (ctx: { parsed: { y: number | null }; dataset: { label?: string } }) => {
                    const v = ctx.parsed.y ?? 0;
                    return `${ctx.dataset.label ?? ""}: ${formatTooltipValue(v)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                display: true,
                grid: { display: false },
                ticks: {
                  maxTicksLimit: 8,
                  font: { size: 10 },
                  color: "#9ca3af",
                  callback: (_: unknown, index: number) => (labels[index] ? labels[index] : undefined),
                },
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

        chartRef.current = chart;

        const resizeChart = () => {
          const c = chartRef.current as { resize?: () => void } | null;
          if (c?.resize) c.resize();
        };
        const ro = new ResizeObserver(resizeChart);
        ro.observe(container);

        cleanup = () => {
          ro.disconnect();
          if (chartRef.current) {
            (chartRef.current as { destroy: () => void }).destroy();
            chartRef.current = null;
          }
        };
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(initChart);
    });

    return () => {
      cancelled = true;
      cleanup?.();
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
        chartRef.current = null;
      }
    };
  }, [labels, currentNetWorth, recommendedNetWorth]);

  return (
    <div
      className="relative w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      style={{ height: `${height}px` }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
