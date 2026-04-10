

## Fix: Chart time range buttons not rendering, data truncation, add year-end lines

### What's wrong

1. **Toggle buttons invisible**: The buttons exist in code but the header row uses `display: flex` with `gap: 12` and `marginLeft: auto` — on narrow expanded rows the buttons may overflow or get clipped. The screenshot confirms they're absent from the visible area.

2. **Data ending in 2025**: Despite `.limit(5000)` being in the code, the chart shows `2024-02-27 → 2025-03-28`. This is exactly ~252 trading days — meaning the `1Y` default IS working, but the date range label shows 2025 not 2026. The actual issue is likely that the `useTickerHistory` cached stale data from before the limit fix was deployed, or the component is receiving the wrong points. Need to add a console log or verify the data is actually arriving with 2026 dates.

3. **No year-end vertical lines**: The chart currently shows year labels at the x-axis where each new year starts. Adding subtle vertical lines at Dec 31 / Jan 1 boundaries would improve readability.

### Changes

**`src/components/PriceChart.tsx`**
- Move the range toggle buttons to their own row below the header label, with larger font (10px) and more padding so they're unmissable
- Add vertical dashed lines at year-end boundaries (where year changes in the data) — subtle `rgba(140,140,170,0.15)` stroke
- Add `console.log` of the full points array length and last date on render (temporary debug) to verify data completeness

**`src/hooks/useTickerHistory.ts`**
- Add a `console.log` after fetch showing `ticker`, `data.length`, and last row's `snapshot_date` — to confirm 2026 data is arriving from the database

### Visual result
- Clear row of 5 toggle buttons: `[1W] [1M] [1Y] [5Y] [MAX]` — visible and clickable
- Thin vertical dashed lines at each Dec→Jan transition
- Year labels positioned at those same boundaries

