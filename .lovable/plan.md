

## Watchlist Redesign + AUM Cash Fix + In-Zone Count Fix

### Issues Found

**1. "0 in-zone" bug** — The `alertStatus` field in `parseWatchlist` uses `findCol(row, "alert_status", "ALERT_STATUS")`. But `resolveColumnLabel` checks `labelLower.includes("alert_status")`. If the sheet header is "Alert Status" (with space), it normalizes to `"alert status"` which does NOT contain the underscore version `"alert_status"`. The column resolves to something else (likely just "Status" via the fallback logic), so `alertStatus` always defaults to `"WAITING"`.

**Fix**: Add `"alert status"` (space version) to `resolveColumnLabel` for the watchlist alert_status column. Same issue likely affects `trigger_price_numeric` and `last_checked`.

**2. AUM missing cash** — The cash parsing uses `fetchSheetGrid` which returns raw strings. If the CASH sheet's row 1 contains labels like "SIPP Cash" / "ISA Cash" rather than just "SIPP" / "ISA", the `includes("sipp")` check should work. But there may be a structural issue (e.g., the sheet has rows like "Label | Value" instead of columnar layout). Add defensive logging and also try row-based parsing (check if column A contains "SIPP" / "ISA" labels with values in column B/C).

**Fix**: Expand cash parsing to handle both columnar and row-based layouts. Add `console.log` for debugging the raw grid.

**3. Column sorting** — Table headers are static text with no click handlers.

**Fix**: Add sortable column headers with sort state, toggling asc/desc on click.

**4. Column widths** — Currently no explicit widths; the Trigger column consumes too much space.

**Fix**: Set explicit column widths via `gridTemplateColumns` or table `colgroup`.

### Jony Ive UX Redesign for Watchlist

The current page is functional but flat. Key improvements:

**A. Hero summary strip** — Replace the small "3 buy-ready · 0 in-zone · 25 total" text with a bold, glanceable summary bar. Three large stat cards: Buy Ready (green glow), In Zone (amber pulse), Total Watching. Each card has the count as the hero number with a subtle label beneath.

**B. Buy Targets box elevation** — Give the buy targets box more visual weight: subtle green left-border accent, slightly larger typography, each item as a distinct card-row with hover state. Add a pulsing green dot next to "BUY TARGETS" label.

**C. Table refinement** — Sortable headers with a subtle arrow indicator. Fixed column widths so the layout stays stable. Status badges with more visual hierarchy. On hover, rows get a subtle glow. The Trigger column gets a max-width with text truncation and tooltip on hover.

**D. Visual rhythm** — Add subtle section dividers between the summary, buy box, and table. Use spacing and opacity to create clear visual hierarchy.

### Files to Change

- `src/hooks/usePortfolioData.ts` — Fix `resolveColumnLabel` for space-separated alert/trigger column names; fix cash parsing with row-based fallback
- `src/components/WatchlistTab.tsx` — Full redesign: summary stat cards, sortable columns, fixed widths, elevated buy box, hover states
- `src/pages/Index.tsx` — Minor: add console.log for cash debug (temporary)

### Technical Details

**resolveColumnLabel fix** — Add these before the existing underscore checks:
```
if (labelLower.includes("alert status")) return "alert_status";
if (labelLower.includes("trigger price numeric")) return "trigger_price_numeric"; 
if (labelLower.includes("last checked")) return "last_checked";
```

**Cash parsing fallback** — Check if cashGrid rows have a label-value pattern (column A = label string, column B/C = numeric values). Try matching row labels like "SIPP", "ISA", "Total" and extracting adjacent numeric cells.

**Sortable columns** — Add `sortCol` and `sortDir` state. Column headers become clickable with sort arrow indicator. Sort applies to the main table (after the status-priority pre-sort, user sort takes precedence).

**Column widths** — Use `colgroup` with explicit widths: Name (160px), Ticker (90px), Layer (80px), Entry Target (110px), Current (80px), vs Target (80px), Trigger (flex), Status (90px), Alert (70px).

