# Plan: Price Anchor Fields — End-to-End

Close the gap on `PRICE_AT_FIRST_ADD`, `FIRST_ADD_DATE`, `PRICE_AT_LAST_SCORE` (and derived `PCT_FROM_*`) across SCORES, HOLDINGS, WATCHLIST.

Decisions locked:
- Source: all three sheet tabs carry these columns
- `pct_from_*`: computed client-side from current price (live UI value)
- Supabase `score_rationales.pct_from_*` retained as **snapshot-at-time-of-scoring** (analytic history, distinct from live)

---

## Step 1 — Extend the sheet column registry

`src/hooks/usePortfolioData.ts`

- Add to `KNOWN_COLS`: `price_at_first_add`, `first_add_date`, `price_at_last_score`, `pct_from_first_add`, `pct_from_last_score` (last two accepted but discarded for live; SCORES snapshot uses the recomputed value).
- Add explicit space-variant matches in `resolveColumnLabel` for `"Price At First Add"`, `"First Add Date"`, `"Price At Last Score"`.

## Step 2 — Capture anchors per row in each sheet parser

Same file. For SCORES, HOLDINGS, and WATCHLIST row mapping, lift the three raw anchor fields onto the normalized row object. No semantic merging yet — each tab keeps its own anchor for provenance.

## Step 3 — Define merged anchor type + precedence

`src/types/intelligence.ts`

```ts
type AnchorSource = 'scores' | 'holdings' | 'watchlist' | 'rationale';

interface AnchorValue {
  price: number | null;
  date: string | null;   // first_add only
  source: AnchorSource;
}

interface AssetPriceAnchors {
  first_add: AnchorValue;
  last_score: AnchorValue;
  pct_from_first_add: number | null;   // computed live
  pct_from_last_score: number | null;  // computed live
  raw: Partial<Record<AnchorSource, {
    first_add_price?: number;
    first_add_date?: string;
    last_score_price?: number;
  }>>;
}
```

**Precedence (revised):**
- `first_add` → **SCORES > HOLDINGS > WATCHLIST > rationale**
- `last_score` → **SCORES > HOLDINGS > WATCHLIST > rationale**

Rationale: HOLDINGS!AO:AP is a sparse mirror, only populated when a Research Commit fires a `holdings_updates` payload. SCORES is canonical — every score event writes there. HOLDINGS is fallback only.

## Step 4 — Merge in `useAssetIntelligence` + same-source current-price pairing

`src/hooks/useAssetIntelligence.ts`

- Resolve `AssetPriceAnchors` using the precedence above.
- **Same-unit current-price pairing:**
  - HELD ticker → current price comes from `HOLDINGS.PRICE_LOCAL`
  - Research-only ticker → current price comes from `WATCHLIST.CURRENT_PRICE`
  - Both quote in the matching unit as the anchor (USD, GBp, JPY, etc.) — no FX conversion in pct calc.
- **Unit-mismatch detector:** if HELD ticker also has WATCHLIST current_price and the two diverge by >10%, emit a `console.warn` (likely currency-unit mismatch — e.g. GBp vs GBP, JPY whole vs sen).
- Compute pct: `(current − anchor.price) / anchor.price * 100`. Null-safe.
- Case-insensitive ticker matching (per Core memory).

## Step 5 — UI surface

1. **AssetExpansion** — new "Price Anchors" block:
   - First Add: `£X.XX · 2025-04-12 · +12.4%` + source chip (`SCORES`)
   - Last Score: `£Y.YY · −3.1%` + source chip
   - Conflict badge if `raw` values diverge across sources by >1%
2. **Holdings table** — optional "**vs last score**" column (NOT "vs cost"). Reuses `pct_from_last_score`. Cost basis lives in TRANSACTIONS, not HOLDINGS!AO; first_add is thesis-discovery, not position-open. Column gated behind the existing toggle pattern; default off.

Styling: Cormorant Garamond labels, DM Mono numerics, gold positive / silver-muted negative.

## Step 6 — Tests + safety

- Extend `IntelligencePreview.test.ts` with: SCORES-only, HOLDINGS-only, WATCHLIST-only, cross-source conflict, missing current price, unit-mismatch (>10% divergence) warning.
- `withSafeV213Defaults` + v2.13 fallback badge remain as runtime safety net.

## Step 7 — Supabase

- **No schema change.** `score_rationales` already has the three anchor columns.
- **Keep** `pct_from_first_add` and `pct_from_last_score` writes in `ingest-rationales` — these are **snapshots at time of scoring** with analytic value (separate from live UI).
- Optional follow-up migration (non-blocking): rename to `pct_from_first_add_at_scoring` / `pct_from_last_score_at_scoring` to make snapshot semantics explicit. Defer until requested.

---

## Technical notes

- **Currency**: anchors stored as published by sheet, in asset's quote unit. Same-source current-price pairing (Step 4) guarantees unit match.
- **Tab GIDs**: SCORES / HOLDINGS / WATCHLIST already wired per `mem://architecture/google-sheets-data-ownership`.
- **Header parsing**: `mem://architecture/google-sheets-header-normalization` handles space↔underscore.

## Out of scope

- Anchor lines on the price sparkline
- Threshold alerting on `pct_from_*`
- Historical pct trend chart

## Risks

- Sheets `PCT_FROM_*` columns are ignored for live UI (by design). If they ever encode split-adjusted history, we'd silently diverge — Step 2 keeps raw values around for a one-line swap.
- HOLDINGS anchors stay second-class until a Research Commit populates them. Acceptable given SCORES coverage.
