/**
 * Income Distribution Chart Component
 * 
 * Donut/pie chart showing income allocation breakdown with 3 main categories
 * (Needs, Wants, Savings) and hover breakdowns
 */

'use client';

import { useRef, useEffect, useState } from 'react';

interface CategoryDetail {
  label: string;
  amount: number;
  percent: number;
  color: string;
  description?: string;
}

interface MainCategory {
  label: string;
  amount: number;
  percent: number;
  color: string;
  breakdown: CategoryDetail[];
}

interface IncomeDistributionChartProps {
  takeHomePay: number;
  grossIncome?: number;
  categories: Array<{
    label: string;
    amount: number;
    percent: number;
    color: string;
    why?: string;
  }>;
  size?: number;
}

export function IncomeDistributionChart({
  takeHomePay,
  grossIncome,
  categories,
  size = 280,
}: IncomeDistributionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Group categories into Needs, Wants, Savings
  const mainCategories: MainCategory[] = [
    {
      label: 'Needs',
      amount: categories
        .filter((c) => c.label === 'Essentials & Bills' || c.label === 'Debt Minimums')
        .reduce((sum, c) => sum + c.amount, 0),
      percent: 0,
      color: '#f97316', // orange
      breakdown: categories
        .filter((c) => c.label === 'Essentials & Bills' || c.label === 'Debt Minimums')
        .map((c) => ({
          label: c.label,
          amount: c.amount,
          percent: c.percent,
          color: c.color,
          description: c.why,
        })),
    },
    {
      label: 'Wants',
      amount: categories
        .filter((c) => c.label === 'Fun & Flexible')
        .reduce((sum, c) => sum + c.amount, 0),
      percent: 0,
      color: '#3b82f6', // blue
      breakdown: categories
        .filter((c) => c.label === 'Fun & Flexible')
        .map((c) => ({
          label: c.label,
          amount: c.amount,
          percent: c.percent,
          color: c.color,
          description: c.why,
        })),
    },
    {
      label: 'Savings',
      amount: categories
        .filter(
          (c) =>
            c.label === 'Extra Debt Paydown' ||
            c.label === 'Emergency Savings' ||
            c.label === 'Long-Term Investing'
        )
        .reduce((sum, c) => sum + c.amount, 0),
      percent: 0,
      color: '#14b8a6', // teal
      breakdown: categories
        .filter(
          (c) =>
            c.label === 'Extra Debt Paydown' ||
            c.label === 'Emergency Savings' ||
            c.label === 'Long-Term Investing'
        )
        .map((c) => ({
          label: c.label,
          amount: c.amount,
          percent: c.percent,
          color: c.color,
          description: c.why,
        })),
    },
  ].filter((cat) => cat.amount > 0.01); // Only show categories with meaningful amounts

  // Calculate percentages
  mainCategories.forEach((cat) => {
    cat.percent = (cat.amount / takeHomePay) * 100;
  });

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
      if (!ctx) return;

      // Set canvas size
      if (canvasRef.current) {
        canvasRef.current.width = size;
        canvasRef.current.height = size;
      }

      const data = mainCategories.map((cat) => ({
        label: cat.label,
        value: cat.amount,
        color: cat.color,
      }));

      chartRef.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.map((d) => d.label),
          datasets: [
            {
              data: data.map((d) => d.value),
              backgroundColor: data.map((d) => d.color),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              padding: 16,
              titleFont: { size: 14, weight: 'bold' },
              bodyFont: { size: 13 },
              callbacks: {
                title: function (context: any) {
                  const category = mainCategories[context[0].dataIndex];
                  return category.label;
                },
                label: function (context: any) {
                  const category = mainCategories[context.dataIndex];
                  const lines = [
                    `Total: $${category.amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} (${category.percent.toFixed(1)}%)`,
                  ];
                  
                  if (category.breakdown.length > 0) {
                    lines.push('');
                    lines.push('Breakdown:');
                    category.breakdown.forEach((item) => {
                      lines.push(
                        `  • ${item.label}: $${item.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} (${item.percent.toFixed(1)}%)`
                      );
                    });
                  }
                  
                  return lines;
                },
              },
            },
          },
          onHover: (event: any, activeElements: any[]) => {
            if (activeElements && activeElements.length > 0) {
              const index = activeElements[0].index;
              if (mainCategories[index]) {
                setHoveredCategory(mainCategories[index].label);
              }
            } else {
              setHoveredCategory(null);
            }
          },
        },
      });

      return () => {
        if (chartRef.current) {
          chartRef.current.destroy();
        }
      };
    });
  }, [mainCategories, size, takeHomePay]);

  // Calculate responsive font size based on amount length
  const getFontSize = (text: string, baseSize: number = 24): number => {
    const length = text.length;
    if (length <= 6) return baseSize;
    if (length <= 8) return baseSize * 0.85;
    if (length <= 10) return baseSize * 0.7;
    return baseSize * 0.6;
  };

  const takeHomePayText = takeHomePay.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const fontSize = getFontSize(takeHomePayText, 28);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      {/* Chart */}
      <div className="relative flex-shrink-0">
        <canvas ref={canvasRef} width={size} height={size} />
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="font-bold text-slate-900 dark:text-white"
            style={{ fontSize: `${fontSize}px` }}
          >
            ${takeHomePayText}
          </div>
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Take Home Pay
          </div>
          {grossIncome && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              Gross Income - ${grossIncome.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}/month
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-3">
        {mainCategories.map((cat) => {
          const isHovered = hoveredCategory === cat.label;
          return (
            <div
              key={cat.label}
              onMouseEnter={() => setHoveredCategory(cat.label)}
              onMouseLeave={() => setHoveredCategory(null)}
              className={`cursor-pointer rounded-lg border p-4 transition-all ${
                isHovered
                  ? 'border-primary bg-primary/5 shadow-md dark:bg-primary/10'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-1 h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {cat.label}
                    </span>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 dark:text-white">
                        ${cat.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {cat.percent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Breakdown (shown on hover) */}
                  {isHovered && cat.breakdown.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                      {cat.breakdown.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-slate-700 dark:text-slate-300">
                              {item.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              ${item.amount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <span className="ml-2 text-slate-600 dark:text-slate-400">
                              ({item.percent.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
