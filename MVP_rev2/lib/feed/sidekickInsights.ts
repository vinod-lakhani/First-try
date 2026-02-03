/**
 * Sidekick Insights — Core topics and narratives (Financial Sidekick framework).
 * Short, confidence-building explanations that support Leaps. Each topic has:
 * - What this is (plain language)
 * - Why it matters now (contextual)
 * - How WeLeap uses it (action connection)
 */

export interface SidekickInsightTopic {
  id: string;
  title: string;
  whatThisIs: string;
  whyItMatters: string;
  howWeLeapUsesIt: string;
}

export const SIDEKICK_INSIGHTS: SidekickInsightTopic[] = [
  {
    id: 'savings-order',
    title: 'Why your savings has an order — and why it matters',
    whatThisIs:
      "Saving isn't one bucket — it's a stack, and the order matters. Your Sidekick prioritizes savings in this order: 1) Emergency Fund (safety) 2) High-interest debt payoff (stop the leak) 3) Retirement (long-term growth) 4) Brokerage / flexible investing (optional growth).",
    whyItMatters:
      "Putting money in the wrong place can slow you down or even put you at risk. For example, investing before you have a safety buffer can force you to pull money out later — often at the worst time.",
    howWeLeapUsesIt:
      "When you save money, your Sidekick automatically routes it to the highest-impact layer of the stack based on where you are today.",
  },
  {
    id: 'emergency-fund-freedom',
    title: "Why an emergency fund gives you freedom, not fear",
    whatThisIs:
      "An emergency fund isn't about fear — it's about freedom. It's money set aside so unexpected expenses (job changes, medical bills, car repairs) don't turn into debt or panic.",
    whyItMatters:
      "Without a buffer, even small surprises can knock your entire plan off track. With one, you can absorb shocks without changing your lifestyle or going into debt.",
    howWeLeapUsesIt:
      "Your Sidekick tracks how protected you are (in months of coverage) and recommends small, realistic Leaps to reach safety faster — without over-tightening your budget.",
  },
  {
    id: 'paycheck-allocation',
    title: 'How your Sidekick decides where your next paycheck should go',
    whatThisIs:
      "Your paycheck isn't static — it should adapt as your life changes. Your Sidekick looks at: your take-home pay, fixed costs (rent, utilities, debt minimums), variable spending patterns, and savings progress.",
    whyItMatters:
      "A “perfect” budget on paper can fail in real life. The goal isn't perfection — it's staying aligned while life shifts.",
    howWeLeapUsesIt:
      "When something changes (income, spending, bills), your Sidekick suggests a small allocation shift that keeps you moving forward — and shows exactly what it improves.",
  },
  {
    id: 'retirement-early',
    title: 'Why starting retirement savings early beats saving more later',
    whatThisIs:
      "Time is your biggest advantage — not income. Money invested earlier has more time to grow, even if the amounts feel small.",
    whyItMatters:
      "Waiting a few years to start can mean needing to save much more later to reach the same outcome.",
    howWeLeapUsesIt:
      "Your Sidekick focuses first on capturing employer matches and then suggests retirement Leaps only when your foundation (cash flow + emergency fund) can support it.",
  },
  {
    id: 'needs-vs-wants',
    title: 'How Needs vs Wants helps you improve — without cutting joy',
    whatThisIs:
      "Needs vs Wants isn't about cutting joy — it's about clarity. Needs keep your life running. Wants make life enjoyable. Both matter.",
    whyItMatters:
      "When everything feels like a need, it becomes impossible to prioritize or improve your plan.",
    howWeLeapUsesIt:
      "Your Sidekick uses this distinction to recommend flexible adjustments — shifting small amounts from Wants only when it meaningfully improves your future.",
  },
  {
    id: 'small-moves',
    title: 'How small money moves today quietly change your future',
    whatThisIs:
      "Big change doesn't come from big moves — it comes from consistent small ones. A $25 or $50 shift today can quietly turn into thousands over time.",
    whyItMatters:
      "Large changes feel risky and often get postponed. Small Leaps feel safe — and they actually stick.",
    howWeLeapUsesIt:
      "Every Leap shows its projected impact so you can see how today's action improves tomorrow's outcome — without overwhelming you.",
  },
  {
    id: '401k-match',
    title: 'How your 401(k) and employer match turn into free money',
    whatThisIs:
      "A 401(k) is money you save for retirement directly from your paycheck — before you ever see it. An employer match is extra money your company adds when you contribute. It's essentially a guaranteed return.",
    whyItMatters:
      "Not contributing enough to get the full match is leaving free money on the table. Choosing between Traditional and Roth affects when you pay taxes — now or later — which can significantly change your long-term outcome.",
    howWeLeapUsesIt:
      "Your Sidekick prioritizes capturing the full employer match first, then helps decide whether Traditional or Roth makes more sense based on your income, taxes, and cash flow.",
  },
  {
    id: 'hsa',
    title: "Why an HSA might be the most underrated savings account you have",
    whatThisIs:
      "A Health Savings Account (HSA) is a special savings account for healthcare expenses — but it's also one of the most tax-efficient accounts available. Money going in is tax-free, it can grow tax-free, and withdrawals for qualified medical expenses are also tax-free.",
    whyItMatters:
      "Healthcare costs are almost guaranteed later in life. An HSA lets you prepare for them while getting tax benefits today.",
    howWeLeapUsesIt:
      "If you're eligible, your Sidekick treats HSA contributions as a high-impact savings layer — often recommending them alongside or even before additional retirement savings, when cash flow allows.",
  },
];
