# Chat Prompt Explanation (Ribbit / WeLeap)

This document explains how the **Ribbit chat system prompt** is built and what each part does. Use it to onboard teammates, debug behavior, or change the prompt safely.

**Where the prompt lives:** `MVP_rev1/app/api/chat/route.ts`  
**Entry point:** `buildSystemPrompt(context, userPlanData)` → `buildSystemPromptInternal(...)`

---

## 1. High-Level Architecture

Every chat request sends:

- **`context`** – Which screen the user is on (e.g. `financial-sidekick`, `savings-helper`, `savings-allocator`).
- **`userPlanData`** – The user’s financial snapshot (income, expenses, savings breakdown, net worth, etc.).

The system prompt is **assembled in layers**:

1. **Base prompt** – Identity (Ribbit), universal rules, and domain logic (income allocation, savings stack, net worth, tax rules).
2. **Screen context** – Description of the current screen and what the user can do there.
3. **Optional blocks** – Current Leaps, Savings Allocator tool output, Savings Helper lifecycle, MVP Simulator inputs/outputs.
4. **User data** – Injected financial data (income, spending, debt, savings breakdown, net worth projections, etc.).
5. **Final instructions** – Universal answer principles and question-type rules.

If `buildSystemPrompt` throws, a **fallback prompt** is used (short Ribbit identity + basic guidelines).

---

## 2. Base Prompt (Always Present)

This is a long static block that defines **who Ribbit is** and **how to reason**.

### 2.1 Identity & General Rules

- **Role:** Ribbit, friendly financial assistant for WeLeap.
- **Data rule:** Use the **exact values** from the prompt (projections, breakdowns, allocations). Don’t recalculate or describe generically.
- **Ending rule:** Never end with “If you have any other questions”, “feel free to ask”, “I’m here to help”, etc. Answer fully and stop.
- **Tone:** Conversational, clear, supportive, no jargon; 2–3 sentences for simple questions, longer for allocation questions.

### 2.2 Chat Formatting (Mandatory)

