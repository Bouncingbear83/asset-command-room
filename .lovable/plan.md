# Research Tab — Conclusion, Date & Price-Change Columns

Surface three new sortable columns on the Research tab table (rendered by `ReportCard` rows inside `ResearchTab`):

1. **Conclusion** (BUY / WAIT / HOLD / TRIM / SELL / ADD / etc.) — derived from existing report text
2. **Report Date** — already on the row, but make it sortable via a column header
3. **Δ Since Report** — % change between `spot_at_report` and the current live price from Google Sheets

## Data sources

- **Conclusion**: parsed from `summary` (fallback: `report_html`). Token regex matches the first occurrence of `BUY | WAIT | HOLD | TRIM | SELL | ADD | EXIT | DEPLOY | PAUSE` (case-insensitive, word-bounded). Result cached per report. If none found → `—` (sorts last).
- **Report date**: `research_reports.report_date` (existing).
- **Current price**: live Google Sheets feed already loaded by `usePortfolioData` — match by ticker (case-insensitive, per memory). Δ% = `(live − spot_at_report) / spot_at_report`. Missing live or spot → `—`.

## UI changes

Convert the current "stack of `ReportCard` buttons" list in `ResearchTab.tsx` into a table-style layout with a sticky header row exposing sort buttons:

```text
TICKER · LAYER/TIER · CONCLUSION ▲▼ · SCORE · EV/SPOT · REPORT DATE ▲▼ · Δ SINCE ▲▼ · →
```

- Reuse the existing dark-void styling (gold accents, mono font, rim borders).
- Conclusion rendered as a colored chip: BUY/ADD/DEPLOY = green, WAIT/HOLD = gold, TRIM/SELL/EXIT/PAUSE = red, unknown = dim.
- Δ Since Report colored: positive = green, negative = red, neutral = dim. Show `+12.4%` / `−5.1%`.
- Default sort: `report_date desc` (preserves today's behavior).
- Clicking the active column toggles asc/desc; clicking a new column sets desc (numeric/date) or asc (text).

## Implementation

- `ResearchTab.tsx`:
  - Pull live prices via `usePortfolioData` (same hook used elsewhere) and build a `Map<tickerLower, price>`.
  - Add `sortField` / `sortDir` state; compute `sortedReports` with `useMemo`.
  - Add a small `parseConclusion(summary, html)` helper (co-located or in `src/lib/`).
  - Replace the `ReportCard` list with a header row + body rows. Either:
    - (a) refactor `ReportCard` to accept the new columns and render in table grid, or
    - (b) introduce a new `ReportRow` component and keep `ReportCard` unused/removed.
    Plan: **(b)** — `ReportCard`'s current 4-column grid doesn't match the new layout cleanly; build a focused `ReportRow.tsx` and delete `ReportCard.tsx` once swapped.
- New component `src/components/ReportRow.tsx` (flat per memory) — grid columns matching the header, hover state, click handler opens `ReportViewer`.
- No schema changes, no migrations, no backend work.

## Mobile

Header row hides under 767px (same pattern as `IntelligenceListHeader`); on mobile the conclusion + Δ chips stack inline under the ticker, and a `MobileSortSelect` exposes the three sort options.

## Out of scope

- Persisting sort in URL state (can add later if you want it).
- Storing `conclusion` as its own DB column (using text parsing per your choice).
