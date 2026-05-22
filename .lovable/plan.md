## Audit: Fact Sheet vs. Sheets + Supabase

Below is everything the data layer carries for a ticker but the popout does NOT currently render. Anything not listed is already surfaced.

### Sheets — gaps

**HOLDINGS row** (`LiveHolding`):
- `priceAtFirstAdd` / `firstAddDate` / `priceAtLastScore` — Price Anchors (was previously added to AssetExpansion, never to the fact sheet)
- `prevClose`, `costLocal`, `notes`
- `pct_below_52w_high`, `pct_above_52w_low` (proximity to range)
- `ma60` (matches the price strip's MA20/MA50)
- `trigger_type`, `trigger_price_add`, `trigger_price_exit` (currently only free-text ADD/EXIT shown)
- `alert_fired_date`, `deploy_note`, `trigger_review_date`, `trigger_review_note`

**WATCHLIST row** (`LiveWatchItem`):
- `priceAtFirstAdd` / `firstAddDate` / `priceAtLastScore`
- `triggerPriceNumeric`, `alertStatus`, `lastChecked`
- `deploy_amount_gbp`, `triggerReviewDate`, `triggerReviewNote`

**SCORES row** (`LiveScore`):
- `scoreDate`, `thesisAgeMonths`
- Anchor trio (mirrors of the above)

**EARNINGS_CALENDAR row**: only triggers the blackout banner; never shown as its own block (`nextEarningsDate`, `fiscalPeriod`, `confirmed`, `lastUpdated`, days-until).

### Supabase — gaps

**`score_rationales`**: `price_at_scoring`, `mv_gbp_at_scoring`, `scored_by`, `scored_at`-as-meta (only embedded in history list today).

**`disruption_rationales`**: per-subscore rationales (`sub_avail_rationale`, `economics_rationale`, `govt_support_rationale`, `demand_vuln_rationale`, `time_viability_rationale`), `amber_trigger`, `red_trigger`, `status`, `change_note`, `scored_at`, `scored_by`. Today only the 5 numbers + `evidence` show.

**`narrative_signals`**: not queried by the fact sheet at all. Relevant per-ticker headlines/snippets/url/published_date/strength/review_status are invisible inside the popout.

**`alerts_log`**: not queried. Recent fires (`alert_type`, `previous_status → new_status`, `trigger_value`, `threshold`, `note`, `triggered_at`) are invisible.

## Plan

Add to `useFactSheetData.ts`:
1. Two parallel Supabase queries: `narrative_signals` (latest 5 for ticker) and `alerts_log` (latest 5 for ticker), both filtered by `tickerVariants`.
2. Extend `FactSheetData` with `narratives: NarrativeRow[]` and `alerts: AlertRow[]`.

Add to `HoldingFactSheet.tsx` (in this order, after existing sections):

A. **Price Anchors block** (always, when score/holding/watch has any of the three): two cells — First add (price · date · pct from now), Last score (price · pct from now), reusing the same precedence as `useAssetIntelligence` (SCORES > HOLDINGS > WATCHLIST > Supabase `score_rationales`).

B. **Earnings block** (when `data.earnings`): date · fiscal period · confirmed · days until · last updated. Sits above existing "Earnings prep" button.

C. **Position (HELD) v2**: append cells for `prevClose`, `ma60`, `pct_below_52w_high`, `pct_above_52w_low`, `costLocal`, `alert_fired_date`. Add a small "Triggers" sub-line showing `trigger_type · trigger_price_add · trigger_price_exit`. Show `deploy_note`, `trigger_review_date`/`note`, `notes` as a stacked footer below the grid.

D. **Watchlist (WATCH) v2**: append `triggerPriceNumeric`, `alertStatus`, `lastChecked`, `deploy_amount_gbp`, `triggerReviewDate`/`Note` to the existing grid.

E. **Score meta strip** under the 6D grid title: `scoreDate · thesisAgeMonths mo · scored_by · price_at_scoring (CCY) · mv_gbp_at_scoring`.

F. **Disruption v2**: expand each of the 5 sub-score tiles into a small accordion (or always-on caption) showing its rationale; below the row show `status`, `amber_trigger`, `red_trigger`, `change_note`, and `scored_at · scored_by`.

G. **Narrative Signals block** (when rows exist): up to 5 rows — strength chip, signal_class, headline (linked to `url`), snippet, published_date, source_table. Reuse the styling pattern from `NarrativeSignalsCard`.

H. **Alerts Log block** (when rows exist): up to 5 rows — triggered_at, alert_type, previous_status → new_status, trigger_value vs threshold, note.

### Non-goals

- No business-logic changes (precedence rules, banner triggers, webhooks, Claude deep-link prompt all stay).
- No styling overhaul — reuse `sectionStyle`, `sectionTitle`, `Cell`, `monoLabel`.
- No new tables, RLS, or edge functions; all four Supabase tables already allow anon SELECT.

### Validation

- Pick one HELD ticker with a populated `score_rationales` row and one WATCH-only ticker (e.g. ENR.DE) and confirm every new block renders or hides cleanly.
- Confirm narrative_signals + alerts_log queries return 0 rows without throwing for tickers with no history.
- Confirm sheet recompute event still updates the new Price Anchors block.