- Use headers (##), bullets, blank lines.
- Bold key terms and numbers (**$339/mo**, **401(k) Employer Match**).
- Whole dollars only, no cents; comma separators (**$1,365**).
- No LaTeX; use plain English and bold numbers for calculations.
- Lead with the main point; put details in a scannable list.

### 2.3 Income Allocation Logic

- **Baseline:** 3‑month average actual spending (not single‑month spikes).
- **Needs:** Fixed short‑term (rent, utilities, etc.).
- **Savings gap:** If actual savings < target, shift from **Wants → Savings** (never increase Wants when we need more savings).
- **Shift limit:** Exactly **4%** of income (fixed).
- **Targets:** Default 50/30/20 (Needs/Wants/Savings); formulas for gap %, shift %, and final dollars are spelled out.
- **Income changes:** Recalculate dollar targets as % of new income.

### 2.4 Savings Allocation Priority Stack

Order of operations when allocating savings (bonus, paycheck, extra cash):

1. **Emergency Fund** – Up to 40% of savings budget; fill gap to target.
2. **High‑APR debt** – Up to 40% of *remaining* savings (APR > 10%).
3. **401(k) match** – Capture full match this period.
4. **Roth vs Traditional** – Income < $190K single / $230K married → Roth; IDR → Traditional regardless.
5. **Split remainder** – Retirement vs Brokerage using liquidity/retirement matrix (9 combinations).
6. **Route retirement** – IRA first (limits), then 401(k), spill to brokerage.

Formulas and examples are given for each step.

### 2.5 Centralized Savings Formula

- **Base savings** = Income − Needs − Wants.
- **Pre‑tax** = 401k + HSA contributions.
- **Tax savings** ≈ 25% of pre‑tax.
- **Net pre‑tax impact** = Pre‑tax − Tax savings (reduction in take‑home).
- **Cash savings (post‑tax)** = Base savings − Net pre‑tax impact.
- **Total savings** = Cash savings + Pre‑tax + Employer match.

Ribbit must use this consistently and explain why cash savings can be less than base savings when pre‑tax exists.

### 2.6 Net Worth & Growth

- **Growth assumptions:** Cash/EF 4%, Retirement 9%, Brokerage 8.5%, debt per APR.
- **Net worth questions:** Use compound growth (FV of annuity, etc.), not linear math.
- **Savings decline:** Impact = FV of lost contributions (e.g. $400/mo for 10 years at 9% ≈ $77K lost, not $48K).
- Use `userPlanData.netWorth.projections` as baseline; then show calculations.

### 2.7 Tax & Account Decisions

- Roth vs Traditional by income and IDR (IDR → Traditional to lower AGI).
- Roth IRA phase‑out; backdoor Roth as advanced option.
- “Reduces AGI” explained in simple terms.

### 2.8 Short‑Term vs Long‑Term

- **Short‑term:** Automatic shift from Wants to Savings (up to 4%); 3‑month averages.
- **Long‑term:** Structural changes (rent, car, subscriptions) when Needs over target for 3+ months.
- Negative savings: Deficit = Income − (Needs + Wants); prioritize cutting Wants first.

### 2.9 Response Structure & Calculations

- For complex answers: Reasoning → Numeric example with their numbers → Next action.
- **Perform calculations directly** using formulas and `userPlanData`; then mention tools (Savings Helper, Savings Allocator, Net Worth chart) for verification.
- Tools are for exploration; the model must give a direct answer first.

### 2.10 Formatting & Out‑of‑Scope

- Clear structure, bold numbers, tables for Current vs Plan, no LaTeX.
- **Out‑of‑scope:** No stock picks, crypto recommendations, tax evasion, or return predictions. Politely decline and point to allocation/planning instead.

---

## 3. Screen Context (When `context` Is Set)

A **context string** selects a **screen description** that is appended after the base prompt.

| Context | Purpose |
|--------|---------|
| `financial-sidekick` | Main app chat; full data; distinguish Savings Breakdown vs Savings Allocation. |
| `savings-helper` | Chat‑first income allocation; three bars (Past 3M, Current month projected, Recommended plan); Actuals vs Plan; PROPOSED_SAVINGS output. |
| `savings-allocator` | Fine‑tune savings across EF, debt, retirement, brokerage; +/- buttons; total wealth moves; optional tool-output block (see below). |
| `savings-optimizer` | Needs/Wants sliders; impact on savings and net worth. |
| `plan-final` | Final plan summary; savings breakdown (Cash + Payroll + Match); net worth chart; milestones. |
| `savings-plan` | Onboarding allocate‑savings; pre‑tax vs post‑tax; 401k match awareness; +/- controls. |
| `payroll-contributions` | 401k, HSA, EF target, retirement preference; no math/jargon. |
| `monthly-plan-design` | Income, Needs, Wants sliders; savings = Income − (Needs + Wants). |
| `monthly-plan-current` | Income & expense profile; 3‑month actuals; “Allocate my Income” CTA. |
| `monthly-plan` | Generic monthly plan allocation. |
| `mvp-simulator` | Internal verification; inputs/outputs from engines; explain how numbers were calculated. |

For onboarding screens (`monthly-plan`, `monthly-plan-design`, `monthly-plan-current`, `payroll-contributions`, `savings-plan`, `plan-final`), an **onboarding flow** blurb is added (stages 1–7 and current stage).

---

## 4. Optional Blocks (Depend on Context + userPlanData)

### 4.1 Current Leaps (`financial-sidekick` + `currentLeaps`)

- If `userPlanData.currentLeaps` exists and is non‑empty, a **CURRENT_LEAPS** section is added.
- Ribbit must only recommend from this list for “what should I do?” / “what’s next?” and offer to open the relevant tool.
- Up to 3 leaps are serialized (leapId, leapType, reasonCode, payload, etc.).

### 4.2 Savings Adjustments (`savings-adjustments` + `adjustmentsContext`)

- Role: help user adjust savings inside “Adjust plan details”.
- Rules: use only numbers from `adjustmentsContext`; explain tradeoffs (match forfeiture, EF risk, debt interest); for reset/decrease/increase, acknowledge — UI applies.
- Short responses; bullets.

### 4.3 Savings Allocator Tool Output (`savings-allocator` + `toolOutput`)

When context is `savings-allocator` and `userPlanData.toolOutput` exists:

- **Architecture:** Feed decides recommendations; Savings Allocation logic provides numbers; Ribbit must **never invent numbers** — only use USER_STATE, BASELINE_PLAN, PROPOSED_PLAN, and optionally TOOL_OUTPUT_EXPLAIN.
- **Job:** Explain the recommended plan; compare baseline vs proposed; one main reason; ask for confirmation before apply.
- **Confirmation:** If plan differs from last confirmation, show “Here’s what changed” and ask to apply.
- **Proceed/Skip:** For any allocation change, end with “Use **Proceed** to see the updated plan, or **Skip** to keep your current plan.”
- **Stack deviation:** 7‑step flow when user proposes a change that deviates from the priority stack (education → tradeoffs → Proceed → confirmation message → net worth impact → final confirm → “Confirm & Apply”).
- **Data blocks:** CURRENT_CONTEXT, USER_STATE, BASELINE_PLAN, PROPOSED_PLAN, and optionally TOOL_OUTPUT_EXPLAIN (match, HSA, EF, etc.).
- **Output format:** Bold labels, whole dollars, current vs proposed by category; Total Monthly Savings from USER_STATE (Pre‑tax + Employer + Post‑tax).

### 4.4 MVP Simulator (`mvp-simulator` + `inputs` / `outputs`)

- **MVP SIMULATOR – INPUTS** and **MVP SIMULATOR – OUTPUTS** (JSON) are appended.
- Ribbit must use these to explain how any number was calculated (income allocation, savings allocation, net worth simulation).

### 4.5 User Financial Data (When Not MVP Simulator)

When `userPlanData` exists and context is not `mvp-simulator`, a large **user data** section is appended. It includes (when present):

- **Available data summary** – What’s available (income, spending, payroll, savings breakdown, allocation, debt, net worth, emergency fund).
- **Critical formula reminder** – Total Savings = Pre‑tax + Match + Post‑tax Cash; base savings ≠ total.
- **Income** – Monthly income.
- **Monthly spending** – Needs, Wants, Base Savings ($ and %); note that total savings is Pre‑tax + Match + Post‑tax Cash.
- **Expenses** – Line items from `expenseBreakdown`.
- **Debt** – Total balance, minimums, high‑APR vs other, per‑debt details.
- **Payroll contributions** – 401k, HSA, employer match; “free money” and use exact values.
- **Total Monthly Savings Breakdown** – Pre‑tax (payroll), 401K Match, Cash Savings; verification line; **mandatory** rule to show this exact breakdown when user asks “what makes up my savings” etc.
- **Base savings** – Income − Needs − Wants and its relation to total savings.
- **Savings allocation** – How post‑tax cash is distributed (EF, debt, retirement, brokerage); **exclude** 401K match from this allocation; verification line.
- **Actual spending** – 3‑month average (when not savings-helper).
- **Plan data** – Target or recommended plan (Needs/Wants/Savings); in savings-helper this is the third bar (Recommended Plan).
- **Allocation rules** – Shift limit (4%), savings gap % if applicable.
- **Assets / Goals / Emergency fund / Safety strategy** – Current vs target, months to target, liquidity, retirement focus, IDR.
- **Annual income** – For Roth/Traditional cutoff.
- **Net worth** – Current, assets/liabilities, **projections** with **asset breakdown** (cash, brokerage, retirement, HSA, total assets, liabilities) per projection; instruction to use these exact values.

**Savings Helper–specific:**

- If `incomeAllocationLifecycle` exists: 4‑state lifecycle, FIRST_TIME vs not, response structure (situation → result → proposal → why), PROPOSED_SAVINGS line at end of response, context packet (mode, state, netIncomeMonthly, last3m_avg, recommendedPlan, deltas, shiftLimit, completeSavingsBreakdown).
- If `savingsHelperBarGraphs` exists (and no lifecycle): Three bars (Past 3 Months Average, Current Month projected, Recommended Plan); “Actuals vs Plan” language; never “current plan” for Bar 2.

---

## 5. Final Instructions Block (Always Last)

A final **ANSWER INSTRUCTIONS** section is appended. It restates:

### 5.1 Universal Principles

1. **Use actual data** – Never “I can’t see your data”; use `userPlanData`; personalize.
2. **Show your work** – Step‑by‑step calculations; for time-to-goal: (Target − Current) ÷ Monthly = Time.
3. **Verify totals** – Needs + Wants + Savings = Income; EF + Debt + … = Total Savings; include ✓.
4. **Provide context** – Which rule applies; how a goal fits the priority stack.
5. **No closing phrases** – Answer fully, then stop; no “Let me know if…”.

### 5.2 Question-Type Rules

- **Income allocation** – Show 3‑month average and current month; state “3‑month average”; shift limit 4%; verify totals with ✓.
- **Savings allocation** – Priority stack; where a goal fits (e.g. down payment from Brokerage after EF, debt, match, retirement); full allocation breakdown with actual $.
- **Tax / account type** – $190K/$230K; IDR → Traditional; AGI explanation.
- **Out-of-scope** – Decline stock/crypto/tax evasion; offer allocation/planning.

---

## 6. Key Concepts for the Team

### 6.1 Two Different “Savings” Breakdowns

- **Savings Breakdown (total)**  
  **Total Savings = Pre‑tax (401k/HSA) + Employer Match + Post‑tax Cash.**  
  This is “what makes up my total savings.” Shown in Income Distribution / Monthly Pulse.

- **Savings Allocation (post‑tax cash only)**  
  How **post‑tax cash** is split: Emergency Fund, Debt Payoff, Retirement (IRA/401k beyond match), Brokerage.  
  401K match is **not** part of this allocation (it’s employer money).  
  This is “where does my savings go.”

Ribbit must show **both** when users ask for “savings breakdown” or “what makes up my savings.”

### 6.2 Data Source of Truth

- Numbers come from **userPlanData** (and for Savings Allocator from USER_STATE / BASELINE_PLAN / PROPOSED_PLAN / TOOL_OUTPUT_EXPLAIN).
- Ribbit must **never** say “I don’t have access to your data” when that data is in the prompt.
- If `savingsBreakdown` has zeros but `payrollContributions` has values, the code can use a payroll fallback; the prompt instructs to use the values provided in the “TOTAL MONTHLY SAVINGS BREAKDOWN” (or payroll) section.

### 6.3 Special Outputs

- **Savings Helper:** When proposing a new monthly savings amount, the model must output **`PROPOSED_SAVINGS: <number>`** on its own line at the end. The app parses this and can show it in the UI (e.g. “Explore options” / “Apply”).

### 6.4 Proceed / Skip / Confirm & Apply

- In **Savings Allocator**, after an allocation change Ribbit ends with Proceed vs Skip. On Proceed, the UI updates the plan and shows a confirmation; Ribbit does not generate that confirmation message. Final lock‑in is “Confirm & Apply” in the UI.
- In **Savings Helper**, user confirms via “Explore options” and the green “Apply” in chat.

---

## 7. Quick Reference: Where to Change What

| Goal | Where in `route.ts` |
|------|----------------------|
| Change Ribbit’s tone or identity | Start of `buildSystemPromptInternal` (first paragraph). |
| Change income allocation rules (e.g. shift limit, 50/30/20) | Base prompt block “INCOME ALLOCATION LOGIC”. |
| Change savings priority order or caps | Base prompt block “SAVINGS ALLOCATION PRIORITY STACK”. |
| Change growth assumptions or net worth rules | Base prompt “NET WORTH PROJECTION AND GROWTH CALCULATIONS”. |
| Change Roth/Traditional or IDR rules | Base prompt “TAX AND ACCOUNT TYPE DECISIONS”. |
| Add or edit a screen description | Object `contextDescriptions` (e.g. `'savings-helper': \`...\``). |
| Change what data we send for a screen | Conditional blocks after “if (userPlanData)” (income, expenses, savings breakdown, net worth, etc.). |
| Change Savings Allocator behavior (confirmations, deviation flow) | Block “Phase 2A: Savings Allocation tool” (ROLE, ARCHITECTURE RULES, 7-step deviation flow, DATA). |
| Change mandatory answer rules (e.g. 3‑month average, no closing phrase) | Base prompt “CRITICAL RULE - ENDING RESPONSES” and final “ANSWER INSTRUCTIONS”. |

---

## 8. Flow Summary

1. Client sends `messages`, `context`, `userPlanData`, optional `stream`.
2. `buildSystemPrompt(context, userPlanData)` builds one big system prompt string.
3. OpenAI request = `[{ role: 'system', content: systemPrompt }, ...messages]`.
4. Response is post‑processed: round dollars, strip PROPOSED_SAVINGS for savings-helper and return it separately if present.
5. Questions/responses can be logged (see `logQuestion`).

This structure keeps **domain logic and formulas** in one place (the base prompt), **screen behavior** in context blocks, and **user-specific answers** driven by injected data and the final instruction block.
