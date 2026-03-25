

## Fix Mobile Overflow Issues

### Problems Found
1. **Command Tab — Deploy Queue**: Each row uses `display: flex` with multiple `minWidth` values (50+60+60+16+50 = 236px minimum for fixed elements, plus flex content). The context text overflows on 430px.
2. **Holdings Tab**: Table columns (TICKER, NAME, MV, G/L%, DAY%, PRICE, NOTES) are too wide for 430px. Has `overflowX: auto` but the wrapper may not be constraining width properly.
3. **Scores Tab**: Similar — many columns (TICKER, LAYER, SCORE, SUB/25, DEM/22, MOAT/18, plus more off-screen). Has `overflowX: auto`.
4. **Monitor Tab**: 2-column grid (`1fr 1fr`) is fine at 430px but could be tight.
5. **Header stats**: Currently showing fine but the AUM/SIPP/ISA/TARGET area is cramped.

### Changes

**`src/components/CommandTab.tsx`**
- **Deploy Queue rows**: On mobile, switch from single-line flex to a stacked layout — ticker+tier+amount on line 1, layer+context on line 2. Remove `minWidth` constraints. Use `flexWrap: wrap` or a two-line block layout.
- Import `useIsMobile` hook.

**`src/components/HoldingsTab.tsx`**
- On mobile, hide the NOTES column (least critical data) to reduce table width.
- Alternatively, give the table a `minWidth` (e.g. 700px) inside the `overflowX: auto` wrapper so it scrolls cleanly rather than squishing columns. But since the user said "without scrolling horizontally", we should hide/collapse less important columns on mobile.
- Import `useIsMobile`. On mobile: hide NOTES column, reduce PRICE column, abbreviate NAME.

**`src/components/ScoresTab.tsx`**
- On mobile, hide the individual dimension columns (SUB, DEM, MOAT, etc.) and show only TICKER, LAYER, SCORE, and CHANGE. The detail is available in the expandable row.
- Import `useIsMobile`.

**`src/components/MonitorTab.tsx`**
- Switch from `1fr 1fr` grid to single column (`1fr`) on mobile.
- Import `useIsMobile`.

### Section order (top to bottom)
1. CommandTab Deploy Queue → stacked rows
2. HoldingsTab → hide NOTES column on mobile
3. ScoresTab → hide dimension columns on mobile
4. MonitorTab → single column on mobile

