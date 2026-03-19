/**
 * Income Allocation Donut Chart
 * Needs / Wants / Savings distribution
 */

"use client";

import { useRef, useEffect } from "react";

interface IncomeAllocationDonutProps {
  needs: number;
  wants: number;
  savings: number;
  total: number;
  size?: number;
}

const COLORS = {
  needs: "#f97316",   // orange-500
  wants: "#3b82f6",   // blue-500
  savings: "#16a34a", // green-600
};

export function IncomeAllocationDonut({
  needs,
  wants,
  savings,
  total,
  size = 200,
}: IncomeAllocationDonutProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!canvasRef.current || total <= 0) return;

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

        const ctx = canvasRef.current!.getContext("2d");
        if (!ctx) return;

        const chart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Needs", "Wants", "Post-Tax Savings"],
            datasets: [
              {
                data: [needs, wants, savings],
                backgroundColor: [COLORS.needs, COLORS.wants, COLORS.savings],
                borderWidth: 0,
                hoverOffset: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            cutout: "65%",
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: { parsed: number; label: string }) => {
                    const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(0) : "0";
                    const formatted = new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(ctx.parsed);
                    return `${ctx.label}: ${formatted} (${pct}%)`;
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
  }, [needs, wants, savings, total]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} />
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-semibold text-slate-900 dark:text-white">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(total)}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">take-home</span>
        </div>
      </div>
    </div>
  );
}
