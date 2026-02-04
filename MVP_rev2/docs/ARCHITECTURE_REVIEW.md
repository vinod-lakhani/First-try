# Savings Allocator Architecture Review

## Executive Summary

This document reviews the architecture, state management, data flow, and prompt structure for the Savings Allocator tool to identify root causes of issues with net worth impact display and number formatting.

## 1. State Management Architecture

### 1.1 State Sources

**Global State (Zustand Store):**
- `baselineState` = `useOnboardingStore()` - Single source of truth for user's financial data
  - Income, expenses, assets, debts, goals
  - Risk constraints, safety strategy
  - Payroll contributions
  - Custom savings allocation (when user has applied a plan)

**Derived State:**
- `baselinePlanData` = `usePlanData({ useCurrentStateActuals: true })` 
  - Built from `baselineState` via `buildFinalPlanData()`
  - Contains: paycheck categories, net worth projection (Today, 6M, 12M, 24M - **NOT 20 Years**), net worth chart data
  - **CRITICAL ISSUE**: `baselinePlanData.netWorthProjection` does NOT include "20 Years"

**Local Component State:**
- `overrides` = `SavingsOverrides` - Post-tax bucket deltas from chat/UI
- `pretaxOverrides` = `{ k401EmployeeMonthly?, hsaMonthly? }` - Pre-tax overrides
- `allocatorScenario` = Mode selector (first_time, my_data, no_match, etc.)

### 1.2 Plan Computation Flow

```
baselineState (store)
  ↓
baselinePlanData (usePlanData)
  ↓
engineAllocationForScenario (runSavingsAllocation)
  ↓
ribbitProposalPlanData (frozen baseline with "20 Years")
  ↓
allocationForScenario (engine + overrides)
  ↓
scenarioPlanData (proposed plan with "20 Years")
```

**Key Issue**: `ribbitProposalPlanData` was using `baselinePlanData` directly when it has projection, but `baselinePlanData` doesn't have "20 Years", so we lose the baseline 20-year value.

## 2. Source of Truth Analysis

### 2.1 Baseline Plan (Ribbit Proposal)

**Should Be:**
- Frozen snapshot of engine's recommendation
- Calculated ONCE from `engineAllocationForScenario`
- Includes "20 Years" projection
- Never changes until user confirms a new plan

**Current Implementation:**
- `ribbitProposalPlanData` - recalculates from `engineAllocationForScenario`
- **FIXED**: Now always recalculates to include "20 Years"

### 2.2 Proposed Plan (User Changes)

**Should Be:**
- Engine recommendation + user overrides
- Recalculates when overrides change
- Includes "20 Years" projection
- Shows delta vs baseline

**Current Implementation:**
- `scenarioPlanData` - calculated from `allocationForScenario` (engine + overrides)
- **CORRECT**: Already includes "20 Years"

### 2.3 Net Worth Impact Calculation

**Should Be:**
- Baseline 20Y from `ribbitProposalPlanData.netWorthProjection["20 Years"]`
- Proposed 20Y from `scenarioPlanData.netWorthProjection["20 Years"]`
- Delta = Proposed - Baseline

**Current Implementation:**
- Uses `ribbitProposalPlanData` and `scenarioPlanData` projections
- **FIXED**: Now uses correct sources

## 3. Data Flow: Chat → Plan Update

### 3.1 Chat Message Flow

```
User types "reduce 401K to $300"
  ↓
SavingsChatPanel.handleSend()
  ↓
sendChatMessageStreaming() → API route
  ↓
AI responds with PLAN_CHANGES: {"preTax401k": 300}
  ↓
SavingsChatPanel.onDone() → applyPlanChangesFromChat()
  ↓
onUserRequestedPlanChange({ category: '401k', delta: -828.4 })
  ↓
handlePreTaxStepper('k401EmployeeMonthly', -828.4)
  ↓
setPretaxOverrides({ k401EmployeeMonthly: 300 })
  ↓
allocationForScenario recalculates (includes pretaxOverrides)
  ↓
scenarioPlanData recalculates (includes new 401K)
  ↓
Net worth impact recalculates
  ↓
UI updates
```

