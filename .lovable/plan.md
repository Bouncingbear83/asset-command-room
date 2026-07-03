## Goal
Swap the vault-reading `vault-narrative-sync` edge function for a simpler write-only `ingest-narrative-watch` function. Parsing moves to n8n; the function only deactivates existing active rows in `narrative_watch` and inserts fresh ones.

## Steps

1. **Delete `vault-narrative-sync`**
   - Remove local `supabase/functions/vault-narrative-sync/` directory.
   - Delete the deployed function from the Supabase project.

2. **Create `ingest-narrative-watch`**
   - New file `supabase/functions/ingest-narrative-watch/index.ts` with the provided write-only code (POST-only, CORS, service-role client).
   - Accepts `{ items: [{ ticker, layer, category, content, source_path }] }`.
   - Deactivates all `active = true` rows in `narrative_watch`, then inserts new rows.

3. **Deploy** `ingest-narrative-watch`.

## Notes
- No frontend code changes; `useNarrativeWatch` continues to read from the `narrative_watch` table.
- No database schema changes required.
- No auth header (matches pattern of other write-only ingest functions that rely on service-role from env).
