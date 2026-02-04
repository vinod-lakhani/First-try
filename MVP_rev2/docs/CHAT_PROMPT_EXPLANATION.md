# Chat Prompt Explanation (Ribbit / WeLeap)

This document explains how the **Ribbit chat system prompt** is built and how **plan-update-via-chat** works in MVP_rev2. Use it to onboard teammates, debug behavior, or change the prompt safely.

**Where the prompt lives:** `MVP_rev2/app/api/chat/route.ts`  
**Entry point:** `buildSystemPrompt(context, userPlanData)` → `buildSystemPromptInternal(...)`  
**Intent module (plan updates):** `MVP_rev2/lib/chat/savingsAllocationIntent.ts`  
**Chat plan data (single source of truth):** `MVP_rev2/lib/chat/buildChatPlanData.ts`

---

## 1. High-Level Architecture

Every chat request sends:

- **`context`** – Which screen the user is on (e.g. `financial-sidekick`, `savings-helper`, `savings-allocator`, `savings-plan`).
- **`userPlanData`** – The user’s financial snapshot (income, expenses, savings breakdown, net worth, etc.).

The system prompt is **assembled in layers**:

1. **Base prompt** – Identity (Ribbit), universal rules, and domain logic (income allocation, savings stack, net worth, tax rules).
2. **Screen context** – Description of the current screen and what the user can do there.
3. **Optional blocks** – Current Leaps, Savings Allocator tool output, Savings Helper lifecycle, MVP Simulator inputs/outputs.
4. **User data** – Injected financial data (income, spending, debt, savings breakdown, net worth projections, etc.).
5. **Final instructions** – Universal answer principles and question-type rules.

If `buildSystemPrompt` throws, a **fallback prompt** is used (short Ribbit identity + basic guidelines).

**Streaming:** For `savings-allocator` and `savings-plan`, the API **always uses non-streaming** so the full response is available to parse `PLAN_CHANGES` and avoid the response overwriting or disappearing in the embedded chat UI. All other contexts may stream when requested.

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
- **Bullet lists in chat:** No line space between the bullet and the text (bullet and text stay on one line). The UI (IncomePlanChatCard, ChatMarkdown) enforces this so responses render inline.

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
| `financial-sidekick` | Main app chat; full data; distinguish Savings Breakdown vs Savings Allocation; CURRENT_LEAPS when provided. |
| `savings-helper` | Chat‑first income allocation; three bars (Past 3M, Current month projected, Recommended plan); Actuals vs Plan; PROPOSED_SAVINGS output; net worth impact when user proposes new savings amount. |
| `savings-allocator` | Fine‑tune savings across EF, debt, retirement, brokerage; +/- buttons; total wealth moves; PLAN_CHANGES at end of response when applying a change; optional tool-output block. |
| `savings-optimizer` | Needs/Wants sliders; impact on savings and net worth. |
| `plan-final` | Final plan summary; savings breakdown (Cash + Payroll + Match); net worth chart; milestones. |
| `savings-plan` | Onboarding allocate‑savings; pre‑tax vs post‑tax; 401k match awareness; +/- controls; PLAN_CHANGES when applying a change. |
| `payroll-contributions` | 401k, HSA, EF target, retirement preference; no math/jargon. |
| `monthly-plan-design` | Income, Needs, Wants sliders; savings = Income − (Needs + Wants). |
| `monthly-plan-current` | Income & expense profile; 3‑month actuals; “Allocate my Income” CTA. |
| `monthly-plan` | Generic monthly plan allocation. |
| `mvp-simulator` | Internal verification; inputs/outputs from engines; explain how numbers were calculated. |

For onboarding screens (`monthly-plan`, `monthly-plan-design`, `monthly-plan-current`, `payroll-contributions`, `savings-plan`, `plan-final`), an **onboarding flow** blurb is added (stages 1–7 and current stage).

When the user is **not** on `savings-allocator` or `savings-plan` and asks to change their savings plan, the prompt instructs Ribbit to direct them to **Tools → Savings Allocation** (or the savings recommendation in the Feed) instead of applying changes in that chat.

---

## 4. Optional Blocks (Depend on Context + userPlanData)

