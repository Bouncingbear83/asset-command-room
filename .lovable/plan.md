
The user wants Prompt 3 of 7. First I need to inspect the actual Supabase schema for `score_rationales` and `disruption_rationales` (already visible in context) and reconcile against the spec, then plan the expansion component.

**Schema reconciliation (from context — no need to query):**

`score_rationales` actual columns:
- `ticker`, `scored_at`, `scored_by`, `total_score`, `tier`, `action`, `thesis_summary`, `change_note`
- Per-dimension PAIRS (not long-format): `substrate_score`+`substrate_rationale`, `demand_score`+`demand_rationale`, `moat_score`+`moat_rationale`, `valuation_score`+`valuation_rationale`, `mgmt_score`+`mgmt_rationale`, `disruption_score`+`disruption_rationale`
- Plus context: `price_at_scoring`, `mv_gbp_at_scoring`

`disruption_rationales` actual columns:
- `ticker`, `scored_at`, `scored_by`, `disruption_score`, `status`, `change_note`, `evidence`, `amber_trigger`, `red_trigger`
- Per-dimension PAIRS: `sub_avail_score`+`sub_avail_rationale`, `economics_score`+`economics_rationale`, `govt_support_score`+`govt_support_rationale`, `demand_vuln_score`+`demand_vuln_rationale`, `time_viability_score`+`time_viability_rationale`

**Mismatch vs spec:** The user's spec assumed long format (`dimension` column + one `rationale` row per dimension). Actual schema is wide format (one row per ticker with all six rationales as columns). This is BETTER — simpler join, one row per ticker. RLS already allows anon SELECT on both tables (confirmed in context).

**Existing infrastructure:**
- `src/integrations/supabase/client.ts` — anon Supabase client already initialised
- `src/hooks/useRationales.ts` already exists — likely fetches score_rationales. Need to inspect to avoid duplication. ScoresTab already uses `fetchDisruptionRationales` pattern.
- `useAssetIntelligence` currently derives from `usePortfolioData()` (sync, no async). Adding Supabase fetches needs `useEffect` + state OR React Query. Project uses bespoke hooks (no React Query for these), so match existing pattern: `useEffect` + state, similar to `useRationales`.

**Plan:**

### Step 1 — Extend hook with rationales (wide-format reads)

1. **Update `src/types/intelligence.ts`**: add `ScoreRationales`, `DisruptionRationales`, and `rationales: { score, disruption }` field on `AssetIntelligence`. Note: `score.disruption` here is the 6D-disruption (/15) rationale; deep-dive disruption rationales live under `disruption.<dimension>`.

2. **Update `src/hooks/useAssetIntelligence.ts`**:
   - Add `useEffect` to fetch latest row per ticker from both `score_rationales` and `disruption_rationales`. Order by `scored_at desc`, dedupe in JS (keep first per ticker).
   - Pagination guard: both tables likely <1000 rows but use `.range(0, 999)` defensively; if reach 1000 paginate (per memory `historical-data-pagination`).
   - Build two `Map<ticker, RowData>` lookups.
   - In the existing `useMemo` join, attach `rationales.score` (always present, empty strings for missing dimensions) and `rationales.disruption` (null if `asset.disruption === null`, else populated with empty-string fallbacks).
   - Warn (console) for rationale rows whose ticker isn't in SCORES.
   - Loading state should wait for sheets AND rationales (combine flags).

### Step 2 — Build `src/components/intelligence/AssetExpansion.tsx`

Single component, prop `{ asset: AssetIntelligence }`. Sections in order, each with bottom border:

1. **THESIS** — markdown-ish text (use existing markdown approach in repo; if none, render as `white-space: pre-wrap`). Show-more at 3 lines via line-clamp + state. Metadata strip: change_note · score_date · reclass_status · age.
2. **6D RATIONALES** — 3×2 grid of cards. Per card: label (mono small caps) + score chip top-right (`val/max`, colored) + rationale body (line-clamp 4 + show more) or muted "No rationale recorded".
3. **DISRUPTION DEEP DIVE** — only when `asset.disruption !== null`. Header with status chip. 5-col grid of /20 cards. Conditional amber/red trigger banners with left-border accents. Conditional evidence quote block. Footer: `Last assessed: {last_checked}`.
4. **PRICE CONTEXT** — only when `asset.position !== null` (52w data only on held). Render 52w range bar with current + MA60 markers and buy-range overlay region. Stub note for chart (Prompt 6).
5. **POSITION** — only when `asset.position !== null`. 4×2 metrics grid. ADD/EXIT trigger banners (green/red left border, conditional). Trigger type, alert status chip, factor primary.
6. **META FOOTER** — DEEP DIVE button (stub: console.log) · Buy range · Score · Tier.

Responsive grids via inline `gridTemplateColumns` + a small companion CSS file (`AssetExpansion.css`) for the breakpoint switches (consistent with `AssetRow.css` pattern).

Shared score-chip color util — extract to a tiny helper in same file (or co-locate in `AssetRow.tsx` and import). Keep DRY: extract `scoreColor(pct)` into a small utility at the top of `AssetExpansion.tsx` and re-use within.

### Step 3 — Wire expansion into row + preview

- **`AssetRow.tsx`**: change layout so the row becomes a wrapper (`<div>`) containing the existing 48px header + (when `expanded`) `<AssetExpansion asset={asset} />` below it, full width, no indent, no extra border (expansion handles its own internal borders). Toggle/keyboard handlers stay on the header strip only so clicks inside the expansion don't collapse it.
- **`IntelligencePreview.tsx`**: no logic changes needed — `ExpandableList` already toggles rows. Just verify `top10` rerenders cleanly with expanded children. Maybe add a small note in subtitle that expansion is now live.

### Files touched

- `src/types/intelligence.ts` — add rationale types + field
- `src/hooks/useAssetIntelligence.ts` — add Supabase fetch + join
- `src/components/intelligence/AssetExpansion.tsx` — new
- `src/components/intelligence/AssetExpansion.css` — new (responsive grid breakpoints)
- `src/components/intelligence/AssetRow.tsx` — render expansion inline; isolate click handler

### Schema decision callout

The spec's assumed long format is replaced by the **actual wide format** in the DB. This is a strict improvement (no GROUP BY, single row per ticker). I'll proceed with the actual schema — flagging here so you know the spec drifted but the implementation will be cleaner.

### Out of scope (later prompts)

- Real price chart (Prompt 6)
- IntelligenceTab filters/sorts/grouping (Prompt 4)
- Wiring into HoldingsTab (Prompt 5)
- Deleting Scores/Disruption tabs (Prompt 6)
- "Ann. Ret" metric (not in AssetIntelligence yet — TODO placeholder)

### Risks

- `useRationales.ts` may already fetch one of these tables; I'll inspect it during implementation. If it's a clean superset I'll reuse; if not, the new hook fetch is independent and harmless.
- Pagination: if either rationales table grows past 1000 rows, switch to keyset pagination. Adding the `.range(0, 999)` cap with a console warn if length === 1000 for now.
