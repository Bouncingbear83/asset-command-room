

## Add Period Returns Grid to Returns Tab

### Approach

Compute period returns (Current QTR, Previous QTR, 6M, 1Y, 3Y, 5Y) from the `performance[]` data by finding the nearest row to each lookback date and calculating TWR over each window using the formula: `(1 + end_twr) / (1 + start_twr) - 1`.

### Changes: `src/components/ReturnsTab.tsx`

**New helper function** `computePeriodReturns(sortedPerf: LivePerformance[])`:
- Takes performance sorted newest-first
- Defines 6 periods with target lookback dates from `latest.date`:
  - Current QTR: start of current calendar quarter
  - Previous QTR: start of previous calendar quarter to start of current
  - Last 6M, 1Y, 3Y, 5Y: rolling from latest date
- For each period, finds the nearest row by date and computes `(1 + latest_twr) / (1 + start_twr) - 1` for Total, SIPP, and ISA
- Returns array of `{ label, total, sipp, isa }` (null if insufficient data)

**New UI section** between the 4 summary cards and the chart:
- A styled table/grid with columns: Period | SIPP | ISA | Portfolio
- 6 rows (one per period), color-coded green/red values
- Matches existing card/panel styling

No other files need changes — all data is already available in the `performance` prop.

