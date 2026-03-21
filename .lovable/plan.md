

## Update Quick Commands + Add Authenticated Webhook Buttons

### Summary

Remove 3 quick commands (Weekly Check, Monthly Review, Quarterly Review), keep 3 Claude-linked commands (Substrate Audit, Layer Gaps, Reclassification Risk), add 3 webhook-powered commands (Rescore, Earnings Prep, Layer Scan). Add per-row action buttons on Holdings, Scores, Earnings, and Layers tabs. All webhook calls authenticated with `x-stellar-key` header.

### Authentication

Store the webhook secret as a runtime secret (`N8N_STELLAR_KEY`) accessible from the client-side webhook helper. Since this is a client-side app, the key will be embedded — but the header auth prevents casual URL abuse. The helper will read from an environment variable with a fallback.

### Changes

**1. `src/lib/webhooks.ts`** — New shared helper
- `N8N_BASE` constant
- `triggerWebhook(endpoint, body, successMsg)` with `x-stellar-key` header
- Toast feedback on success/failure via sonner

**2. `src/components/CommandTab.tsx`** — Update Quick Commands
- Remove: Weekly Check, Monthly Review, Quarterly Review
- Keep: Open Stellar Intelligence, Substrate Audit, Layer Gaps, Reclassification Risk (Claude links)
- Add: Rescore (ticker dropdown → webhook), Earnings Prep (ticker dropdown → webhook), Layer Scan (layer dropdown → webhook)
- Webhook commands use dropdowns populated from portfolio data, then call `triggerWebhook`

**3. `src/components/HoldingsTab.tsx`** — Add 🔄 Rescore icon per row
- POST `{ ticker }` to `/stellar-rescore`

**4. `src/components/ScoresTab.tsx`** — Add 🔄 Rescore icon per row
- POST `{ ticker }` to `/stellar-rescore`

**5. `src/components/EarningsCalendarTab.tsx`** — Add 📋 Prep icon per row
- POST `{ ticker }` to `/stellar-earnings-prep`

**6. `src/components/LayersTab.tsx`** — Add 🔍 Scan icon per layer row
- POST `{ layer }` to `/stellar-layer-scan`

### Files
- `src/lib/webhooks.ts` — new
- `src/components/CommandTab.tsx` — update commands
- `src/components/HoldingsTab.tsx` — add rescore button
- `src/components/ScoresTab.tsx` — add rescore button
- `src/components/EarningsCalendarTab.tsx` — add prep button
- `src/components/LayersTab.tsx` — add scan button

