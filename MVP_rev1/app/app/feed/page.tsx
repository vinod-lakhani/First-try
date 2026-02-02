/**
 * Feed Tab — Phase 1: Feed Logic + Next Leaps validation
 *
 * Renders Top Leap (highest priority) + All Leaps (Debug) from generateCandidateLeaps.
 * Scenario dropdown drives UserFinancialState + TriggerSignals for validation.
 *
 * TODO Phase 2: Sidekick open should fetch top 1–3 Leaps from this engine.
 * TODO Phase 2: Sidekick should narrate tool output (not invent plan).
 * TODO Phase 2: Tool pages should become chat-first wrappers around existing MVP UIs.
 */

'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { useSidekick } from '@/app/app/context/SidekickContext';
import { usePlanData } from '@/lib/onboarding/usePlanData';
import { generateCandidateLeaps } from '@/lib/feed/generateLeaps';
import type { Leap, UserFinancialState, TriggerSignals, UnimplementedLeapEntry } from '@/lib/feed/leapTypes';
import {
  FEED_SCENARIOS,
  getScenarioById,
  DEFAULT_SCENARIO_ID,
  getToolScenarioFromFeed,
  LIVE_SCENARIO_ID,
} from '@/lib/feed/scenarios';
import {
  buildUserFinancialStateFromPlan,
  buildTriggerSignalsFromPlan,
} from '@/lib/feed/fromPlanData';
import { computePreviewMetric } from '@/lib/feed/previewMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { SIDEKICK_INSIGHTS } from '@/lib/feed/sidekickInsights';
import { SidekickInsightItem } from '@/components/feed/SidekickInsightItem';
import { LeapCard, type FeedDisplayMode } from '@/components/feed/LeapCard';

function toolRoute(tool: Leap['originatingTool']): string {
  switch (tool) {
    case 'income':
      return '/app/tools/savings-helper';
    case 'savings':
      return '/app/tools/savings-allocator';
    case 'sweeper':
      return '/app/tools/savings-allocator'; // stub: no sweeper page yet
    case 'sidekick':
      return '/app'; // stub: Sidekick not in Phase 1
    default:
      return '/app';
  }
}

/** Leap type → preferred tool scenario when opening from feed (overrides feed scenario when applicable). */
function getScenarioFromLeapType(leapType: Leap['leapType'], tool: 'income' | 'savings'): string | null {
  if (tool === 'savings') {
    if (leapType === 'MISSING_EMPLOYER_MATCH' || leapType === 'EMPLOYER_MATCH_NOT_MET') return 'no_match';
    if (leapType === 'HSA_OPPORTUNITY' || leapType === 'HSA_RECOMMENDATION_PENDING') return 'no_hsa';
  }
  if (tool === 'income') {
    if (leapType === 'FIRST_INCOME_PLAN_NEEDED') return 'FIRST_TIME';
    if (leapType === 'MONTH_CLOSED_REVIEW_INCOME_PLAN') return 'ON_TRACK';
    if (leapType === 'INCOME_DRIFT_DETECTED') return null; // use feed scenario
    if (leapType === 'PAYCHECK_REBALANCE_AVAILABLE' || leapType === 'SAVINGS_DRIFT_DETECTED') return null; // use feed scenario
  }
  return null;
}

/** Build full URL with source=feed, leapId, leapType, and scenario params so the tool opens with the right mode. */
function buildLeapToolUrl(leap: Leap, feedScenarioId: string): string {
  const base = toolRoute(leap.originatingTool);
  const tool = leap.originatingTool === 'sweeper' ? 'savings' : leap.originatingTool;
  if (tool !== 'income' && tool !== 'savings') return base;
  const fromLeapType = getScenarioFromLeapType(leap.leapType, tool);
  const fromFeed = getToolScenarioFromFeed(feedScenarioId, tool);
  const scenario = fromLeapType ?? fromFeed.scenario;
  const simulateAmount = fromFeed.simulateAmount;
  const params = new URLSearchParams();
  params.set('source', 'feed');
  params.set('leapId', leap.leapId);
  params.set('leapType', leap.leapType);
  params.set('scenario', scenario);
  if (simulateAmount != null) params.set('simulateAmount', String(simulateAmount));
  return `${base}?${params.toString()}`;
}

