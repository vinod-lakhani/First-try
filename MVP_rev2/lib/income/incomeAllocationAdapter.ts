/**
 * Income Allocation Adapter
 *
 * Produces a single structured snapshot (past3m, current, recommended, proposed)
 * and draft proposals from user intents (SAVE_MORE, MORE_SPENDING, CUSTOM).
 * Shift limit V1: maxWantsShiftMonthly = min(300, 0.10 * netIncomeMonthly).
 * Needs is NOT auto-adjusted unless user explicitly requests.
 */

export type IncomeAllocationSnapshot = {
  past3m: {
    needsMonthly: number;
    wantsMonthly: number;
    cashMonthly: number;
    netIncomeMonthly: number;
  };
  current: {
    needsMonthly: number;
    wantsMonthly: number;
    cashMonthly: number;
    netIncomeMonthly: number;
    allInSavingsMonthly: number;
    cashSavingsMonthly: number;
    payrollSavingsMonthlyEstimated: number;
    employerMatchMonthlyEstimated: number;
  };
  recommended: {
    needsMonthly: number;
    wantsMonthly: number;
    cashMonthly: number;
    allInSavingsMonthly: number;
    targets?: {
      needsPctGuide?: number;
      wantsPctGuide?: number;
      allInSavingsPctTarget?: number;
    };
    reasonCodes: string[];
  };
  proposed: {
    needsMonthly: number;
    wantsMonthly: number;
    cashMonthly: number;
    allInSavingsMonthly: number;
    deltas: {
      needsMonthly: number;
      wantsMonthly: number;
      cashMonthly: number;
      allInSavingsMonthly: number;
    };
    shiftLimit: {
      maxWantsShiftMonthly: number;
      appliedWantsShiftMonthly: number;
    };
    narrative: {
      headline: string;
      bullets: Array<{ key: string; text: string }>;
    };
    reasonCodes: string[];
  } | null;
};

export type ProposalIntent = 'SAVE_MORE' | 'MORE_SPENDING' | 'TIGHTEN_PLAN' | 'CUSTOM';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Shift limit V1: Wants is the primary lever.
 * maxWantsShiftMonthly = min(300, 0.10 * netIncomeMonthly)
 */
export function getShiftLimit(netIncomeMonthly: number): {
  maxWantsShiftMonthly: number;
} {
  const tenPct = round2(0.1 * netIncomeMonthly);
  const maxWantsShiftMonthly = Math.min(300, tenPct);
  return { maxWantsShiftMonthly };
}

export interface BuildSnapshotInputs {
  past3m: {
    needsMonthly: number;
    wantsMonthly: number;
    cashMonthly: number;
    netIncomeMonthly: number;
  };
  current: {
    needsMonthly: number;
    wantsMonthly: number;
    cashMonthly: number;
    netIncomeMonthly: number;
    allInSavingsMonthly: number;
    cashSavingsMonthly: number;
    payrollSavingsMonthlyEstimated: number;
    employerMatchMonthlyEstimated: number;
  };
  recommended: {
    needsMonthly: number;
    wantsMonthly: number;
    cashMonthly: number;
    allInSavingsMonthly: number;
    targets?: {
      needsPctGuide?: number;
      wantsPctGuide?: number;
      allInSavingsPctTarget?: number;
    };
    reasonCodes: string[];
  };
  proposed?: IncomeAllocationSnapshot['proposed'];
}

/**
 * Build a full IncomeAllocationSnapshot. Use this after computing past3m, current, recommended
 * from your data layer; optionally set proposed via draftProposalFromIntent.
 */
export function buildIncomeAllocationSnapshot(inputs: BuildSnapshotInputs): IncomeAllocationSnapshot {
  return {
    past3m: { ...inputs.past3m },
    current: { ...inputs.current },
    recommended: { ...inputs.recommended },
    proposed: inputs.proposed ?? null,
  };
}

/**
 * Draft a proposed plan from user intent. Applies shift limit; does not change Needs unless CUSTOM with needs delta.
 * - SAVE_MORE / TIGHTEN_PLAN: decrease wants by up to shiftLimit, increase cash (savings).
 * - MORE_SPENDING: increase wants by up to shiftLimit, decrease cash; may warn if cash goes below floor.
 * - CUSTOM: optional wantsDelta (positive = more spending, negative = more savings); needs unchanged unless passed.
 */
