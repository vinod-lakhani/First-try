/**
 * Feed Logic — Mock scenarios for Phase 1 validation.
 * Each scenario sets UserFinancialState + TriggerSignals so we can verify Leap output and ranking.
 * "My data" (id: live) uses real onboarding/plan data — see fromPlanData.ts; state/signals here are placeholders when plan is missing.
 */

import type { FeedScenario, UserFinancialState, TriggerSignals } from './leapTypes';

export const LIVE_SCENARIO_ID = 'live';

const nowISO = () => new Date().toISOString();

function baseState(overrides: Partial<UserFinancialState> = {}): UserFinancialState {
  return {
    takeHomePayMonthly: 5000,
    paycheckDetected: false,
    needsPercent: 55,
    wantsPercent: 25,
    savingsPercent: 20,
    cashBalance: 3000,
    safetyBufferTarget: 2000,
    emergencyFundMonths: 2,
    emergencyFundTargetMonths: 6,
    hasHighAprDebt: false,
    employerMatchEligible: false,
    employerMatchMet: false,
    hsaEligible: false,
    hsaContributing: false,
    unimplementedLeaps: [],
    ...overrides,
  };
}

function baseSignals(overrides: Partial<TriggerSignals> = {}): TriggerSignals {
  return {
    nowISO: nowISO(),
    cashRisk: false,
    surplusCash: false,
    ...overrides,
  };
}

