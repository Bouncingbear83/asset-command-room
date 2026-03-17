

## Problem: Performance data not loading + Add chart

### Bug: `fetchSheet` filter drops all performance rows

The generic row filter in `fetchSheet` (line 67-81) requires either a `row_type` column or a column named `ticker`/`name`/`type`. The Performance sheet has neither — its columns are `date`, `sipp_mv`, `total_value`, etc. So every row gets filtered out, resulting in an empty `performance[]` array and "—" in all summary cards.

**Fix in `usePortfolioData.ts`**: Add `"date"` to the identifier check in the `fetchSheet` filter (line 78), so rows with a valid `date` column also pass:
```ts
return (kl.includes("ticker") || kl === "name" || kl === "type" || kl === "date") && ...
```

### Feature: Cumulative TWR line chart

Add a line chart above the performance history table using `recharts` (already installed). The chart will show:
- **3 lines**: Total TWR, SIPP TWR, ISA TWR (cumulative)
- **X-axis**: Date (oldest to newest)
- **Y-axis**: Cumulative TWR %
- **Styling**: Dark theme matching existing panel aesthetic — dark background, gold for total line, accent colors for SIPP/ISA, grid lines using `var(--rim)`

**File**: `ReturnsTab.tsx` — import `LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer` from recharts. Sort performance by date ascending for the chart data. Render inside a card panel above the history table.

### Summary

| File | Change |
|---|---|
| `usePortfolioData.ts` | Add `"date"` to fetchSheet identifier check (1 line) |
| `ReturnsTab.tsx` | Add recharts cumulative TWR line chart above performance table |

