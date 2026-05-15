# Fix Japan Sleeve desktop layout

## Diagnosis

The mobile-friendly pass introduced `.js-table-wrap` and `.js-table { min-width: 880px }` inside a `@media (max-width: 767px)` block, but it also exposed a pre-existing desktop bug: the positions table is naturally wider than its grid column (13 columns including a long Notes cell), and nothing constrains it.

In `js-main` (`gridTemplateColumns: "minmax(0, 1fr) 360px"`), the left grid cell has no `min-width: 0` enforcement on its child wrappers, and `.js-table-wrap` has no `overflow-x` outside mobile. Result on the user's 2407px viewport: the table overflows its panel rightwards, the expanded-row content (Add Trigger / Exit Trigger / Last Review text) bleeds across the gutter and visually sits on top of the right-hand Doctrine Compliance / Tax Friction panels. The Notes column is also clipped beyond the panel rim.

## Fix (CSS-only, in the existing `<style>` block of `JapanSleeveTab.tsx`)

1. **Always-on overflow guard on the table wrapper** — move `overflow-x: auto; -webkit-overflow-scrolling: touch;` for `.js-table-wrap` out of the mobile media query so it applies at every viewport. Keep `min-width: 880px` on `.js-table` mobile-only.
2. **Constrain the left grid cell** — add a default `.js-main > div:first-child { min-width: 0; }` rule (or give the left panel a `js-main-left` class with `min-width: 0; overflow: hidden`) so `minmax(0, 1fr)` actually shrinks.
3. **Tighten the Notes column on desktop** — reduce its inline `maxWidth` from 180 to ~140 and let it `text-overflow: ellipsis` as today; keeps row height stable without pushing the table wider.
4. **Allow the expanded-row text to wrap within its cell** — add `overflow-wrap: anywhere; word-break: break-word;` to the expand grid container so long mono strings (e.g. `¥6,200`, `>¥7,500`) cannot extend past the cell.

## Out of scope

- No data-flow, prop, or business-logic change.
- Mobile styles already shipped remain intact.
- Right-hand compliance/tax/FX panels untouched.

## Acceptance

- At 1280–2560px, the positions table fits inside its panel; if it cannot, it scrolls horizontally inside `.js-table-wrap` instead of bleeding into the right column.
- Expanded thesis/trigger rows wrap cleanly inside the left panel; no text overlaps the Doctrine Compliance panel.
- Mobile (≤767px) layout unchanged from the previous pass.
