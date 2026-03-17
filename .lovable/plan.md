

## Plan: Integrate Performance Sheet into Returns Tab

### New data flow

**1. `usePortfolioData.ts`** — Add performance sheet parsing

- Add `performance: "7099973"` to `GIDS`
- Add known columns: `date`, `sipp_mv`, `isa_mv`, `total_mv`, `cash_sipp`, `cash_isa`, `total_cash`, `total_sipp`, `total_isa`, `total_value`, `deposits_in_period_sipp`, `deposits_in_period_isa`, `deposits_in_period_total`, `sub_period_rtn_sipp`, `sub_period_rtn_isa`, `sub_period_rtn_total`, `cumulative_twr_sipp`, `cumulative_twr_isa`, `cumulative_twr_total`, `note`
- Create `parsePerformance` function mapping each row to a typed object with date, MVs, cash, totals, deposits, sub-period returns, cumulative TWR, note
- Export `LivePerformance` type
- Add `performance: LivePerformance[]` to `PortfolioData` state and fetch in `load()`

**2. `ReturnsTab.tsx`** — Rebuild with performance data

Keep existing props (sipp, isa) for winners/losers/movers cards. Add `performance: LivePerformance[]` prop.

New layout:
- **Summary cards row** (4 cards): Total AUM, Cumulative TWR (Total), Cumulative TWR (SIPP), Cumulative TWR (ISA) — all from latest performance row
- **Performance history table**: Date | SIPP Total | ISA Total | Portfolio Total | Deposits | Sub-period Return | Cumulative TWR — rows sorted newest first, color-coded returns (green positive, red negative)
- **Existing 3-column grid**: Winners / Losers / Movers (unchanged, below the table)

**3. `Index.tsx`** — Pass `performance` prop to `ReturnsTab`

### Summary

| File | Change |
|---|---|
| `usePortfolioData.ts` | Add GID, known cols, `parsePerformance`, fetch + expose `performance[]` |
| `ReturnsTab.tsx` | Accept `performance` prop, render summary cards from latest row, render performance history table, keep winners/losers/movers |
| `Index.tsx` | Pass `portfolio.performance` to ReturnsTab |