export function draftProposalFromIntent(
  snapshot: IncomeAllocationSnapshot,
  intent: ProposalIntent,
  options?: { wantsDelta?: number; needsDelta?: number }
): IncomeAllocationSnapshot['proposed'] {
  const { current, recommended } = snapshot;
  const netIncomeMonthly = current.netIncomeMonthly;
  const { maxWantsShiftMonthly } = getShiftLimit(netIncomeMonthly);

  let appliedWantsShiftMonthly: number;
  let headline: string;
  const bullets: Array<{ key: string; text: string }> = [];
  const reasonCodes: string[] = [];

  // appliedWantsShiftMonthly: magnitude of $/mo move. Sign: positive = more wants (MORE_SPENDING), negative = more savings (SAVE_MORE).
  let wantsDeltaSigned: number;

  if (intent === 'MORE_SPENDING') {
    const shift = Math.min(maxWantsShiftMonthly, Math.max(0, current.cashMonthly));
    if (shift <= 0) return null;
    wantsDeltaSigned = shift;
    appliedWantsShiftMonthly = shift;
    headline = 'Add more spending money this month';
    bullets.push({
      key: 'past3m_wants',
      text: `Past 3 months wants avg was $${Math.round(snapshot.past3m.wantsMonthly).toLocaleString()} — current is $${Math.round(current.wantsMonthly).toLocaleString()}.`,
    });
    bullets.push({
      key: 'step',
      text: `This step frees $${Math.round(shift).toLocaleString()} for wants; cash savings drops by the same amount.`,
    });
    bullets.push({
      key: 'limit',
      text: `Step limit: we're moving $${Math.round(shift).toLocaleString()} this month to keep it realistic.`,
    });
    reasonCodes.push('MORE_SPENDING');
  } else if (intent === 'SAVE_MORE' || intent === 'TIGHTEN_PLAN') {
    const wantsFloor = (recommended.targets?.wantsPctGuide ?? 0.25) * netIncomeMonthly;
    const roomFromWants = Math.max(0, current.wantsMonthly - wantsFloor);
    const shift = Math.min(maxWantsShiftMonthly, roomFromWants);
    if (shift <= 0) return null;
    wantsDeltaSigned = -shift;
    appliedWantsShiftMonthly = shift;
    headline = 'Save more this month';
    bullets.push({
      key: 'past3m_wants',
      text: `Past 3 months wants avg was $${Math.round(snapshot.past3m.wantsMonthly).toLocaleString()} — current is $${Math.round(current.wantsMonthly).toLocaleString()}.`,
    });
    bullets.push({
      key: 'step',
      text: `This step saves $${Math.round(shift).toLocaleString()} more in cash this month.`,
    });
    bullets.push({
      key: 'limit',
      text: `Step limit: we're moving $${Math.round(shift).toLocaleString()} this month to keep it realistic.`,
    });
    reasonCodes.push('SAVE_MORE');
  } else if (intent === 'CUSTOM' && options?.wantsDelta != null) {
    const rawShift = options.wantsDelta;
    const magnitude = Math.min(maxWantsShiftMonthly, Math.abs(rawShift));
    if (rawShift > 0) {
      const cap = Math.max(0, current.cashMonthly);
      wantsDeltaSigned = Math.min(magnitude, cap);
    } else {
      const cap = Math.max(0, current.wantsMonthly);
      wantsDeltaSigned = -Math.min(magnitude, cap);
    }
    if (Math.abs(wantsDeltaSigned) <= 0) return null;
    appliedWantsShiftMonthly = Math.abs(wantsDeltaSigned);
    headline = wantsDeltaSigned > 0 ? 'Add more spending money' : 'Save more this month';
    bullets.push({
      key: 'step',
      text: `Change: $${Math.round(appliedWantsShiftMonthly).toLocaleString()}/mo ${wantsDeltaSigned > 0 ? 'to wants' : 'to cash savings'}.`,
    });
    bullets.push({
      key: 'limit',
      text: `Step limit applied: max $${Math.round(maxWantsShiftMonthly).toLocaleString()}/mo move.`,
    });
    reasonCodes.push('CUSTOM');
  } else {
    return null;
  }

  const needsMonthly = options?.needsDelta != null ? round2(current.needsMonthly + options.needsDelta) : current.needsMonthly;
  const wantsMonthly = round2(current.wantsMonthly + wantsDeltaSigned);
  const cashMonthly = round2(netIncomeMonthly - needsMonthly - wantsMonthly);
  const allInSavingsMonthly = round2(cashMonthly + current.payrollSavingsMonthlyEstimated + current.employerMatchMonthlyEstimated);

  const deltas = {
    needsMonthly: round2(needsMonthly - current.needsMonthly),
    wantsMonthly: round2(wantsMonthly - current.wantsMonthly),
    cashMonthly: round2(cashMonthly - current.cashMonthly),
    allInSavingsMonthly: round2(allInSavingsMonthly - current.allInSavingsMonthly),
  };

  return {
    needsMonthly,
    wantsMonthly,
    cashMonthly,
    allInSavingsMonthly,
    deltas,
    shiftLimit: {
      maxWantsShiftMonthly,
      appliedWantsShiftMonthly,
    },
    narrative: { headline, bullets },
    reasonCodes,
  };
}
