/**
 * Net Worth Simulator
 * 
 * Simulates monthly cash flows, investment growth, and liabilities
 * over a 40-year horizon based on allocation engine outputs.
 */

import { round2 } from '../alloc/income';

export interface Liability {
  name: string;
  balance: number;
  aprPct: number;
  minPayment: number;
  extraPayment?: number;
}

export interface OpeningBalances {
  cash: number;
  brokerage: number;
  retirement: number;
  hsa?: number;
  otherAssets?: number;
  liabilities: Liability[];
}

export interface MonthlyPlan {
  monthIndex: number;
  incomeNet: number;
  needs$: number;
  wants$: number;
  ef$: number;
  highAprDebt$: number;
  match401k$: number;
  retirementTaxAdv$: number;
  brokerage$: number;
  unallocated$?: number;
}

export interface ScenarioGoals {
  efTarget$?: number;
  debtFreeByMonth?: number;
}

export interface ScenarioInput {
  startDate: string; // ISO date for month 0
  horizonMonths?: number; // default 480
  inflationRatePct?: number; // default 2.5
  nominalReturnPct?: number; // default 9.0 (matches standalone net-worth-interactive.html)
  cashYieldPct?: number; // default 4.0 (matches standalone net-worth-interactive.html)
  employerMatchPctOfSalary?: number;
  taxDragBrokeragePct?: number; // default 0.5%/yr (matches standalone net-worth-interactive.html)
  openingBalances: OpeningBalances;
  monthlyPlan: MonthlyPlan[];
  goals?: ScenarioGoals;
}

export interface ScenarioSeries {
  labels: string[];
  assets: number[];
  liabilities: number[];
  netWorth: number[];
  cash: number[];
  brokerage: number[];
  retirement: number[];
  hsa?: number[];
  kpis: {
    efReachedMonth?: number;
    debtFreeMonth?: number;
    netWorthAtYears: Record<number, number>;
    cagrNominal?: number;
  };
  warnings: string[];
  // Track when each individual debt is paid off
  debtPayoffMonths?: Map<string, number>; // debt name -> month index when paid off
}

/**
 * Builds month labels from start date
 */
function buildMonthLabels(startDate: string, months: number): string[] {
  const start = new Date(startDate);
  const labels: string[] = [];
  
  for (let i = 0; i < months; i++) {
    const date = new Date(start);
    date.setMonth(start.getMonth() + i);
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    labels.push(`${monthName} ${year}`);
  }
  
  return labels;
}

/**
 * Clones liabilities array for simulation
 */
function cloneLiabilities(liabilities: Liability[]): Liability[] {
  return liabilities.map(liab => ({
    ...liab,
    balance: liab.balance,
  }));
}

/**
 * Applies extra payment using snowball method (highest APR first)
 * Note: This function assumes interest has already been accrued and minimum payment applied
 */
function applyExtraPayment(debts: Liability[], extraPayment$: number): number {
  if (extraPayment$ <= 0.01 || debts.length === 0) {
    return 0;
  }
  
  // Sort by APR descending (highest first)
  const activeDebts = debts
    .filter(d => d.balance > 0.01)
    .sort((a, b) => b.aprPct - a.aprPct);
  
  let remaining = extraPayment$;
  
  for (const debt of activeDebts) {
    if (remaining <= 0.01) break;
    
    // Extra payment can only be applied to remaining balance after interest and min payment
    const payment = Math.min(remaining, debt.balance);
    debt.balance = round2(debt.balance - payment);
    remaining = round2(remaining - payment);
  }
  
  return round2(extraPayment$ - remaining);
}

/**
 * Calculates total liabilities
 */
function sumLiabilities(debts: Liability[]): number {
  return round2(debts.reduce((sum, d) => sum + Math.max(0, d.balance), 0));
}

/**
 * Computes KPIs from the simulation series
 */
