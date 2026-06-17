The user shared a PostgreSQL function `upsert_watchlist_prices(prices jsonb)` that performs a bulk upsert into `watchlist_price_history` from a JSONB array. This is more efficient than the current row-by-row client upserts in the `ingest-watchlist-history` edge function.

### 1. Deploy the function via migration
- Harden with `SET search_path = public` (security best practice, matching recent fixes)
- Grant execute to `service_role` so edge functions can call it
- Grant execute to `authenticated` if n8n or other authenticated callers need it

### 2. Update `ingest-watchlist-history` edge function
- Keep the existing validation logic (it validates ticker, date format, price > 0, currency)
- After validation, build a JSONB array from the normalised rows
- Call `supabase.rpc("upsert_watchlist_prices", { prices: jsonbArray })` instead of `supabase.from(...).upsert(...)`
- Return the row count from the function in the response

### 3. Optionally update `ingest-daily-snapshot`
- The `watchlistPrices` branch currently does a passthrough upsert
- Could also route through this RPC for consistency, though passthrough is fine if n8n already sends clean data

### Why this helps
- Single round-trip for large batches instead of PostgREST row-by-row
- Server-side execution avoids network overhead
- `GET DIAGNOSTICS ROW_COUNT` gives accurate inserted/updated counts
- Aligns with the recent security hardening (search_path hygiene)

### Open question
Should `ingest-daily-snapshot` also use this RPC for its `watchlistPrices` branch, or leave it as passthrough?