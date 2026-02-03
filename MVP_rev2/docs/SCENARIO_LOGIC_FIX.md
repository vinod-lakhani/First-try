# Scenario Logic Fix Summary

## Key Principle

**Scenario Distinction:**
- **`first_time` mode**: Baseline = Ribbit Proposal (engine recommendation), Proposed = user modifications
- **`my_data` mode**: Baseline = Current Plan (saved plan from store), Proposed = user modifications
- **NO "Ribbit Proposal" in `my_data` mode** - only Current vs Proposed

## Changes Made

### 1. `ribbitProposalPlanData` - Only for `first_time`
- **Before**: Calculated for both scenarios
- **After**: Only calculated when `allocatorScenario === 'first_time'`
- **In `my_data`**: Returns `null` immediately

### 2. `netWorthImpact20Y` - Uses correct baseline per scenario
- **`my_data` mode**: Uses `baselinePlanData` (Current Plan) as baseline
  - If missing "20 Years", recalculates from `netWorthScenarioInput`
- **`first_time` mode**: Uses `ribbitProposalPlanData` (Ribbit Proposal) as baseline

### 3. Net Worth Boxes - Uses correct baseline per scenario
- **`my_data` mode**: Shows "Current Plan" vs "Proposed"
  - Baseline from `baselinePlanData` (Current Plan)
  - Recalculates "20 Years" from `netWorthScenarioInput` if needed
- **`first_time` mode**: Shows "Ribbit Proposal" vs "Proposed"
  - Baseline from `ribbitProposalPlanData` (Ribbit Proposal)

### 4. `allocationComparison` - Already correct
- **`my_data` mode**: Uses `effectiveCurrentPlan` (saved plan) as baseline
- **`first_time` mode**: Uses `engineSnapshot` (engine recommendation) as baseline

## Remaining Issue

**Emergency fund showing $1,599.99 instead of $200:**
- `baselinePlanData` is not using `customSavingsAllocation` correctly
- `buildFinalPlanData` should use `customSavingsAllocation.ef$ = $200`
- But logs show `ef$: 1599.99` which is the engine recommendation

**Root Cause**: `baselinePlanData` is being built without `customSavingsAllocation`, or `customSavingsAllocation` is not in the store when `buildFinalPlanData` runs.

**Fix Applied**: Added explicit subscription to `customSavingsAllocation` in `usePlanData` hook to ensure recalculation when it changes.

## Testing Checklist

For `my_data` scenario:
1. ✅ Baseline should be Current Plan (saved plan with $200 EF)
2. ✅ Proposed should be user modifications
3. ✅ Net worth impact should compare Current Plan vs Proposed
4. ✅ Net worth boxes should show "Current Plan" vs "Proposed"
5. ⏳ `baselinePlanData` should reflect `customSavingsAllocation` ($200 EF)

For `first_time` scenario:
1. ✅ Baseline should be Ribbit Proposal (engine recommendation)
2. ✅ Proposed should be user modifications
3. ✅ Net worth impact should compare Ribbit Proposal vs Proposed
4. ✅ Net worth boxes should show "Ribbit Proposal" vs "Proposed"
