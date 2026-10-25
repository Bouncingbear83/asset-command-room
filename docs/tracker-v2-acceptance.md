# Tracker v2 acceptance — 25 October 2026

Both tracker functions deployed; existing Bearer INGEST_SECRET authentication retained. No policies, SQL function definitions, or grants changed.

## RPC permissions checked before implementation

| RPC | Security | EXECUTE |
| --- | --- | --- |
| vault_search | INVOKER | PUBLIC (including anon, authenticated, service_role) |
| get_missing_watchlist_tickers | INVOKER | PUBLIC (including anon, authenticated, service_role) |
| upsert_position_reference | DEFINER | PUBLIC (including anon, authenticated, service_role) |

PUBLIC EXECUTE applies to every database role. In a later lockdown, the SECURITY DEFINER position RPC needs explicit execution-privilege review; table policies alone do not close it. Nothing was revoked in this step.

## Tests and deployed samples

- 40 Deno contract tests passed: 18 existing tests (intentional table-name expectation updated) plus 22 v2 tests.
- vault_search Narrative Watch, max 50: 200, 29 records.
- vault_search KLAC, max 5, note_type ticker: 200, 3 records.
- get_missing_watchlist_tickers: 200, one text result, ZZZZ_NOT_REAL.
- pg_sleep: 400, RPC_NOT_ALLOWED: pg_sleep.
- layer_weights_snapshot latest 10: 200, 10 records.
- layer_weights: 400, TABLE_NOT_ALLOWED: layer_weights.
- Empty vault upsert: exact specified 200 response, requested/affected zero and empty rows.
- Vault smoke upsert run twice: 200, affected 1 each time; readback shows exactly one path and updated body. tests/edge-fn-smoke.md intentionally retained for the nightly orphan purge.
- Invalid ../etc/passwd: 400 path validation.
- POSITION_REF UPSERT KLAC without price: 400, p_price_at_first_add required for UPSERT. No real POSITION_REF write was fired.
- Wrong Bearer on both deployed functions: 401 unauthorised, including independent function-tool checks.
- v1 read samples: action_tracker open/date ordering, layer_review_schedule status-in/date ordering, score_rationales projection/null filter/limit 50: all 200.
- v1 action smoke insert: affected 1 on first execution, then 0 for duplicate; UPDATE by id and dedupe_key each affected 1; confirmed dismissal/note via tracker-read. Only the dedicated TEST action was mutated, left DISMISSED.
- v1 REVIEW_UPDATE COMPLETE validated and executed against a verified nonexistent UUID, affected 0; no live review schedule changed. The old sample UUID was found to exist, so it was not written.
- v1 UPDATE missing identity: expected 400.

## Unchanged catalog fingerprints

- pg_policies before/after: 3e337028f498ba3fb54ba26e84cfada2.
- Three RPC definitions and ACLs before/after: 52f6373b01052632fd1e0aa6f0772d45.
- Latest preview build log: build OK.