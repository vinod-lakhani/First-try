'use client';

/**
 * WeLeap Leap Impact Tool
 * ─────────────────────────────────────────────────────────────────────────────
 * A guided, animated 3-step wizard that:
 *  1. Captures salary
 *  2. Captures 401(k) / match setup
 *  3. Reveals the user's single highest-impact "Leap" with:
 *     - 30-year wealth trajectory chart
 *     - Cost of delay breakdown
 *     - What the leap actually costs per paycheck
 *     - Full Leap Stack preview (blurred beyond step 2)
 *     - WeLeap signup CTA
 *
 * All math is inlined — no external API calls required.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowRight, TrendingUp, Clock, Zap, CheckCircle2,
  Lock, Sparkles, ChevronDown, ChevronUp, Info,
  DollarSign, AlertCircle,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const K401_CAP = 23_500;   // 2025 IRS employee 401(k) limit
const REAL_RETURN = 0.07;  // 7% annualised real return assumption
const MONTHS = 12;
const YEARS = 30;
const WELEAP_URL = 'https://www.weleap.ai/join?ref=leaptool';

// ─── Math Engine (self-contained) ────────────────────────────────────────────

function fvMonthly(monthly: number, rate: number, n: number): number {
  if (rate === 0) return monthly * n;
  return monthly * (Math.pow(1 + rate, n) - 1) / rate;
}

function runPath(
  salary: number,
  pct: number,
  matchCap: number,
  matchRate: number,
  hasMatch: boolean,
): number[] {
  const r = REAL_RETURN / MONTHS;
  const empAnnual = Math.min((salary * pct) / 100, K401_CAP);
  const empMonthly = empAnnual / MONTHS;
  const effPct = salary > 0 ? (empAnnual / salary) * 100 : 0;
  const matchMonthly = hasMatch
    ? (salary * Math.min((effPct * matchRate) / 100, matchCap) / 100) / MONTHS
    : 0;
  const total = empMonthly + matchMonthly;
  const path: number[] = [0];
  let prior = 0;
  for (let y = 1; y <= YEARS; y++) {
    prior = prior * Math.pow(1 + r, MONTHS) + fvMonthly(total, r, MONTHS);
    path.push(Math.round(prior));
  }
  return path;
}

interface LeapResult {
  type: 'capture_match' | 'increase' | 'at_cap';
  label: string;
  tagline: string;
  optimizedPct: number;
  baselinePath: number[];
  optimizedPath: number[];
  delta30yr: number;
  costOfDelay12mo: number;
  annualContribIncrease: number;
  perPaycheckCost: number; // biweekly paychecks
  monthlyTakeHome: number;
  takeHomeAfterLeap: number;
}

function calcLeap(
  salary: number,
  state: string,
  hasMatch: boolean,
  matchCap: number,
  matchRate: number,
  currentPct: number,
): LeapResult {
  // Determine recommended %
  const capPct = salary > 0 ? (K401_CAP / salary) * 100 : 15;
  let type: LeapResult['type'];
  let optimizedPct: number;
  let label: string;
  let tagline: string;

  if (hasMatch && currentPct < matchCap) {
    type = 'capture_match';
    optimizedPct = Math.min(matchCap, capPct);
    label = 'Capture your full employer match';
    tagline = `Move from ${currentPct}% → ${+optimizedPct.toFixed(1)}% and unlock free money your employer is already setting aside for you.`;
  } else if ((salary * currentPct / 100) >= K401_CAP || currentPct >= capPct) {
    type = 'at_cap';
    optimizedPct = currentPct;
    label = '401(k) is maxed';
    tagline = "You're already hitting the IRS limit — that's a big deal. Your next Leap is in the full plan.";
  } else {
    type = 'increase';
    optimizedPct = Math.min(capPct, 100);
    label = 'Max out your 401(k)';
    tagline = `Move from ${currentPct}% → ${+optimizedPct.toFixed(1)}% and compound the difference for 30 years.`;
  }

  const baselinePath = runPath(salary, currentPct, matchCap, matchRate, hasMatch);
  const optimizedPath = runPath(salary, optimizedPct, matchCap, matchRate, hasMatch);
  const baselineEnd = baselinePath[YEARS] ?? 0;
  const optimizedEnd = optimizedPath[YEARS] ?? 0;
  const delta30yr = optimizedEnd - baselineEnd;

  // Cost of delay: 12 months at baseline then switch vs optimized from day 1
  const r = REAL_RETURN / MONTHS;
  const empBaseAnnual = Math.min((salary * currentPct) / 100, K401_CAP);
  const empBase = empBaseAnnual / MONTHS;
  const basePctForMatch = salary > 0 ? (empBaseAnnual / salary) * 100 : 0;
  const matchBase = hasMatch
    ? (salary * Math.min((basePctForMatch * matchRate) / 100, matchCap) / 100) / MONTHS
    : 0;
  const totalBase = empBase + matchBase;
  const empOptAnnual = Math.min((salary * optimizedPct) / 100, K401_CAP);
  const empOpt = empOptAnnual / MONTHS;
  const optPctForMatch = salary > 0 ? (empOptAnnual / salary) * 100 : 0;
  const matchOpt = hasMatch
    ? (salary * Math.min((optPctForMatch * matchRate) / 100, matchCap) / 100) / MONTHS
    : 0;
  const totalOpt = empOpt + matchOpt;
  const nwDelay = fvMonthly(totalBase, r, 12);
  const remaining = YEARS * MONTHS - 12;
  const costOfDelay12mo = Math.max(
    0,
    Math.round(optimizedEnd - (nwDelay * Math.pow(1 + r, remaining) + fvMonthly(totalOpt, r, remaining))),
  );

  // Annual contribution increase (employee + match)
  const empCurAnnual = Math.min((salary * currentPct) / 100, K401_CAP);
  const empOptAnnual2 = Math.min((salary * optimizedPct) / 100, K401_CAP);
  const curPctForMatch = salary > 0 ? (empCurAnnual / salary) * 100 : 0;
  const optPctForMatch2 = salary > 0 ? (empOptAnnual2 / salary) * 100 : 0;
  const matchCurAnnual = hasMatch
    ? salary * Math.min((curPctForMatch * matchRate) / 100, matchCap) / 100 : 0;
  const matchOptAnnual = hasMatch
    ? salary * Math.min((optPctForMatch2 * matchRate) / 100, matchCap) / 100 : 0;
  const annualContribIncrease = Math.round((empOptAnnual2 - empCurAnnual) + (matchOptAnnual - matchCurAnnual));

  // Per paycheck (employee only, biweekly = 26 pay periods)
  const perPaycheckCost = Math.round((empOptAnnual2 - empCurAnnual) / 26);

  // Take-home (simplified tax estimation)
  const taxRate = estimateTaxRate(salary, state);
  const monthlyTakeHome = Math.round((salary * (1 - taxRate)) / 12);
  const takeHomeAfterLeap = Math.round(((salary - empOptAnnual2) * (1 - taxRate)) / 12);

  return {
    type,
    label,
    tagline,
    optimizedPct,
    baselinePath,
    optimizedPath,
    delta30yr,
    costOfDelay12mo,
    annualContribIncrease,
    perPaycheckCost,
    monthlyTakeHome,
    takeHomeAfterLeap,
  };
}

// ─── Tax Estimator ────────────────────────────────────────────────────────────

const STATE_TAX: Record<string, number> = {
  AK: 0, FL: 0, NV: 0, SD: 0, TN: 0, TX: 0, WA: 0, WY: 0,
  NH: 0.05, CO: 0.044, IL: 0.0495, IN: 0.0315, MI: 0.0425, UT: 0.045,
  AZ: 0.025, PA: 0.0307, GA: 0.055, NC: 0.0525, VA: 0.0575, OH: 0.040,
  MO: 0.048, KS: 0.055, AL: 0.050, AR: 0.049, IA: 0.060, KY: 0.045,
  LA: 0.0425, MS: 0.05, ND: 0.025, NE: 0.0664, NM: 0.059, OK: 0.0475,
  SC: 0.065, WV: 0.065, ID: 0.058, MT: 0.069, WI: 0.0765, MN: 0.0985,
  OR: 0.099, NJ: 0.0897, MD: 0.0575, CT: 0.0699, DE: 0.066, MA: 0.05,
  RI: 0.0599, VT: 0.0875, NY: 0.0685, CA: 0.093, HI: 0.110, ME: 0.0715,
  DC: 0.085,
};

function estimateTaxRate(salary: number, state: string): number {
  let fed = 0.10;
  if (salary > 200_000) fed = 0.28;
  else if (salary > 150_000) fed = 0.25;
  else if (salary > 100_000) fed = 0.22;
  else if (salary > 75_000) fed = 0.20;
  else if (salary > 50_000) fed = 0.18;
  else if (salary > 30_000) fed = 0.14;
  const st = STATE_TAX[state] ?? 0.05;
  const fica = Math.min(salary, 168_600) / salary * 0.0765;
  return fed + st + fica;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return '$' + Math.round(n / 1_000) + 'K';
  return fmt(n);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington D.C.' },
];

const MATCH_PRESETS = [
  { label: '100% match up to 3%', matchRate: 100, matchCap: 3 },
  { label: '100% match up to 4%', matchRate: 100, matchCap: 4 },
  { label: '100% match up to 5%', matchRate: 100, matchCap: 5 },
  { label: '100% match up to 6%', matchRate: 100, matchCap: 6 },
  { label: '50% match up to 6%', matchRate: 50, matchCap: 6 },
  { label: '50% match up to 8%', matchRate: 50, matchCap: 8 },
];

const CONTRIB_PRESETS = [0, 2, 3, 4, 5, 6, 8, 10, 12];

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ target, prefix = '$', duration = 1800 }: { target: number; prefix?: string; duration?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    function step(ts: number) {
      if (start.current === null) start.current = ts;
      const progress = Math.min((ts - start.current) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return (
    <span>
      {prefix}{displayed >= 1_000_000
        ? (displayed / 1_000_000).toFixed(1) + 'M'
        : displayed >= 1_000
        ? Math.round(displayed / 1_000) + 'K'
        : displayed.toLocaleString()}
    </span>
  );
}

// ─── Tooltip for chart ────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white shadow-lg border border-gray-100 p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">Year {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmtK(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Stack Preview ────────────────────────────────────────────────────────────

const STACK_STEPS = [
  {
    n: 1, icon: '🛡️', name: 'Emergency Fund',
    why: '1-month buffer first — your financial safety net before anything else.',
    status: 'ready',
  },
  {
    n: 2, icon: '🎯', name: 'Capture Employer Match',
    why: 'Free money. 100% instant return. This is always Leap #1 if you\'re not capturing it.',
    status: 'active',
  },
  {
    n: 3, icon: '💳', name: 'Pay Off High-APR Debt',
    why: 'Eliminating 15–25% interest is a guaranteed return you can\'t beat in the market.',
    status: 'locked',
  },
  {
    n: 4, icon: '📈', name: 'Retirement vs Brokerage Split',
    why: 'Based on your retirement focus, we optimize the split for tax efficiency.',
    status: 'locked',
  },
  {
    n: 5, icon: '🌱', name: 'Brokerage Investing',
    why: 'After the foundation is set, grow long-term wealth in taxable accounts.',
    status: 'locked',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

type Phase = 'hook' | 'salary' | 'setup' | 'reveal';

export default function LeapToolPage() {
  // ── Phase state ──
  const [phase, setPhase] = useState<Phase>('hook');
  const [animateReveal, setAnimateReveal] = useState(false);

  // ── Form state ──
  const [salary, setSalary] = useState('');
  const [state, setState] = useState('');
  const [hasMatch, setHasMatch] = useState<boolean | null>(null);
  const [matchPresetIdx, setMatchPresetIdx] = useState(0); // index into MATCH_PRESETS
  const [currentPct, setCurrentPct] = useState<number>(3);
  const [showChart, setShowChart] = useState(false);
  const [showDelay, setShowDelay] = useState(false);
  const [email, setEmail] = useState('');
  const [emailDone, setEmailDone] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // ── Derived ──
  const salaryNum = parseFloat(salary.replace(/,/g, '')) || 0;
  const matchPreset = MATCH_PRESETS[matchPresetIdx];
  const effectiveHasMatch = hasMatch === true;

  const leap: LeapResult | null =
    salaryNum > 0 && state && hasMatch !== null
      ? calcLeap(
          salaryNum, state, effectiveHasMatch,
          effectiveHasMatch ? matchPreset.matchCap : 5,
          effectiveHasMatch ? matchPreset.matchRate : 100,
          currentPct,
        )
      : null;

  const chartData = leap
    ? Array.from({ length: YEARS + 1 }, (_, y) => ({
        year: y,
        'Without Leap': Math.round((leap.baselinePath[y] ?? 0) / 1000),
        'With Your Leap': Math.round((leap.optimizedPath[y] ?? 0) / 1000),
      }))
    : [];

  // Animate reveal on enter
  useEffect(() => {
    if (phase === 'reveal') {
      const t = setTimeout(() => setAnimateReveal(true), 100);
      return () => clearTimeout(t);
    } else {
      setAnimateReveal(false);
    }
  }, [phase]);

  // ── Handlers ──
  const handleSalaryContinue = useCallback(() => {
    if (salaryNum < 10_000) return;
    setPhase('setup');
  }, [salaryNum]);

  const handleCalculate = useCallback(() => {
    if (!state || hasMatch === null) return;
    setPhase('reveal');
    setShowChart(false);
    setShowDelay(false);
  }, [state, hasMatch]);

  const handleSignup = useCallback(async () => {
    if (!email.includes('@')) { setEmailError('Please enter a valid email'); return; }
    setSignupLoading(true);
    setEmailError('');
    try {
      await fetch('https://www.weleap.ai/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'leap_tool',
          salaryAnnual: salaryNum,
          state,
          leapType: leap?.type,
          delta30yr: leap?.delta30yr,
        }),
      }).catch(() => {}); // Fail silently — redirect regardless
      setEmailDone(true);
      setTimeout(() => window.open(WELEAP_URL, '_blank'), 600);
    } finally {
      setSignupLoading(false);
    }
  }, [email, leap, salaryNum, state]);

  const handleSalaryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSalaryContinue();
  };

  // ── Salary formatting ──
  const formatSalaryDisplay = (raw: string) => {
    const n = parseFloat(raw.replace(/,/g, ''));
    if (!n) return raw;
    return Math.round(n).toLocaleString('en-US');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HOOK phase
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'hook') {
    return (
      <div className="min-h-screen bg-[#0f1f10] text-white flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-[#7fc27e] text-lg tracking-tight">WeLeap</span>
          <a
            href={WELEAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#7fc27e] border border-[#3F6B42] px-3 py-1.5 rounded-full hover:bg-[#3F6B42]/20 transition-colors"
          >
            Join waitlist
          </a>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          {/* Glow orb */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#3F6B42]/20 rounded-full blur-[120px]" />
          </div>

          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#3F6B42]/30 border border-[#3F6B42]/50 text-[#7fc27e] text-sm px-4 py-1.5 rounded-full mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Free · No sign-up required · Takes 60 seconds
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              What's your{' '}
              <span className="text-[#7fc27e]">#1 money move</span>{' '}
              right now?
            </h1>

            <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-10 max-w-xl mx-auto">
              Most people leave $150K–$400K on the table over their career.
              One small change — a Leap — can flip that. Find yours in 60 seconds.
            </p>

            <button
              onClick={() => setPhase('salary')}
              className="group inline-flex items-center gap-3 bg-[#3F6B42] hover:bg-[#4d8050] text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all duration-200 shadow-lg shadow-[#3F6B42]/30 hover:shadow-[#3F6B42]/50 hover:scale-105"
            >
              Find my #1 money move
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Social proof stats */}
            <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
              {[
                { value: '$247K', label: 'avg. 30-yr impact' },
                { value: '3 min', label: 'to your full plan' },
                { value: '1 Leap', label: 'changes everything' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-bold text-[#7fc27e]">{s.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* What is a Leap */}
        <section className="border-t border-white/10 px-6 py-12">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#7fc27e] mb-6 text-center">What is a Leap?</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: '🎯', title: 'Highest-impact first', body: "We don't overwhelm you with 20 tips. One move, the right one, right now." },
                { icon: '📈', title: 'Compounded over time', body: 'Even small changes compound massively. We show you the exact 30-year number.' },
                { icon: '🔓', title: 'Your full plan awaits', body: 'After your Leap, WeLeap builds your complete Savings Stack — step by step.' },
              ].map((c) => (
                <div key={c.title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="text-2xl mb-3">{c.icon}</div>
                  <div className="font-semibold text-white mb-1">{c.title}</div>
                  <div className="text-sm text-gray-400 leading-relaxed">{c.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SALARY phase
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'salary') {
    const taxRate = state ? estimateTaxRate(salaryNum, state) : null;
    const monthlyTakeHome = salaryNum > 0 && taxRate !== null
      ? Math.round((salaryNum * (1 - taxRate)) / 12) : null;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-[#3F6B42] text-lg">WeLeap</span>
          <StepPill current={1} total={3} />
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                What's your annual salary?
              </h2>
              <p className="text-gray-500">
                This lets us calculate your take-home pay and find your biggest Leap.
              </p>
            </div>

            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={salary ? formatSalaryDisplay(salary) : ''}
                onChange={(e) => setSalary(e.target.value.replace(/,/g, ''))}
                onKeyDown={handleSalaryKeyDown}
                placeholder="85,000"
                autoFocus
                className="w-full pl-8 pr-4 py-4 text-2xl font-semibold border-2 border-gray-200 rounded-2xl focus:border-[#3F6B42] focus:outline-none bg-white transition-colors"
              />
            </div>

            {/* Live take-home preview */}
            {monthlyTakeHome && (
              <div className="bg-[#3F6B42]/5 border border-[#3F6B42]/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-[#3F6B42] mt-0.5 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-[#3F6B42]">
                    ≈ {fmt(monthlyTakeHome)}/mo take-home
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    (after ~{Math.round((taxRate ?? 0) * 100)}% tax in {state})
                  </span>
                </div>
              </div>
            )}

            {/* State selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3F6B42] focus:outline-none bg-white text-gray-900"
              >
                <option value="">Select your state</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSalaryContinue}
              disabled={salaryNum < 10_000 || !state}
              className="w-full flex items-center justify-center gap-2 bg-[#3F6B42] hover:bg-[#4d8050] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-lg py-4 rounded-2xl transition-all duration-200"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              We use this only to calculate your Leap. Nothing is stored.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP phase
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <button onClick={() => setPhase('salary')} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <StepPill current={2} total={3} />
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Your 401(k) setup</h2>
              <p className="text-gray-500">Two quick questions — this is where the biggest Leaps hide.</p>
            </div>

            {/* Employer match */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-[#3F6B42]/10 text-[#3F6B42] rounded-lg p-2">🎯</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Does your employer offer a 401(k) match?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">This is literally free money — the #1 missed Leap.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: true, label: '✅ Yes, they do' },
                  { val: false, label: '❌ No / Not sure' },
                ].map(({ val, label }) => (
                  <button
                    key={String(val)}
                    onClick={() => setHasMatch(val)}
                    className={`py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      hasMatch === val
                        ? 'border-[#3F6B42] bg-[#3F6B42]/10 text-[#3F6B42]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Match preset selector */}
              {hasMatch === true && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">What's their match?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MATCH_PRESETS.map((p, i) => (
                      <button
                        key={p.label}
                        onClick={() => setMatchPresetIdx(i)}
                        className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                          matchPresetIdx === i
                            ? 'border-[#3F6B42] bg-[#3F6B42]/10 text-[#3F6B42]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                    <p className="text-xs text-amber-700">
                      <strong>💡 That's a {matchPreset.matchRate}% match up to {matchPreset.matchCap}% of your salary.</strong>{' '}
                      On a {fmt(salaryNum)} salary, that's up to {fmt(salaryNum * matchPreset.matchCap / 100 * matchPreset.matchRate / 100)} free per year.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Current contribution */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-[#3F6B42]/10 text-[#3F6B42] rounded-lg p-2">📊</div>
                <div>
                  <h3 className="font-semibold text-gray-900">What % are you contributing now?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Your current 401(k) % from each paycheck.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {CONTRIB_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPct(p)}
                    className={`py-2 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                      currentPct === p
                        ? 'border-[#3F6B42] bg-[#3F6B42] text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p === 12 ? '12%+' : `${p}%`}
                  </button>
                ))}
              </div>
              {salaryNum > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  {currentPct}% = {fmt(Math.min(salaryNum * currentPct / 100, K401_CAP))}/yr from your paycheck
                  {currentPct > 0 && ` (${fmt(Math.min(salaryNum * currentPct / 100, K401_CAP) / 26)}/paycheck)`}
                </p>
              )}
            </div>

            <button
              onClick={handleCalculate}
              disabled={hasMatch === null || !state}
              className="w-full flex items-center justify-center gap-2 bg-[#3F6B42] hover:bg-[#4d8050] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-lg py-4 rounded-2xl transition-all duration-200 shadow-md shadow-[#3F6B42]/20"
            >
              <Zap className="w-5 h-5" />
              Calculate my Leap
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REVEAL phase
  // ─────────────────────────────────────────────────────────────────────────

  if (!leap) return null;

  const isAtCap = leap.type === 'at_cap';
  const isCapturMatch = leap.type === 'capture_match';
  const monthlyImpact = Math.round(leap.annualContribIncrease / 12);
  const takeHomeDelta = leap.takeHomeAfterLeap - leap.monthlyTakeHome;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dark reveal header */}
      <div className="bg-[#0f1f10] text-white px-6 pt-8 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#3F6B42]/20 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => setPhase('setup')} className="text-sm text-gray-400 hover:text-white transition-colors">
              ← Recalculate
            </button>
            <span className="font-bold text-[#7fc27e]">WeLeap</span>
          </div>

          {isAtCap ? (
            // Already maxed
            <div className={`transition-all duration-700 ${animateReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="text-5xl mb-4">🏆</div>
              <h1 className="text-3xl font-bold mb-3">Your 401(k) is maxed out</h1>
              <p className="text-gray-300 text-lg leading-relaxed">
                You're already hitting the {fmt(K401_CAP)} IRS limit — that puts you ahead of 95% of people your age.
                Your next Leap is in your full plan.
              </p>
            </div>
          ) : (
            // Has a leap
            <div className={`transition-all duration-700 ${animateReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="inline-flex items-center gap-2 text-[#7fc27e] text-sm bg-[#3F6B42]/30 px-3 py-1.5 rounded-full mb-4">
                <TrendingUp className="w-3.5 h-3.5" />
                Your #1 money move
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                {leap.label}
              </h1>
              <p className="text-gray-300 text-lg mb-8 leading-relaxed">{leap.tagline}</p>

              {/* Big delta number */}
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
                <p className="text-sm text-gray-400 mb-1 uppercase tracking-wide">30-year wealth difference</p>
                <div className="text-5xl md:text-6xl font-bold text-[#7fc27e]">
                  {animateReveal && <AnimatedNumber target={leap.delta30yr} />}
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  That's the gap between your current path and your Leap path — compounded at 7% real return.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cards section */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* ── Card 1: What it actually costs per paycheck ── */}
        {!isAtCap && (
          <div className={`bg-white rounded-2xl border border-gray-200 p-6 shadow-sm transition-all duration-700 delay-200 ${animateReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
              <span className="bg-[#3F6B42]/10 text-[#3F6B42] w-8 h-8 rounded-lg flex items-center justify-center text-sm">💰</span>
              What this Leap costs you
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-600 text-sm">Increase per paycheck (employee only)</span>
                <span className="font-semibold text-gray-900">{fmt(leap.perPaycheckCost)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-600 text-sm">Annual employee contribution increase</span>
                <span className="font-semibold text-gray-900">{fmt(Math.min(salaryNum * leap.optimizedPct / 100, K401_CAP) - Math.min(salaryNum * currentPct / 100, K401_CAP))}</span>
              </div>
              {effectiveHasMatch && (
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-600 text-sm">Employer match unlocked (free)</span>
                  <span className="font-semibold text-[#3F6B42]">+{fmt(leap.annualContribIncrease - (Math.min(salaryNum * leap.optimizedPct / 100, K401_CAP) - Math.min(salaryNum * currentPct / 100, K401_CAP)))}/yr</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 text-sm font-medium">Total new annual investment</span>
                <span className="font-bold text-gray-900">{fmt(leap.annualContribIncrease)}</span>
              </div>
            </div>
            {/* Tax advantage note */}
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>💡 Tax advantage:</strong> 401(k) contributions are pre-tax. Your paycheck only drops by ~{fmt(leap.perPaycheckCost * (1 - estimateTaxRate(salaryNum, state)))} after tax savings — not the full {fmt(leap.perPaycheckCost)}.
              </p>
            </div>
          </div>
        )}

        {/* ── Card 2: 30-Year Chart ── */}
        {!isAtCap && (
          <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700 delay-300 ${animateReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={() => setShowChart(!showChart)}
              className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="bg-[#3F6B42]/10 text-[#3F6B42] w-8 h-8 rounded-lg flex items-center justify-center">📈</span>
                <div className="text-left">
                  <div className="font-bold text-gray-900">30-year wealth trajectory</div>
                  <div className="text-sm text-gray-500">
                    {fmtK(leap.baselinePath[YEARS] ?? 0)} → {fmtK(leap.optimizedPath[YEARS] ?? 0)} at retirement
                  </div>
                </div>
              </div>
              {showChart ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {showChart && (
              <div className="px-6 pb-6">
                <div className="flex gap-4 text-xs mb-4">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#94A3B8]" />Current path</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#3F6B42]" />With your Leap</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradBaseline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradLeap" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3F6B42" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3F6B42" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="year"
                      tickFormatter={(v) => `Yr ${v}`}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${v}K`}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Without Leap"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      fill="url(#gradBaseline)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="With Your Leap"
                      stroke="#3F6B42"
                      strokeWidth={2.5}
                      fill="url(#gradLeap)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Based on 7% real annual return · {fmt(K401_CAP)} IRS limit · employee + employer contributions
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Card 3: Cost of Delay ── */}
        {!isAtCap && leap.costOfDelay12mo > 0 && (
          <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700 delay-[400ms] ${animateReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={() => setShowDelay(!showDelay)}
              className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="bg-orange-50 w-8 h-8 rounded-lg flex items-center justify-center">⏰</span>
                <div className="text-left">
                  <div className="font-bold text-gray-900">Cost of waiting 12 months</div>
                  <div className="text-sm text-orange-600 font-semibold">{fmtK(leap.costOfDelay12mo)} left on the table</div>
                </div>
              </div>
              {showDelay ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {showDelay && (
              <div className="px-6 pb-6 border-t border-gray-50">
                <div className="grid grid-cols-3 gap-4 py-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{fmt(Math.round(leap.costOfDelay12mo / 12))}</div>
                    <div className="text-xs text-gray-500 mt-1">per month delayed</div>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{fmt(Math.round(leap.costOfDelay12mo / 52))}</div>
                    <div className="text-xs text-gray-500 mt-1">per week delayed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">{fmtK(leap.costOfDelay12mo)}</div>
                    <div className="text-xs text-gray-500 mt-1">total over 30 yrs</div>
                  </div>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  This is how much less you'll have at year 30 if you wait 12 months before making this Leap, compared to starting today. Compound interest doesn't wait.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Card 4: Your Full Leap Stack ── */}
        <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700 delay-500 ${animateReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="p-6 pb-4">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-1">
              <span className="bg-[#3F6B42]/10 w-8 h-8 rounded-lg flex items-center justify-center text-sm">🗺️</span>
              Your full Leap Stack
            </h3>
            <p className="text-sm text-gray-500">The right order for every dollar beyond your Leap.</p>
          </div>

          <div className="px-6 pb-6 space-y-2">
            {STACK_STEPS.map((step, i) => {
              // Determine display status based on user's situation
              const isCurrent = step.n === 2 && !isAtCap;
              const isCompleted = (step.n === 2 && isAtCap) || (step.n === 1);
              const isLocked = step.status === 'locked';

              return (
                <div
                  key={step.n}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-[#3F6B42]/8 border border-[#3F6B42]/20'
                      : isCompleted
                      ? 'bg-gray-50 border border-gray-100'
                      : 'bg-gray-50/50 border border-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${
                    isLocked ? 'grayscale opacity-40' : ''
                  }`}>
                    {isCompleted ? '✅' : step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${isLocked ? 'text-gray-400' : 'text-gray-800'}`}>
                        {step.name}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-[#3F6B42] text-white px-2 py-0.5 rounded-full">Your Leap</span>
                      )}
                      {isLocked && (
                        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />Unlock in full plan
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 leading-relaxed ${isLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                      {step.why}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Locked overlay teaser */}
          <div className="mx-6 mb-6 bg-gradient-to-r from-[#3F6B42]/5 to-[#3F6B42]/10 border border-[#3F6B42]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#3F6B42]" />
              <span className="text-sm font-semibold text-[#3F6B42]">WeLeap builds your full plan</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Debt payoff priority, HSA optimization, brokerage split — all calculated for your situation. Join the waitlist to unlock it.
            </p>
          </div>
        </div>

        {/* ── Card 5: CTA ── */}
        <div className={`bg-[#0f1f10] text-white rounded-2xl overflow-hidden transition-all duration-700 delay-[600ms] ${animateReveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="relative p-6 md:p-8">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-8 -right-8 w-48 h-48 bg-[#3F6B42]/20 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="text-2xl font-bold mb-2">
                Ready to build your<br />complete financial plan?
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-6">
                WeLeap turns your Leap into a full, step-by-step Savings Stack — debt, retirement, investing — all prioritized for your situation.
                {!isAtCap && leap.delta30yr > 0 && (
                  <> Your Leap alone adds <strong className="text-[#7fc27e]">{fmtK(leap.delta30yr)}</strong> over 30 years. Imagine what the full plan does.</>
                )}
              </p>

              {emailDone ? (
                <div className="flex items-center gap-2 text-[#7fc27e] font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  You're on the list — redirecting to WeLeap...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                      placeholder="your@email.com"
                      className="flex-1 bg-white/10 border border-white/20 text-white placeholder-gray-400 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[#7fc27e] transition-colors"
                    />
                    <button
                      onClick={handleSignup}
                      disabled={signupLoading}
                      className="bg-[#3F6B42] hover:bg-[#4d8050] text-white font-semibold px-5 py-3 rounded-xl transition-colors whitespace-nowrap flex items-center gap-2"
                    >
                      {signupLoading ? 'Joining...' : <>Join waitlist <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                  {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
                  <p className="text-xs text-gray-500">No spam. We'll reach out when your spot opens.</p>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-[#7fc27e]" />Full Leap Stack built for you</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-[#7fc27e]" />Debt payoff priority</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-[#7fc27e]" />HSA & brokerage guidance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Assumptions */}
        <div className="text-center py-4">
          <details className="text-xs text-gray-400 inline-block text-left max-w-sm">
            <summary className="cursor-pointer hover:text-gray-600 flex items-center gap-1 justify-center">
              <Info className="w-3 h-3" />
              Methodology & assumptions
            </summary>
            <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 space-y-1.5 text-left">
              <p>• 7% real annual return (nominal ~9.5% minus ~2.5% inflation)</p>
              <p>• {fmt(K401_CAP)} 2025 IRS employee 401(k) contribution limit</p>
              <p>• Employer match computed as min(contrib%, match cap%) × match rate</p>
              <p>• Tax estimate: simplified federal bracket + state flat rate + FICA 7.65%</p>
              <p>• 30-year projection, monthly compounding, no investment fees modelled</p>
              <p>• This is educational, not financial advice.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

// ─── Step Pill ────────────────────────────────────────────────────────────────

function StepPill({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i + 1 === current ? 'w-6 bg-[#3F6B42]' : i + 1 < current ? 'w-2 bg-[#3F6B42]/50' : 'w-2 bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}
