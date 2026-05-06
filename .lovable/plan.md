# Drivers Tab v2 — Heatmap, Cap-Tightening Monitor, Section 3 Verification

Three additions to `src/components/DriversTab.tsx`. Pure presentation; no schema changes, no writes. All data comes from the existing `holdings` prop and `useFactorGroupWeights` hook.

## 1. Section 3 — confirm auto-activation (~20 May)

The gate already exists:

```
{distinctDays < 14 ? <placeholder> : <DriverTrendChart .../>}
```

`distinctDays` is computed from distinct `snapshot_date` values in `factor_group_weights` over the last 30 days. The chart will switch on automatically the first render where ≥14 distinct dates exist. No code change required.

Small polish:
- Update placeholder copy to show projected activation date: `Activates around <today + (14 - distinctDays) days>`.
- Add a one-line comment in `useFactorGroupWeights.ts` documenting the gate semantics.

## 2. New Section — Driver × Layer Heatmap

Insert as a new card between Section 1 (Driver Concentration bars) and Section 2 (Driver Headroom). Title: `Driver × Layer Matrix`.

Structure:
- Rows = `FACTOR_GROUP` values (same order as Section 1: by AUM% desc).
- Columns = portfolio `LAYER` values, fixed order from existing layer taxonomy used in Holdings/Layers tab (e.g. `Anchor`, `Core`, `Satellite`, `Spec`, `Hedge`, `Cash` — taken from whatever `LiveHolding.layer` actually contains; derive dynamically from `holdings`).
- Cells:
  - Metric A: sum of `aum_pct` for HELD rows in that (driver, layer) pair.
  - Metric B: count of distinct tickers in that (driver, layer) pair.
- Toggle above the matrix: `[AUM %] [Count]` segmented control, default `AUM %`.
- Empty cells render as faint dots; populated cells shaded by intensity:
  - AUM% mode: opacity `min(1, value / 15)` over the driver's brand color from `FACTOR_GROUP_COLORS`.
  - Count mode: opacity `min(1, count / 5)`.
- Cell text: `value.toFixed(1)%` or integer count, mono, gold on populated cells.
- Row total column on the right (matches Section 1 % per driver — sanity check).
- Column total row at the bottom (matches Layers tab allocations — sanity check).
- Tooltip on each cell: `DRIVER · LAYER · N positions · X.XX% AUM`.

No new dependencies; pure CSS grid + spans.

## 3. New Section — Cap-Tightening Monitor

Insert as a new card after Section 3 (30-Day Trend). Title: `Cap-Tightening Monitor (40 → 35)`.

Trigger condition (per user choice): a driver's drawdown exceeds the portfolio's drawdown by ≥ N pp (default `5`, declared as a `const TIGHTEN_DELTA_PP = 5` near top of file for easy tuning).

Definitions:
- Per-day portfolio weight = sum of `current_pct` across all groups for that snapshot_date (should be ~100, used as a sanity baseline).
- Per-driver "drawdown" = `(peak_pct_to_date − current_pct) / peak_pct_to_date` across the available history window, peak computed cumulatively day-by-day.
- Portfolio "drawdown" proxy: average of all per-driver drawdowns weighted by latest `current_pct` (we do not have a portfolio NAV series in this hook; this is a doctrine-faithful proxy using the same data source). Document this clearly inline.
- A driver is **flagged** when `(driver_dd_pp − portfolio_dd_pp) ≥ TIGHTEN_DELTA_PP` AND its latest `current_pct ≥ 30` (only matters near the cap).

UI:
- Same 14-day gate as Section 3 — show placeholder until `distinctDays ≥ 14`. Reuse the same activation-date hint copy.
- Two-column layout once active:
  - Left: small SVG chart (reuse the trend SVG shell) plotting each driver's drawdown line and a thicker portfolio drawdown line.
  - Right: list of currently-flagged drivers with `driver_dd | portfolio_dd | delta_pp | latest_pct`, color = red when flagged, dim grey when not.
- Footer note explaining the rule: `Flag = driver drawdown exceeds portfolio drawdown by ≥5pp while sitting ≥30% AUM. Doctrine-driven trigger for tightening cap from 40% to 35%.`

## Files touched

- `src/components/DriversTab.tsx` — add toggle state, heatmap section, cap-tightening section, helper functions; keep existing four sections intact and ordering: Concentration → Heatmap → Headroom → Trend → Cap-Tightening → Holdings by Driver.
- `src/hooks/useFactorGroupWeights.ts` — add doc comment only.

## Out of scope

- No DB migrations.
- No changes to ingestion / Google Sheets parsing.
- No changes to other tabs.
- No new external libs (charts stay hand-rolled SVG to match existing style).

## Verification

- Heatmap row totals match Section 1 bar values within 0.05pp.
- Heatmap column totals match Layers tab allocations within 0.05pp.
- Toggling AUM%/Count re-shades cells without layout shift.
- Cap-tightening section shows placeholder today (distinctDays < 14) and switches on automatically once 14 days are in `factor_group_weights`.
- With current data (~6–7 active drivers, no driver currently in deep relative drawdown), flagged list is empty and all rows render in dim grey.