### 4.1 Current Leaps (`financial-sidekick` + `currentLeaps`)

- If `userPlanData.currentLeaps` exists and is non‑empty, a **CURRENT_LEAPS** section is added.
- Ribbit must only recommend from this list for “what should I do?” / “what’s next?” and offer to open the relevant tool.
- Up to 3 leaps are serialized (leapId, leapType, reasonCode, payload, etc.).

### 4.2 Savings Adjustments (`savings-helper` + user-proposed amount + `netWorthImpact`)

- **Role:** Help user adjust savings inside Savings Helper; net worth chart above chat updates in real time when they propose a new monthly savings amount.
- **When the user proposes a specific new savings amount** (e.g. “I want to save $2,500” or “save $4,000”) and `userPlanData.netWorthImpact` is provided:
  - The model must give a **short reply (2–4 sentences)**. Do **not** use the usual 4-part structure (Current situation / What that results in / Proposed plan / Why).
  - **Lead with the 20-year net worth impact:** “The impact of this change would [increase|reduce] your net worth by $X in 20 years.” (X = absolute value of `deltaAt20Y` from `netWorthImpact`.)
  - Then one brief close (e.g. “Click **Apply** above to lock this in, or ask if you have questions.”).
  - No section headers, no bullet lists, no long breakdown — the user already sees the numbers in the chart.
  - Do **not** use generic flexibility phrases like “We’re suggesting you adjust your savings…” or “This means your new allocation would allow for more flexibility…”.
- **Apply flow:** When the user clicks **Apply** in Savings Helper, the new target is saved and the app shows: “Your new target is saved. Go to Savings Allocator to see the breakdown and accept the plan.” The plan is **not** updated globally until the user opens Savings Allocator and clicks **Confirm & Apply** there.
- Rules: use only numbers from context; explain tradeoffs when relevant; short responses when `netWorthImpact` is present.

### 4.3 Savings Allocator Tool Output (`savings-allocator` + `toolOutput`)

When context is `savings-allocator` and `userPlanData.toolOutput` exists:

- **Architecture:** Feed decides recommendations; Savings Allocation logic provides numbers; Ribbit must **never invent numbers** — only use USER_STATE, BASELINE_PLAN, PROPOSED_PLAN, and optionally TOOL_OUTPUT_EXPLAIN.
- **Current Plan vs Proposed Plan:** **Current Plan** = last locked plan (baseline). **Proposed Plan** = when the user has applied a new target in Savings Helper but not yet accepted in Savings Allocator, this is the new amount; otherwise it matches the effective savings budget. The allocator shows both so the user can compare before clicking **Confirm & Apply**.
- **Intro / first message:** When monthly savings has changed (e.g. user came from Savings Helper with a new target), the UI states the change (e.g. “Monthly savings changed from $X to $Y”) and asks “Want an explanation of how we allocated it?” The button label is **“Explain the breakdown”** (not “Why these changes?”).
- **Proposed Allocation Breakdown — MANDATORY:** When explaining current vs proposed allocation (e.g. user clicks “Explain the breakdown”), the model **must** use a **bold category header** before **each** category’s bullets. Never list Current/Proposed/Reason without the category name first. Use exact labels: **Emergency Fund:**, **High-APR Debt Payoff:**, **Roth IRA / Taxable Retirement:** (or **Retirement Contributions:**), **Brokerage:**, **401(k) Employer Match:**, **HSA:**. Format every category like this:
  - **Category name:** on its own line, then bullets for Current, Proposed, Reason. Do **not** output a block of bullets without category headers.
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
- **Net worth impact:** When the user types a specific new savings amount in chat (e.g. “I want to save $2,500”), the client sends `userPlanData.netWorthImpact` with `baselineNetWorthAt20Y`, `proposedMonthlySavings`, `proposedNetWorthAt20Y`, and `deltaAt20Y`. The net worth chart in Savings Helper updates live to the proposed amount. The model must lead with the 20-year impact sentence and keep the reply to 2–4 sentences (see §4.2).
- **Apply flow:** Clicking **Apply** in Savings Helper saves the new target and shows a modal: “Your new target is saved. Go to Savings Allocator to see the breakdown and accept the plan.” The plan is only written to the rest of the app (Income tab, Monthly Pulse, etc.) when the user opens Savings Allocator and clicks **Confirm & Apply** there.

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

