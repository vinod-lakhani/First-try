/**
 * Needs/Wants/Savings Comparison Bars Component
 * 
 * Visualizes NOW (Today), NEXT (This Plan), and GOAL (Target) as stacked bars.
 */

'use client';

import { useState } from 'react';
import type { NWSState } from '@/lib/income/computePlan';

export interface NWSComparisonProps {
  now: NWSState;   // A - actuals
  next: NWSState;  // R - recommended plan
  goal: NWSState;  // T - targets
  totalSavings?: {
    now?: number;   // Optional: Total savings for NOW (Cash + Payroll + Match)
    next?: number;  // Optional: Total savings for NEXT (Cash + Payroll + Match)
    goal?: number; // Optional: Total savings for GOAL (Cash + Payroll + Match)
  };
}

const categoryColors = {
  needs: '#3b82f6',   // Blue
  wants: '#10b981',   // Green
  savings: '#8b5cf6', // Purple
};

const categoryLabels = {
  needs: 'Needs',
  wants: 'Wants',
  savings: 'Savings',
};

export function NWSBars({ now, next, goal, totalSavings }: NWSComparisonProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const renderBar = (
    label: string,
    state: NWSState,
    isHovered: boolean,
    savingsOverride?: number
  ) => {
    const savingsAmount = savingsOverride !== undefined 
      ? savingsOverride 
      : state.income$ * state.savingsPct;
    
    const segments = [
      { key: 'needs', pct: state.needsPct, amount: state.income$ * state.needsPct },
      { key: 'wants', pct: state.wantsPct, amount: state.income$ * state.wantsPct },
      { key: 'savings', pct: state.savingsPct, amount: savingsAmount },
    ];

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {label}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            ${state.income$.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        
        <div
          className="flex h-12 w-full overflow-hidden rounded-lg border-2 border-slate-200 dark:border-slate-700"
          onMouseEnter={() => setHoveredBar(label)}
          onMouseLeave={() => setHoveredBar(null)}
        >
          {segments.map((segment) => (
            <div
              key={segment.key}
              className="relative flex items-center justify-center transition-all"
              style={{
                width: `${segment.pct * 100}%`,
                backgroundColor: categoryColors[segment.key as keyof typeof categoryColors],
                minWidth: segment.pct > 0.01 ? '2px' : '0',
              }}
              onMouseEnter={() => setHoveredSegment(`${label}-${segment.key}`)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {(isHovered || hoveredSegment === `${label}-${segment.key}`) && segment.pct > 0.05 && (
                <span className="z-10 text-xs font-semibold text-white drop-shadow-lg">
                  {Math.round(segment.pct * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Segment details on hover */}
        {(isHovered || hoveredSegment?.startsWith(label)) && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {segments.map((segment) => {
              const isHoveredSeg = hoveredSegment === `${label}-${segment.key}`;
              return (
                <div
                  key={segment.key}
                  className={`rounded p-2 transition-all ${
                    isHoveredSeg
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'bg-transparent'
                  }`}
                >
                  <div
                    className="mb-1 h-2 w-full rounded"
                    style={{ backgroundColor: categoryColors[segment.key as keyof typeof categoryColors] }}
                  />
                  <div className="font-medium text-slate-900 dark:text-white">
                    {categoryLabels[segment.key as keyof typeof categoryLabels]}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {Math.round(segment.pct * 100)}%
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    ${segment.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Calculate deltas for NEXT vs NOW
  const nextDeltas = {
    needs: (next.needsPct - now.needsPct) * 100,
    wants: (next.wantsPct - now.wantsPct) * 100,
    savings: (next.savingsPct - now.savingsPct) * 100,
  };

  // Calculate deltas for GOAL vs NOW
  const goalDeltas = {
    needs: (goal.needsPct - now.needsPct) * 100,
    wants: (goal.wantsPct - now.wantsPct) * 100,
    savings: (goal.savingsPct - now.savingsPct) * 100,
  };

  return (
    <div className="space-y-6">
      {/* Today (NOW) */}
      {renderBar('Today', now, hoveredBar === 'Today')}

      {/* This Plan (NEXT) */}
      <div className="space-y-2">
        {renderBar('This Plan', next, hoveredBar === 'This Plan')}
        
        {/* Delta annotations for NEXT */}
        <div className="flex gap-4 text-xs">
          {Math.abs(nextDeltas.needs) > 0.1 && (
            <div className="text-slate-600 dark:text-slate-400">
              Needs: {nextDeltas.needs >= 0 ? '+' : ''}
              {nextDeltas.needs.toFixed(1)} pp vs today
            </div>
          )}
          {Math.abs(nextDeltas.wants) > 0.1 && (
            <div className="text-slate-600 dark:text-slate-400">
              Wants: {nextDeltas.wants >= 0 ? '+' : ''}
              {nextDeltas.wants.toFixed(1)} pp vs today
            </div>
          )}
          {Math.abs(nextDeltas.savings) > 0.1 && (
            <div className="font-medium text-purple-600 dark:text-purple-400">
              Savings: {nextDeltas.savings >= 0 ? '+' : ''}
              {nextDeltas.savings.toFixed(1)} pp vs today
            </div>
          )}
        </div>
      </div>

      {/* Goal (TARGET) */}
      <div className="space-y-2">
        {renderBar('Goal', goal, hoveredBar === 'Goal', totalSavings?.goal)}
        
        {/* Delta annotations for GOAL */}
        <div className="flex gap-4 text-xs">
          {Math.abs(goalDeltas.needs) > 0.1 && (
            <div className="text-slate-600 dark:text-slate-400">
              Needs: {goalDeltas.needs >= 0 ? '+' : ''}
              {goalDeltas.needs.toFixed(1)} pp vs today
            </div>
          )}
          {Math.abs(goalDeltas.wants) > 0.1 && (
            <div className="text-slate-600 dark:text-slate-400">
              Wants: {goalDeltas.wants >= 0 ? '+' : ''}
              {goalDeltas.wants.toFixed(1)} pp vs today
            </div>
          )}
          {Math.abs(goalDeltas.savings) > 0.1 && (
            <div className="font-medium text-purple-600 dark:text-purple-400">
              Savings: {goalDeltas.savings >= 0 ? '+' : ''}
              {goalDeltas.savings.toFixed(1)} pp vs today
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
        {Object.entries(categoryColors).map(([key, color]) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-slate-700 dark:text-slate-300">
              {categoryLabels[key as keyof typeof categoryLabels]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

