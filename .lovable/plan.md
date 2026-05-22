## Goal

Render event milestones on the fact sheet's price chart so the line is anchored to *why* moves happened — when we first added, when we re-scored, when an alert fired, and the next earnings date.

## What to mark

Sourced from data already loaded by `useFactSheetData` + `usePortfolioData` (no new queries):

| Kind | Source | Colour |
|------|--------|--------|
| `added` — First Add | resolveAnchor("first_add") date — SCORES > HOLDINGS > WATCHLIST > rationale | gold (`--gold`) |
| `scored` — every score event | `data.rationaleHistory[*].scored_at` (latest 10) | accent blue |
| `alert` — Alert fired | `holdings[].alert_fired_date` | amber |
| `earnings` — Next earnings (future only, if inside chart range) | `data.earnings.next_earnings_date` | silver, dotted |

Each milestone is `{ date: "YYYY-MM-DD", kind, label, tooltip? }`. Duplicates on the same day are merged into one marker with a combined label (e.g. "Added · Scored").

## PriceChart changes (`src/components/PriceChart.tsx`)

1. Add optional prop:
   ```ts
   milestones?: Array<{ date: string; kind: "added" | "scored" | "alert" | "earnings"; label: string; tooltip?: string }>;
   ```
2. Map each milestone's date to the nearest in-range data index (binary search on `data[i].date`). Drop ones outside the current `range` slice.
3. Render per milestone inside the existing SVG:
   - Vertical dashed line from `padTop` to `bottomY`, coloured by `kind`.
   - A small filled circle (3px) on the price line at that x.
4. Render an HTML chip layer above the SVG with a 1-char glyph (A / S / ! / E) positioned at the milestone's x, top-aligned just under the range row. Hover shows the tooltip (native `title`).
5. Add a compact legend row next to the existing "MA20 / MA50" labels.
6. Hover behaviour unchanged; if the cursor is within ~1.5% of a milestone x, the tooltip text appends "· {label}".

Performance: O(n + m); milestones are usually ≤ 15.

## HoldingFactSheet wiring (`src/components/factsheet/HoldingFactSheet.tsx`)

- Build a `milestones` memo from existing data (no new fetches).
- Pass it to `<PriceChart points={chartPoints} milestones={milestones} ... />`.
- Earnings only included when `next_earnings_date` is within the active chart window and in the future.

## Out of scope

- Transactions (buys/sells) — would need transactions passed into the fact sheet; can be added in a follow-up if useful.
- User-toggleable layers — single combined view for v1.
- Persisting hover/click state.

## Files touched

- `src/components/PriceChart.tsx` — prop + render logic.
- `src/components/factsheet/HoldingFactSheet.tsx` — assemble + pass milestones.