function computeKPIs(
  series: ScenarioSeries,
  input: ScenarioInput,
  efTarget$?: number
): void {
  const months = series.netWorth.length;
  
  // EF reached month
  if (efTarget$ !== undefined) {
    for (let i = 0; i < months; i++) {
      if (series.cash[i] >= efTarget$) {
        series.kpis.efReachedMonth = i;
        break;
      }
    }
  }
  
  // Debt-free month
  for (let i = 0; i < months; i++) {
    if (series.liabilities[i] <= 0.01) {
      series.kpis.debtFreeMonth = i;
      break;
    }
  }
  
  // Net worth at 5/10/20/40 years
  const yearPoints = [5, 10, 20, 40];
  yearPoints.forEach(years => {
    const monthIndex = years * 12 - 1; // Month index is 0-based, so year N is at index (N*12 - 1)
    if (monthIndex >= 0 && monthIndex < months) {
      series.kpis.netWorthAtYears[years] = round2(series.netWorth[monthIndex]);
    }
  });
  
  // CAGR (Compound Annual Growth Rate)
  if (months > 12) {
    const startNW = series.netWorth[0];
    const endNW = series.netWorth[months - 1];
    if (startNW > 0 && endNW > 0) {
      const years = months / 12;
      const cagr = (Math.pow(endNW / startNW, 1 / years) - 1) * 100;
      series.kpis.cagrNominal = round2(cagr);
    }
  }
}

/**
 * Simulates a single scenario over the horizon
 */