### 3.2 Issues in Current Flow

1. **Number Formatting**: AI generates `$828.4000000000001` → should be formatted to `$828`
   - **FIXED**: `roundDollarAmountsInText()` now matches many decimals

2. **Net Worth Impact Not Mentioned**: AI doesn't mention 20-year impact
   - **ROOT CAUSE**: `netWorthImpact20Y` may not be reaching prompt, or prompt isn't strong enough
   - **FIXED**: Added to `userStateJson`, enhanced prompt instructions

3. **Net Worth Boxes Not Showing Delta**: UI doesn't show baseline vs proposed
   - **ROOT CAUSE**: `ribbitProposalPlanData` didn't have "20 Years"
   - **FIXED**: Now always recalculates to include "20 Years"

## 4. Modes and Scenarios

### 4.1 Mode Definitions

**`first_time`** (Onboarding):
- No current plan exists
- Engine proposes first plan
- Baseline = Engine recommendation (Ribbit Proposal)
- Proposed = Engine recommendation (same as baseline initially)
- User can modify → Proposed changes
- On Apply → Plan saved to store

**`my_data`** (Post-Onboarding):
- Current plan exists in store
- Baseline = Current saved plan (from store)
- Proposed = Engine recommendation OR user modifications
- User can modify → Proposed changes
- On Apply → Plan saved to store

**`no_match`**:
- No employer match available
- Baseline 401K = 0, Match = 0
- Proposed = Engine recommendation without match

**`no_hsa`**:
- No HSA available
- Baseline HSA = 0
- Proposed = Engine recommendation without HSA

**`savings_decrease`** / **`savings_increase`**:
- Testing scenarios
- Simulates different savings amounts

### 4.2 Mode-Specific Behavior

**Net Worth Display:**
- `first_time`: Show only Proposed (no baseline comparison)
- `my_data`: Show Ribbit Proposal vs Proposed (two columns)
- Other modes: Same as `my_data`

**Chat Behavior:**
- All modes: Chat can update plan via `onUserRequestedPlanChange`
- All modes: Should mention net worth impact

## 5. Prompt Architecture Review

### 5.1 Prompt Structure

**System Prompt Sections:**
1. Screen context (savings-allocator)
2. UI layout and controls
3. User controls explanation
4. Calculation details
5. Guidance rules
6. **MANDATORY rules** (net worth impact, plan updates)
7. Data sections (USER_STATE, BASELINE_PLAN, PROPOSED_PLAN, TOOL_OUTPUT_EXPLAIN)

### 5.2 Key Rules and Principles

**Cardinal Rules:**
1. **Net Worth Impact**: MUST mention 20-year impact when ANY change is made
2. **Plan Updates**: Use PLAN_CHANGES JSON format
3. **Number Formatting**: Whole dollars only (no cents)
4. **Pre-tax vs Post-tax**: Explain conversions when moving funds

**Current Issues:**
- Rule #1 not being followed (AI not mentioning impact)
- Rule #3 not working (numbers with many decimals)
- Rule #4 working correctly

### 5.3 Data Formatting Consistency

**Numbers:**
- Should be whole dollars: `$828` not `$828.4000000000001`
- Should use locale formatting: `$1,234,567`
- **FIXED**: `roundDollarAmountsInText()` regex updated

**Net Worth:**
- Should show: "This change would **reduce** your net worth by **$5,728,267** in 20 years"
- Format: `$${Math.round(Math.abs(delta)).toLocaleString()}`
- **FIXED**: Prompt includes exact format

## 6. Identified Root Causes

### 6.1 Net Worth Impact Not Showing

**Root Cause #1**: `ribbitProposalPlanData` didn't include "20 Years"
- **Fix**: Always recalculate from `engineAllocationForScenario` to include "20 Years"

**Root Cause #2**: `netWorthImpact20Y` not in `userStateJson`
- **Fix**: Added to `userStateJson` (line 1810)

**Root Cause #3**: Prompt instructions not strong enough
- **Fix**: Enhanced prompt with explicit format and "MANDATORY" language

### 6.2 Number Formatting Not Working

