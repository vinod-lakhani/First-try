/**
 * Collapsible Sidekick Insight item.
 * Displays one insight topic with What this is / Why it matters / How WeLeap uses it.
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SidekickInsightTopic } from '@/lib/feed/sidekickInsights';

interface SidekickInsightItemProps {
  topic: SidekickInsightTopic;
  defaultExpanded?: boolean;
}

export function SidekickInsightItem({ topic, defaultExpanded = false }: SidekickInsightItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 mt-0.5">
            <BookOpen className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {topic.title}
          </span>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>
      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-1">What this is</h4>
              <p className="text-slate-600 dark:text-slate-400">{topic.whatThisIs}</p>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-1">Why this matters</h4>
              <p className="text-slate-600 dark:text-slate-400">{topic.whyItMatters}</p>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-1">How WeLeap uses this</h4>
              <p className="text-slate-600 dark:text-slate-400">{topic.howWeLeapUsesIt}</p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
