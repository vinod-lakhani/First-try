/**
 * Build current-plan data for chat — SINGLE SOURCE OF TRUTH
 *
 * All chat contexts (FinancialSidekick, SavingsChatPanel, IncomePlanChatCard) MUST use
 * this utility for current/baseline data. Ensures net worth, savings breakdown, and
 * savings allocation are consistent across all chat windows.
 *
 * Source: FinalPlanData from buildFinalPlanData (usePlanData hook).
 */

import type { FinalPlanData } from '@/lib/onboarding/plan';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Chat API expects this net worth structure */
export interface ChatNetWorth {
  current: number;
  currentAssets?: number;
  currentLiabilities?: number;
  currentAssetBreakdown?: {
    cash: number;
    brokerage: number;
    retirement: number;
    hsa?: number;
    totalAssets: number;
    liabilities: number;
  };
  projections: Array<{
    label: string;
    months: number;
    value: number;
    assetBreakdown?: {
      cash: number;
      brokerage: number;
      retirement: number;
      hsa?: number;
      totalAssets: number;
      liabilities: number;
    };
  }>;
  chartDataMonths?: number;
}

/** Build net worth object for chat from plan data */
export function buildChatNetWorthFromPlan(planData: FinalPlanData | null): ChatNetWorth | undefined {
  if (!planData?.netWorthChartData) return undefined;

  const { netWorthChartData, netWorthProjection } = planData;
  const netWorth = netWorthChartData.netWorth || [];
  const assets = netWorthChartData.assets || [];
  const liabilities = netWorthChartData.liabilities || [];
  const cash = netWorthChartData.cash || [];
  const brokerage = netWorthChartData.brokerage || [];
  const retirement = netWorthChartData.retirement || [];
  const hsa = netWorthChartData.hsa;

  const currentNetWorth = netWorth.length > 0 ? netWorth[0] : 0;
  const currentAssets = assets.length > 0 ? assets[0] : 0;
  const currentLiabilities = liabilities.length > 0 ? liabilities[0] : 0;

  const getAssetBreakdown = (index: number) => {
    if (index < 0 || index >= netWorth.length) return undefined;
    return {
      cash: cash[index] ?? 0,
      brokerage: brokerage[index] ?? 0,
      retirement: retirement[index] ?? 0,
      ...(hsa && hsa.length > index ? { hsa: hsa[index] } : {}),
      totalAssets: assets[index] ?? 0,
      liabilities: liabilities[index] ?? 0,
    };
  };

  const projections = (netWorthProjection || []).map((p) => {
    const months = p.months ?? 0;
    const index = months === 0 ? 0 : months;
    const breakdown = getAssetBreakdown(index);
    return {
      label: p.label,
      months,
      value: p.value,
      ...(breakdown ? { assetBreakdown: breakdown } : {}),
    };
  });

  const has5Year = projections.some((p) => p.months === 60);
  if (!has5Year && netWorth.length > 60) {
    const idx = 60;
    const breakdown = getAssetBreakdown(idx);
    projections.push({
      label: '5 Years',
      months: 60,
      value: round2(netWorth[idx] ?? 0),
      ...(breakdown ? { assetBreakdown: breakdown } : {}),
    });
  }

  const has10Year = projections.some((p) => p.months === 120);
  if (!has10Year && netWorth.length > 120) {
    const idx = 120;
    const breakdown = getAssetBreakdown(idx);
    projections.push({
      label: '10 Years',
      months: 120,
      value: round2(netWorth[idx] ?? 0),
      ...(breakdown ? { assetBreakdown: breakdown } : {}),
    });
  }

  return {
    current: round2(currentNetWorth),
    currentAssets: round2(currentAssets),
    currentLiabilities: round2(currentLiabilities),
    currentAssetBreakdown: getAssetBreakdown(0),
    projections,
    chartDataMonths: netWorth.length,
  };
}

/** Build savings allocation object for chat from plan data */
export function buildChatSavingsAllocationFromPlan(
  planData: FinalPlanData | null,
  paychecksPerMonth: number
): Record<string, { amount: number; percent: number }> | undefined {
  if (!planData?.paycheckCategories) return undefined;

  const emergencyCat = planData.paycheckCategories.find((c) => c.key === 'emergency');
  const debtExtraCat = planData.paycheckCategories.find((c) => c.key === 'debt_extra');
  const longTermCat = planData.paycheckCategories.find((c) => c.key === 'long_term_investing');
  const matchSub = longTermCat?.subCategories?.find((s) => s.key === '401k_match');
  const retirementSub = longTermCat?.subCategories?.find((s) => s.key === 'retirement_tax_advantaged');
  const brokerageSub = longTermCat?.subCategories?.find((s) => s.key === 'brokerage');

  const emergencyMonthly = (emergencyCat?.amount ?? 0) * paychecksPerMonth;
  const debtExtraMonthly = (debtExtraCat?.amount ?? 0) * paychecksPerMonth;
  const match401kMonthly = (matchSub?.amount ?? 0) * paychecksPerMonth;
  const retirementMonthly = (retirementSub?.amount ?? 0) * paychecksPerMonth;
  const brokerageMonthly = (brokerageSub?.amount ?? 0) * paychecksPerMonth;

  const total =
    emergencyMonthly + debtExtraMonthly + match401kMonthly + retirementMonthly + brokerageMonthly;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return {
    emergencyFund: { amount: round2(emergencyMonthly), percent: pct(emergencyMonthly) },
    debtPayoff: { amount: round2(debtExtraMonthly), percent: pct(debtExtraMonthly) },
    match401k: { amount: round2(match401kMonthly), percent: pct(match401kMonthly) },
    retirementTaxAdv: { amount: round2(retirementMonthly), percent: pct(retirementMonthly) },
    brokerage: { amount: round2(brokerageMonthly), percent: pct(brokerageMonthly) },
  };
}

/** Current plan data for chat — net worth, savings breakdown, savings allocation */
export interface ChatCurrentPlanData {
  netWorth?: ChatNetWorth;
  savingsBreakdown?: {
    cashSavingsMTD: number;
    payrollSavingsMTD: number;
    employerMatchMTD: number;
    employerHSAMTD?: number;
    totalSavingsMTD: number;
    baseSavingsMonthly?: number;
    preTaxSavingsTotal?: number;
    taxSavingsMonthly?: number;
    netPreTaxImpact?: number;
  };
  savingsAllocation?: Record<string, { amount: number; percent: number }>;
}

/**
 * Build current-plan data for chat from plan data.
 * Use this everywhere chat needs baseline/current user data.
 */
export function buildChatCurrentPlanData(
  planData: FinalPlanData | null,
  options?: {
    paychecksPerMonth?: number;
    savingsBreakdown?: ChatCurrentPlanData['savingsBreakdown'];
  }
): ChatCurrentPlanData {
  if (!planData) return {};

  const paychecksPerMonth = options?.paychecksPerMonth ?? 2.17;

  const netWorth = buildChatNetWorthFromPlan(planData);
  const savingsAllocation = buildChatSavingsAllocationFromPlan(planData, paychecksPerMonth);
  const savingsBreakdown = options?.savingsBreakdown ?? planData.savingsBreakdown;

  return {
    ...(netWorth ? { netWorth } : {}),
    ...(savingsBreakdown ? { savingsBreakdown } : {}),
    ...(savingsAllocation ? { savingsAllocation } : {}),
  };
}
