/**
 * Feed Tab
 * 
 * Notifications and action cards.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FeedPage() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-2xl">Your Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-400">
                Your personalized financial insights and recommendations will appear here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