// ─── Clarity Notifications (derived from state + static examples) ───────────
interface ClarityItem {
  id: string;
  title: string;
  message: string;
}

function buildClarityNotifications(state: UserFinancialState): ClarityItem[] {
  const items: ClarityItem[] = [];
  if (state.paycheckDetected) {
    items.push({
      id: 'clarity-paycheck',
      title: 'New paycheck detected',
      message: "Your paycheck arrived — want me to optimize it?",
    });
  }
  const efPct =
    state.emergencyFundTargetMonths > 0
      ? (state.emergencyFundMonths / state.emergencyFundTargetMonths) * 100
      : 0;
  const milestones = [10, 25, 50, 75, 100];
  const hit = milestones.find((m) => efPct >= m);
  if (hit !== undefined) {
    items.push({
      id: `clarity-ef-${hit}`,
      title: 'Emergency fund milestone reached',
      message: `You've reached ${hit}% of your emergency fund. Want to speed this up with a Savings Leap?`,
    });
  }
  items.push({
    id: 'clarity-plan-saved',
    title: 'Plan saved',
    message: "Got it — I've updated your plan. I'll keep an eye on how it affects your future.",
  });
  items.push({
    id: 'clarity-account-linked',
    title: 'Account linked successfully',
    message: 'Your Sidekick is now connected to your bank.',
  });
  items.push({
    id: 'clarity-rent',
    title: 'Rent payment posted',
    message: "Your rent went through. Your Sidekick will check if everything remains on track.",
  });
  return items;
}

