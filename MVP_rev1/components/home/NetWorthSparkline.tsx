/**
 * Net Worth Sparkline Component
 * 
 * Simple sparkline chart showing net worth trend over time.
 */

'use client';

interface NetWorthSparklineProps {
  data: { month: string; value$: number }[];
}

export function NetWorthSparkline({ data }: NetWorthSparklineProps) {
  if (data.length === 0) return null;

  const width = 300;
  const height = 60;
  const padding = 4;

  const values = data.map(d => d.value$);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-green-600 dark:text-green-400"
        />
      </svg>
    </div>
  );
}

