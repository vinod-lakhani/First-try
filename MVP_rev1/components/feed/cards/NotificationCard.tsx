/**
 * Notification Card Component
 * 
 * Light-touch updates that inform the user but do not require immediate action.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import type { FeedCard } from '@/lib/feed/types';

interface NotificationCardProps {
  card: FeedCard;
}

export function NotificationCard({ card }: NotificationCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Bell className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {card.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {card.body}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

