# Feed Page Testing & Verification Guide

## Quick Test Checklist

### ✅ User View Testing
1. Navigate to `/app/feed`
2. Click "User View" tab
3. **Verify**:
   - [ ] Dropdown label shows "Data Source"
   - [ ] Dropdown is disabled showing "My data" with helper text
   - [ ] Helper text reads: "Debug scenarios available in Debug View"
   - [ ] Leap cards show clean, user-friendly titles (e.g., "Build your emergency fund")
   - [ ] No debug fields visible (no score, reasonCode, payload)
   - [ ] Benefit preview shows formatted values (e.g., "Free money: ~$200/mo")

### ✅ Debug View Testing
1. Click "Debug View" tab
2. **Verify**:
   - [ ] Dropdown label shows "Debug Scenario"
   - [ ] Dropdown is enabled with grouped options
   - [ ] Groups visible: "Income Debug", "Savings/Allocator Debug", "Trigger Debug", "Compound Debug"
   - [ ] Each scenario has "Debug:" prefix
   - [ ] Leap cards show collapsible debug section
   - [ ] Debug section includes: leapType, priorityScore, reasonCode, dedupeKey, payload

### ✅ Scenario Testing

#### Test 1: EF Suppression (CRITICAL)
**Scenario: "Debug: EF On Track (suppressed)"**
- State: emergencyFundMonths: 3.5, target: 6, savingsPercent: 20%
- **Expected**: NO `EMERGENCY_FUND_GAP` leap should appear
- **Reason**: EF is "on track" (>50% complete with good savings plan)

**Scenario: "Debug: EF Gap"**
- State: emergencyFundMonths: 1, target: 6, savingsPercent: 10%
- **Expected**: `EMERGENCY_FUND_GAP` leap SHOULD appear
- **Reason**: EF is below target and not on track

#### Test 2: Priority Order
**Scenario: "Debug: Many issues"**
- **Expected Leap Order**:
  1. `MISSING_EMPLOYER_MATCH` (priority 100)
  2. `CASH_RISK_DETECTED` (priority 95)
  3. `EMERGENCY_FUND_GAP` (priority 90)
  4. `HIGH_APR_DEBT_PRIORITY` (priority 80)
  5. `HSA_OPPORTUNITY` (priority 70)
  6. Lower priority income/paycheck leaps

#### Test 3: New Income Triggers
**Scenario: "Debug: First Time (income)"**
- State: takeHomePayMonthly > 0, savingsPercent: 0
- **Expected**: `FIRST_INCOME_PLAN_NEEDED` leap appears
- **Title**: "Set your first income plan"
- **Subtitle**: "Let's calibrate how your paycheck should work for you."

**Scenario: "Debug: On Track (income)"**
- State: savingsPercent: 20%, with lastPaycheckISO
- **Expected**: `MONTH_CLOSED_REVIEW_INCOME_PLAN` leap appears
- **Title**: "Review last month"

#### Test 4: Benefit Preview Format
**Scenario: "Debug: Missing Match"**
- State: employerMatchGapMonthly: 200
- **Expected Benefit Preview**:
  - Label: "Free money"
  - Value: "~$200/mo"

**Scenario: "Debug: EF Gap"**
- State: emergencyFundMonths: 1, emergencyFundTargetMonths: 6
- **Expected Benefit Preview**:
  - Label: "Runway"
  - Value: "1 → 6 months"

**Scenario: "Debug: High APR Debt"**
- State: highAprDebtApr: 24
- **Expected Benefit Preview**:
  - Label: "APR"
  - Value: "24%"

**Scenario: "Debug: Surplus Cash"**
- State: cashBalance: 8000, safetyBufferTarget: 2000
- **Expected Benefit Preview**:
  - Label: "Available"
  - Value: "~$6,000"

### ✅ Visual Inspection

#### User View Card (Example)
```
┌─────────────────────────────────────────┐
│ Build your emergency fund               │
│ You're at 1 months — target is 6.      │
│                                         │
│ Runway: 1 → 6 months                    │
│                                         │
│ [Start savings plan] [Why this?]        │
│ [Not now]                               │
│                                         │
│ Tool: Savings                           │
└─────────────────────────────────────────┘
```

#### Debug View Card (Example)
```
┌─────────────────────────────────────────┐
│ Build your emergency fund               │
│ You're at 1 months — target is 6.      │
│                                         │
│ Runway: 1 → 6 months                    │
│                                         │
│ [Start savings plan] [Why this?]        │
│ [Not now] [Mark Completed]              │
│                                         │
│ Tool: Savings                           │
│ ─────────────────────────────────────── │
│ ▼ Details                               │
│   leapType: EMERGENCY_FUND_GAP          │
│   priorityScore: 90                     │
│   reasonCode: EF_GAP                    │
│   dedupeKey: leap:EMERGENCY_FUND_GAP    │
│   {                                     │
│     "emergencyFundMonths": 1,           │
│     "emergencyFundTargetMonths": 6,     │
│     "efProgress": 0.1667                │
│   }                                     │
└─────────────────────────────────────────┘
```

## Common Issues & Solutions

### Issue: EF leap still showing when on track
**Check**: Is `savingsPercent >= 15` AND `efProgress >= 0.5` in the scenario?
**Fix**: Adjust scenario state or review `isEFOnTrack()` function

### Issue: Wrong priority order
**Check**: Verify PRIORITY map values in `generateLeaps.ts`
**Expected**: match (100) > cash risk (95) > EF (90) > debt (80) > HSA (70) > income (60-50) > surplus (40)

### Issue: Debug fields showing in User View
**Check**: LeapCard component `isUserView` flag
**Fix**: Ensure debug section is wrapped in `{!isUserView && (...)}`

### Issue: Scenario dropdown not grouped in Debug View
**Check**: Are `<optgroup>` tags present?
**Fix**: Verify page.tsx has proper optgroup structure

## Performance Notes
- All leap generation is synchronous and runs on every state change
- Typical execution: <10ms for 8-10 candidate leaps
- No network calls during leap generation

## Next Steps
After verification:
1. Test with real user data (scenario: "My data")
2. Verify tool routing (click primary CTA → opens correct tool)
3. Test Sidekick integration (click "Open Sidekick" → opens with leap context)
4. Add analytics tracking for leap impressions/clicks
