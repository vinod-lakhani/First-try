/**
 * Confirmation modal for plan update. Required before applying any plan change.
 * Shows "What changed" (diffs), Confirm & Apply, Keep current plan, optional "Review details".
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanDiffItem } from '@/lib/tools/savings/diffPlans';

export interface PlanConfirmModalProps {
  open: boolean;
  diffs: PlanDiffItem[];
  isFirstApply?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReviewDetails?: () => void;
}

export function PlanConfirmModal({
  open,
  diffs,
  isFirstApply = false,
  onConfirm,
  onCancel,
  onReviewDetails,
}: PlanConfirmModalProps) {
  if (!open) return null;
  const isFirstTimeCopy = isFirstApply;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl">
            {isFirstTimeCopy ? 'Apply savings plan?' : 'Confirm plan update'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFirstTimeCopy ? (
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <p>This applies a complete savings plan that:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                <li>builds your emergency buffer</li>
                <li>captures free employer match</li>
                <li>prioritizes tax-advantaged accounts</li>
              </ul>
              <p>You can change this anytime.</p>
            </div>
          ) : isFirstApply && diffs.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You&apos;re about to apply your savings plan. This will update your allocation across emergency fund, debt paydown, retirement, and brokerage.
            </p>
          ) : isFirstApply && diffs.length > 0 ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You&apos;re about to apply your savings plan.
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                {diffs.slice(0, 5).map((d, i) => (
                  <li key={i}>
                    <strong>{d.label}:</strong> {d.to}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">What changed</p>
              <ul className="text-sm space-y-2">
                {diffs.slice(0, 5).map((d, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400">{d.label}</span>
                    <span className="shrink-0 text-right">
                      <span className="text-slate-500 line-through">{d.from}</span>
                      {' → '}
                      <span className="font-medium text-slate-900 dark:text-white">{d.to}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {isFirstTimeCopy ? (
              <>
                {onReviewDetails && (
                  <Button variant="outline" size="sm" onClick={onReviewDetails}>
                    See details
                  </Button>
                )}
                <Button onClick={onConfirm} className="ml-auto">
                  Apply plan
                </Button>
              </>
            ) : (
              <>
                {onReviewDetails && (
                  <Button variant="ghost" size="sm" onClick={onReviewDetails}>
                    Review details
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={onCancel}>
                    Keep current plan
                  </Button>
                  <Button onClick={onConfirm}>Confirm & Apply</Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
