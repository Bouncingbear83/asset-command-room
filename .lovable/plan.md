

## Issues Found

### 1. Disruption warning showing on all tickers
The disruption score max is **15** (not 100), but the warning condition on line 183 still checks `s.disruption < 50`. Since live scores on a /15 scale will always be below 50, every ticker triggers the ⚠ warning. The same problem affects the color logic on line 200 which uses thresholds of 70 and 50 — impossible to reach on a /15 scale.

**Fix:** Adjust all disruption thresholds to the /15 scale:
- Green: ≥ 11 (≈70% of 15)
- Amber: 8–10 (≈50-69%)
- Red / ⚠ warning: < 8 (≈50%)

Also update the static fallback data (lines 41-43) to use /15-scale values (e.g. 13, 11, 14 instead of 85, 72, 90).

### 2. Tier labels wrong
`getTier()` returns CORE / HOLD / MONITOR / EXIT. User wants **Core, Satellite, Spec, Anchor**.

**Fix:** Update `getTier` and `TIER_STYLE` to use:
- **Core** (≥80)
- **Anchor** (60–79)
- **Satellite** (40–59)
- **Spec** (<40)

Update the summary row labels and threshold legend accordingly.

### Files to edit
- `src/components/ScoresTab.tsx` — both fixes above

