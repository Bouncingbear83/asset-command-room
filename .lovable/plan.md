

## Plan: Fix Returns AUM, show scores in Holdings, fix sparklines, add chart time ranges

### Issue 1 — Returns tab AUM excludes cash

The Returns tab calculates AUM as `sipp.reduce(mv) + isa.reduce(mv)` — pure holdings market value. But the PERFORMANCE sheet already has `cashSipp`, `cashIsa`, `totalSipp`, `totalIsa`, `totalValue` columns that are parsed into `LivePerformance`. The hero cards should use the latest performance row's `totalSipp` / `totalIsa` / `totalValue` (which include cash), or fall back to holdings MV + cash from the CASH sheet.

**Fix in `ReturnsTab.tsx`:**
- Pass `cashSipp` and `cashIsa` as props (already available from `usePortfolioData`)
- Add cash to `sippTotal`, `isaTotal`, `total` in the hero cards
- Alternatively, use the latest PERFORMANCE row's `totalSipp`/`totalIsa`/`totalValue` directly, which already include cash

### Issue 2 — Holdings expanded row missing wider scores

Currently, the expanded row shows `ThesisCard` (DB rationale) and `DisruptionPanel` (Sheet disruption), but NOT the numeric score breakdown (Total, Substrate, Demand, Moat, Valuation, Mgmt, Disruption). The `scores` prop is passed to `HoldingsTab` but never used in the expanded view.

**Fix in `HoldingsTab.tsx`:**
- Accept and pass `scores` data into `TriggerRows`
- Find the matching `LiveScore` for the ticker
- Add a compact score card showing all 7 dimensions with their numeric values and color coding
- Place it below the ThesisCard and above the price chart
- Style: horizontal bar or compact grid matching the existing dim/accent aesthetic

### Issue 3 — Sparklines showing exaggerated movements

The sparkline for ASML shows a dramatic crash because the Y-axis auto-scales to `min/max` of the 30-day window. A 7% dip (1125→963→1020) fills the entire vertical range, making it look catastrophic. The `priceGbp` values also appear to have a large drop on one day that dominates the visual.

**Fix in `Sparkline.tsx`:**
- Add padding to the Y-axis range: extend min/max by ~10-15% of the range so small movements don't fill the entire chart
- Alternatively, floor the range to at least 10% of the mean price, so a 3-5% move appears proportional rather than extreme
- This preserves readability for genuinely volatile stocks while taming flat-ish ones

### Issue 4 — Price chart time range selector

The PriceChart currently shows the full history (max). Add a selector for: 1W, 1M, 1Y, 5Y, MAX.

**Fix in `PriceChart.tsx`:**
- Add a row of toggle buttons: `1W | 1M | 1Y | 5Y | MAX`
- Default to `1Y` (most useful view)
- Filter `points` array based on selected range before rendering
- 1W = last 5 trading days, 1M = last 22 trading days, 1Y = last ~252 trading days, 5Y = last ~1260 days, MAX = all
- Use the same `ToggleButton` style as elsewhere (mono font, accent when active)
- MA overlays adjust naturally since they compute from filtered data

### Files to modify

| File | Change |
|------|--------|
| `src/components/ReturnsTab.tsx` | Add `cashSipp`/`cashIsa` to AUM calculations in hero cards |
| `src/pages/Index.tsx` | Pass cash values as props to ReturnsTab |
| `src/components/HoldingsTab.tsx` | Add score breakdown card to expanded row using `scores` prop |
| `src/components/Sparkline.tsx` | Add Y-axis padding to prevent exaggerated movement visuals |
| `src/components/PriceChart.tsx` | Add time range selector (1W/1M/1Y/5Y/MAX) |

No database changes required. No new files needed.

