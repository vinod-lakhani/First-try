/**
 * Net Worth Chart Component
 * 
 * Crypto-style chart matching the standalone net worth simulator
 */

'use client';

import { useRef, useEffect, useState, useMemo } from 'react';

interface NetWorthChartProps {
  labels: string[];
  netWorth: number[];
  assets?: number[];
  liabilities?: number[];
  height?: number;
}

export function NetWorthChart({
  labels,
  netWorth,
  assets,
  liabilities,
  height = 300,
}: NetWorthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [timeRange, setTimeRange] = useState<'1Y' | '5Y' | '10Y' | '20Y' | '40Y' | 'ALL'>('ALL');

  const { currentValue, change, changePct, chartData } = useMemo(() => {
    // Filter by time range
    let filteredNetWorth = netWorth;
    let filteredAssets = assets || [];
    let filteredLiabilities = liabilities || [];
    let filteredLabels = labels;

    if (timeRange !== 'ALL') {
      const totalMonths = netWorth.length;
      let monthsToShow = 0;
      switch (timeRange) {
        case '1Y': monthsToShow = 12; break;
        case '5Y': monthsToShow = 60; break;
        case '10Y': monthsToShow = 120; break;
        case '20Y': monthsToShow = 240; break;
        case '40Y': monthsToShow = 480; break;
      }
      // Show the FIRST N months (from the start of the projection)
      // This matches user expectation: "1Y" means "the first year", not "the last year"
      const rangeEnd = Math.min(monthsToShow, totalMonths);
      filteredNetWorth = netWorth.slice(0, rangeEnd);
      filteredAssets = (assets || []).slice(0, rangeEnd);
      filteredLiabilities = (liabilities || []).slice(0, rangeEnd);
      filteredLabels = labels.slice(0, rangeEnd);
    }

    const currentValue = filteredNetWorth[filteredNetWorth.length - 1] || 0;
    const startValue = filteredNetWorth[0] || 0;
    const change = currentValue - startValue;
    const changePct = startValue !== 0 ? (change / startValue) * 100 : 0;

    // Build datasets
    const datasets: any[] = [
      {
        label: 'Net Worth',
        data: filteredNetWorth,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        order: 1,
      },
    ];

    if (filteredAssets.length > 0) {
      datasets.push({
        label: 'Assets',
        data: filteredAssets,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        order: 2,
      });
    }

    if (filteredLiabilities.length > 0) {
      datasets.push({
        label: 'Liabilities',
        data: filteredLiabilities,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderWidth: 2,
        borderDash: [3, 3],
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        order: 3,
      });
    }

    return {
      currentValue,
      change,
      changePct,
      chartData: {
        labels: filteredLabels,
        datasets,
      },
    };
  }, [labels, netWorth, assets, liabilities, timeRange]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Dynamically import Chart.js
    import('chart.js/auto').then((ChartModule) => {
      const Chart = ChartModule.default;

      // Destroy existing chart if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx || !canvasRef.current) return;

      const container = canvasRef.current.parentElement;
      if (container) {
        const containerWidth = container.clientWidth - 40;
        const containerHeight = height;
        canvasRef.current.width = containerWidth;
        canvasRef.current.height = containerHeight;
      }

      // Store filtered data for tooltip callbacks
      const filteredLabels = chartData.labels;
      const filteredNetWorth = chartData.datasets.find((d: any) => d.label === 'Net Worth')?.data || [];
      const filteredAssets = chartData.datasets.find((d: any) => d.label === 'Assets')?.data || [];
      const filteredLiabilities = chartData.datasets.find((d: any) => d.label === 'Liabilities')?.data || [];

      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: { size: 13, weight: 'bold' },
              bodyFont: { size: 13 },
              displayColors: true,
              callbacks: {
                title: function (contexts: any[]) {
                  // Use the label from the filtered chartData
                  if (contexts.length > 0) {
                    const dataIndex = contexts[0].dataIndex;
                    return filteredLabels[dataIndex] || '';
                  }
                  return '';
                },
                label: function (context: any) {
                  // Get value from the filtered dataset at the current index
                  const dataIndex = context.dataIndex;
                  const datasetLabel = context.dataset.label;
                  let value: number;
                  
                  if (datasetLabel === 'Net Worth') {
                    value = filteredNetWorth[dataIndex] || 0;
                  } else if (datasetLabel === 'Assets') {
                    value = filteredAssets[dataIndex] || 0;
                  } else if (datasetLabel === 'Liabilities') {
                    value = filteredLiabilities[dataIndex] || 0;
                  } else {
                    value = context.parsed.y;
                  }
                  
                  const formatted =
                    value >= 1000000
                      ? '$' + (value / 1000000).toFixed(2) + 'M'
                      : value >= 1000
                      ? '$' + (value / 1000).toFixed(1) + 'K'
                      : '$' +
                        value.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        });
                  return `${datasetLabel}: ${formatted}`;
                },
                labelColor: function (context: any) {
                  return {
                    borderColor: context.dataset.borderColor,
                    backgroundColor: context.dataset.borderColor,
                  };
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
                font: { size: 11 },
                color: '#9ca3af',
              },
            },
            y: {
              display: true,
              grid: {
                color: '#f3f4f6',
              },
              ticks: {
                font: { size: 11 },
                color: '#9ca3af',
                callback: function (value: any) {
                  if (value >= 1000000) {
                    return '$' + (value / 1000000).toFixed(1) + 'M';
                  } else if (value >= 1000) {
                    return '$' + (value / 1000).toFixed(0) + 'K';
                  }
                  return (
                    '$' +
                    value.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })
                  );
                },
              },
            },
          },
        },
      });

      const handleResize = () => {
        if (chartRef.current && canvasRef.current) {
          const container = canvasRef.current.parentElement;
          if (container) {
            const containerWidth = container.clientWidth - 40;
            const containerHeight = height;
            chartRef.current.resize(containerWidth, containerHeight);
          }
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.destroy();
        }
      };
    });
  }, [chartData, height]);

  return (
    <div className="w-full overflow-hidden rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-5 py-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          Net Worth
        </div>
        <div className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
          ${currentValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div
          className={`flex items-center gap-1.5 text-base font-semibold ${
            change >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          <span>{change >= 0 ? '↑' : '↓'}</span>
          <span>
            ${Math.abs(change).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ({Math.abs(changePct).toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative w-full bg-white px-5 py-5 dark:bg-slate-800" style={{ height: `${height}px` }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap justify-center gap-2 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
        {(['1Y', '5Y', '10Y', '20Y', '40Y', 'ALL'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
              timeRange === range
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}