### 6.2 Data Source of Truth for Chat

- **Plan data for chat:** All chat contexts (FinancialSidekick, SavingsChatPanel, IncomePlanChatCard) MUST use **`lib/chat/buildChatPlanData.ts`** for current/baseline data. It builds net worth and savings allocation from `FinalPlanData` (usePlanData hook), so values are consistent across every chat window.
- **Numbers in the prompt:** Come from **userPlanData** (and for Savings Allocator from USER_STATE / BASELINE_PLAN / PROPOSED_PLAN / TOOL_OUTPUT_EXPLAIN).
- Ribbit must **never** say “I don’t have access to your data” when that data is in the prompt.
- If `savingsBreakdown` has zeros but `payrollContributions` has values, the code can use a payroll fallback; the prompt instructs to use the values provided in the “TOTAL MONTHLY SAVINGS BREAKDOWN” (or payroll) section.

### 6.3 Intent-Based Plan Updates (rev2 Architecture)

Plan-update-via-chat follows an **intent-first** design so “to $X” vs “by $X” and single-category changes are handled consistently everywhere.

**Philosophy:** The chat parses the user’s message into a **semantic intent** (what they want). The **tool** applies that intent. The API’s `PLAN_CHANGES` line is a **fallback** when no intent is parsed (e.g. explain-only or model-only flow).

**Intent module** (`lib/chat/savingsAllocationIntent.ts`):

- **`parseSavingsAllocationIntent(text, context)`** – Parses user (or assistant) text into a single intent: `reset`, `set_target` (to $X), `delta` (by $X), or `eliminate` (401k/HSA to zero). Uses current balances so “to $1000” → correct delta.
- **`intentToDelta(intent, context)`** – Converts intent to `{ category, delta }` (category: ef, debt, retirementExtra, brokerage, 401k, hsa).
- **`intentToPlanChanges(intent, context)`** – Converts intent to the same shape as `PlanChangesFromChat` (absolute for preTax401k/hsa, deltas for efDelta, debtDelta, etc.) so the client can merge over API `planChanges`.
- **`intentIsSingleCategoryChange(intent)`** – True when the intent is a single-category change that should override API-provided deltas for other categories.

**Where intent is used:**

| Chat surface | Role |
|--------------|------|
| **SavingsChatPanel** (savings-allocator, savings-helper) | Applies plan changes: **intent first** (from last user message), then API `planChanges` as fallback. For single-category intents (e.g. “reduce EF to $1000”), only that category’s delta is applied; other API deltas for post‑tax categories are ignored so rebalance logic handles freed funds. |
| **OnboardingChat** (savings-plan) | When API returns `planChanges`, builds intent from last user message and current plan. If a **single-category intent** is parsed, corrects `planChanges` with `intentToPlanChanges` and passes the merged object to `onPlanChangesFromChat`. |
| **AdjustPlanChatPanel** (embedded “Ribbit — Adjustments”) | Uses `parseSavingsAllocationIntent` + `intentToDelta` for all edits (reset, “to $X”, “by $X”) so wording is consistent with the rest of the app. |
| **FinancialSidekick** | Does **not** apply plan changes. Plan updates happen on the tool pages (savings-allocator, etc.); the sidekick only chats and routes to tools. |

**PLAN_CHANGES format (API output):**

- One line at the end of the response: `PLAN_CHANGES: {"key": value, ...}`.
- **Pre‑tax (absolute monthly):** `preTax401k`, `hsa` – e.g. `0` to eliminate, or target value when user says “set 401k to $100”.
- **Post‑tax (monthly deltas in $):** `efDelta`, `debtDelta`, `retirementExtraDelta`, `brokerageDelta` – positive = add, negative = reduce.
- **“to $X” vs “by $X”** is specified in the system prompt for savings-allocator and savings-plan so the model outputs correct deltas (e.g. “reduce EF to $1000” → `efDelta = 1000 - currentEF`, not −1000). The client still corrects with intent when it parses a single-category change, so mis-parsed API output does not override user meaning.

