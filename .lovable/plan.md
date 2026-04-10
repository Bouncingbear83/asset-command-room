

## Plan: Fix rationale access, add pricing chart to Holdings expanded row, surface Sheet thesis/notes

### Current State

1. **Rationale data exists** in `score_rationales` and `disruption_rationales` tables (populated by Research Commit workflow)
2. **RLS blocks access**: Both tables only allow SELECT for `authenticated` role. The app uses the `anon` key without authentication, so rationale queries silently return empty arrays. This is why expanded rows show no rationale data.
3. **Scores tab** already shows `changeNote || fullThesis` from Google Sheets in a Notes column, and the expanded row code already calls `fetchScoreRationales` / `fetchDisruptionRationales` — it just gets nothing back due to RLS.
4. **Holdings expanded row** already has `ThesisCard` from DB (also blocked by RLS), plus disruption panel from Sheets (amber/red triggers, evidence).
5. **daily_prices** has ~1,260 data points per ticker going back to April 2021 — excellent for a long-term pricing chart.

### Changes

#### 1. Database migration: Add anon SELECT policies to rationale tables

Add `anon` read policies to both `score_rationales` and `disruption_rationales` (same pattern used for `daily_prices`).

```sql
CREATE POLICY "Anon can read score_rationales"
  ON public.score_rationales FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read disruption_rationales"
  ON public.disruption_rationales FOR SELECT TO anon USING (true);
```

This is the primary fix — once applied, all existing rationale UI code will start working immediately.

#### 2. Holdings expanded row: Add a pricing chart

Create a new `PriceChart` component that renders an SVG line chart using `daily_prices` data for the expanded ticker. Features:

- Uses the full historical range available (up to 5 years for most tickers)
- Renders price_gbp as the main line (green/red based on overall trend)
- Overlays MA20 and MA50 as thin dashed lines (computed client-side from the data)
- X-axis: year labels. Y-axis: price range with min/max labels
- Size: full width of expanded row, ~120px tall
- Fetched on-demand when row expands (same lazy pattern as rationales)

Data strategy: The existing `useDailyPrices` hook only fetches 75 days. For the chart, we need the full history. Add a new function `fetchFullHistory(ticker)` to the hook (or a separate small hook) that queries all `daily_prices` rows for a specific ticker on expand. Cache per ticker.

Place the chart between the ThesisCard and the ADD/EXIT trigger rows in the expanded content.

#### 3. Scores tab: Surface Sheet thesis & change_note in expanded view

The expanded row already shows the DB rationale panel. Add a fallback: if the DB has no `score_rationales` for a ticker, display the Google Sheets `fullThesis` and `changeNote` fields instead (already available on the `LiveScore` object). This ensures every position shows *something* when expanded, even if the Research Commit workflow hasn't scored it yet.

#### 4. Holdings expanded row: Merge Sheet + DB disruption data

The disruption panel currently shows Sheet data (amber/red triggers, evidence, sub-scores). The DB `disruption_rationales` adds per-component rationale text. When both exist for the same ticker, merge them: keep the Sheet's numeric sub-scores and triggers as the compact row, and append the DB's rationale text below each component. This is already what `DisruptionRationalePanel` does — it just needs the RLS fix to receive data.

### Technical Details

**Files to modify:**
- New migration SQL (RLS policies for anon on 2 tables)
- `src/hooks/useDailyPrices.ts` — add `fetchTickerFullHistory(ticker)` function that queries all daily_prices for one ticker, cached in state
- `src/components/PriceChart.tsx` — new component: full-history SVG line chart with MA overlays
- `src/components/HoldingsTab.tsx` — integrate PriceChart in expanded row; call `fetchTickerFullHistory` on expand
- `src/components/ScoresTab.tsx` — add Sheet thesis/changeNote fallback when DB rationale is empty

**No changes to:** data fetching from Sheets, Price Map view, macro bar, navigation, edge functions.