**Root Cause**: `roundDollarAmountsInText()` regex only matched 1-2 decimals
- **Fix**: Updated regex to `(\.\d+)?` to match any number of decimals

### 6.3 Net Worth Boxes Not Showing Delta

**Root Cause**: Using `baselinePlanData` which doesn't have "20 Years"
- **Fix**: Use `ribbitProposalPlanData.netWorthProjection` for baseline values

## 7. Recommendations

### 7.1 Immediate Fixes (Already Applied)

1. ✅ Always recalculate `ribbitProposalPlanData` to include "20 Years"
2. ✅ Add `netWorthImpact20Y` to `userStateJson`
3. ✅ Fix `roundDollarAmountsInText()` regex
4. ✅ Use `ribbitProposalPlanData` for baseline net worth boxes

### 7.2 Architectural Improvements Needed

**1. Single Source of Truth for Baseline:**
- Create `baselineNetWorth20Y` computed value that's always available
- Store it in a `useMemo` that depends on `engineAllocationForScenario`
- Use this everywhere instead of recalculating

**2. Consistent Net Worth Calculation:**
- Create `useNetWorthImpact()` hook that:
  - Takes baseline and proposed plans
  - Returns 20-year impact object
  - Handles all edge cases (missing data, etc.)

**3. Prompt Data Validation:**
- Add validation that `netWorthImpact20Y` is in `userPlanData` before building prompt
- Log warning if missing
- Fallback to calculating from plans if missing

**4. Number Formatting Standardization:**
- Create `formatCurrency()` utility function
- Use everywhere (chat, UI, prompts)
- Ensures consistency

**5. State Management Clarity:**
- Document which state is "frozen" vs "mutable"
- Clear naming: `ribbitProposalPlanData` = frozen baseline
- Clear naming: `scenarioPlanData` = mutable proposed

### 7.3 Testing Strategy

**For Each Mode:**
1. Verify baseline net worth includes "20 Years"
2. Verify proposed net worth includes "20 Years"
3. Verify delta calculation is correct
4. Verify chat mentions net worth impact
5. Verify numbers are formatted correctly
6. Verify net worth boxes show delta

## 8. Prompt Architecture and Key Rules

### 8.1 Prompt Structure Hierarchy

**Level 1: Screen Context**
- Defines which screen user is on (savings-allocator)
- Explains UI layout and controls
- Mode-specific instructions

**Level 2: Cardinal Rules (MANDATORY)**
- Net Worth Impact Rule (CARDINAL RULE)
- Plan Updates Rule
- Number Formatting Rule
- Pre-tax/Post-tax Conversion Rule

**Level 3: Data Sections**
- USER_STATE (includes netWorthImpact20Y)
- BASELINE_PLAN (frozen baseline)
- PROPOSED_PLAN (user-modified)
- TOOL_OUTPUT_EXPLAIN (engine calculations)

**Level 4: Conditional Sections**
- Net Worth Impact data (if available)
- Tool-specific instructions

### 8.2 Key Rules and Principles

**Rule 1: Net Worth Impact (CARDINAL RULE)**
- **When**: ANY change to savings plan
- **What**: MUST mention 20-year impact
- **Format**: "This change would **reduce/increase** your net worth by **$X** in 20 years (from $Y to $Z)."
- **Timing**: BEFORE asking where to move funds or confirming change
- **Data Source**: `userPlanData.netWorthImpact20Y` (preferred) or calculate from plans
- **Status**: ⚠️ NOT BEING FOLLOWED - AI not mentioning impact

**Rule 2: Plan Updates**
- **When**: User requests change AND AI agrees
- **What**: Output `PLAN_CHANGES: {"preTax401k": 100}` at end of response
- **Format**: JSON object with target values (not deltas)
- **Status**: ✅ Working correctly

**Rule 3: Number Formatting**
- **What**: Whole dollars only (no cents)
- **Format**: `$828` not `$828.4000000000001`
- **Implementation**: `roundDollarAmountsInText()` function
- **Status**: ⚠️ NOT WORKING - regex fixed but may not be applied correctly

