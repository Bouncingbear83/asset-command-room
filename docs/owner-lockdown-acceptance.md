# Owner lockdown acceptance — 25 October 2026

## Applied

- One migration: `drizzle/migrations/0001_owner_only_lockdown.sql`.
- Replaced 58 existing policies with 30 owner-only policies. All 24 public tables have RLS enabled. No anonymous or unconditional public/authenticated policies remain.
- Owner SELECT covers every existing requested table. `themes_history` is absent; `test5_early_warning` is a view, secured as an invoker view.
- Owner writes: action_tracker INSERT/UPDATE/DELETE; layer_review_schedule and scheduled_reviews UPDATE; narrative_signals UPDATE on **review_status only**, enforced with column grants. The UI no longer sends reviewed_at/reviewed_by in that update.
- All nine public views use security_invoker. Anonymous table/view/sequence grants were revoked. Service-role grants retained.
- All 12 public functions deny anonymous execution. Authenticated EXECUTE remains only on vault_search(text,text,integer) and perf_by_dimension_window(text,integer). upsert_position_reference and upsert_watchlist_prices are service-role-only among API roles. Function bodies were not changed.
- Public signup was confirmed **already disabled** by a live `/auth/v1/settings` read; no auth settings were changed.
- AuthGate refuses non-owner sessions and signs them out with a message. Both client-administration functions verify the confirmed owner email server-side.
- Four permitted edge functions deployed: register-mcp-client, list-oauth-clients, live-prices, earnings-dates. Prices/earnings require a verified owner or Bearer INGEST_SECRET, with exact app-origin CORS. live-prices reads daily_prices instead of the nonexistent stellar_daily_snapshot.

## Verification

| Check | Result |
| --- | --- |
| Anonymous SELECT holdings_snapshot, jisa_snapshot, action_tracker, scores_snapshot, vault_notes_meta | All 401 |
| Anonymous INSERT action_tracker / vault_notes_meta | Both 401; no test data inserted |
| Anonymous vault_search RPC | 401 |
| Owner SELECT on the five tables above | All 200 with rows |
| Owner vault_search KLAC | 200, 5 rows |
| Anonymous live-prices / earnings-dates | Both 401 |
| Owner live-prices / earnings-dates | Both 200 |
| INGEST_SECRET live-prices / earnings-dates | Both 200 |
| Untrusted Origin CORS preflight | No Access-Control-Allow-Origin |
| Signed-in owner, all 15 tabs | Loaded, no page errors or failed database requests |
| Vault browse | 814 notes, 1000 links rendered |
| Research | 232 tickers rendered |
| Attribution | Portfolio chart and dimension data rendered |
| DECIDE Mark done | Temporary TEST card persisted CONFIRMED with resolution_note; read back from database |
| Layer Mark Done → Yes | Temporary TEST review persisted COMPLETE, completed_date 2026-10-25; displayed crossed out |
| tracker-read v1 action/layer/rationale samples | All 200 |
| tracker-read v2 layer_weights_snapshot/vault_search/missing-tickers | All 200 |
| tracker-write INSERT_IGNORE twice | affected 1, then 0 |
| tracker-write UPDATE and REVIEW_UPDATE | affected 1 each on temporary TEST records |
| tracker-write empty VAULT_META_UPSERT | 200, affected 0 |
| Wrong tracker Bearers | Both 401 |
| Existing deployed MCP, invalid Bearer | 401 |
| Deno tests | 43 passed (40 tracker contracts + 3 owner/CORS checks) |
| Vitest regression / owner / MCP boundary tests | 41 distinct tests passed |
| Database linter | No issues |
| Preview compilation | build OK |

Temporary action/review records were removed after verification. No real action or review was resolved. Google Sheet and n8n were not modified. Existing Vault dangling-link warnings remain unrelated to access control.

## MCP exception and remaining verification

The requested service-role MCP implementation was deliberately not used: MCP handlers must preserve verified caller identity and RLS, not bypass it. All four tools now use one shared caller-scoped factory after SDK issuer/audience/OAuth client verification, validate the OAuth subject against the confirmed owner, and preserve the caller bearer for database queries. Tool names, arguments and outputs are unchanged.

The manifest successfully extracted all four tools. **This new MCP revision is not deployed until app republish.** The old published MCP reads anonymously and its data tools are consequently blocked by the applied lockdown until republish. The new authenticated four-tool external connector round trip remains unverified pending republish and a real OAuth connector session. No app-session token was substituted for OAuth. No new auth/OAuth services were enabled this turn.

## Complete before/after listings

- [Before policies](./policies-before.json)
- [After policies](./policies-after.json)
- [Before function ACLs](./functions-before.json)
- [After function ACLs](./functions-after.json)
- [After view options](./views-after.json)