## Diagnosis

The error text ("Couldn't register with Stellar app's sign-in service … add an OAuth Client ID in the connector settings … `ofid_…`") comes from the external MCP client (ChatGPT-style connector), not from this app.

I probed the OAuth server directly and everything on our side is healthy:

- OAuth server enabled, consent path `/.lovable/oauth/consent` (returns 200)
- Dynamic Client Registration works — a live POST to `/auth/v1/oauth/clients/register` returned HTTP 201 with a valid `client_id`
- Discovery metadata (`.well-known/oauth-authorization-server`) advertises the `registration_endpoint`, PKCE (`S256`), `code` response type, and refresh tokens
- Redirect-URI allow-list includes the published domain
- MCP endpoint at `/functions/v1/mcp` responds to `initialize`

So this is almost certainly a transient failure on the connector side (network blip, or it cached a half-registered client).

## Proposed steps

1. **Retry from the connector.** In the client (ChatGPT/Claude/etc.), remove the half-registered Stellar connector entry, then re-add it using the MCP server URL:
   `https://eervjywaxpxqdjjhtguz.supabase.co/functions/v1/mcp`
2. **If it still fails**, use the fallback the error message offers: manually create an OAuth client and paste the `client_id` into the connector's "OAuth Client ID" field. I'll provide the exact `redirect_uris` the connector shows in its setup screen and register the client for you via the auth API, returning the `client_id`.
3. **If both fail**, share the connector's own debug/log output (or which app it is — ChatGPT, Claude, Cursor, Codex). The `ofid_…` reference is only meaningful to that vendor's support; our server has no matching log entry.

## Not changing

No code or backend config changes in step 1. Steps 2–3 only run if the retry fails.

## Question for you

Which client are you connecting from (ChatGPT, Claude, Cursor, other), and what redirect URI does it show you on its "add MCP server" screen? That's what I need to pre-register a manual client if the retry doesn't fix it.
