# Fix: Price info missing for watchlist tickers in HoldingFactSheet

## Why it's blank today

The fact sheet pulls price from two places only:

1. `firstHolding?.price` — the live GOOGLEFINANCE value from the HOLDINGS sheet. Watchlist tickers aren't in holdings, so this is `null`.
2. `daily_prices` table (queried in `useFactSheetData.ts`) — only populated for HELD tickers by the nightly snapshot. Watchlist tickers return zero rows.

Result: `stripPrice` is `null`, "no price" is shown, and the chart prints "No price history available".

Meanwhile the Watchlist tab and Command tab Movers card already render sparklines because they read `watchlist_price_history` via `useWatchlistHistory` — a separate yfinance-backed table the fact sheet never consults.

## Fix

Extend the fact sheet data layer to fall back to `watchlist_price_history` when a ticker is not held / has no `daily_prices` rows.

### Changes

1. **`src/components/factsheet/useFactSheetData.ts`**
   - Add a parallel `supabase.from("watchlist_price_history")` query for the same ticker variants over the last 180d.
   - If `daily_prices` returns rows, keep current behaviour (held path).
   - Otherwise map watchlist rows into `DailyPricePoint` shape: `priceLocal = close_price`, `priceGbp = null` (no FX in that table), carry `currency` through a new optional field on the returned shape.
   - Return a small `priceSource: "holdings" | "daily_prices" | "watchlist_history" | "none"` flag so the UI can label freshness honestly.

2. **`src/components/factsheet/HoldingFactSheet.tsx`**
   - When `firstHolding` is null and `pricePoints` come from `watchlist_price_history`:
     - `stripPrice` = latest `close_price`
     - `liveCcy` = currency from the watchlist row (fallback `""`)
     - Day change = `(latest - prevClose) / prevClose` computed from the last two points
     - `asOf` label = `Watchlist EOD {date}` and keep the `isStale` styling (it is EOD, not live)
   - Chart already consumes `pricePoints` so it will render automatically once they're populated.
   - MA20/MA50 strip stays hidden for the watchlist path (we don't compute MAs in `watchlist_price_history`).

3. No schema or backend changes. RLS on `watchlist_price_history` already allows anon read.

## Out of scope

- Mid-day live price for watchlist tickers (would need a separate quote source).
- Backfilling `daily_prices` with watchlist data — keeping the two tables separate matches existing architecture.
- Cost / P&L blocks — these stay hidden for watchlist tickers since there's no position.