export const FEED_SCENARIOS: FeedScenario[] = [
  {
    id: LIVE_SCENARIO_ID,
    label: 'My data',
    state: baseState(),
    signals: baseSignals(),
  },
  
  // ─── Income Debug ─────────────────────────────────────────────────────────
  {
    id: 'first_time',
    label: 'Debug: First Time (income)',
    state: baseState({ savingsPercent: 0 }),
    signals: baseSignals(),
  },
  {
    id: 'on_track',
    label: 'Debug: On Track (income)',
    state: baseState({ savingsPercent: 20, needsPercent: 50, wantsPercent: 30 }),
    signals: baseSignals(),
  },
  {
    id: 'oversaved',
    label: 'Debug: Oversaved (income)',
    state: baseState({ savingsPercent: 28, needsPercent: 50, wantsPercent: 22 }),
    signals: baseSignals(),
  },
  {
    id: 'undersaved',
    label: 'Debug: Undersaved (income)',
    state: baseState({ savingsPercent: 12, needsPercent: 55, wantsPercent: 33 }),
    signals: baseSignals(),
  },
  
  // ─── Savings/Allocator Debug ──────────────────────────────────────────────
  {
    id: 'savings_decrease',
    label: 'Debug: Savings Decrease (allocator)',
    state: baseState({ savingsPercent: 15 }),
    signals: baseSignals(),
  },
  {
    id: 'savings_increase',
    label: 'Debug: Savings Increase (allocator)',
    state: baseState({ savingsPercent: 25 }),
    signals: baseSignals(),
  },
  
  // ─── Trigger Debug ────────────────────────────────────────────────────────
  {
    id: 'new-paycheck',
    label: 'Debug: New Paycheck',
    state: baseState({
      paycheckDetected: true,
      takeHomePayMonthly: 5200,
      cashBalance: 4500,
    }),
    signals: baseSignals({
      lastPaycheckISO: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  },
  {
    id: 'missing-match',
    label: 'Debug: Missing Match',
    state: baseState({
      employerMatchEligible: true,
      employerMatchMet: false,
      takeHomePayMonthly: 6000,
      employerMatchGapMonthly: 200,
    }),
    signals: baseSignals(),
  },
  {
    id: 'hsa-eligible',
    label: 'Debug: HSA Eligible',
    state: baseState({
      hsaEligible: true,
      hsaContributing: false,
      takeHomePayMonthly: 5500,
    }),
    signals: baseSignals(),
  },
  // Acceptance test scenarios for EF suppression
  {
    id: 'ef-gap',
    label: 'Debug: EF Gap (Case B: show)',
    state: baseState({
      emergencyFundMonths: 1,
      emergencyFundTargetMonths: 6,
      cashBalance: 1500,
      savingsPercent: 10,
      appliedPlanEfMonthly: 0, // Not on-track: need ~825/mo, have 0
    }),
    signals: baseSignals(),
  },
  {
    id: 'ef-on-track',
    label: 'Debug: EF On Track (Case A: suppressed)',
    state: baseState({
      emergencyFundMonths: 2,
      emergencyFundTargetMonths: 6,
      cashBalance: 5500,
      savingsPercent: 20,
      appliedPlanEfMonthly: 850, // On-track: gap ~11k, need 825/mo (11k/12*0.9)
    }),
    signals: baseSignals(),
  },
  {
    id: 'ef-target-met',
    label: 'Debug: EF Target Met (Case C: suppressed)',
    state: baseState({
      emergencyFundMonths: 6,
      emergencyFundTargetMonths: 6,
      cashBalance: 18000,
      savingsPercent: 20,
    }),
    signals: baseSignals(),
  },
  {
    id: 'ef-grace-period',
    label: 'Debug: EF Grace Period (Case D: suppressed)',
    state: baseState({
      emergencyFundMonths: 2,
      emergencyFundTargetMonths: 6,
      cashBalance: 5500,
      savingsPlanAppliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // yesterday
      appliedPlanEfMonthly: 0, // Not on-track by amount, but grace period applies
    }),
    signals: baseSignals(),
  },
  {
    id: 'ef-grace-critically-low',
    label: 'Debug: EF Grace + Critically Low (Case E: show)',
    state: baseState({
      emergencyFundMonths: 0.5,
      emergencyFundTargetMonths: 6,
      cashBalance: 1500,
      savingsPlanAppliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // yesterday
      appliedPlanEfMonthly: 0,
      savingsPercent: 10,
    }),
    signals: baseSignals(),
  },
  {
    id: 'high-apr-debt',
    label: 'Debug: High APR Debt',
    state: baseState({
      hasHighAprDebt: true,
      highAprDebtApr: 24,
    }),
    signals: baseSignals(),
  },
  {
    id: 'cash-risk',
    label: 'Debug: Cash Risk',
    state: baseState({
      cashBalance: 800,
      safetyBufferTarget: 2000,
    }),
    signals: baseSignals({ cashRisk: true }),
  },
  {
    id: 'surplus-cash',
    label: 'Debug: Surplus Cash',
    state: baseState({
      cashBalance: 8000,
      safetyBufferTarget: 2000,
      emergencyFundMonths: 6,
      emergencyFundTargetMonths: 6,
    }),
    signals: baseSignals({ surplusCash: true }),
  },
  
  // ─── Compound Debug ───────────────────────────────────────────────────────
  {
    id: 'many-issues',
    label: 'Debug: Many issues',
    state: baseState({
      paycheckDetected: true,
      employerMatchEligible: true,
      employerMatchMet: false,
      employerMatchGapMonthly: 150,
      hsaEligible: true,
      hsaContributing: false,
      emergencyFundMonths: 0.5,
      emergencyFundTargetMonths: 6,
      hasHighAprDebt: true,
      highAprDebtApr: 22,
      cashBalance: 600,
      safetyBufferTarget: 2000,
      savingsPercent: 10,
    }),
    signals: baseSignals({
      lastPaycheckISO: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      cashRisk: true,
    }),
  },
  {
    id: 'unimplemented-follow-up',
    label: 'Debug: Unimplemented follow-up',
    state: baseState({
      unimplementedLeaps: [
        {
          dedupeKey: 'leap:MISSING_EMPLOYER_MATCH',
          leapType: 'MISSING_EMPLOYER_MATCH',
          lastSurfacedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          timesIgnored: 2,
        },
      ],
      employerMatchEligible: true,
      employerMatchMet: false,
      employerMatchGapMonthly: 200,
    }),
    signals: baseSignals(),
  },
];

export function getScenarioById(id: string): FeedScenario | undefined {
  return FEED_SCENARIOS.find((s) => s.id === id);
}

/** Default scenario: "My data" so users with onboarding data see their data first. */
export const DEFAULT_SCENARIO_ID = LIVE_SCENARIO_ID;

// ─── Superset: map feed scenario → tool scenario (for deep link from feed) ───
/** Scenario value for Savings Helper (income) tool: default | FIRST_TIME | ON_TRACK | OVERSAVED | UNDERSAVED */
export type IncomeToolScenario = 'default' | 'FIRST_TIME' | 'ON_TRACK' | 'OVERSAVED' | 'UNDERSAVED';
/** Scenario value for Savings Allocator tool: my_data | first_time | savings_decrease | savings_increase | no_match | no_hsa */
export type SavingsAllocatorToolScenario = 'my_data' | 'first_time' | 'savings_decrease' | 'savings_increase' | 'no_match' | 'no_hsa';

export type OriginatingTool = 'income' | 'savings';

/**
 * Returns the tool scenario and optional simulateAmount to pass in URL when opening a tool from the feed.
 * Used so that clicking a leap opens the right screen with the right scenario pre-selected.
 */
export function getToolScenarioFromFeed(
  feedScenarioId: string,
  tool: OriginatingTool
): { scenario: string; simulateAmount?: number } {
  const defaultAmount = 200;
  if (tool === 'income') {
    const map: Record<string, IncomeToolScenario> = {
      [LIVE_SCENARIO_ID]: 'default',
      first_time: 'FIRST_TIME',
      on_track: 'ON_TRACK',
      oversaved: 'OVERSAVED',
      undersaved: 'UNDERSAVED',
      'new-paycheck': 'default',
      'missing-match': 'default',
      'hsa-eligible': 'default',
      'ef-gap': 'default',
      'high-apr-debt': 'default',
      'cash-risk': 'default',
      'surplus-cash': 'default',
      'many-issues': 'default',
      'unimplemented-follow-up': 'default',
    };
    const scenario = map[feedScenarioId] ?? 'default';
    const simulateAmount = (scenario === 'OVERSAVED' || scenario === 'UNDERSAVED') ? defaultAmount : undefined;
    return { scenario, simulateAmount };
  }
  // savings
  const map: Record<string, SavingsAllocatorToolScenario> = {
    [LIVE_SCENARIO_ID]: 'my_data',
    first_time: 'first_time',
    savings_decrease: 'savings_decrease',
    savings_increase: 'savings_increase',
    'missing-match': 'no_match',
    'hsa-eligible': 'no_hsa',
    'new-paycheck': 'my_data',
    'ef-gap': 'my_data',
    'ef-on-track': 'my_data',
    'ef-target-met': 'my_data',
    'ef-grace-period': 'my_data',
    'ef-grace-critically-low': 'my_data',
    'high-apr-debt': 'my_data',
    'cash-risk': 'my_data',
    'surplus-cash': 'my_data',
    'many-issues': 'my_data',
    'unimplemented-follow-up': 'my_data',
  };
  const scenario = map[feedScenarioId] ?? 'my_data';
  const simulateAmount = (scenario === 'savings_decrease' || scenario === 'savings_increase') ? defaultAmount : undefined;
  return { scenario, simulateAmount };
}
