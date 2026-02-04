# Verification: Savings-Helper Alignment with Baseline vs Proposed Principle

**Principle:** For any plan change we show (1) baseline vs proposed, (2) net worth delta in chat (e.g. 20-year impact), (3) net worth delta on chart. **My-data:** Current vs Proposed. **Onboarding:** Ribbit Plan vs Proposed.

---

## Savings-Helper (Initial Mode + App Mode)

### 1. Net worth in chat ✓

- **IncomePlanChatCard** passes `baselineNetWorthAt20Y` and `getProposedNetWorthAt20Y`.
- When the user proposes a specific amount (e.g. "I want to save $2500"), the card computes `netWorthImpact` (baselineAt20Y, proposedAt20Y, deltaAt20Y) and sends it in `userPlanData`.
- **API (savings-helper):** When `netWorthImpact` is present, the prompt injects a **NET WORTH IMPACT** block and instructs: *"First sentence MUST be: The impact of this change would [increase|reduce] your net worth by $X in 20 years."*
- **Files:** `components/tools/IncomePlanChatCard.tsx` (lines 177–188, 199–203), `app/api/chat/route.ts` (savings-helper block, netWorthImpact injection ~2399–2405, and "When the user proposes a specific new savings amount" ~2359).

**Verdict:** Savings-helper (initial and app mode) already states the 20-year net worth impact in the chat when the user proposes a new savings amount.

---

### 2. Net worth on chart ✓

- **IncomePlanContent** renders a "Net worth impact" section with projection cards and `NetWorthChart`.
- When `proposedPlanData` exists (user proposed amount in chat or UNDERSAVED/OVERSAVED simulation):
  - **Primary series** = proposed plan net worth.
  - **Baseline series** = `baselinePlanData` (current/planned net worth).
  - **seriesLabels:** `{ primary: 'Proposed plan', baseline: 'Planned net worth (current)' }`.
- When there is no proposed change: primary = planned net worth, baseline = "Based on current saving".
- Projection cards show the proposed/planned value and a **delta** line: "vs Current" or "vs current saving".

**Verdict:** Chart and cards show baseline vs proposed and the net worth delta. Behaviour matches the principle.

---

### 3. Baseline vs proposed (concept) ✓

- **App mode (has current plan):** Baseline = `baselinePlanData` (current/planned). Proposed = `proposedPlanData` (user’s proposed amount or simulation). So Current vs Proposed.
- **Initial mode (FIRST_TIME):** Baseline = recommended plan (engine) in `baselinePlanData`. Proposed = user’s proposed amount when they type a new number. So we have a “recommendation” vs “what user wants”; no saved plan yet.

**Verdict:** Conceptually aligned: baseline vs proposed in both modes.

---

### 4. Terminology vs agreed principle

- **Agreed:** Onboarding = **Ribbit Plan** (baseline) vs **Proposed**.
- **Current savings-helper:**
  - **Chart:** Uses "Planned net worth (current)" and "Proposed plan" (not "Ribbit Plan" in FIRST_TIME).
  - **Adjust plan message (FIRST_TIME):** Uses "Current plan: No plan yet" and "Proposed for next month" (`lib/income/adjustPlanMessage.ts` line 51).

**Gap (optional):** For strict wording alignment in **onboarding / FIRST_TIME** we could:
- In **savings-helper**, when `snapshot.state === 'FIRST_TIME'` and we have a proposed change, use chart baseline label **"Ribbit Plan"** instead of "Planned net worth (current)".
- In **adjustPlanMessage** for FIRST_TIME, use **"Ribbit Plan"** instead of "Current plan" for the left column (e.g. "Ribbit Plan: $X/mo" when showing the recommendation).

Behaviour is already correct; this would only make labels match the principle exactly.

---

## Summary

| Aspect                         | Savings-helper initial | Savings-helper app | Aligned? |
|--------------------------------|------------------------|--------------------|----------|
| Net worth delta in chat        | ✓ (netWorthImpact, 20y) | ✓                  | Yes      |
| Net worth delta on chart       | ✓ (two lines + labels) | ✓                  | Yes      |
| Baseline vs proposed concept   | ✓ (recommended vs proposed) | ✓ (current vs proposed) | Yes |
| Labels: "Ribbit Plan" in onboarding | Uses "Current plan" / "Planned net worth (current)" | N/A | Optional tweak |

**Conclusion:** Savings-helper is already aligned with the principle: any user-proposed change gets a 20-year net worth impact in chat and a baseline-vs-proposed view on the chart. The only optional improvement is using the label **"Ribbit Plan"** in FIRST_TIME/onboarding (chart and adjust-plan message) for full terminology consistency with the agreed principle.
