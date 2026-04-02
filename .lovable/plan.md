

## Fix Mobile Layout Issues Across Multiple Tabs

### Issues Identified

1. **Nav bar text bleed** — Tab labels run together with no spacing (screenshot shows "COMMANDMONITORWATCHLISTLAYERSSCORESRETURNSHOLDINGSEARNINGS CALEN..."). The tabs have reduced padding on mobile but the letters still bleed into each other.

2. **Monitor tab card overflow** — Monitor uses `gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr"` which is correct, but the inner content (metric details with "Current: ... · AMBER: ... · RED: ...") wraps poorly. The status badges and long text strings cause horizontal bleed.

3. **Layers AUM not including cash** — `parseLayers()` filters out CASH and TOTAL rows, so `LayersAllocation` can never find them. `totalMv` only sums invested layer MVs, and `dryPowder` is always £0. Need to pass cash data separately or stop filtering those rows.

4. **Layers allocation chart — over/under not clear** — The gap labels just show signed numbers like "-11.0" or "+3.0" without context. Need to append "under" / "over" text and use clearer color coding.

5. **Returns tab 3-column cards not stacking on mobile** — `ReturnsTab` doesn't import or use `isMobile`. The account cards grid is hardcoded to `repeat(3,1fr)`, making SIPP/ISA/PORTFOLIO cards unreadable at 430px.

---

### Plan

**File: `src/index.css`**
- Increase mobile tab gap/padding slightly — add `gap: 2px` to `.stellar-nav` on mobile and ensure tab padding has enough horizontal breathing room (e.g. `padding: 12px 12px` instead of `12px 10px`)

**File: `src/components/MonitorTab.tsx`**
- On mobile, reduce inner card padding from `0 20px` to `0 12px`
- For metric detail lines, break "Current · AMBER · RED" into separate lines on mobile instead of one long inline span

**File: `src/hooks/usePortfolioData.ts`**
- Stop filtering CASH and TOTAL from `parseLayers()` — remove them from the SKIP list so they pass through to the Layers components (the chart/table already filters them at the component level)

**File: `src/components/LayersAllocation.tsx`**
- Gap labels: append "under" or "over" text (e.g. "-11.0 under", "+3.0 over") for clarity
- Use red for under-allocation, green for over-allocation consistently

**File: `src/components/ReturnsTab.tsx`**
- Import `useIsMobile`
- Change account cards grid from `repeat(3,1fr)` to `1fr` on mobile so the three cards stack vertically
- Reduce card padding on mobile

### Technical Detail

The `parseLayers` SKIP list currently is `["TOTAL", "CASH", "LAYER", ""]`. Changing it to `["LAYER", ""]` will let CASH and TOTAL rows flow to `LayersAllocation` where they're already looked up via `.find()`. This fixes the AUM calculation (`layerSum + cashRow.mv`) and the Dry Powder display.

### Files changed
- `src/index.css` — nav tab spacing
- `src/components/MonitorTab.tsx` — mobile padding and text wrapping
- `src/hooks/usePortfolioData.ts` — remove CASH/TOTAL from parseLayers SKIP
- `src/components/LayersAllocation.tsx` — clearer gap labels
- `src/components/ReturnsTab.tsx` — responsive card stacking

