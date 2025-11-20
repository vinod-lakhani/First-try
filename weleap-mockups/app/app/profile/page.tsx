/**
 * Profile Tab
 * 
 * Profile settings and onboarding status.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { isComplete, completedAt } = useOnboardingStore();

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl">Profile & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Onboarding Status:</span>
                  {isComplete ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Complete</span>
                    </div>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-400">Incomplete</span>
                  )}
                </div>
                {completedAt && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Completed on {new Date(completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/onboarding')}
                >
                  Re-run onboarding
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/onboarding/plan-final')}
                >
                  View your plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

