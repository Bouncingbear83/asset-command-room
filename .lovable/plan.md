

## Fixes for Returns Tab

### 1. AUM comma formatting
`fmtGbp` currently does `£${(v / 1000).toFixed(0)}k` — no comma for large numbers. Replace with `toLocaleString()` to get proper comma-separated formatting (e.g., "£312,450").

### 2. Top TWR boxes — add time context
The 3 cumulative TWR cards are "since inception" but don't say so. Add "Since Inception" subtitle text. Alternatively, add a small dropdown to switch between time horizons (QTR, 1Y, 3Y, All), pulling values from the period returns calculation already in place.

**Proposed**: Add "Since Inception" label below each TWR value for now, keeping it simple.

### 3. Performance History table — collapsible, moved to bottom
- Move the Performance History table section **below** the Winners/Losers/Movers grid (currently it sits above it)
- Make it collapsible using a `useState` toggle, defaulting to collapsed
- When expanded, show only the first 5 rows initially with a "Show all" button to reveal the rest

### 4. Period Returns not working — date parsing bug
**Root cause**: Google Sheets gviz API returns date-type cell values as `"Date(2024,0,15)"` strings. `new Date("Date(2024,0,15)")` returns `Invalid Date`, so every date comparison in `computePeriodReturns` produces `NaN`, causing all periods to either match the wrong row or fail the data-range check.

**Fix in `usePortfolioData.ts`**: Add a `parseSheetDate(val)` helper that handles the `Date(y,m,d)` format:
```ts
function parseSheetDate(val: any): string {
  if (typeof val === "string") {
    const m = val.match(/^Date\((\d+),(\d+),(\d+)\)$/);
    if (m) return `${m[1]}-${String(+m[2]+1).padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  }
  return String(val ?? "");
}
```
Use this in `parsePerformance` for the `date` field so dates become ISO-like strings (`"2024-01-15"`) that `new Date()` can parse correctly.

**Fix in `ReturnsTab.tsx`**: Also add a safety check — if `new Date(latest.date)` is invalid, skip period returns gracefully.

### Files changed

| File | Changes |
|---|---|
| `src/hooks/usePortfolioData.ts` | Add `parseSheetDate` helper, use it in `parsePerformance` date field |
| `src/components/ReturnsTab.tsx` | (1) Format AUM with commas, (2) add "Since Inception" to TWR cards, (3) move history table below movers grid + make collapsible with 5-row default, (4) guard period returns against invalid dates |

