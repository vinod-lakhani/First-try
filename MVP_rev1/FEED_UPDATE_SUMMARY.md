# Feed Page Update Summary

## Overview
Updated the FEED page implementation to align with the "Feed Logic — Next Leaps, Triggers, Actions, Debug" spec.

## Changes Made

### 1. Updated Leap Data Model (`lib/feed/leapTypes.ts`)
- Added new normalized Leap structure with:
  - `id`, `title`, `subtitle`, `tool`
  - `benefitPreview` (user-facing benefit fields)
  - `primaryCta` and `secondaryCtas` (action types: OPEN_TOOL, OPEN_SIDEKICK, APPLY)
  - `debug` object (score, reasonCode, payload, dedupeKey)
- Maintained backward compatibility with legacy fields
- Added new LeapType values for income lifecycle:
  - `FIRST_INCOME_PLAN_NEEDED`
  - `MONTH_CLOSED_REVIEW_INCOME_PLAN`
  - `INCOME_DRIFT_DETECTED`
- Added canonical savings stack types:
  - `MISSING_EMPLOYER_MATCH`
  - `EMERGENCY_FUND_GAP`
  - `HSA_OPPORTUNITY`
  - `HIGH_APR_DEBT_PRIORITY`
  - `SURPLUS_CASH_AVAILABLE`

### 2. Updated Trigger Logic (`lib/feed/generateLeaps.ts`)
- **New Priority Order**: missing match > EF/cash risk > high APR debt > HSA > income review/drift > surplus sweeper
- **New Triggers Implemented**:
  1. `FIRST_INCOME_PLAN_NEEDED`: has actuals AND no income plan exists
  2. `MONTH_CLOSED_REVIEW_INCOME_PLAN`: month boundary AND last month closed
  3. `INCOME_DRIFT_DETECTED`: abs(actual - planned) > driftThreshold
  4. `MISSING_EMPLOYER_MATCH`: match available AND not met
  5. `EMERGENCY_FUND_GAP`: EF < target (with suppression logic)
  6. `HSA_OPPORTUNITY`: eligible AND not contributing
  7. `HIGH_APR_DEBT_PRIORITY`: APR >= threshold
  8. `CASH_RISK_DETECTED`: cash < safety buffer
  9. `SURPLUS_CASH_AVAILABLE`: EF met AND surplus above threshold

- **Suppression Logic**:
  - EF Gap is suppressed if:
    - EF months >= target, OR
    - Current savings plan trajectory will meet EF target (heuristic: savings >= 15% AND EF >= 50% of target)

### 3. Updated Scenarios (`lib/feed/scenarios.ts`)
- Renamed scenarios with "Debug:" prefix
- Grouped scenarios:
  - **Income Debug**: First Time, On Track, Oversaved, Undersaved
  - **Savings/Allocator Debug**: Savings Increase, Savings Decrease
  - **Trigger Debug**: New Paycheck, Missing Match, HSA Eligible, EF Gap, EF On Track (suppressed), High APR Debt, Cash Risk, Surplus Cash
  - **Compound Debug**: Many issues, Unimplemented follow-up
- Added new scenario: "Debug: EF On Track (suppressed)" to test suppression

### 4. Updated Feed Page UI (`app/app/feed/page.tsx`)
- **User View**:
  - Dropdown label: "Data Source"
  - Shows disabled "My data" with message: "Debug scenarios available in Debug View"
  - Debug fields never shown in cards
- **Debug View**:
  - Dropdown label: "Debug Scenario"
  - Full dropdown with grouped scenarios (using `<optgroup>`)
  - Shows debug fields (score, reasonCode, payload, dedupeKey) in collapsible section

### 5. Updated LeapCard Component (`components/feed/LeapCard.tsx`)
- Uses new normalized Leap structure (title, subtitle, primaryCta, debug)
- Fallbacks to leapCopyMap if new fields not populated
- Debug section only visible in Debug View
- Never shows internal reason codes or payload in User View

### 6. Updated Copy Map (`lib/feed/leapCopyMap.ts`)
- Added user-friendly titles/subtitles for new leap types:
  - "Set your first income plan"
  - "Review last month"
  - "Adjust your income plan"
  - "Grab your free employer match"
  - "Build your emergency fund"
  - "Maximize your HSA"
  - "Pay down high-interest debt faster"
  - "Put extra cash to work"
  - "Heads up: cash could get tight"

### 7. Updated Benefit Preview Rules (`lib/feed/previewMetrics.ts`)
- **Match**: "Free money: ~$X/mo"
- **EF**: "Runway: A → B months" (changed from "Status: X months (goal Y)")
- **Debt**: "APR: XX%"
- **Sweeper**: "Available: ~$X" (changed from "Status: ~$X available")
- Added preview metrics for new leap types

### 8. Updated Formatters (`lib/feed/formatters.ts`)
- Added fallback logic for new leap types in `deriveImpactLine()`
- Updated priority threshold: >= 90 for High, >= 60 for Medium

## Testing
To verify the implementation:

1. **User View**: 
   - Switch to "User View"
   - Confirm dropdown shows "My data" and is disabled with hint text
   - Confirm leap cards show user-friendly text, no debug fields

2. **Debug View**:
   - Switch to "Debug View"
   - Confirm dropdown shows grouped scenarios
   - Select "Debug: EF Gap" → should show EF leap
   - Select "Debug: EF On Track (suppressed)" → should NOT show EF leap (suppressed)
   - Confirm debug section shows score, reasonCode, payload

3. **Suppression**:
   - Verify "EF On Track" scenario does NOT generate EMERGENCY_FUND_GAP leap
   - Verify "EF Gap" scenario DOES generate EMERGENCY_FUND_GAP leap

4. **Priority Order**:
   - Select "Debug: Many issues"
   - Verify top leap is MISSING_EMPLOYER_MATCH (priority 100)
   - Verify order: match → cash risk → EF → debt → HSA → income → surplus

## Files Modified
1. `lib/feed/leapTypes.ts` - New data model
2. `lib/feed/generateLeaps.ts` - Triggers + suppression
3. `lib/feed/scenarios.ts` - Debug scenario structure
4. `lib/feed/leapCopyMap.ts` - User-friendly copy
5. `lib/feed/previewMetrics.ts` - Benefit preview rules
6. `lib/feed/formatters.ts` - Formatting helpers
7. `app/app/feed/page.tsx` - UI changes
8. `components/feed/LeapCard.tsx` - Card rendering

## Backward Compatibility
All legacy leap types are preserved and work alongside new types. The normalized structure includes legacy fields for smooth migration.
