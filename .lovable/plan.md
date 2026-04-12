

## Plan: Fix Current MV lookup in Transaction drill-down

### Problem
The Transactions ticker drill-down shows "Current MV: £0" for HEXA-B (and likely other tickers) because `calcTickerReturns` in `src/lib/xirr.ts` matches holdings with strict case-sensitive equality (`h.ticker === ticker`). If the ticker casing differs between transactions and holdings, or if the holding exists but isn't found, MV defaults to zero — producing nonsensical -100% returns.

### Fix

**`src/lib/xirr.ts` — `calcTickerReturns` function**
- Change the holdings lookup from `h.ticker === ticker` to a case-insensitive comparison: `h.ticker.toUpperCase() === ticker.toUpperCase()`
- Same fix in `calcHoldingReturns` for consistency (line ~42: `t.ticker === ticker`)

**`src/lib/xirr.ts` — `calcHoldingReturns` function**  
- Apply the same case-insensitive fix to the transaction filter: `t.ticker.toUpperCase() === ticker.toUpperCase()`

### Files changed

| File | Change |
|------|--------|
| `src/lib/xirr.ts` | Case-insensitive ticker matching in both `calcTickerReturns` (holdings filter) and `calcHoldingReturns` (transaction filter) |

Single file, two line changes.

