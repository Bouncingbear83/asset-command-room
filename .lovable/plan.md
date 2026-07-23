# Plan: Pre-registered OAuth clients for Claude / ChatGPT

## Diagnosis (verified this turn, correcting Claude's summary)

I probed the live server before writing this plan:

- Supabase discovery **does** publish a `registration_endpoint`:
  `https://<ref>.supabase.co/auth/v1/oauth/clients/register`
- A live DCR probe returns **HTTP 201** with a valid `client_id`, so DCR is not the failure mode Claude assumed.
- `/functions/v1/mcp` returns **401 with a correct `WWW-Authenticate` challenge** and `resource_metadata` pointing at protected-resource discovery — that endpoint also returns 200 with `authorization_servers` set to the direct `supabase.co` issuer.
- `src/pages/OAuthConsent.tsx` is mounted at `/.lovable/oauth/consent`, and `src/pages/Auth.tsx` already consumes `?next=` through password, signup `emailRedirectTo`, and the Google `signInWithOAuth` `redirect_uri`.

The server side is healthy. What we don't yet have is a **manual escape hatch** for MCP clients whose DCR attempt fails for a client-side reason (Claude's `ofid_...` reference is opaque and can't be reproduced from our side). Claude's connector supports pasting a Client ID / Secret in Advanced Settings, which bypasses DCR.

The generated TS types don't cover `scores_snapshot` / `vault_notes_meta`, but the MCP tool files compile today. That's a defensive polish item — not the blocker — so it is a small follow-up, not the main deliverable.

## What we'll build

### 1. Edge function: `register-mcp-client`
- Path: `supabase/functions/register-mcp-client/index.ts`
- Verifies the caller's Supabase JWT (same pattern as `list-oauth-clients`).
- Accepts `{ client_name, redirect_uris: string[], token_endpoint_auth_method: "client_secret_basic" | "none" }`.
- Uses `SUPABASE_SERVICE_ROLE_KEY` to POST `/auth/v1/admin/oauth/clients` with `registration_type: "manual"`, `grant_types: ["authorization_code","refresh_token"]`, `response_types: ["code"]`.
- Returns `{ client_id, client_secret, redirect_uris, token_endpoint_auth_method }`. Secret is only ever returned by this response (Supabase does not re-reveal it).

### 2. UI: extend `src/components/McpConnectorSection.tsx`
- New "Register a client manually" panel with:
  - Dropdown of well-known redirect URIs (Claude: `https://claude.ai/api/mcp/auth_callback`; ChatGPT: `https://chatgpt.com/connector_platform_oauth_redirect`) + free-text fallback.
  - Auth method selector (default `client_secret_basic` for Claude Advanced Settings).
  - "Create client" button → calls the edge function.
- On success, shows Client ID and Client Secret side-by-side with copy buttons and a **one-time warning** ("secret is shown once — copy it now"). Keeps the existing "Load client IDs" list below.

### 3. Reconnect flow (docs in UI)
- Add three short steps under the form: (1) copy Client ID + Secret, (2) in Claude → Add connector → paste MCP URL → Advanced Settings → paste Client ID + Secret, (3) approve on the Stellar consent page.

### 4. TS-cast polish (small)
- Wrap `.from("scores_snapshot")` / `.from("vault_notes_meta")` results in `src/lib/mcp/tools/list-scores.ts` and `get-vault-note.ts` with the same `parseRows`/`as unknown as` pattern used in `useAttribution.ts` so future type regens can't silently break the handlers. No behavior change.

## Out of scope

- Changing the OAuth server configuration (already correct).
- Modifying the consent page or Auth `next` handling (verified working).
- Any change to `App.tsx` routing.

## Technical notes

- Supabase admin OAuth API: `POST /auth/v1/admin/oauth/clients` with `apikey` + `Authorization: Bearer <service_role>` headers. Response includes `client_secret` exactly once on create.
- No new secrets needed (function uses existing `SUPABASE_SERVICE_ROLE_KEY`).
- No DB migration needed.
- After deploy, the file will regenerate on next build; no manual step.
