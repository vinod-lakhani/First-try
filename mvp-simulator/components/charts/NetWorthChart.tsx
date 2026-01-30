/**
 * Net Worth Chart Component
 * 
 * Crypto-style chart matching the standalone net worth simulator
 */

'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NetWorthChartProps {
  labels: string[];
  netWorth: number[];
  assets?: number[];
  liabilities?: number[];
  height?: number;
  baselineNetWorth?: number[]; // Optional baseline series for comparison
}

export function NetWorthChart({
  labels,
  netWorth,
  assets,
  liabilities,
  height = 300,
  baselineNetWorth,
}: NetWorthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [timeRange, setTimeRange] = useState<'1Y' | '5Y' | '10Y' | '20Y' | '40Y' | 'ALL'>('40Y');
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  const { currentValue, change, changePct, deltaFromBaseline, deltaPctFromBaseline, chartData } = useMemo(() => {
    // Filter by time range
    let filteredNetWorth = netWorth;
    let filteredAssets = assets || [];
    let filteredLiabilities = liabilities || [];
    let filteredLabels = labels;
    let filteredBaseline = baselineNetWorth || [];

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
      if (baselineNetWorth && baselineNetWorth.length > 0) {
        filteredBaseline = baselineNetWorth.slice(0, rangeEnd);
      }
    }

    const currentValue = filteredNetWorth[filteredNetWorth.length - 1] || 0;
    const startValue = filteredNetWorth[0] || 0;
    const change = currentValue - startValue;
    const changePct = startValue !== 0 ? (change / startValue) * 100 : 0;

    // Calculate delta from baseline if baseline exists
    let deltaFromBaseline = 0;
    let deltaPctFromBaseline = 0;
    if (baselineNetWorth && baselineNetWorth.length > 0) {
      const baselineCurrentValue = filteredBaseline[filteredBaseline.length - 1] || 0;
      deltaFromBaseline = currentValue - baselineCurrentValue;
      deltaPctFromBaseline = baselineCurrentValue !== 0 ? (deltaFromBaseline / Math.abs(baselineCurrentValue)) * 100 : 0;
    }

    // Build datasets
    const datasets: any[] = [];
    
    // Add baseline series if provided
    if (baselineNetWorth && baselineNetWorth.length > 0) {
      datasets.push({
        label: 'Current Plan',
        data: filteredBaseline,
        borderColor: '#6b7280',
        backgroundColor: 'rgba(107, 114, 128, 0.05)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        order: 1,
      });
    }
    
    // Add scenario series
    datasets.push({
      label: baselineNetWorth ? 'Modified Plan' : 'Net Worth',
      data: filteredNetWorth,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      borderWidth: 2.5,
      fill: !baselineNetWorth,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      order: baselineNetWorth ? 2 : 1,
    });

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
      deltaFromBaseline,
      deltaPctFromBaseline,
      chartData: {
        labels: filteredLabels,
        datasets,
      },
    };
  }, [labels, netWorth, assets, liabilities, timeRange, baselineNetWorth]);

  useEffect(() => {
    // Check if canvas ref is available before importing Chart.js
    if (!canvasRef.current) return;

    // Dynamically import Chart.js
    import('chart.js/auto').then((ChartModule) => {
      const Chart = ChartModule.default;

      // Check again after async import
      if (!canvasRef.current) return;

      // Destroy existing chart if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const container = canvasRef.current.parentElement;
      if (container) {
        const containerWidth = container.clientWidth - 40;
        const containerHeight = height;
        canvasRef.current.width = containerWidth;
        canvasRef.current.height = containerHeight;
      }

      // Store filtered data for tooltip callbacks
      const filteredLabels = chartData.labels;
      const filteredNetWorth = chartData.datasets.find((d: any) => d.label === 'Net Worth' || d.label === 'Modified Plan')?.data || [];
      const filteredBaseline = chartData.datasets.find((d: any) => d.label === 'Current Plan')?.data || [];
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
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                  size: 12,
                },
              },
            },
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
                  
                  if (datasetLabel === 'Net Worth' || datasetLabel === 'Modified Plan') {
                    value = filteredNetWorth[dataIndex] || 0;
                  } else if (datasetLabel === 'Assets') {
                    value = filteredAssets[dataIndex] || 0;
                  } else if (datasetLabel === 'Liabilities') {
                    value = filteredLiabilities[dataIndex] || 0;
                  } else if (datasetLabel === 'Current Plan') {
                    value = filteredBaseline[dataIndex] || 0;
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
                  
                  // Add delta for Modified Plan when baseline exists
                  if (datasetLabel === 'Modified Plan' && filteredBaseline.length > 0) {
                    const baselineValue = filteredBaseline[dataIndex] || 0;
                    const delta = value - baselineValue;
                    const deltaFormatted =
                      Math.abs(delta) >= 1000000
                        ? '$' + (delta / 1000000).toFixed(2) + 'M'
                        : Math.abs(delta) >= 1000
                        ? '$' + (delta / 1000).toFixed(1) + 'K'
                        : '$' +
                          delta.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          });
                    return `${datasetLabel}: ${formatted} (${delta >= 0 ? '+' : ''}${deltaFormatted})`;
                  }
                  
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
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Net Worth
          </span>
          <button
            onClick={() => setShowInfoDialog(true)}
            className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            aria-label="How net worth is calculated"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">
          ${currentValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-1.5 text-sm sm:text-base lg:text-lg font-semibold ${
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
              ({Math.abs(changePct).toFixed(2)}%) from start
            </span>
          </div>
          {baselineNetWorth && baselineNetWorth.length > 0 && (
            <div
              className={`flex items-center gap-1.5 text-sm font-medium ${
                deltaFromBaseline >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              <span>{deltaFromBaseline >= 0 ? '↑' : '↓'}</span>
              <span>
                {deltaFromBaseline >= 0 ? '+' : ''}${Math.abs(deltaFromBaseline).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                ({deltaFromBaseline >= 0 ? '+' : ''}{Math.abs(deltaPctFromBaseline).toFixed(2)}%) vs Current Plan
              </span>
            </div>
          )}
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

      {/* Info Dialog */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <Card className="flex h-full w-full sm:max-h-[90vh] sm:max-w-3xl flex-col overflow-hidden rounded-none sm:rounded-lg">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold">
                  How We Calculated Your Net Worth
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInfoDialog(false)}
                  className="h-8 w-8"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-6">
              <p className="text-slate-600 dark:text-slate-400">
                Here's the simple, real‑talk version of how we estimate your net worth over time:
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    🚀 Step 1: We start with your money coming in
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 ml-6">
                    Your paycheck hits → we look at how much typically goes to:
                  </p>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-slate-700 dark:text-slate-300">
                    <li>✅ Needs (rent, groceries, bills)</li>
                    <li>✅ Wants (fun stuff)</li>
                    <li>✅ Savings (your future)</li>
                  </ul>
                  <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">
                    We use your actual spending trends, not just rules, so it feels realistic.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    💡 Step 2: We put your savings to work
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 ml-6">
                    Any money you save gets split based on smart priorities:
                  </p>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-slate-700 dark:text-slate-300">
                    <li>Emergency fund (your safety net)</li>
                    <li>High‑interest debt (credit cards, etc.)</li>
                    <li>401(k) employer match (free money!)</li>
                    <li>Retirement and investing</li>
                  </ul>
                  <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">
                    The goal: build stability first, then grow wealth.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    📈 Step 3: We grow your investments
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 ml-6">
                    Every month, your savings can:
                  </p>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-slate-700 dark:text-slate-300">
                    <li>earn interest</li>
                    <li>grow in investments</li>
                    <li>reduce debt</li>
                  </ul>
                  <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">
                    As debt disappears, more money gets redirected into investing.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">
                    This is why your net worth curve usually starts slow and then suddenly 🤯 skyrockets — compounding.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    🔁 Step 4: We repeat this every month
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 ml-6">
                    We simulate this over 40 years to show:
                  </p>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-slate-700 dark:text-slate-300">
                    <li>when your emergency fund is done</li>
                    <li>when debts are paid off</li>
                    <li>how fast your investments grow</li>
                    <li>what your future net worth could look like</li>
                  </ul>
                  <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">
                    It's like a time machine for your money.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    🌱 The big idea
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 ml-6">
                    Small, consistent actions today → massive impact long term.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">
                    You don't need to be perfect. You just need to keep going.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">Key Assumptions</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  To make the simulator easy to understand and fast to run, we make a few key assumptions about the future. These assumptions help us estimate your net worth, but they won't match real life perfectly.
                </p>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      📊 Investment Returns
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 ml-6 mb-2">We assume:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                      <li>Investment accounts (401k/Roth/brokerage) grow at a long‑term average rate (e.g., 6–7% per year)</li>
                      <li>Growth is steady and smooth (no crashes or bull runs modeled)</li>
                    </ul>
                    <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">
                      <strong>Why?</strong> Real markets go up and down a lot. Modeling volatility makes the chart harder to read and less helpful for planning.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      💰 Cash Returns
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 ml-6 mb-2">We assume cash savings (emergency fund, checking/savings) earn:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                      <li>a small return (e.g., 2–4% per year)</li>
                    </ul>
                    <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">This reflects high‑yield savings accounts and money market rates.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      🧾 Brokerage Tax Drag
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 ml-6 mb-2">Taxable brokerage accounts lose some return to taxes each year. We model this as:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                      <li>tax drag = 0.5%–1.5% per year</li>
                    </ul>
                    <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">This represents taxes on dividends, capital gains on selling investments, and fund distributions.</p>
                    <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">So if investments return 7% and tax drag is 1%, we model brokerage at 6% effective growth.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      📉 Inflation
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 ml-6 mb-2">We assume prices rise over time:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                      <li>inflation = ~2.5% per year</li>
                    </ul>
                    <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">We use this to calculate "real" purchasing power of your net worth and long‑term value of money.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      🧮 Income & Spending
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 ml-6 mb-2">We assume for now:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                      <li>income stays constant unless you update it</li>
                      <li>spending patterns stay similar over time</li>
                    </ul>
                    <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">Future versions may include automatic raises, lifestyle creep, and job changes.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      💳 Debt
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300 ml-6 mb-2">We assume:</p>
                    <ul className="list-disc list-inside ml-6 space-y-1 text-slate-700 dark:text-slate-300">
                      <li>interest rates stay fixed</li>
                      <li>minimum payments stay the same</li>
                    </ul>
                    <p className="text-slate-600 dark:text-slate-400 ml-6 mt-2">When debt is paid off, those payments shift into savings/investing.</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-6">
                  <h4 className="font-semibold mb-2">✅ Why we do this</h4>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    These assumptions keep the simulation understandable, make results stable and predictable, and help you see the direction your money is heading.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    But they cannot perfectly predict the future.
                  </p>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">⚠️ Important Disclaimer</h4>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    This simulation is meant to be a helpful guide, not a guarantee.
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    We can't predict future market performance, interest rate changes, inflation, job changes, or unexpected expenses.
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 mb-2">
                    All investment returns and growth rates are estimates only. Your actual results will vary.
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    Nothing here should be considered financial advice. Always make decisions based on your own situation and talk to a financial professional if you need personalized guidance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
