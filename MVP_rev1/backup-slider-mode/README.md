# Backup: Savings Allocator Slider Mode

This folder contains a backup of the **original slider-based** Adjust plan details UI (before Manual Mode with +/- steppers).

**To restore the slider mode** (in case you need to revert):

```bash
# From MVP_rev1 root
cp backup-slider-mode/page.tsx app/app/tools/savings-allocator/page.tsx
cp backup-slider-mode/allocatorState.ts lib/tools/savings/allocatorState.ts
cp backup-slider-mode/SavingsChatPanel.tsx components/tools/SavingsChatPanel.tsx
```

**Files:**
- `page.tsx` — main savings allocator page (sliders, Pre-Tax panel, Summary)
- `allocatorState.ts` — state model (SavingsOverrides, applyOverridesAndRebalance)
- `SavingsChatPanel.tsx` — chat panel with delta table

**Date backed up:** 2026-01-30
