## Goal
Add a **Watchlist Movers** section to the Today's Movers card on the Command tab, kept visually separate from the existing Holdings movers (which stay unchanged).

## Why a separate section
Holdings movers are sized by MV (£) and source `day` / `prevClose` from the live Sheets `holdings` rows. Watchlist items have no `day` field and no MV, so mixing them would distort sort order and the up/down counters. Showing two sibling lists in the same card preserves the existing semantics while surfacing watchlist activity.

## Data source
`LiveWatchItem` (from `usePortfolioData`) does **not** carry day-change data. Reuse the `priceData` map already loaded in `CommandTab` via `useDailyPrices()`:

- Get the last two `DailyPricePoint`s per ticker.
- `dayPct = (last.priceLocal - prev.priceLocal) / prev.priceLocal * 100`
- Skip when `<2` points, when both prices are equal (same stale-price guard used for holdings), or when the latest point is older than the most recent date seen across all tickers (drop pre-weekend stragglers).

## UI changes (CommandTab.tsx, ~line 773 block)

1. Keep the existing Holdings movers list exactly as-is.
2. Below it, inside the **same card**, add:
   - A thin divider + subheader row: `WATCHLIST` (left) · `{up} ▲ · {down} ▼` (right), styled like the current header counters but smaller/dimmer.
   - Top 5 watchlist movers, obeying the current ALL / ▲ GAIN / ▼ LOSS toggle (shared with holdings — one toggle controls both).
   - Same row layout as holdings rows: ticker · price · day% · sparkline. **Omit the MV column** (replace with the entry-target string, dimmed) since watchlist items have no MV.
   - No Bordier/JPY badge logic.
3. Empty state: if no watchlist movers qualify, render nothing (don't show the subheader).

## Edge cases
- Dedupe watchlist tickers that are already in holdings → show only in the Holdings section (avoid double-counting).
- Currency symbol resolution reuses the existing inline ternary on `w.currency`.
- Sparkline reuses the same `priceData.get(normaliseTicker(...))` lookup.

## Files touched
- `src/components/CommandTab.tsx` — single edit inside the Today's Movers IIFE block (~lines 773–880).

No hook, type, or backend changes.
