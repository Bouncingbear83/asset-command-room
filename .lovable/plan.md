## Problem

The Movers card on the Command tab surfaces holdings prices fine but drops watchlist rows. Root cause in `src/components/MoversCard.tsx` (watchlist branch, ~line 132): the code requires either `daily_prices` (≥2 points) or `watchlist_price_history` (≥2 points) to derive `last`/`prev`. If neither exists, it does `return;` and the row never enters the list — even though the WL sheet itself carries `w.current` (the live price the user can see on the WL tab of the Google Sheet).

So any watchlist ticker without backing history in Supabase is invisible in Movers, regardless of what the sheet shows.

## Fix

Make sheet `current` the fallback source of truth for watchlist rows in `MoversCard.tsx`:

1. **Stop dropping rows without history.** Replace the early `return;` when `last`/`prev` are missing with a fallback path that still emits the row when `w.current` is a positive number.
2. **Change %**:
   - If we have `pd`/`traj` data, compute change as today (1D/1W/1M logic unchanged).
   - If not, set `change = null` and render `—` in the change column instead of `+0.00%`. Rows with null change are excluded from the winners/losers sort buckets and shown in a new compact "No Δ data" group at the bottom of the filtered list (only when WL/ALL scope is active).
3. **Sparkline**: keep current behaviour — render only when `sparkPoints` exists; otherwise render the empty `<span />` slot already in the grid.
4. **Price**: use `w.current` (already the preferred source in the existing code) when present; only fall back to `last` if `w.current` is missing.

### File touched
- `src/components/MoversCard.tsx` only (presentation logic). No hook or data-fetch changes; no schema changes.

### Types
Widen the local `MoverRow.change` to `number | null` and guard the two spots that read it (row render + winners/losers split). `upCount`/`downCount` ignore null entries.

### Out of scope
- Backfilling `watchlist_price_history` for missing tickers — separate ingestion concern.
- Any change to HOLDINGS behaviour.