**Rule 4: Pre-tax/Post-tax Conversion**
- **What**: Explain tax implications when moving funds
- **Format**: "That frees up **$X/month pre-tax**. If you move it to a post-tax bucket, you'll have **~$Y/month** after taxes."
- **Status**: ✅ Working correctly

### 8.3 Prompt Data Flow

```
SavingsAllocatorContent
  ↓
userStateForChat = {
  netWorthImpact20Y: { ribbit20Y, proposed20Y, deltaAt20Y }
}
  ↓
SavingsChatPanel.handleSend()
  ↓
userPlanData = {
  ...userStateForChat,
  ...currentPlanDataForChat,
  toolOutput,
  baselinePlan,
  currentContext
}
  ↓
API Route (route.ts)
  ↓
userStateJson = JSON.stringify({
  ...userPlanData fields,
  netWorthImpact20Y: userPlanData.netWorthImpact20Y  // ✅ Added
})
  ↓
Prompt includes:
  - USER_STATE: ${userStateJson}  // Contains netWorthImpact20Y
  - Conditional section if netWorthImpact20Y exists
```

**Issue**: Prompt checks `userPlanData.netWorthImpact20Y` but it's also in `userStateJson`. Need to ensure consistency.

## 9. Consistency Across Modes

### 9.1 Mode Comparison Matrix

| Mode | Baseline Source | Proposed Source | Net Worth Display | Chat Updates Plan |
|------|----------------|-----------------|-------------------|-------------------|
| `first_time` | Engine (Ribbit Proposal) | Engine + Overrides | Proposed only | ✅ Yes |
| `my_data` | Current saved plan | Engine + Overrides | Ribbit vs Proposed | ✅ Yes |
| `no_match` | Current (401K=0) | Engine (no match) | Ribbit vs Proposed | ✅ Yes |
| `no_hsa` | Current (HSA=0) | Engine (no HSA) | Ribbit vs Proposed | ✅ Yes |
| `savings_decrease` | Current | Engine (lower budget) | Ribbit vs Proposed | ✅ Yes |
| `savings_increase` | Current | Engine (higher budget) | Ribbit vs Proposed | ✅ Yes |

### 9.2 Consistency Rules

**All Modes Should:**
1. ✅ Show net worth impact in chat when changes are made
2. ✅ Format numbers correctly ($828 not $828.4000000000001)
3. ✅ Show net worth delta in UI boxes
4. ✅ Calculate net worth impact from correct baseline

**Mode-Specific Exceptions:**
- `first_time`: Hide baseline net worth boxes (show only Proposed)
- `first_time`: No "Current Plan" exists, so baseline = Engine recommendation
- `no_match`/`no_hsa`: Baseline has 0 for those categories

## 10. Identified Gaps

### 10.1 Data Flow Gaps

**Gap 1: Net Worth Impact Not Reaching Prompt**
- **Symptom**: AI doesn't mention 20-year impact
- **Root Cause**: `netWorthImpact20Y` may not be in `userPlanData` when prompt is built
- **Fix Applied**: Added to `userStateJson`, but need to verify it's accessible as `userPlanData.netWorthImpact20Y`

**Gap 2: Baseline Net Worth Missing "20 Years"**
- **Symptom**: Wrong baseline 20-year value
- **Root Cause**: `baselinePlanData` doesn't include "20 Years" in projection
- **Fix Applied**: `ribbitProposalPlanData` now always recalculates to include "20 Years"

**Gap 3: Number Formatting Not Applied**
- **Symptom**: `$828.4000000000001` in chat
- **Root Cause**: `roundDollarAmountsInText()` regex only matched 1-2 decimals
- **Fix Applied**: Updated regex to `(\.\d+)?` to match any decimals

### 10.2 State Management Gaps

**Gap 4: Multiple Sources of Truth**
- **Issue**: Baseline net worth calculated in multiple places
- **Impact**: Inconsistency, wrong values
- **Recommendation**: Single `useMemo` for baseline 20-year net worth

**Gap 5: Override State Not Persisted**
- **Issue**: `overrides` and `pretaxOverrides` are local state
- **Impact**: Lost on page refresh
- **Recommendation**: Consider persisting to URL params or store

### 10.3 Prompt Gaps

