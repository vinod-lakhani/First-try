/**
 * Net Worth Chart Component
 * 
 * Interactive Chart.js line chart showing net worth, assets, and liabilities
 * with hover tooltips and scenario comparison support.
 */

'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ScenarioSeries } from '../../lib/sim/netWorth';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface NetWorthChartProps {
  scenarios: Array<{
    name: string;
    series: ScenarioSeries;
    color: string;
  }>;
  visibleYears?: number; // 5, 10, 20, or 40
  showAssets?: boolean;
  showLiabilities?: boolean;
}

export function NetWorthChart({
  scenarios,
  visibleYears = 40,
  showAssets = true,
  showLiabilities = true,
}: NetWorthChartProps) {
  const chartData = useMemo(() => {
    const monthsToShow = visibleYears * 12;
    
    const datasets: any[] = [];
    
    scenarios.forEach((scenario, idx) => {
      const labels = scenario.series.labels.slice(0, monthsToShow);
      const netWorth = scenario.series.netWorth.slice(0, monthsToShow);
      
      // Primary: Net Worth line
      datasets.push({
        label: `${scenario.name} - Net Worth`,
        data: netWorth,
        borderColor: scenario.color,
        backgroundColor: `${scenario.color}20`,
        borderWidth: 3,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 6,
        order: idx * 3,
      });
      
      // Optional: Assets line
      if (showAssets) {
        datasets.push({
          label: `${scenario.name} - Assets`,
          data: scenario.series.assets.slice(0, monthsToShow),
          borderColor: `${scenario.color}80`,
          backgroundColor: `${scenario.color}10`,
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          order: idx * 3 + 1,
        });
      }
      
      // Optional: Liabilities line
      if (showLiabilities) {
        datasets.push({
          label: `${scenario.name} - Liabilities`,
          data: scenario.series.liabilities.slice(0, monthsToShow),
          borderColor: `${scenario.color}60`,
          backgroundColor: `${scenario.color}08`,
          borderWidth: 2,
          borderDash: [3, 3],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          order: idx * 3 + 2,
        });
      }
    });
    
    return {
      labels: scenarios[0]?.series.labels.slice(0, monthsToShow) || [],
      datasets,
    };
  }, [scenarios, visibleYears, showAssets, showLiabilities]);
  
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
        },
      },
      title: {
        display: true,
        text: `Net Worth Projection (${visibleYears} Years)`,
        font: {
          size: 18,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `${context.dataset.label}: $${value.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time',
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Dollars ($)',
        },
        ticks: {
          callback: function(value: any) {
            return '$' + value.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            });
          },
        },
      },
    },
  }), [visibleYears]);
  
  return (
    <div style={{ width: '100%', height: '500px', position: 'relative' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

