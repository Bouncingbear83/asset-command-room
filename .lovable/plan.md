
Goal

Fix the sheet-to-UI number scaling/parsing so percentage-based values render correctly, starting with the obviously broken Layers view shown in the screenshot, and then audit the rest of the live-sheet percentage paths to prevent similar errors elsewhere.

What I found

- The Layers screenshot shows values like 1757.3%, 1852.3%, 10000.0%, which strongly indicates whole-number percentages from the sheet are being multiplied by 100 again.
- In `src/hooks/usePortfolioData.ts`, `parseLayers()` currently does:
  - `target: typeof targetRaw === "number" ? targetRaw * 100 : 0`
  - `current: typeof currentRaw === "number" ? currentRaw * 100 : 0`
- That logic only works if Google Sheets returns fractions like `0.22`; it breaks if the sheet already stores/display values as `22` or `15.3`.
- The same risk exists in other parsers:
  - `parsePct()` always multiplies numeric inputs by 100.
  - `parseGl()` and `parseDay()` also multiply numeric inputs by 100.
- The macro banner fix for S&P YTD was done in the UI only (`Index.tsx`), which means scaling rules are currently inconsistent across the app.

Plan

1. Introduce one shared percent-normalization utility in `usePortfolioData.ts`
- Add a helper that accepts either:
  - fraction-style values (`0.153` -> `15.3`)
  - whole-percent values (`15.3` -> `15.3`)
  - percent strings (`"15.3%"`, `"0.153"`, `"1,530%"` where relevant)
- Use a clear heuristic instead of blind `* 100`, e.g.:
  - if absolute numeric value is `<= 1`, treat as fraction and convert to percent
  - otherwise treat as already-percent
- Keep this utility centralized so every percent field follows the same rule.

2. Fix Layers parsing first
- Update `parseLayers()` to use the shared percent-normalizer for both `target` and `current`.
- Preserve current visual logic in `LayersTab.tsx` once the underlying values are corrected.
- This should bring values like `17.573` or `0.17573` into a sane displayed percent instead of `1757.3%`.

3. Audit and align all other percent parsers
- Replace/adjust:
  - `parsePct()`
  - `parseGl()`
  - `parseDay()`
- Review all consumers that expect already-normalized percent values, including:
  - Returns tab performance metrics/charts
  - Holdings G/L and Day %
  - Any macro/risk-control values that may be percent-like
- Ensure there is one rule for parsing percent data and a separate rule for formatting percent data.

4. Unify macro percentage handling
- Move S&P YTD normalization closer to the data layer where possible so the UI does not need to know whether a sheet value is fractional or whole-percent.
- Then update `Index.tsx`/macro banner formatting to simply display normalized percent data once.

5. Add defensive handling for live-sheet variability
- Make parsing tolerant of:
  - raw numbers
  - strings with `%`
  - currency/spacing noise
  - possible comma/dot formatting inconsistencies
- Avoid fixed assumptions about sheet formatting drifting over time.

6. Validate impacted screens
- Check the main places likely affected by this audit:
  - Layers tab: weights, targets, diffs, bars
  - Index macro banner: S&P YTD
  - Holdings tab: G/L %, Day %
  - Returns tab: TWR fields and chart labels
  - Command/Monitor cards if any values are percent-driven
- Confirm no values are now under-scaled after removing the blind `* 100` behavior.

Expected outcome

- Layer weights display in realistic portfolio percentages.
- Differences/bar widths are mathematically consistent again.
- Percent values across the app follow one normalization rule instead of multiple ad hoc ones.
- Future sheet changes are less likely to silently corrupt numbers.

Technical notes

- Primary root cause: data-layer percent parsing currently assumes numeric sheet values are always fractions.
- Most likely fix shape:
  - add one `parsePercentLike()` helper
  - refactor existing percent-specific parsers to delegate to it
  - normalize at parse time, format at render time
- No backend/database work is needed; this is a frontend data-parsing correction only.