### 6.4 Special Outputs

- **Savings Helper:** When proposing a new monthly savings amount, the model must output **`PROPOSED_SAVINGS: <number>`** on its own line at the end. The app parses this and shows the adjust-plan tile (Apply, Ask a question, Keep my plan) in chat.
- **Savings Allocator / Savings Plan:** When applying a change the user requested, the model must output **`PLAN_CHANGES: {"preTax401k":…,"hsa":…,"efDelta":…,…}`** at the very end. The API parses this and returns it in the response (non-streaming for these contexts). The client may **override** these values using the intent module when a single-category intent is detected from the last user message.
- **Savings Helper — net worth impact:** When the user types a specific new savings amount (e.g. “I want to save $2,500”), the client sends **`userPlanData.netWorthImpact`** with `baselineNetWorthAt20Y`, `proposedMonthlySavings`, `proposedNetWorthAt20Y`, and `deltaAt20Y`. The system prompt instructs the model to lead with “The impact of this change would [increase|reduce] your net worth by $X in 20 years.” and to keep the reply short (2–4 sentences). The net worth chart above the chat updates in real time to the proposed amount.
- **Apply in Savings Helper:** Clicking **Apply** does not persist the plan globally. It stores the new target in `proposedSavingsFromHelper` (and sessionStorage) and shows a modal directing the user to Savings Allocator to “see the breakdown and accept the plan.” The Feed shows a “Pending savings plan change” banner when `proposedSavingsFromHelper` is set. The plan is only committed when the user clicks **Confirm & Apply** in Savings Allocator.

### 6.5 Proceed / Skip / Confirm & Apply

- In **Savings Allocator**, **Current Plan** is the last locked plan; **Proposed Plan** can be the new target set in Savings Helper (when the user clicked Apply there but has not yet accepted in the allocator). After reviewing, the user clicks “Confirm & Apply” to lock in the plan; that clears `proposedSavingsFromHelper` and updates the store so Income tab, Monthly Pulse, and Savings Helper all show the new plan.
- In **Savings Allocator**, after an allocation change Ribbit ends with Proceed vs Skip. On Proceed, the UI updates the plan and shows a confirmation; Ribbit does not generate that confirmation message. Final lock‑in is “Confirm & Apply” in the UI.
- In **Savings Helper**, the user confirms via the green “Apply” button in the chat tile. That saves the new target and directs them to Savings Allocator to see the breakdown and accept the plan. The plan is only fully applied when they click “Confirm & Apply” in Savings Allocator.

---

## 7. Implementation Notes (Store & UI)

- **`proposedSavingsFromHelper`:** Stored in the onboarding store (`lib/onboarding/store.ts`) and persisted in sessionStorage (`weleap_proposedSavingsFromHelper`) so the pending target survives reloads and navigation. Set when the user clicks **Apply** in Savings Helper; cleared when the user clicks **Confirm & Apply** in Savings Allocator or "Keep my plan" in Savings Helper.
- **Feed:** When `proposedSavingsFromHelper` is set, the Feed page shows a "Pending savings plan change" card with a link to Savings Allocator so the user can review the breakdown and accept the plan.
- **Savings Allocator:** Reads `proposedSavingsFromHelper` on load (and hydrates from sessionStorage if needed). When set, **Proposed Plan** uses that amount; **Current Plan** stays the last locked plan until the user confirms in the allocator.
- **Onboarding vs post-onboarding:** We distinguish the two with the allocator scenario and URL `source`. **Onboarding:** `source=onboarding` and scenario `first_time` — no current plan; we show "Ribbit Plan" (engine proposal) vs "Proposed" (user edits). **Post-onboarding:** When the user opens the allocator from Savings Helper after clicking Apply (or when `proposedSavingsFromHelper` is set), we use scenario `my_data` and `source=sidekick` so **Current Plan** = last locked plan and **Proposed Plan** = new target from helper; the stored plan is **not** updated until the user clicks **Confirm & Apply** in the allocator.
- **Chat bullet formatting:** Bullet lists in chat render with no line space between bullet and text (inline). Enforced in `components/tools/IncomePlanChatCard.tsx` and `components/chat/ChatMarkdown.tsx`.

