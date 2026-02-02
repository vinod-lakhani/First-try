/**
 * Savings Helper Tool (Income Allocation — 4-state lifecycle)
 *
 * Two modes: CALIBRATION (first-time) vs MONTHLY_CHECKIN (ongoing).
 * Four states: FIRST_TIME | ON_TRACK | OVERSAVED | UNDERSAVED.
 * No mid-month projections; chat-first, decision-first.
 */

'use client';

import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { IncomePlanContent } from './IncomePlanContent';

export default function SavingsHelperPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600 dark:text-slate-400">Loading income plan...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <IncomePlanContent />
    </Suspense>
  );
}
