# Step 5 — revised Apps Script Part A and n8n proxy

## Implemented

- Deployed sheet-read and n8n-proxy. No RLS, tracker or MCP changes.
- Both validate the bearer with the auth service, require the confirmed owner email, and use exact existing app-origin CORS.
- sheet-read accepts only `keys`, 1–20 entries, drawn from the exact 16-key allowlist. Unknown keys are rejected before upstream access.
- Apps Script receives text/plain POST with server-only SHEET_READ_SECRET, follows redirects, and times out after 25 seconds. Success is cached for 60 seconds by sorted unique keys. Per-key errors are preserved; missing keys become errors. UNAUTHORISED/NOT_CONFIGURED map to 500 SHEET_READ_MISCONFIGURED; other upstream failures map to 502.
- Browser fetches one batch per refresh through PortfolioProvider. Existing five-minute refresh, canonical values, grid/object adapters and NO DATA source states remain. SCORES formatted fallback is restricted to quartet columns. PRICES stamp supplies the header date, with fetched_at fallback.
- n8n-proxy forwards only the three requested endpoints using Authorization: Bearer INGEST_SECRET. It preserves upstream status/body unless the body would expose the secret.
- Removed client sheet ID, Google Sheet URLs, direct n8n URLs and x-stellar-key. Source-sheet link now opens the in-app Scores view; Research Commit shortcut now opens ticker research in Claude rather than exposing an n8n workflow URL.

## Verified

| Check | Result |
| --- | --- |
| Saved secret names | SHEET_READ_URL, SHEET_READ_SECRET, INGEST_SECRET, managed LOVABLE_API_KEY; no GOOGLE_SA_JSON |
| Tests | 14 function contract tests and 11 client/canonical/owner tests passed |
| 25 Oct fixture AUM | £1,462,880 |
| 25 Oct fixture gross DP | 11.39% |
| Real owner sheet request | 200; HOLDINGS_CASH, PRICES and LAYERS returned |
| Live AUM | £1,368,629, read from E60 |
| Live gross DP | 12.18%, read from F58 |
| Data date | 2026-10-23 from PRICES stamp |
| Unknown sheet key | 400 with owner session |
| Missing JWT | 401 |
| Unknown proxy endpoint | 400 with owner session |
| Vault proxy | 200; KLAC results returned |
| Vault UI | SEARCH → KLAC → 24 results, including KLA Corporation |
| Earnings proxy | 200, Workflow was started for NVDA |
| Signed-in navigation | All 15 tabs mounted; data rendered across portfolio views |
| Direct browser calls | 0 Google Sheet/n8n/legacy sheet-transport requests observed |
| Source scan | 0 hits in src for docs.google.com, gviz, n8n.cloud, N8N_KEY or x-stellar-key |
| Preview compilation | build OK |

## Not yet verified / operator steps

- Earnings proxy was exercised with real NVDA input; the Prep button click itself remained unverified because the automated select interaction stalled. The workflow was started only once by the successful direct owner-authenticated proxy check; no delivery claim is made.
- A real valid non-owner JWT was not available. Missing/invalid authentication is denied, owner is verified server-side, and existing owner-email tests pass; a real non-owner round trip remains unverified.
- Direct POST to SHEET_READ_URL with a wrong secret must be checked by the operator. Its secret URL is not exposed to a diagnostic endpoint or copied into a test script.
- No generated production bundle is available in the sandbox. Source scan and observed request checks passed; the requested built-bundle scan remains pending publication.
- No Google credentials were created/requested. Service-account email is no longer applicable under Part A v2.
- Do not unshare the sheet or change n8n authentication until the updated app is published and checked on the published site. Neither action was performed here.