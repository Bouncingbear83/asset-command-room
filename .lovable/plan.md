

## Fix: Cumulative TWR values break when they exceed 100%

### Root cause

The Google Sheets API returns percentage-formatted cells as decimal fractions. A cell showing `129.4%` arrives as `1.294`. The `parsePercentLike` heuristic multiplies by 100 only when `abs(val) <= 1`, so:

- `0.737` (73.7%) → correctly scaled to `73.7` ✓
- `1.04` (104.0%) → left as `1.04`, displayed as `+1.0%` ✗
- `1.294` (129.4%) → left as `1.294`, displayed as `+1.3%` ✗

This is why it "goes wrong at 2025-06-30" — that's the row where ISA TWR first crosses 100% (fraction > 1.0).

Sub-period returns stay well under 100% in absolute terms so `parsePercentLike` works for those. The problem is isolated to the three cumulative TWR fields.

### Fix

In `parsePerformance` within `usePortfolioData.ts`, change the three cumulative TWR lines from `parsePercentLike(...)` to a direct `parseRawFraction(...)` that always multiplies by 100:

```
cumulativeTwrSipp:  alwaysScaleFraction(val)   // 1.294 → 129.4
cumulativeTwrIsa:   alwaysScaleFraction(val)   // 1.04  → 104.0
cumulativeTwrTotal: alwaysScaleFraction(val)   // 0.737 → 73.7
```

Add a small helper (or inline): parse the raw number and unconditionally `* 100`, since the API always delivers these as fractions regardless of magnitude.

Sub-period return fields stay on `parsePercentLike` — they never exceed ±100% so the heuristic is safe there.

### Validation

After fix, the Performance History table's "Cumul. TWR" column should match the sheet exactly:
- Row 2026-03-20: +140.6% (not +1.4%)
- Row 2025-06-30: +88.5% (not +0.9%)
- Row 2022-06-30: +84.6% (not +0.8%)

Period Returns (TWR) will also compute correctly since `calcReturn` uses these cumulative values.

### Files

- `src/hooks/usePortfolioData.ts` — add fraction parser, update 3 cumulative TWR fields in `parsePerformance`

