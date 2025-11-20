/**
 * Feed Card Components Index
 * 
 * Centralized card renderer that maps card types to components.
 */

'use client';

import type { FeedCard } from '@/lib/feed/types';
import { PulseCard } from './PulseCard';
import {
  AlertSavingsGapCard,
  AlertDebtHighAprCard,
  AlertCashflowRiskCard,
} from './AlertCard';
import {
  ActionIncomeShiftCard,
  ActionSavingsRateCard,
  ActionSavingsAllocationCard,
} from './ActionCard';
import {
  OppRentOptimizerCard,
  OppSavingsAllocatorCard,
  OppSideIncomeCard,
} from './OpportunityCard';
import {
  ProgressEfCard,
  ProgressDebtCard,
  ProgressSavingsStreakCard,
} from './ProgressCard';
import { EducationCard } from './EducationCard';

interface FeedCardRendererProps {
  card: FeedCard;
  onAction?: (action: FeedCard['ctaAction']) => void;
}

export function FeedCardRenderer({ card, onAction }: FeedCardRendererProps) {
  switch (card.type) {
    case 'pulse':
      return <PulseCard card={card} onAction={onAction} />;
    
    case 'alert_savings_gap':
      return <AlertSavingsGapCard card={card} onAction={onAction} />;
    case 'alert_debt_high_apr':
      return <AlertDebtHighAprCard card={card} onAction={onAction} />;
    case 'alert_cashflow_risk':
      return <AlertCashflowRiskCard card={card} onAction={onAction} />;
    
    case 'action_income_shift':
      return <ActionIncomeShiftCard card={card} onAction={onAction} />;
    case 'action_savings_rate':
      return <ActionSavingsRateCard card={card} onAction={onAction} />;
    case 'action_savings_allocation':
      return <ActionSavingsAllocationCard card={card} onAction={onAction} />;
    
    case 'opp_rent_optimizer':
      return <OppRentOptimizerCard card={card} onAction={onAction} />;
    case 'opp_savings_allocator':
      return <OppSavingsAllocatorCard card={card} onAction={onAction} />;
    case 'opp_side_income':
      return <OppSideIncomeCard card={card} onAction={onAction} />;
    
    case 'progress_ef':
      return <ProgressEfCard card={card} onAction={onAction} />;
    case 'progress_debt':
      return <ProgressDebtCard card={card} onAction={onAction} />;
    case 'progress_savings_streak':
      return <ProgressSavingsStreakCard card={card} onAction={onAction} />;
    
    case 'education':
      return <EducationCard card={card} onAction={onAction} />;
    
    default:
      console.warn(`Unknown card type: ${(card as any).type}`);
      return null;
  }
}