**Gap 6: Rule Not Strong Enough**
- **Issue**: "MANDATORY" language may not be enough
- **Impact**: AI still not following rule
- **Recommendation**: Add explicit example in prompt, make it first rule

**Gap 7: Data Validation Missing**
- **Issue**: No validation that `netWorthImpact20Y` exists before using
- **Impact**: Silent failures
- **Recommendation**: Add validation and fallback logic

## 11. Recommendations

### 11.1 Immediate Fixes (Priority 1)

1. **Verify Data Flow**
   - Add console.log to verify `netWorthImpact20Y` is in `userPlanData` when prompt is built
   - Add console.log to verify prompt includes the net worth impact section
   - Test with actual API call to see what AI receives

2. **Strengthen Prompt**
   - Move net worth impact rule to TOP of prompt (first rule)
   - Add explicit example: "Example: 'This change would **reduce** your net worth by **$5,728,267** in 20 years (from $17,712,547 to $11,984,280).'"
   - Add validation: "If netWorthImpact20Y is provided, you MUST use it. If you don't mention it, you're violating a cardinal rule."

3. **Fix Number Formatting**
   - Test `roundDollarAmountsInText()` with actual AI output
   - Add unit tests for regex matching
   - Consider formatting numbers BEFORE sending to AI (in the prompt itself)

### 11.2 Architectural Improvements (Priority 2)

1. **Create `useNetWorthImpact()` Hook**
   ```typescript
   const netWorthImpact = useNetWorthImpact({
     baselinePlan: ribbitProposalPlanData,
     proposedPlan: scenarioPlanData,
   });
   // Returns: { ribbit20Y, proposed20Y, deltaAt20Y } | null
   ```

2. **Single Source of Truth for Baseline**
   - Create `baselineNetWorth20Y` computed value
   - Use everywhere instead of recalculating
   - Store in `useMemo` with correct dependencies

3. **Standardize Number Formatting**
   - Create `formatCurrency(value: number): string` utility
   - Use everywhere (chat, UI, prompts)
   - Ensures consistency

4. **Add Data Validation**
   - Validate `netWorthImpact20Y` exists before building prompt
   - Log warnings if missing
   - Fallback to calculating from plans if missing

### 11.3 Testing Strategy (Priority 3)

**For Each Mode:**
1. Test baseline net worth includes "20 Years"
2. Test proposed net worth includes "20 Years"
3. Test delta calculation is correct
4. Test chat mentions net worth impact
5. Test numbers are formatted correctly
6. Test net worth boxes show delta

**Test Cases:**
- Reduce 401K to $300 → Should show ~$5.7M reduction
- Increase emergency fund → Should show impact
- Move funds between buckets → Should show impact
- All modes (first_time, my_data, no_match, no_hsa)

## 12. Next Steps

1. **Immediate**: Verify fixes work with actual user flow
2. **Short-term**: Add validation and logging
3. **Medium-term**: Refactor into hooks/utilities
4. **Long-term**: Add comprehensive tests

## 13. Code Locations Reference

**State Management:**
- `page.tsx:89` - `baselineState = useOnboardingStore()`
- `page.tsx:91` - `baselinePlanData = usePlanData()`
- `page.tsx:108` - `overrides` state
- `page.tsx:110` - `pretaxOverrides` state

**Plan Computation:**
- `page.tsx:849` - `engineRunResult` (engine allocation)
- `page.tsx:937` - `engineAllocationForScenario`
- `page.tsx:1011` - `allocationForScenario` (engine + overrides)
- `page.tsx:1355` - `scenarioPlanData` (net worth simulation)
- `page.tsx:1533` - `ribbitProposalPlanData` (baseline net worth)

**Net Worth Impact:**
- `page.tsx:1996` - `netWorthImpact20Y` calculation
- `page.tsx:1988` - Passed to `userStateForChat`

**Chat Integration:**
- `SavingsChatPanel.tsx:728` - `userPlanData` construction
- `route.ts:1799` - `userStateJson` construction
- `route.ts:1973` - Prompt net worth impact section
- `route.ts:347` - `roundDollarAmountsInText()` function
- `route.ts:433` - Applied to streaming chunks