---

## 8. Quick Reference: Where to Change What

| Goal | Where |
|------|--------|
| Change Ribbit’s tone or identity | `app/api/chat/route.ts` – start of `buildSystemPromptInternal` (first paragraph). |
| Change income allocation rules (e.g. shift limit, 50/30/20) | Base prompt block “INCOME ALLOCATION LOGIC”. |
| Change savings priority order or caps | Base prompt block “SAVINGS ALLOCATION PRIORITY STACK”. |
| Change growth assumptions or net worth rules | Base prompt “NET WORTH PROJECTION AND GROWTH CALCULATIONS”. |
| Change Roth/Traditional or IDR rules | Base prompt “TAX AND ACCOUNT TYPE DECISIONS”. |
| Add or edit a screen description | `app/api/chat/route.ts` – object `contextDescriptions` (e.g. `'savings-helper': \`...\``). |
| Change what data we send for a screen | Conditional blocks after “if (userPlanData)” (income, expenses, savings breakdown, net worth, etc.). |
| Change Savings Helper net worth impact (20-year lead sentence) | Savings-helper block "When the user proposes a specific new savings amount" and "NET WORTH IMPACT"; client sends `userPlanData.netWorthImpact`. |
| Change Savings Allocator breakdown (bold category headers, "Explain the breakdown") | Block "Proposed Allocation Breakdown — MANDATORY"; UI button label in `components/tools/SavingsChatPanel.tsx`. |
| Change Savings Allocator behavior (confirmations, deviation flow) | Block “Phase 2A: Savings Allocation tool” (ROLE, ARCHITECTURE RULES, 7-step deviation flow, DATA). |
| Change PLAN_CHANGES / “to $X” vs “by $X” instructions | `contextDescriptions['savings-allocator']` and `contextDescriptions['savings-plan']` – “Plan updates via chat” paragraph. |
| Change how plan updates are applied from chat (intent vs API) | `lib/chat/savingsAllocationIntent.ts` (parser + intentToDelta / intentToPlanChanges); `components/tools/SavingsChatPanel.tsx` (applyPlanChangesFromChat); `components/onboarding/OnboardingChat.tsx` (onDone correction); `components/tools/AdjustPlanChatPanel.tsx` (parseIntent). |
| Change mandatory answer rules (e.g. 3‑month average, no closing phrase) | Base prompt “CRITICAL RULE - ENDING RESPONSES” and final “ANSWER INSTRUCTIONS”. |

---

## 9. Flow Summary

1. Client sends `messages`, `context`, `userPlanData`, optional `stream`. For savings-allocator and savings-plan, the API **ignores** `stream` and uses **non-streaming** so the full response can be parsed for `PLAN_CHANGES`. For savings-helper when the user proposes a new savings amount, `userPlanData.netWorthImpact` is included.
2. `buildSystemPrompt(context, userPlanData)` builds one big system prompt string.
3. OpenAI request = `[{ role: 'system', content: systemPrompt }, ...messages]`. For savings-allocator/savings-plan, `max_tokens` is higher (e.g. 3200) to allow for PLAN_CHANGES at the end.
4. Response is post‑processed: round dollars; for savings-helper strip PROPOSED_SAVINGS and return it separately if present; for savings-allocator/savings-plan parse `PLAN_CHANGES` from the end of the response and attach to the JSON/SSE `done` payload.
5. **Client:** For savings-allocator (SavingsChatPanel) and savings-plan (OnboardingChat), the client may **correct** the received `planChanges` using the intent module: parse the last user message with `parseSavingsAllocationIntent`; if a single-category intent is found, compute the correct change with `intentToDelta` / `intentToPlanChanges` and apply that (or merge over API planChanges) so “to $X” and “by $X” behave correctly even if the API mis-parsed.
6. Questions/responses can be logged (see `logQuestion`).

This structure keeps **domain logic and formulas** in the base prompt, **screen behavior** in context blocks, **plan updates** intent-first with API PLAN_CHANGES as fallback, and **user-specific answers** driven by injected data and the final instruction block.
