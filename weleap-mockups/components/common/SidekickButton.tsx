/**
 * Sidekick Button Component
 * 
 * Fixed floating button for AI sidekick chat.
 */

'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { FinancialSidekick } from '@/app/app/components/FinancialSidekick';

export function SidekickButton() {
  return (
    <>
      <div className="fixed bottom-4 right-4 z-40">
        <FinancialSidekick />
      </div>
    </>
  );
}

