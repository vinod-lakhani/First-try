/**
 * Net Worth Viewer
 * 
 * Simple viewer for net worth chart and projections.
 */

'use client';

import { useRouter } from 'next/navigation';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { NetWorthChart } from '@/components/charts/NetWorthChart';

function NetWorthViewerContent() {
  const router = useRouter();
  const planData = usePlanData();

  // Early return check
  if (!planData) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">
              Loading net worth data...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">View Net Worth</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Net Worth Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Wealth Accumulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Net Worth Chart */}
              <div className="overflow-x-auto rounded-lg border bg-white p-4 dark:bg-slate-800">
                <div className="min-w-0">
                  <NetWorthChart
                    labels={planData.netWorthChartData.labels}
                    netWorth={planData.netWorthChartData.netWorth}
                    assets={planData.netWorthChartData.assets}
                    liabilities={planData.netWorthChartData.liabilities}
                    height={400}
                  />
                </div>
              </div>

              {/* Key Milestones */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {planData.netWorthProjection.map((projection) => {
                  return (
                    <div
                      key={projection.label}
                      className="rounded-lg border bg-white p-4 text-center dark:bg-slate-800"
                    >
                      <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {projection.label}
                      </p>
                      <p className={`text-2xl font-bold ${
                        projection.value >= 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        ${projection.value.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
              
              {/* Final Value Recommendation */}
              {planData.netWorthProjection.length > 0 && (
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Rec. ${(planData.netWorthProjection[planData.netWorthProjection.length - 1].value / 1000000).toFixed(2)}M
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function NetWorthViewerPage() {
  return <NetWorthViewerContent />;
}

