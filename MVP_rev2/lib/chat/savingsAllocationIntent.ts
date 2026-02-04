/**
 * Savings allocation intent: chat creates intent, tool uses intent.
 *
 * Philosophy: We parse the user's message into a single semantic intent (what they want),
 * not word triggers. The allocator then applies from intent; PLAN_CHANGES from the API
 * is only used when no intent was parsed (e.g. explain-only or model-only flow).
 */

export type SavingsAllocationCategory = 'ef' | 'debt' | 'retirementExtra' | 'brokerage' | '401k' | 'hsa';

export type SavingsAllocationIntent =
  | { kind: 'reset' }
  | { kind: 'set_target'; category: SavingsAllocationCategory; targetMonthly: number }
  | { kind: 'delta'; category: SavingsAllocationCategory; delta: number }
  | { kind: 'eliminate'; category: '401k' | 'hsa' };

export interface SavingsAllocationIntentContext {
  preTax401k$: number;
  hsa$: number;
  ef$: number;
  debt$: number;
  retirementExtra$: number;
  brokerage$: number;
}

const CATEGORY_EF = /(?:emergency\s*fund|emergency fund|ef|buffer)/i;
const CATEGORY_DEBT = /(?:debt|high\s*[- ]?apr)/i;
const CATEGORY_RETIREMENT = /(?:retirement|roth|ira)/i;
const CATEGORY_BROKERAGE = /(?:brokerage|investing|investment)/i;
const CATEGORY_401K = /(?:401\s*\(?\s*k\s*\)?|401k)/i;
const CATEGORY_HSA = /\bhsa\b/i;

function parseAmount(t: string): number | null {
  const match = t.match(/\$?(\d+(?:,\d{3})*)/);
  if (!match) return null;
  return parseInt(match[1].replace(/,/g, ''), 10);
}

function getCategory(t: string): SavingsAllocationCategory | null {
  if (CATEGORY_EF.test(t)) return 'ef';
  if (CATEGORY_DEBT.test(t)) return 'debt';
  if (CATEGORY_RETIREMENT.test(t)) return 'retirementExtra';
  if (CATEGORY_BROKERAGE.test(t)) return 'brokerage';
  if (CATEGORY_401K.test(t)) return '401k';
  if (CATEGORY_HSA.test(t)) return 'hsa';
  return null;
}

/**
 * Parse user message into a single savings allocation intent.
 * Order: reset → eliminate → set_target (to $X) → delta (by $X).
 * Returns null if no allocation-change intent is detected.
 */
