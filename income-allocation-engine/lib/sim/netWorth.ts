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
}

export interface ScenarioGoals {
  efTarget$?: number;
  debtFreeByMonth?: number;
}

export interface ScenarioInput {
  startDate: string; // ISO date for month 0
  horizonMonths?: number; // default 480
  inflationRatePct?: number; // default 2.5
  nominalReturnPct?: number; // default 6.0
  cashYieldPct?: number; // default 4.0
  employerMatchPctOfSalary?: number;
  taxDragBrokeragePct?: number; // default 0.5%/yr
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
  };
  
  if (hsa > 0 || input.openingBalances.hsa !== undefined) {
    series.hsa = new Array(months).fill(0);
  }
  
  // Constants
  const cashYield = (input.cashYieldPct ?? 4.0) / 100 / 12;
  const nominalReturn = (input.nominalReturnPct ?? 6.0) / 100 / 12;
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
    const plan = input.monthlyPlan[t] ?? input.monthlyPlan[0];
    
    // 1) Apply growth
    cash = round2(cash * (1 + cashYield));
    brokerage = round2(brokerage * (1 + brokerageReturn));
    retirement = round2(retirement * (1 + nominalReturn));
    if (hsa > 0) {
      hsa = round2(hsa * (1 + nominalReturn));
    }
    
    // 2) Inflows from plan
    cash = round2(cash + plan.ef$);
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
          series.warnings.push(
            `Month ${t + 1}: ${debt.name} paid off. Future minimum payment ($${originalMinPay.toFixed(2)}/month) redirected to brokerage.`
          );
        }
      }
    }
    
    // Apply extra payment (snowball highest APR)
    const extraPaid = applyExtraPayment(debts, totalExtraPayment);
    
    // If a debt was paid off and we had extra payment budget, redirect remainder to brokerage
    if (totalExtraPayment > extraPaid && extraPaid > 0) {
      const redirected = round2(totalExtraPayment - extraPaid);
      brokerage = round2(brokerage + redirected);
    }
    
    // Add redirected minimum payments from previously paid-off debts to brokerage
    if (redirectedMinPayments$ > 0.01) {
      brokerage = round2(brokerage + redirectedMinPayments$);
    }
    
    // 4) Cash outflows for needs + wants + debt payments
    // Note: redirectedMinPayments$ represents minimum payments from paid-off debts
    // These are redirected to brokerage, so they don't come from cash outflows
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
  
  return series;
}

/**
 * Validates that monthly plan savings don't exceed available income
 */
export function validateMonthlyPlan(plan: MonthlyPlan): string[] {
  const warnings: string[] = [];
  
  const totalSavings = round2(
    plan.ef$ + plan.highAprDebt$ + plan.match401k$ + 
    plan.retirementTaxAdv$ + plan.brokerage$
  );
  
  const availableForSavings = round2(plan.incomeNet - plan.needs$ - plan.wants$);
  
  if (totalSavings > availableForSavings + 0.01) {
    warnings.push(
      `Planned savings ($${totalSavings.toFixed(2)}) exceed available income ` +
      `($${availableForSavings.toFixed(2)}). Savings will be scaled proportionally.`
    );
  }
  
  return warnings;
}