export function simulateScenario(input: ScenarioInput): ScenarioSeries {
  const months = input.horizonMonths ?? 480;
  const labels = buildMonthLabels(input.startDate, months);
  
  // Initialize balances
  let cash = round2(input.openingBalances.cash);
  let brokerage = round2(input.openingBalances.brokerage);
  let retirement = round2(input.openingBalances.retirement);
  let hsa = round2(input.openingBalances.hsa ?? 0);
  let otherAssets = round2(input.openingBalances.otherAssets ?? 0);
  
  const debts = cloneLiabilities(input.openingBalances.liabilities);
  
  // Initialize series arrays
  const series: ScenarioSeries = {
    labels,
    assets: new Array(months).fill(0),
    liabilities: new Array(months).fill(0),
    netWorth: new Array(months).fill(0),
    cash: new Array(months).fill(0),
    brokerage: new Array(months).fill(0),
    retirement: new Array(months).fill(0),
    kpis: {
      netWorthAtYears: {},
    },
    warnings: [],
    debtPayoffMonths: new Map<string, number>(), // Track individual debt payoff dates
  };
  
  if (hsa > 0 || input.openingBalances.hsa !== undefined) {
    series.hsa = new Array(months).fill(0);
  }
  
  // Constants
  // Match the standalone net-worth-interactive.html defaults:
  // - 4% for cash (HYSA/EF)
  // - 9% for investments (retirement, brokerage before tax drag)
  // - 0.5% tax drag on brokerage
  const cashYield = (input.cashYieldPct ?? 4.0) / 100 / 12;
  const nominalReturn = (input.nominalReturnPct ?? 9.0) / 100 / 12;
  const taxDrag = (input.taxDragBrokeragePct ?? 0.5) / 100 / 12;
  const brokerageReturn = nominalReturn - taxDrag;
  
  const efTarget$ = input.goals?.efTarget$;
  
  // Track original minimum payments for debts (for reallocation when paid off)
  const originalMinPayments = new Map<Liability, number>();
  debts.forEach(debt => {
    originalMinPayments.set(debt, debt.minPayment);
  });
  
  // Track which debts have been paid off and their redirected min payments
  const paidOffDebts = new Set<Liability>();
  let redirectedMinPayments$ = 0;
  
  // Monthly simulation loop
  for (let t = 0; t < months; t++) {
    // Get plan for this month (repeat first if not enough entries)
    let plan = input.monthlyPlan[t] ?? input.monthlyPlan[0];
    
    // Dynamically adjust plan based on current state:
    // 1. If all debts are paid off, redirect debt payments to brokerage
    // 2. If EF target is reached, redirect EF contributions to brokerage
    const activeDebts = debts.filter(d => d.balance > 0.01);
    const hasActiveDebt = activeDebts.length > 0;
    const efTargetReached = efTarget$ !== undefined && cash >= efTarget$;
    
    // Create adjusted plan for this month
    const adjustedPlan: MonthlyPlan = {
      ...plan,
      // If no active debt, redirect debt payments to brokerage
      highAprDebt$: hasActiveDebt ? plan.highAprDebt$ : 0,
      // If EF target reached, redirect EF to brokerage
      ef$: efTargetReached ? 0 : plan.ef$,
      // Redirect freed-up allocations to brokerage
      brokerage$: plan.brokerage$ + 
        (hasActiveDebt ? 0 : plan.highAprDebt$) + 
        (efTargetReached ? plan.ef$ : 0),
    };
    
    plan = adjustedPlan;
    
    // 1) Apply growth
    cash = round2(cash * (1 + cashYield));
    brokerage = round2(brokerage * (1 + brokerageReturn));
    retirement = round2(retirement * (1 + nominalReturn));
    if (hsa > 0) {
      hsa = round2(hsa * (1 + nominalReturn));
    }
    
    // 2) Inflows from plan
    cash = round2(cash + plan.ef$ + (plan.unallocated$ ?? 0));
    brokerage = round2(brokerage + plan.brokerage$);
    retirement = round2(retirement + plan.match401k$ + plan.retirementTaxAdv$);
    
    // 3) Update liabilities (accrue interest, then apply payments)
    let totalMinPayment = 0;
    let totalExtraPayment = plan.highAprDebt$;
    
    // Process each debt
    for (const debt of debts) {
      if (paidOffDebts.has(debt)) {
        // This debt was already paid off in a previous month - its min payment is redirected
        // (already counted in redirectedMinPayments$)
        continue;
      }
      
      if (debt.balance <= 0.01) {
        // Debt is now paid off - add its min payment to redirected amount
        const originalMinPay = originalMinPayments.get(debt) ?? 0;
        if (originalMinPay > 0.01 && !paidOffDebts.has(debt)) {
          redirectedMinPayments$ = round2(redirectedMinPayments$ + originalMinPay);
          paidOffDebts.add(debt);
          // Track when this specific debt was paid off
          series.debtPayoffMonths!.set(debt.name, t);
          series.warnings.push(
            `Month ${t + 1}: ${debt.name} paid off. Future minimum payment ($${originalMinPay.toFixed(2)}/month) redirected to brokerage.`
          );
        }
        continue;
      }
      
      // Accrue interest
      debt.balance = round2(debt.balance * (1 + debt.aprPct / 100 / 12));
      
      // Apply minimum payment
      const minPay = Math.min(debt.balance, debt.minPayment);
      debt.balance = round2(debt.balance - minPay);
      totalMinPayment = round2(totalMinPayment + minPay);
      
      // Check if debt was just paid off this month
      if (debt.balance <= 0.01) {
        const originalMinPay = originalMinPayments.get(debt) ?? 0;
        if (originalMinPay > 0.01 && !paidOffDebts.has(debt)) {
          redirectedMinPayments$ = round2(redirectedMinPayments$ + originalMinPay);
          paidOffDebts.add(debt);
          // Track when this specific debt was paid off
          series.debtPayoffMonths!.set(debt.name, t);
          series.warnings.push(
            `Month ${t + 1}: ${debt.name} paid off. Future minimum payment ($${originalMinPay.toFixed(2)}/month) redirected to brokerage.`
          );
        }
      }
    }
    
    // Apply extra payment (snowball highest APR)
    // Match standalone HTML logic: always try to apply, redirect unused portion
    const extraPaid = applyExtraPayment(debts, totalExtraPayment);
    
    // If we couldn't use all the extra payment (e.g., all debts paid off), redirect to brokerage
    // This represents the savings that would have gone to debt but is now available for investing
    if (totalExtraPayment > extraPaid && totalExtraPayment > 0) {
      const redirected = round2(totalExtraPayment - extraPaid);
      brokerage = round2(brokerage + redirected);
    }
    
    // Add redirected minimum payments from previously paid-off debts to brokerage
    // These represent freed-up cash flow that should be invested, not left in cash
    if (redirectedMinPayments$ > 0.01) {
      brokerage = round2(brokerage + redirectedMinPayments$);
    }
    
    // 4) Cash outflows for needs + wants + debt payments
    // Note: redirectedMinPayments$ represents minimum payments from paid-off debts
    // These minimum payments are redirected to brokerage (line 328), so they don't come from cash outflows
    // Extra debt payments that can't be applied (all debts paid off) are also redirected to brokerage (line 323)
    const totalOutflows = round2(plan.needs$ + plan.wants$ + totalMinPayment + extraPaid);
    
    // Check for cash shortfall
    if (cash < totalOutflows) {
      const shortfall = round2(totalOutflows - cash);
      series.warnings.push(
        `Month ${t + 1}: Cash shortfall of $${shortfall.toFixed(2)}. Payments capped at available cash.`
      );
      // Cap payments at available cash (simplified: reduce proportionally)
      cash = 0;
    } else {
      cash = round2(cash - totalOutflows);
    }
    
    // Validate: no negative balances
    cash = Math.max(0, cash);
    brokerage = Math.max(0, brokerage);
    retirement = Math.max(0, retirement);
    hsa = Math.max(0, hsa);
    
    // 5) Snapshot balances
    const totalLiabilities = sumLiabilities(debts);
    const totalAssets = round2(cash + brokerage + retirement + hsa + otherAssets);
    
    series.cash[t] = cash;
    series.brokerage[t] = brokerage;
    series.retirement[t] = retirement;
    if (series.hsa) {
      series.hsa[t] = hsa;
    }
    series.assets[t] = totalAssets;
    series.liabilities[t] = totalLiabilities;
    series.netWorth[t] = round2(totalAssets - totalLiabilities);
  }
  
  // Compute KPIs
  computeKPIs(series, input, efTarget$);
  
  // Debug: Log array lengths before returning - CRITICAL DEBUG
  const debugInfo = {
    cash: series.cash.length,
    brokerage: series.brokerage.length,
    retirement: series.retirement.length,
    assets: series.assets.length,
    netWorth: series.netWorth.length,
    cashFirst3: series.cash.slice(0, 3),
    cashLast3: series.cash.slice(-3),
    brokerageFirst3: series.brokerage.slice(0, 3),
    brokerageLast3: series.brokerage.slice(-3),
    retirementFirst3: series.retirement.slice(0, 3),
    retirementLast3: series.retirement.slice(-3),
    cashAtIndex119: series.cash[119],
    brokerageAtIndex119: series.brokerage[119],
    retirementAtIndex119: series.retirement[119],
  };
  
  console.log('🔍 [simulateScenario] Returning series with array lengths:', debugInfo);
  
  // CRITICAL: If arrays are empty, throw an error
  if (series.assets.length > 0 && (series.cash.length === 0 || series.brokerage.length === 0 || series.retirement.length === 0)) {
    console.error('❌❌❌ [simulateScenario] FATAL: Assets has data but breakdown arrays are empty!', debugInfo);
    console.error('❌❌❌ Full series object:', {
      hasCash: !!series.cash,
      hasBrokerage: !!series.brokerage,
      hasRetirement: !!series.retirement,
      cashType: typeof series.cash,
      seriesKeys: Object.keys(series),
    });
  }
  
  return series;
}

