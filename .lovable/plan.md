

## Plan: Fix missing price charts for holdings

### Root cause

Two issues prevent charts from appearing:

1. **Case mismatch** — The holdings use `WINTON` and `RUFFER` (all-caps), but `daily_prices` has most data under `Winton` (234 rows) and `Ruffer` (310 rows). The `.eq("ticker", ticker)` query is case-sensitive, so `WINTON` only matches 3 rows instead of 234.

2. **Minimum threshold too high** — Line 267 of `HoldingsTab.tsx` requires `points.length >= 10` to render a chart. Tickers like LEU (3 rows) genuinely have very few data points. With only 3 points the chart isn't useful, but the threshold should be lowered to 2 so any ticker with data at least shows something.

### Fix

**`src/hooks/useTickerHistory.ts`**
- Use case-insensitive matching: query with `.ilike("ticker", ticker)` instead of `.eq("ticker", ticker)` to handle `WINTON` matching `Winton`, etc.

**`src/components/HoldingsTab.tsx`**
- Lower the chart display threshold from `>= 10` to `>= 2` so tickers with limited history still show a chart (even a simple line between 2-3 points is informative)

### Data cleanup (optional, recommended)
- Run a migration to normalize all ticker casing in `daily_prices` to uppercase, matching the holdings data convention. This prevents the issue recurring and avoids needing case-insensitive queries long-term.

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useTickerHistory.ts` | Replace `.eq("ticker", ticker)` with `.ilike("ticker", ticker)` in both batch queries |
| `src/components/HoldingsTab.tsx` | Change threshold from `>= 10` to `>= 2` on line 267 |

