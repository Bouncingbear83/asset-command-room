## Plan: Create `narrative_signals` table

Run the provided DDL as a Supabase migration. It's a new table for tracking narrative/news signals against watchlist and rejected tickers, with run tracking, classification, and review workflow.

### Migration contents
- Table `public.narrative_signals` with UUID PK, run metadata, ticker/name/layer, source_table + signal_class + strength + review_status (all CHECK-constrained), narrative payload (headline/url/snippet/keywords/published_date), review fields.
- 4 indexes: `(ticker, signal_class, created_at desc)`, `(run_id)`, partial on `review_status='NEW'`, `(strength, created_at desc)`.
- RLS enabled.

### RLS adjustment
The provided policy only grants `service_role` access. The frontend uses the `anon`/`authenticated` keys, so with only that policy the app cannot read the table. Matching the convention used by `score_rationales`, `disruption_rationales`, `daily_prices`, and `watchlist_price_history`, I'll add:
- `service role full access` (FOR ALL, as provided — for edge function/n8n writes)
- `Authenticated users can read narrative_signals` (SELECT, true)
- `Anon can read narrative_signals` (SELECT, true)

Writes remain restricted to service role (no INSERT/UPDATE/DELETE policies for anon/authenticated), consistent with the rest of the snapshot tables which are populated by ingest functions.

### Files
- New: `supabase/migrations/<timestamp>_narrative_signals.sql`

### Notes
- No frontend changes in this step — schema only. Once populated, we can wire a Narrative Signals review surface (likely a tab or panel inside Watchlist/Review Queue) in a follow-up.
- `src/integrations/supabase/types.ts` will regenerate automatically.