export function parseSavingsAllocationIntent(
  text: string,
  context: SavingsAllocationIntentContext
): SavingsAllocationIntent | null {
  const t = text.trim();
  const lower = t.toLowerCase();

  // Reset
  if (/reset|revert|undo|go\s+back\s+to\s+recommended/i.test(lower)) {
    return { kind: 'reset' };
  }

  // Eliminate (401k / HSA only)
  if (/eliminate|remove|(?:do\s+not|don't|dont)\s+want|no\s+(?:401k|hsa)|(?:set|drop)\s+to\s+\$?0/i.test(lower)) {
    if (CATEGORY_401K.test(t) && (context.preTax401k$ ?? 0) > 0) return { kind: 'eliminate', category: '401k' };
    if (CATEGORY_HSA.test(t) && (context.hsa$ ?? 0) > 0) return { kind: 'eliminate', category: 'hsa' };
  }

  const amount = parseAmount(t);
  const category = getCategory(t);
  if (category == null) return null;

  // "to $X" (set target) — check before "by $X"
  const toPatterns: Array<RegExp> = [];
  if (category === 'ef') {
    toPatterns.push(
      /(?:decrease|reduce|set|make|change)\s+(?:my\s+)?(?:emergency\s*fund|emergency fund|ef)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
      /(?:want\s+to\s+)?(?:change\s+)?(?:my\s+)?(?:emergency\s*fund|emergency fund|ef)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
      /(?:emergency\s*fund|emergency fund|ef)\s+(?:contribution\s+)?to\s+\$?(\d+)/i
    );
  } else if (category === '401k') {
    toPatterns.push(
      /(?:reduce|set|make|change)\s+(?:my\s+)?(?:401\s*\(?\s*k\s*\)?|401k)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
      /(?:401\s*\(?\s*k\s*\)?|401k)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
      /(?:want\s+to\s+)?(?:change\s+)?(?:my\s+)?(?:401\s*\(?\s*k\s*\)?|401k)\s+(?:contribution\s+)?to\s+\$?(\d+)/i
    );
  } else if (category === 'hsa') {
    toPatterns.push(
      /(?:reduce|set|make|change)\s+(?:my\s+)?hsa\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
      /hsa\s+(?:contribution\s+)?to\s+\$?(\d+)/i
    );
  } else if (category === 'debt') {
    toPatterns.push(
      /(?:decrease|reduce|set|make|change)\s+(?:my\s+)?(?:debt|high\s*[- ]?apr)\s+(?:pay(?:ment|off)?\s+)?to\s+\$?(\d+)/i,
      /(?:debt|high\s*[- ]?apr)\s+to\s+\$?(\d+)/i
    );
  } else if (category === 'retirementExtra') {
    toPatterns.push(
      /(?:decrease|reduce|set|make|change)\s+(?:my\s+)?(?:retirement|roth|ira)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
      /(?:retirement|roth|ira)\s+(?:contribution\s+)?to\s+\$?(\d+)/i
    );
  } else if (category === 'brokerage') {
    toPatterns.push(
      /(?:decrease|reduce|set|make|change)\s+(?:my\s+)?(?:brokerage|investing|investment)\s+(?:contribution\s+)?to\s+\$?(\d+)/i,
      /(?:brokerage|investing|investment)\s+(?:contribution\s+)?to\s+\$?(\d+)/i
    );
  }

  for (const pattern of toPatterns) {
    const match = t.match(pattern);
    if (match) {
      const target = parseInt(match[1].replace(/,/g, ''), 10);
      if (target >= 0 && target <= 100000) return { kind: 'set_target', category, targetMonthly: target };
    }
  }

  // "by $X" (delta)
  const byMatch = t.match(/by\s+\$?(\d+(?:,\d{3})*)(?:\s|$|,|\.|\/mo)/i) ?? t.match(/(?:reduce|reducing|decrease|lower|cut|drop|increase|raise|add|boost)[^0-9]*\$?(\d+)/i);
  if (byMatch && amount != null && amount > 0) {
    const value = parseInt(byMatch[1].replace(/,/g, ''), 10);
    const isDecrease = /decrease|reduce|lower|cut|drop|less/i.test(lower);
    const isIncrease = /increase|add|raise|boost|more/i.test(lower);
    const delta = isDecrease ? -value : isIncrease ? value : 0;
    if (delta !== 0) return { kind: 'delta', category, delta };
  }

  // Single number + category (ambiguous): prefer "set target" if number is small vs current (e.g. "401k 100" when current 677 → to 100)
  if (amount != null && amount > 0) {
    const current = category === 'ef' ? context.ef$ : category === 'debt' ? context.debt$ : category === 'retirementExtra' ? context.retirementExtra$ : category === 'brokerage' ? context.brokerage$ : category === '401k' ? context.preTax401k$ : context.hsa$;
    const isDecrease = /decrease|reduce|lower|cut|drop|change/i.test(lower);
    const isIncrease = /increase|add|raise|boost|more/i.test(lower);
    if (isDecrease && amount < current - 10) return { kind: 'set_target', category, targetMonthly: amount };
    if (isDecrease) return { kind: 'delta', category, delta: -amount };
    if (isIncrease) return { kind: 'delta', category, delta: amount };
  }

  return null;
}

/**
 * Convert intent + context into the delta to apply for a category.
 * For set_target: delta = targetMonthly - current.
 * For delta: return intent.delta.
 * For eliminate: return -current.
 */
export function intentToDelta(
  intent: SavingsAllocationIntent,
  context: SavingsAllocationIntentContext
): { category: SavingsAllocationCategory; delta: number } | null {
  if (intent.kind === 'reset') return null;

  if (intent.kind === 'eliminate') {
    const current = intent.category === '401k' ? context.preTax401k$ : context.hsa$;
    return { category: intent.category, delta: -current };
  }

  if (intent.kind === 'set_target') {
    const current = intent.category === 'ef' ? context.ef$ : intent.category === 'debt' ? context.debt$ : intent.category === 'retirementExtra' ? context.retirementExtra$ : intent.category === 'brokerage' ? context.brokerage$ : intent.category === '401k' ? context.preTax401k$ : context.hsa$;
    const delta = intent.targetMonthly - current;
    return { category: intent.category, delta };
  }

  return { category: intent.category, delta: intent.delta };
}

/**
 * Whether this intent is a single-category change that should override API destination deltas.
 * When true, we apply only this intent's delta and let rebalance handle the freed amount.
 */
export function intentIsSingleCategoryChange(intent: SavingsAllocationIntent): boolean {
  return intent.kind === 'set_target' || intent.kind === 'delta' || intent.kind === 'eliminate';
}

/** Shape matching PlanChangesFromChat: used to correct API plan changes from user intent. */
export interface PlanChangesFromIntent {
  preTax401k?: number;
  hsa?: number;
  efDelta?: number;
  debtDelta?: number;
  retirementExtraDelta?: number;
  brokerageDelta?: number;
}

/**
 * Convert a single-category intent + context into PlanChangesFromIntent (absolute for pre-tax, deltas for post-tax).
 * Returns null for reset or if intent does not produce plan changes.
 */
export function intentToPlanChanges(
  intent: SavingsAllocationIntent,
  context: SavingsAllocationIntentContext
): PlanChangesFromIntent | null {
  if (intent.kind === 'reset') return null;
  const result = intentToDelta(intent, context);
  if (!result) return null;

  const out: PlanChangesFromIntent = {};
  if (result.category === '401k') out.preTax401k = context.preTax401k$ + result.delta;
  else if (result.category === 'hsa') out.hsa = context.hsa$ + result.delta;
  else if (result.category === 'ef') out.efDelta = result.delta;
  else if (result.category === 'debt') out.debtDelta = result.delta;
  else if (result.category === 'retirementExtra') out.retirementExtraDelta = result.delta;
  else if (result.category === 'brokerage') out.brokerageDelta = result.delta;
  return out;
}
