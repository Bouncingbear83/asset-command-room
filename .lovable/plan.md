

## Fix: Watchlist, Layers, Scores Disruption sub-tab, and Performance

### Issues identified

1. **Watchlist range too small** — fetching `A2:K20` but data goes to row 27+. No BUY highlight box at top. No macro-stop indicator. Not sorted by status.
2. **Layers missing layer NAME** — the screenshot shows key holdings but not the layer name (e.g. "Compute", "Energy"). Looking at the code, `parseLayers` reads `layer` or `name` — this should work, but the name column in the sheet might be labelled differently. Also: the bottom blue TOTAL row is meaningless (shows a bar), and CASH total row is missing.
3. **Scores — no Disruption sub-tab** — disruption data exists in the expand panel but there's no dedicated sortable view of disruption scores.
4. **Performance numbers wrong** — `parsePercentLike` is corrupting TWR values. TWR cumulative values like `8.5` (meaning 8.5%) are being treated as "already whole" by the heuristic (`> 1 → leave as-is`), but sub-period returns like `0.03` are being multiplied by 100 to get `3%`. The issue is that `calcReturn` in ReturnsTab already multiplies by 100, so if the input TWR values are already in percent form (e.g. `8.5`), the period return calc double-scales. The root cause: sheet stores TWR as whole percentages (e.g. `8.5`), `parsePercentLike` leaves them as-is, but `calcReturn` formula `((1 + endTwr/100) / (1 + startTwr/100) - 1) * 100` expects them in percent — so that part is correct. The problem is likely that `subPeriodRtnTotal` etc. are small fractions like `0.02` being converted to `2` by `parsePercentLike`, then displayed as `+2.0%` when the real value should be `+0.02%` or `+2%`. Need to check: are TWR values stored as fractions or whole numbers in the sheet? The `parsePercentLike` heuristic `abs <= 1 → fraction` is wrong for small positive returns like `0.5%` stored as `0.5`.

### Plan

**1. Watchlist — expand range, add BUY highlight box, sort by status**

- Change fetch range from `A2:K20` to `A2:K50` (accommodates growth).
- Add a "Buy Targets" highlight box at the top of WatchlistTab showing only items with status `BUY NOW` or `BUY T1`.
  - Each row: name, ticker, entry target price, current price, vs target %.
  - Show macro-stop indicator: check if `PAUSE_ACTIVE` from macroState is `YES` — if so, show a red "MACRO PAUSE — no new buys" banner inside the box.
  - Pass `macroState` to WatchlistTab from Index.
- Sort order: EXECUTE alerts → BUY NOW → BUY T1 → IN_ZONE → WAIT → WATCH → RESEARCH → PRE-IPO.

**2. Layers — show layer name, fix TOTAL row, add CASH**

- The layer name label on each row (line 105) already renders `layer.name`. The issue is likely that the sheet's first column is called "LAYER" not "name", and `parseLayers` tries `layer` first — this should work. Will verify the `findCol` logic handles this. The screenshot shows key holdings text where the layer name should be — looks like `name` is resolving to the holdings text. Will explicitly prioritize `layer` column.
- Remove the bottom TOTAL bar row (it's meaningless with a progress bar). Keep it as a summary line with just current%, target%, and MV — no bar.
- Ensure CASH row appears with current % but no target bar (already partially handled).

**3. Scores — add Disruption sub-tab**

- Add a tab switcher inside ScoresTab: "Scores" | "Disruption".
- Disruption view: table of all disruption data, sortable by each sub-score column (disruptionScore, subAvail, economics, govtSupport, demandVuln, timeViability).
- Show status badge, evidence, amber/red triggers.

**4. Performance — fix TWR percentage parsing**

- The core problem: `parsePercentLike` uses `abs(val) <= 1` as the fraction heuristic. This breaks for:
  - Small whole-percent values like `0.5` (meant to be 0.5%, gets converted to 50%)
  - Sub-period returns that are small fractions
- Fix: for PERFORMANCE fields specifically, do NOT use `parsePercentLike`. The sheet stores TWR values as whole percentages (e.g. `8.5` means 8.5%). Use raw `parseFloat` for performance fields and treat them as already-percent.
- Update `parsePerformance` to use a dedicated `parsePerformancePct` that just parses the number without the fraction heuristic.

### Files affected

- `src/hooks/usePortfolioData.ts` — expand watchlist range, fix performance pct parsing
- `src/components/WatchlistTab.tsx` — add BUY highlight box, macro-stop, accept macroState prop
- `src/components/LayersTab.tsx` — fix layer name display, fix TOTAL row
- `src/components/ScoresTab.tsx` — add Disruption sub-tab
- `src/pages/Index.tsx` — pass macroState to WatchlistTab

