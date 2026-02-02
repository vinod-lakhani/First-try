/**
 * Savings Allocator state model: VALIDATED vs PROPOSAL mode.
 *
 * - currentPlan = last applied plan (persisted)
 * - proposedPlan = draft the user is reviewing (computed)
 * - VALIDATED mode = currentPlan deepEquals proposedPlan
 * - PROPOSAL mode = currentPlan differs from proposedPlan
 *
 * Manual Mode (Phase 2): +/- steppers, deterministic rebalance, uiMessages.
 */

export interface SavingsPlanSnapshot {
  ef$: number;
  debt$: number;
  match401k$: number;
  hsa$: number;
  retirementTaxAdv$: number;
  brokerage$: number;
  monthlySavings: number;
}

export interface SavingsOverrides {
  efDelta?: number;
  debtDelta?: number;
  retirementExtraDelta?: number;
  brokerageDelta?: number;
}

const EPSILON = 0.01;

export function deepEqualPlans(a: SavingsPlanSnapshot, b: SavingsPlanSnapshot): boolean {
  if (!a || !b) return false;
  return (
    Math.abs((a.ef$ ?? 0) - (b.ef$ ?? 0)) < EPSILON &&
    Math.abs((a.debt$ ?? 0) - (b.debt$ ?? 0)) < EPSILON &&
    Math.abs((a.match401k$ ?? 0) - (b.match401k$ ?? 0)) < EPSILON &&
    Math.abs((a.hsa$ ?? 0) - (b.hsa$ ?? 0)) < EPSILON &&
    Math.abs((a.retirementTaxAdv$ ?? 0) - (b.retirementTaxAdv$ ?? 0)) < EPSILON &&
    Math.abs((a.brokerage$ ?? 0) - (b.brokerage$ ?? 0)) < EPSILON
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Apply user overrides to current plan and rebalance.
 * - Reducing a category frees cash → if allowCashLeft, leave unallocated; else add to brokerage
 * - Increasing a category needs cash → take from brokerage, then retirement, ef, debt
 */
export function applyOverridesAndRebalance(
  current: SavingsPlanSnapshot,
  overrides: SavingsOverrides,
  budget: number,
  /** When true, freed money from decreases is left as "cash left" (Phase 1 Manual Mode). */
  allowCashLeft = false
): SavingsPlanSnapshot {
  const hasAny =
    (overrides.efDelta ?? 0) !== 0 ||
    (overrides.debtDelta ?? 0) !== 0 ||
    (overrides.retirementExtraDelta ?? 0) !== 0 ||
    (overrides.brokerageDelta ?? 0) !== 0;
  if (!hasAny) return { ...current };

  let ef$ = round2(Math.max(0, (current.ef$ ?? 0) + (overrides.efDelta ?? 0)));
  let debt$ = round2(Math.max(0, (current.debt$ ?? 0) + (overrides.debtDelta ?? 0)));
  let retirementTaxAdv$ = round2(Math.max(0, (current.retirementTaxAdv$ ?? 0) + (overrides.retirementExtraDelta ?? 0)));
  let brokerage$ = round2(Math.max(0, (current.brokerage$ ?? 0) + (overrides.brokerageDelta ?? 0)));

  const total = ef$ + debt$ + retirementTaxAdv$ + brokerage$;
  let diff = round2(budget - total);

  if (Math.abs(diff) < EPSILON) {
    return {
      ...current,
      ef$,
      debt$,
      retirementTaxAdv$,
      brokerage$,
      monthlySavings: budget,
    };
  }

  if (diff > 0 && !allowCashLeft) {
    brokerage$ = round2(brokerage$ + diff);
  } else if (diff < 0) {
    let take = round2(Math.abs(diff));
    if (brokerage$ >= take) {
      brokerage$ = round2(brokerage$ - take);
    } else {
      take = round2(take - brokerage$);
      brokerage$ = 0;
      if (retirementTaxAdv$ >= take) {
        retirementTaxAdv$ = round2(retirementTaxAdv$ - take);
      } else {
        take = round2(take - retirementTaxAdv$);
        retirementTaxAdv$ = 0;
        if (ef$ >= take) {
          ef$ = round2(ef$ - take);
        } else {
          take = round2(take - ef$);
          ef$ = 0;
          debt$ = round2(Math.max(0, debt$ - take));
        }
      }
    }
  }

  const monthlySavings = round2(ef$ + debt$ + retirementTaxAdv$ + brokerage$);
  return {
    ...current,
    ef$,
    debt$,
    retirementTaxAdv$,
    brokerage$,
    monthlySavings,
  };
}

export type AllocatorMode = 'VALIDATED' | 'PROPOSAL';

export function getAllocatorMode(
  currentPlan: SavingsPlanSnapshot,
  proposedPlan: SavingsPlanSnapshot
): AllocatorMode {
  return deepEqualPlans(currentPlan, proposedPlan) ? 'VALIDATED' : 'PROPOSAL';
}

/** Trim post-tax buckets to fit within pool (reduce from lowest priority first). */
export function trimPostTaxToPool(
  plan: SavingsPlanSnapshot,
  postTaxPool: number
): SavingsPlanSnapshot {
  const postTaxSum = (plan.ef$ ?? 0) + (plan.debt$ ?? 0) + (plan.retirementTaxAdv$ ?? 0) + (plan.brokerage$ ?? 0);
  if (postTaxSum <= postTaxPool + EPSILON) return plan;
  const excess = round2(postTaxSum - postTaxPool);
  let ef$ = plan.ef$ ?? 0;
  let debt$ = plan.debt$ ?? 0;
  let retirementTaxAdv$ = plan.retirementTaxAdv$ ?? 0;
  let brokerage$ = plan.brokerage$ ?? 0;
  let take = excess;
  for (const key of POSTTAX_KEYS_LOWEST_FIRST) {
    if (take <= EPSILON) break;
    const k = POSTTAX_KEY_TO_SNAPSHOT[key];
    let val = k === 'ef$' ? ef$ : k === 'debt$' ? debt$ : k === 'retirementTaxAdv$' ? retirementTaxAdv$ : brokerage$;
    if (val <= EPSILON) continue;
    const reduce = round2(Math.min(take, val));
    val = round2(Math.max(0, val - reduce));
    if (k === 'ef$') ef$ = val;
    else if (k === 'debt$') debt$ = val;
    else if (k === 'retirementTaxAdv$') retirementTaxAdv$ = val;
    else brokerage$ = val;
    take = round2(take - reduce);
  }
  const monthlySavings = round2(ef$ + debt$ + retirementTaxAdv$ + brokerage$);
  return { ...plan, ef$, debt$, retirementTaxAdv$, brokerage$, monthlySavings };
}

// --- Manual Mode (stepper-based) ---

/** Manual overrides: absolute values when user edits via +/- steppers. */
export interface ManualOverrides {
  pretax?: { k401EmployeeMonthly?: number; hsaMonthly?: number };
  posttax?: {
    emergencyFundMonthly?: number;
    highAprDebtMonthly?: number;
    rothMonthly?: number;
    brokerageMonthly?: number;
  };
}

/** UI message for inline display in Manual Mode. */
export interface UIMessage {
  type: 'info' | 'warn' | 'danger';
  text: string;
  id: string;
}

/** Post-tax bucket keys in priority order (1=highest). When user increases, we reduce from lowest first. */
const POSTTAX_KEYS_LOWEST_FIRST = ['brokerage', 'roth', 'highAprDebt', 'emergencyFund'] as const;
const POSTTAX_KEY_TO_SNAPSHOT: Record<string, keyof SavingsPlanSnapshot> = {
  brokerage: 'brokerage$',
  roth: 'retirementTaxAdv$',
  highAprDebt: 'debt$',
  emergencyFund: 'ef$',
};

export type PostTaxBucketKey = 'emergencyFund' | 'highAprDebt' | 'roth' | 'brokerage';

/** Step sizes for Manual Mode steppers. */
export const STEP_SIZES = {
  pretax401k: 25,
  pretaxHsa: 25,
  posttax: 50,
} as const;

/**
 * Apply a stepper change to a post-tax bucket. Deterministic rebalance:
 * - Increasing: if over pool, reduce lowest-priority buckets first.
 * - Decreasing: leave freed cash as "cash left" (don't auto-allocate).
 */
export function applyPostTaxStepperChange(
  base: Pick<SavingsPlanSnapshot, 'ef$' | 'debt$' | 'retirementTaxAdv$' | 'brokerage$'>,
  bucketKey: PostTaxBucketKey,
  delta: number,
  postTaxPool: number
): {
  plan: Pick<SavingsPlanSnapshot, 'ef$' | 'debt$' | 'retirementTaxAdv$' | 'brokerage$' | 'monthlySavings'>;
  reducedBucket?: PostTaxBucketKey;
} {
  let ef$ = base.ef$ ?? 0;
  let debt$ = base.debt$ ?? 0;
  let retirementTaxAdv$ = base.retirementTaxAdv$ ?? 0;
  let brokerage$ = base.brokerage$ ?? 0;

  const currentVal =
    bucketKey === 'emergencyFund' ? ef$ :
    bucketKey === 'highAprDebt' ? debt$ :
    bucketKey === 'roth' ? retirementTaxAdv$ :
    brokerage$;
  const nextVal = round2(Math.max(0, currentVal + delta));

  if (bucketKey === 'emergencyFund') ef$ = nextVal;
  else if (bucketKey === 'highAprDebt') debt$ = nextVal;
  else if (bucketKey === 'roth') retirementTaxAdv$ = nextVal;
  else brokerage$ = nextVal;

  let total = round2(ef$ + debt$ + retirementTaxAdv$ + brokerage$);
  let reducedBucket: PostTaxBucketKey | undefined;

  if (total > postTaxPool + EPSILON) {
    let excess = round2(total - postTaxPool);
    for (const key of POSTTAX_KEYS_LOWEST_FIRST) {
      if (excess <= EPSILON) break;
      const k = POSTTAX_KEY_TO_SNAPSHOT[key];
      let val = k === 'ef$' ? ef$ : k === 'debt$' ? debt$ : k === 'retirementTaxAdv$' ? retirementTaxAdv$ : brokerage$;
      if (val <= EPSILON) continue;
      const take = round2(Math.min(excess, val));
      val = round2(Math.max(0, val - take));
      if (k === 'ef$') ef$ = val;
      else if (k === 'debt$') debt$ = val;
      else if (k === 'retirementTaxAdv$') retirementTaxAdv$ = val;
      else brokerage$ = val;
      if (take > EPSILON) reducedBucket = key as PostTaxBucketKey;
      excess = round2(excess - take);
      total = round2(ef$ + debt$ + retirementTaxAdv$ + brokerage$);
    }
  }

  const monthlySavings = round2(ef$ + debt$ + retirementTaxAdv$ + brokerage$);
  return {
    plan: { ef$, debt$, retirementTaxAdv$, brokerage$, monthlySavings },
    reducedBucket,
  };
}

/** Generate UI messages based on proposed plan vs current and context. */
export function generateUIMessages(params: {
  currentPlan: SavingsPlanSnapshot | null;
  proposedPlan: SavingsPlanSnapshot | null;
  mode: AllocatorMode;
  lastEditedKey: string | null;
  reducedBucket?: PostTaxBucketKey;
  matchNeedMonthly: number;
  fullMatchMonthly: number;
  efTargetMonths: number;
  efMonthsProposed: number;
  efMonthsCurrent: number;
  monthlyBasics: number;
  totalDebtBalance: number;
  hsaRecommendedMonthly: number;
  postTaxPool: number;
  posttaxSum: number;
}): UIMessage[] {
  const msgs: UIMessage[] = [];
  const id = () => `ui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (params.mode === 'VALIDATED') {
    msgs.push({
      type: 'info',
      text: "Your plan is already active. Ask me anything or tap Adjust to tweak it.",
      id: id(),
    });
    return msgs;
  }

  const { currentPlan, proposedPlan } = params;
  if (!proposedPlan || !currentPlan) return msgs;

  // 1) Match loss warning (employer match drops when 401k employee decreases)
  const proposedMatch = proposedPlan.match401k$ ?? 0;
  const currentMatch = currentPlan.match401k$ ?? 0;
  const matchDrop = currentMatch - proposedMatch;
  if (matchDrop > 0.01) {
    const severity = matchDrop > 25 ? 'danger' : 'warn';
    msgs.push({
      type: severity,
      text: `Heads up — lowering your 401(k) below the match level forfeits about $${Math.round(matchDrop).toLocaleString()}/mo in employer match (free money).`,
      id: id(),
    });
  }

  // 2) HSA reduction warning
  const proposedHsa = proposedPlan.hsa$ ?? 0;
  if (params.hsaRecommendedMonthly > 0 && proposedHsa < params.hsaRecommendedMonthly - 0.01) {
    msgs.push({
      type: 'warn',
      text: "Reducing your HSA lowers your tax advantage. Consider keeping it at the recommended level.",
      id: id(),
    });
  }

  // 3) Emergency fund risk
  if (params.efMonthsProposed < params.efTargetMonths) {
    const severity = params.efMonthsProposed < 3 ? 'danger' : 'warn';
    msgs.push({
      type: severity,
      text: severity === 'danger'
        ? "This drops your buffer below ~3 months of expenses. Higher risk of needing debt for surprises."
        : "This slows your emergency fund progress. You'll be under your safety target for longer.",
      id: id(),
    });
  }

  // 4) High-APR debt payoff slowdown
  const proposedDebt = proposedPlan.debt$ ?? 0;
  const currentDebt = currentPlan.debt$ ?? 0;
  if (params.totalDebtBalance > 0 && proposedDebt < currentDebt - 0.01) {
    msgs.push({
      type: 'warn',
      text: "Paying less on high-APR debt usually costs more in interest over time. Want to keep this higher and reduce investing instead?",
      id: id(),
    });
  }

  // 5) Informational rebalance
  const bucketLabels: Record<PostTaxBucketKey, string> = {
    emergencyFund: 'emergency fund',
    highAprDebt: 'debt paydown',
    roth: 'retirement',
    brokerage: 'brokerage',
  };
  if (params.reducedBucket) {
    msgs.push({
      type: 'info',
      text: `I rebalanced ${bucketLabels[params.reducedBucket]} down to keep you within your post-tax savings available.`,
      id: id(),
    });
  }

  // 6) Cash left
  const cashLeft = round2(params.postTaxPool - params.posttaxSum);
  if (cashLeft > 0.01) {
    msgs.push({
      type: 'info',
      text: `Cash left to allocate: $${Math.round(cashLeft).toLocaleString()}/mo`,
      id: id(),
    });
  }

  return msgs;
}