export default function FeedPage() {
  const router = useRouter();
  const planData = usePlanData();
  const store = useOnboardingStore();
  const sidekick = useSidekick();
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [localState, setLocalState] = useState<UserFinancialState>(() => {
    const scenario = getScenarioById(DEFAULT_SCENARIO_ID);
    return scenario ? { ...scenario.state } : FEED_SCENARIOS[0]!.state;
  });
  const [completedLeapIds, setCompletedLeapIds] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<FeedDisplayMode>('user');
  const [clarityExpanded, setClarityExpanded] = useState(true);
  const [insightsExpanded, setInsightsExpanded] = useState(true);

  const scenario = getScenarioById(scenarioId);
  const isLiveScenario = scenarioId === LIVE_SCENARIO_ID;

  const effectiveState = useMemo(() => {
    if (isLiveScenario && planData) {
      return buildUserFinancialStateFromPlan(planData, {
        income: store.income,
        assets: store.assets,
        debts: store.debts,
        payrollContributions: store.payrollContributions,
        plaidConnected: store.plaidConnected,
        safetyStrategy: store.safetyStrategy,
      });
    }
    return localState;
  }, [isLiveScenario, planData, localState, store.income, store.assets, store.debts, store.payrollContributions, store.plaidConnected, store.safetyStrategy]);

  const effectiveSignals = useMemo((): TriggerSignals => {
    if (isLiveScenario && planData) {
      return buildTriggerSignalsFromPlan(planData, {
        income: store.income,
        assets: store.assets,
        plaidConnected: store.plaidConnected,
      });
    }
    const base = scenario?.signals ?? { nowISO: new Date().toISOString(), cashRisk: false, surplusCash: false };
    return { ...base, nowISO: new Date().toISOString() };
  }, [isLiveScenario, planData, scenario?.signals, store.income, store.assets, store.plaidConnected]);

  const allLeaps = useMemo(() => {
    return generateCandidateLeaps(effectiveState, effectiveSignals);
  }, [effectiveState, effectiveSignals]);

  const leapsWithPreview = useMemo(
    () =>
      allLeaps.map((leap) => {
        const payload =
          leap.leapType === 'EMPLOYER_MATCH_NOT_MET' &&
          effectiveState.employerMatchGapMonthly != null
            ? {
                ...leap.payload,
                employerMatchGap: effectiveState.employerMatchGapMonthly,
                employerMatchGapMonthly: effectiveState.employerMatchGapMonthly,
              }
            : leap.payload;
        return {
          ...leap,
          payload,
          previewMetric: computePreviewMetric(
            leap.leapType,
            effectiveState,
            effectiveSignals,
            payload
          ),
        };
      }),
    [allLeaps, effectiveState, effectiveSignals]
  );

  const leaps = useMemo(() => {
    let list = leapsWithPreview.filter((leap) => !completedLeapIds.has(leap.leapId));
    // In User View: filter out suppressed leaps (e.g. EF on-track)
    if (displayMode === 'user') {
      list = list.filter((leap) => !leap.suppressed);
    }
    return list;
  }, [leapsWithPreview, completedLeapIds, displayMode]);

  const topLeap = leaps[0] ?? null;
  const clarityItems = useMemo(() => buildClarityNotifications(effectiveState), [effectiveState]);

  const handleScenarioChange = useCallback((id: string) => {
    setScenarioId(id);
    const s = getScenarioById(id);
    if (s && id !== LIVE_SCENARIO_ID) {
      setLocalState({ ...s.state });
    }
    if (id === LIVE_SCENARIO_ID && planData) {
      setLocalState(
        buildUserFinancialStateFromPlan(planData, {
          income: store.income,
          assets: store.assets,
          debts: store.debts,
          payrollContributions: store.payrollContributions,
          plaidConnected: store.plaidConnected,
          safetyStrategy: store.safetyStrategy,
        })
      );
    }
    setCompletedLeapIds(new Set());
  }, [planData, store.income, store.assets, store.debts, store.payrollContributions, store.plaidConnected, store.safetyStrategy]);

  const handleOpenSidekick = useCallback(() => {
    if (sidekick) sidekick.openSidekick();
    else router.push('/app');
  }, [sidekick, router]);

  const handleOpenTool = useCallback(
    (leap: Leap) => {
      const url = buildLeapToolUrl(leap, scenarioId);
      router.push(url);
    },
    [router, scenarioId]
  );

  const handleMarkCompleted = useCallback((leapId: string) => {
    setCompletedLeapIds((prev) => new Set(prev).add(leapId));
  }, []);

  const handleDismiss = useCallback((leap: Leap) => {
    if (leap.fromUnimplementedFollowUp && leap.payload?.originalLeapType != null) {
      const timesIgnored = Number(leap.payload.timesIgnored ?? 0) + 1;
      const originalLeapType = String(leap.payload.originalLeapType);
      setLocalState((prev) => ({
        ...prev,
        unimplementedLeaps: prev.unimplementedLeaps.map((entry) =>
          entry.leapType === originalLeapType ? { ...entry, timesIgnored } : entry
        ),
      }));
      return;
    }
    const entry: UnimplementedLeapEntry = {
      dedupeKey: leap.dedupeKey,
      leapType: leap.leapType,
      lastSurfacedAt: new Date().toISOString(),
      timesIgnored: 0,
    };
    setLocalState((prev) => ({
      ...prev,
      unimplementedLeaps: [...prev.unimplementedLeaps, entry],
    }));
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* Scenario + Display mode */}
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {displayMode === 'user' ? 'Data Source' : 'Debug Scenario'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {displayMode === 'user' ? (
                // User View: Show simple dropdown with My data as default
                <select
                  value={scenarioId}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                >
                  <option value={LIVE_SCENARIO_ID}>My data</option>
                  <optgroup label="Simulate">
                    <option value="first_time">First time setup</option>
                    <option value="on_track">On track</option>
                    <option value="oversaved">Oversaved</option>
                    <option value="undersaved">Undersaved</option>
                    <option value="missing-match">Missing employer match</option>
                    <option value="hsa-eligible">HSA eligible</option>
                    <option value="ef-gap">Emergency fund gap</option>
                    <option value="high-apr-debt">High APR debt</option>
                    <option value="cash-risk">Cash at risk</option>
                    <option value="surplus-cash">Surplus cash</option>
                  </optgroup>
                </select>
              ) : (
                // Debug View: Show full dropdown with grouped debug scenarios
                <select
                  value={scenarioId}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                >
                  <option value={LIVE_SCENARIO_ID}>My data</option>
                  <optgroup label="Income Debug">
                    <option value="first_time">Debug: First Time (income)</option>
                    <option value="on_track">Debug: On Track (income)</option>
                    <option value="oversaved">Debug: Oversaved (income)</option>
                    <option value="undersaved">Debug: Undersaved (income)</option>
                  </optgroup>
                  <optgroup label="Savings/Allocator Debug">
                    <option value="savings_increase">Debug: Savings Increase (allocator)</option>
                    <option value="savings_decrease">Debug: Savings Decrease (allocator)</option>
                  </optgroup>
                  <optgroup label="Trigger Debug">
                    <option value="new-paycheck">Debug: New Paycheck</option>
                    <option value="missing-match">Debug: Missing Match</option>
                    <option value="hsa-eligible">Debug: HSA Eligible</option>
                    <option value="ef-gap">Debug: EF Gap (Case B: show)</option>
                    <option value="ef-on-track">Debug: EF On Track (Case A: suppressed)</option>
                    <option value="ef-target-met">Debug: EF Target Met (Case C: suppressed)</option>
                    <option value="ef-grace-period">Debug: EF Grace Period (Case D: suppressed)</option>
                    <option value="ef-grace-critically-low">Debug: EF Grace + Critically Low (Case E: show)</option>
                    <option value="high-apr-debt">Debug: High APR Debt</option>
                    <option value="cash-risk">Debug: Cash Risk</option>
                    <option value="surplus-cash">Debug: Surplus Cash</option>
                  </optgroup>
                  <optgroup label="Compound Debug">
                    <option value="many-issues">Debug: Many issues</option>
                    <option value="unimplemented-follow-up">Debug: Unimplemented follow-up</option>
                  </optgroup>
                </select>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">View:</span>
                <div className="flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDisplayMode('user')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      displayMode === 'user'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    User View
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('debug')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      displayMode === 'debug'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Debug View
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Leap */}
          {topLeap && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Top Leap
              </h2>
              <LeapCard
                leap={topLeap}
                mode={displayMode}
                onOpenSidekick={handleOpenSidekick}
                onOpenTool={handleOpenTool}
                onMarkComplete={handleMarkCompleted}
                onDismiss={handleDismiss}
                isTop
              />
            </section>
          )}

          {/* All Leaps / Other Leaps */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {displayMode === 'user'
                ? 'Other Leaps'
                : `All Leaps (Debug) — ${leaps.length} candidate${leaps.length !== 1 ? 's' : ''}`}
            </h2>
            <div className="space-y-3">
              {(displayMode === 'user' ? leaps.slice(1) : leaps).map((leap) => (
                <LeapCard
                  key={leap.leapId}
                  leap={leap}
                  mode={displayMode}
                  onOpenSidekick={handleOpenSidekick}
                  onOpenTool={handleOpenTool}
                  onMarkComplete={handleMarkCompleted}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
            {leaps.length === 0 && (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
                No candidate Leaps for this scenario.
              </p>
            )}
            {displayMode === 'user' && leaps.length <= 1 && leaps.length > 0 && (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">
                No other Leaps right now.
              </p>
            )}
          </section>

          {/* Clarity Notifications */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setClarityExpanded((e) => !e)}
              className="w-full flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <div className="text-left">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Clarity Notifications
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {clarityItems.length} {clarityItems.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>
              {clarityExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {clarityExpanded && (
              <div className="space-y-2">
                {clarityItems.map((item) => (
                  <Card key={item.id} className="border-slate-200 dark:border-slate-700">
                    <CardContent className="py-3 px-4">
                      <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        {item.message}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Sidekick Insights — 8 collapsible topics */}
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => setInsightsExpanded((e) => !e)}
              className="w-full flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <div className="text-left">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Sidekick Insights
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {SIDEKICK_INSIGHTS.length} topics
                  </p>
                </div>
              </div>
              {insightsExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {insightsExpanded && (
              <div className="space-y-3">
                {SIDEKICK_INSIGHTS.map((topic) => (
                  <SidekickInsightItem key={topic.id} topic={topic} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
