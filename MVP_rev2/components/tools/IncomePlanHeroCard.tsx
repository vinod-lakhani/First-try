/**
 * Income Plan Hero Card — state-driven primary answer.
 * Renders exact copy per state (FIRST_TIME, ON_TRACK, OVERSAVED, UNDERSAVED).
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { IncomeAllocationSnapshot } from '@/lib/income/incomeAllocationLifecycle';

export interface IncomePlanHeroCardProps {
  snapshot: IncomeAllocationSnapshot;
  onPrimaryCta: () => void;
  onSecondaryCta: () => void;
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}/mo`;
}

export function IncomePlanHeroCard({ snapshot, onPrimaryCta, onSecondaryCta }: IncomePlanHeroCardProps) {
  const { state, narrative, plan, actuals } = snapshot;
  const isOversavedOrUndersaved = state === 'OVERSAVED' || state === 'UNDERSAVED';
  // Use TOTAL (cash + payroll + match + HSA) for all three — consistent with Income tab
  const currentTarget = plan.totalSavingsTargetForDisplay ?? plan.currentPlan?.plannedSavings ?? 0;
  const actualSavings = actuals.lastMonth?.savings ?? 0;
  const proposedTarget = plan.totalRecommendedSavings ?? plan.recommendedPlan.plannedSavings;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="pt-6 pb-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {narrative.headline}
        </h2>
        <p className="text-xl font-bold text-slate-900 dark:text-white">
          {narrative.subhead}
        </p>
        {state === 'ON_TRACK' && currentTarget > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Current savings target: {formatMoney(currentTarget)}
          </p>
        )}
        {narrative.confidenceLine && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {narrative.confidenceLine}
          </p>
        )}
        {isOversavedOrUndersaved && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Current savings target</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatMoney(currentTarget)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Actual savings (last month)</span>
              <span className={`text-sm font-medium ${
                actualSavings >= currentTarget
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatMoney(actualSavings)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Proposed for next month</span>
              <span className={`text-sm font-medium ${
                proposedTarget >= currentTarget
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatMoney(proposedTarget)}
              </span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={onPrimaryCta}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {narrative.primaryCta}
          </Button>
          <Button variant="outline" onClick={onSecondaryCta}>
            {narrative.secondaryCta}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
