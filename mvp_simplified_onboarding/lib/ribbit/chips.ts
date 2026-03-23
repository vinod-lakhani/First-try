/**
 * Ribbit chips by screen — prompt sent to LLM, expected response shape
 * Screen roles: Home = Direction, Monthly Pulse = Correction, Net Worth = Motivation
 */

export type ChipDef = {
  label: string;
  prompt: string;
  expectedResponse: string;
};

/** Home screen (plan 100% complete) — Direction: "What should I do now" */
export const HOME_CHIPS: ChipDef[] = [
  {
    label: "What should I do next?",
    prompt: "Given my current plan and financial position what is the single highest impact action I should take right now",
    expectedResponse: "One clear action only, tied to biggest gap or opportunity, quantified if possible. E.g. Increase savings by $250 or redirect X to capture employer match",
  },
  {
    label: "Am I on track?",
    prompt: "Based on my current behavior and plan am I on track to hit my targets",
    expectedResponse: "Yes / No / Slightly off. One reason why. E.g. You're slightly behind due to lower savings rate last month",
  },
  {
    label: "What matters most right now?",
    prompt: "Out of everything in my financial plan what is the most important thing I should focus on right now",
    expectedResponse: "Prioritization, filters noise. E.g. Stabilizing your savings rate matters more than investing right now",
  },
  {
    label: "Can I optimize this further?",
    prompt: "If I wanted to improve my trajectory what is the most efficient change I could make",
    expectedResponse: "One optimization lever. E.g. Increasing savings by 3% moves your timeline forward by ~2 years",
  },
];

/** Monthly Pulse — Correction: "What did I do and fix" */
export const MONTHLY_PULSE_CHIPS: ChipDef[] = [
  {
    label: "What changed this month?",
    prompt: "What are the biggest changes between my target and actuals this month",
    expectedResponse: "1–2 key deltas. E.g. Spending is up $180 mainly from dining",
  },
  {
    label: "Where am I off track?",
    prompt: "Where am I deviating the most from my plan and how significant is it",
    expectedResponse: "Largest gap, quantified. E.g. Savings is 6% below target or $220 short",
  },
  {
    label: "What should I adjust?",
    prompt: "What is the single most effective adjustment I can make based on this month",
    expectedResponse: "One behavior change. E.g. Reduce dining by $75 to get back on track",
  },
  {
    label: "Is this a one-off or a pattern?",
    prompt: "Is this behavior consistent with my past months or a one time change",
    expectedResponse: "Pattern vs anomaly. E.g. This is the third month of elevated spending",
  },
];

/** Net Worth chart — Motivation: "Is this working" */
export const NET_WORTH_CHIPS: ChipDef[] = [
  {
    label: "What's driving this change?",
    prompt: "What are the main factors driving the change in my net worth over this period",
    expectedResponse: "Income vs savings vs market. E.g. Growth driven mostly by increased savings not market returns",
  },
  {
    label: "Am I moving fast enough?",
    prompt: "Based on my current trajectory am I progressing at a strong pace toward my goals",
    expectedResponse: "Directional judgment. E.g. Progress is steady but could accelerate with higher savings",
  },
  {
    label: "What would accelerate this?",
    prompt: "What is the most effective way to increase my net worth growth rate",
    expectedResponse: "Single lever. E.g. savings / debt / income",
  },
  {
    label: "What's holding me back?",
    prompt: "What is the biggest constraint slowing my net worth growth",
    expectedResponse: "Bottleneck. E.g. High discretionary spending limiting savings rate",
  },
  {
    label: "Is this sustainable?",
    prompt: "Is my current net worth growth trend sustainable based on my behavior",
    expectedResponse: "Stability vs volatility, grounded answer",
  },
];

/** For RibbitChat: { label, question } — question is the prompt sent to API */
export function toRibbitChips(chips: ChipDef[]): { label: string; question: string }[] {
  return chips.map((c) => ({ label: c.label, question: c.prompt }));
}
