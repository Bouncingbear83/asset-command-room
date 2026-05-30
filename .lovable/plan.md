# Live Asymmetry Ratio + China Risk — Implementation Plan

The spec is detailed and unambiguous, so this plan mirrors it directly. Work proceeds bottom-up: data plumbing → utilities → atoms → tab integrations → FactSheet.

## 1. Data plumbing — `src/hooks/usePortfolioData.ts`

- Change SCORES fetch range from `A1:AA` to `A1:AQ` (line ~979).
- Extend `parseScores` row mapping with 13 new fields (stage2Subclass, chinaExposureFlag, substrateStage, stellarType, rejectReason, anchorSizingPathway, bullBase, bullStretch, bearThesisWeak, bearSubstrateFail, bullBearAtDate, preReclassModifier, s3TransitionModifier) using existing `findCol` / `parseNum` / `parseSheetDate` helpers.
- Update the `ScoreRow` (or equivalent) TypeScript type so downstream consumers see the new fields.

## 2. New utility — `src/lib/liveAsymmetry.ts`

Create the file exactly as specified: `AsymmetryQuartet` + `LiveAsymmetryResult` types, `computeLiveAsymmetry(quartet, price)` with band thresholds 4/3/2, edge cases for price at/below bear or above bull, and `formatRatio` helper.

## 3. Atomic components

- **`src/components/AsymmetryPill.tsx`** — band-coloured mono pill with warning dot (belowBear=red, aboveBull=green, stale >90d=amber) and shadcn Tooltip showing full quartet breakdown. Optional `showStretch` prop.
- **`src/components/ChinaRiskChip.tsx`** — tiny CN exposure pill, returns `null` for blank/`N/A`/`LOW`-unmapped values; HIGH=red, MEDIUM=amber, LOW=dim.

## 4. Holdings tab

- `src/lib/url-state-holdings.ts`: add `"asymmetry"` to `HoldingsSortField` union and `SORT_FIELDS` array.
- `src/components/HoldingsTab.tsx`:
  - In the enrichment step that joins holdings with scores, build the quartet, call `computeLiveAsymmetry(quartet, holding.price)`, attach `liveAsymmetry` + `chinaExposureFlag` to each row.
  - Add `{ label: "Asym", key: "asymmetry", align: "right", sortable: true }` to `UNIFIED_COLUMNS` after "Day %".
  - Extend `sortHoldings` with the asymmetry case (null → -1 so blanks sink).
  - Render `<AsymmetryPill asymmetry={h.liveAsymmetry} />` in the new cell (desktop + mobile rows).
  - Render `<ChinaRiskChip flag={h.chinaExposureFlag} />` inline next to the ticker.

## 5. Watchlist tab

- `src/components/watchlist/WatchlistCard.tsx`: extend `DerivedRow` with `liveAsymmetry: LiveAsymmetryResult` and `chinaExposureFlag: string`; import `LiveAsymmetryResult`. Render the pill in the stats row and the chip near the ticker.
- `src/components/WatchlistTab.tsx`: in the `useMemo` that maps liveData → `DerivedRow[]`, look up matching score, compute `computeLiveAsymmetry(quartet, item.currentPrice)`, and include the two new fields. Add an "asymmetry" sort option (desc by baseRatio).

## 6. Command tab — Asymmetry Snapshot card

In `src/components/CommandTab.tsx`, after Review Queue / Action Inbox and before Quick Commands:

- `useMemo` over `portfolio.scores`. For each score, resolve a price by checking sipp/isa/bordier (case-insensitive ticker match → `price`), else watchlist (`currentPrice`). Tag origin as `HELD` or `WATCHLIST`.
- Compute `computeLiveAsymmetry`, filter `baseRatio !== null`, sort desc, take top 10.
- Render a panel-styled table with columns: Ticker, Score, Status (HELD green-dim / WATCHLIST accent-dim), Band (gold/amber/dim/muted), Live Ratio, Trend arrow (▲ green if `price < priceAtLastScore`, ▼ amber if greater).
- Ticker wrapped in `<TickerButton>` so click opens the FactSheet.
- Reuse Command-tab card styling (panel bg, rim border, mono headers).

## 7. FactSheet enhancement — `src/components/factsheet/HoldingFactSheet.tsx`

Enhance the existing asymmetry section:

- If the matching score row provides a quartet + a live price, compute `computeLiveAsymmetry` and show the live base ratio (and stretch) alongside the existing Supabase `asymmetry_ratio` string.
- Add an inline mini-bar (div-based, no chart lib): track spanning BEAR_SUBSTRATE_FAIL → BULL_STRETCH, four tick marks for the quartet, a marker for current price; gold-dim fill for upside zone (current→bull), red-dim for downside zone (bear→current). Labels in mono under each tick.

## Technical notes

- All colours via existing CSS vars (`--gold`, `--amber`, `--red`, `--text-dim`, `--panel`, `--rim`, dim variants); fonts via `--font-mono` / `--font-ui`.
- Ticker matching across Sheets vs Supabase must stay case-insensitive (project core rule).
- Do NOT touch `src/lib/asymmetry.ts` or `src/lib/rule14.ts` — Supabase string format stays separate from quartet logic.
- Pill sizing matches existing chip grammar (8–10px mono, 1–2px padding, 2–3px radius).
- New asymmetry column visible on mobile; tooltip works on tap via Radix.
- No DB migration, no edge function, no backend changes — pure frontend wiring on top of the extended SCORES fetch.

## File checklist

| File | Action |
|---|---|
| `src/hooks/usePortfolioData.ts` | Range A1:AQ; 13 new parseScores fields + type |
| `src/lib/liveAsymmetry.ts` | NEW utility |
| `src/lib/url-state-holdings.ts` | Add `"asymmetry"` to sort union + array |
| `src/components/AsymmetryPill.tsx` | NEW |
| `src/components/ChinaRiskChip.tsx` | NEW |
| `src/components/HoldingsTab.tsx` | Column, per-row compute, sort, China chip |
| `src/components/WatchlistTab.tsx` | DerivedRow compute, sort option |
| `src/components/watchlist/WatchlistCard.tsx` | DerivedRow fields, pill + chip render |
| `src/components/CommandTab.tsx` | Asymmetry Snapshot card (top 10) |
| `src/components/factsheet/HoldingFactSheet.tsx` | Live ratio + mini quartet bar |
