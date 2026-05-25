## Why it vanished

The WATCHLIST subsection in `CommandTab.tsx` (Today's Movers card) is nested **inside** the holdings movers card and gated by two filters that can silently zero it out:

1. The whole card returns `null` when `topMovers.length === 0` (no holdings movers) — taking the watchlist with it.
2. Inside the watchlist loop, rows are dropped when `last === prev`. For watchlist tickers this is common because `watchlist_price_history` is a once-daily ingest — if today's row hasn't landed yet, the latest two entries can be identical or the diff comes from older dates.
3. Watchlist tickers that overlap holdings are excluded; on small watchlists this can leave zero.

Net effect: the subsection appears to "vanish" even though the data path still works.

## Fix

Edit `src/components/CommandTab.tsx` only — pure presentation, no business logic / hook changes.

1. **Lift the WATCHLIST block out of the holdings gate.** Render the Today's Movers card whenever `topMovers.length > 0 || wlTop.length > 0`. If only watchlist movers exist, show the card with just the WATCHLIST sub-header.
2. **Loosen the equality filter for watchlist.** Drop the `last === prev` skip (that guard was added for stale Bordier JPY holdings, not watchlist). Keep the `!prev` guard so we don't divide by zero.
3. **Add a visible empty-state row** inside the WATCHLIST section when `wlMovers.length === 0` but `watchlist.length > 0`: a single muted line "No watchlist movers — awaiting next price refresh" so the user knows the section is wired up.
4. Keep the ALL / ▲ GAIN / ▼ LOSS toggle shared with holdings, and keep the `TickerButton` + `Sparkline` rendering exactly as today.

## Out of scope

- No changes to `useWatchlistHistory`, `usePortfolioData`, or any Supabase query.
- No changes to ingestion or RLS.
- No restyling beyond the new empty-state line.
