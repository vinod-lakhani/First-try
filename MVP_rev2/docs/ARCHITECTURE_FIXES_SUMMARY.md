# Architecture Fixes Summary

## Critical Bug Found and Fixed

**Issue**: Net worth impact section in prompt was INSIDE conditional check for `toolOutput.explain`
- **Impact**: If `toolOutput.explain` didn't exist, AI never saw net worth impact instructions
- **Fix**: Moved net worth impact section OUTSIDE the conditional so it's always shown
- **Location**: `route.ts` lines 1981-2004

## Architecture Review Findings

### 1. State Management Flow ✅

**Source of Truth Hierarchy:**
```
baselineState (Zustand store)
  ↓
baselinePlanData (usePlanData)
  ↓
engineAllocationForScenario (runSavingsAllocation)
  ↓
ribbitProposalPlanData (frozen baseline with "20 Years") ✅ FIXED
  ↓
allocationForScenario (engine + overrides)
  ↓
scenarioPlanData (proposed plan with "20 Years")
```

**Key Fix**: `ribbitProposalPlanData` now ALWAYS recalculates from `engineAllocationForScenario` to ensure it includes "20 Years" projection.

### 2. Data Flow: Chat → Plan Update ✅

**Flow:**
1. User types message → `SavingsChatPanel.handleSend()`
2. API receives `userPlanData` with `netWorthImpact20Y` ✅
3. Prompt includes net worth impact section ✅ (NOW ALWAYS SHOWN)
4. AI responds with `PLAN_CHANGES` JSON
5. `applyPlanChangesFromChat()` updates `overrides`/`pretaxOverrides`
6. `scenarioPlanData` recalculates
7. Net worth impact recalculates
8. UI updates

### 3. Prompt Architecture ✅

**Structure:**
- USER_STATE includes `netWorthImpact20Y` ✅
- Net worth impact section ALWAYS shown (moved outside conditional) ✅
- Explicit format provided: "This change would **reduce** your net worth by **$X** in 20 years" ✅
- Cardinal rule emphasized with "MANDATORY - NON-NEGOTIABLE" ✅

### 4. Number Formatting ✅

**Fix Applied:**
- Updated regex in `roundDollarAmountsInText()` to match any number of decimals: `(\.\d+)?`
- Applied to both main response (line 250) and streaming chunks (line 351)
- Format: `$828` not `$828.4000000000001`

### 5. Net Worth Boxes Display ✅

**Fix Applied:**
- Uses `ribbitProposalPlanData.netWorthProjection` for baseline "20 Years" value
- Calculates delta correctly: `proposed20Y - ribbit20Y`
- Shows delta with `font-semibold` styling

## Remaining Issues to Verify

### Issue 1: Net Worth Impact Not Mentioned in Chat
**Status**: Should be fixed now
**Verification Needed**: Test with actual user flow
**Why it should work now**:
- `netWorthImpact20Y` is in `userStateJson` ✅
- Net worth impact section is ALWAYS shown in prompt ✅
- Explicit format provided ✅
- Cardinal rule emphasized ✅

### Issue 2: Number Formatting Still Wrong
**Status**: Should be fixed now
**Verification Needed**: Test with actual AI response
**Why it should work now**:
- Regex updated to match many decimals ✅
- Applied to both full response and streaming chunks ✅

### Issue 3: Net Worth Boxes Not Showing Delta
**Status**: Should be fixed now
**Verification Needed**: Test UI display
**Why it should work now**:
- Uses correct baseline source (`ribbitProposalPlanData`) ✅
- Calculates delta correctly ✅

## Testing Checklist

For each mode (`first_time`, `my_data`, `no_match`, `no_hsa`):

1. ✅ Baseline net worth includes "20 Years"
2. ✅ Proposed net worth includes "20 Years"
3. ✅ Delta calculation is correct
4. ⏳ Chat mentions net worth impact (needs testing)
5. ⏳ Numbers are formatted correctly (needs testing)
6. ⏳ Net worth boxes show delta (needs testing)

## Next Steps

1. **Test the fixes** with actual user flow
2. **Monitor logs** to verify:
   - `netWorthImpact20Y` is calculated correctly
   - `netWorthImpact20Y` is in `userPlanData` when prompt is built
   - Prompt includes net worth impact section
   - AI receives and uses the data

3. **If issues persist**, check:
   - Are `ribbitProposalPlanData` and `scenarioPlanData` both recalculating correctly?
   - Is `netWorthImpact20Y` calculation returning valid values?
   - Is the prompt actually being sent to the AI with the net worth section?

## Code Changes Summary

1. **`route.ts`**: Moved net worth impact section outside conditional (lines 1981-2004)
2. **`route.ts`**: Enhanced USER_STATE section to show net worth values explicitly (lines 1970-1976)
3. **`route.ts`**: Fixed number formatting regex (lines 250, 351)
4. **`page.tsx`**: `ribbitProposalPlanData` always recalculates (line 1533)
5. **`page.tsx`**: Net worth boxes use correct baseline source (line 2117)
6. **`SavingsChatPanel.tsx`**: Number formatting in reallocation labels (lines 619, 624, 629)
