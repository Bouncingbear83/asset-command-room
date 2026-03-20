

## Fix: Missing Layer Names + 200% Invested Bug

### Root Cause

The LAYERS sheet has a **title row in row 1** (showing "MV (£)" as a merged header) with the actual column headers ("LAYER", "TARGET %", "CURRENT %", etc.) in **row 2**. The current fetch at line 707 does `fetchSheet({ gid: GIDS.layers })` with no range specified, so the gviz API auto-detects row 1 as headers — which has mostly empty cells and one "MV (£)" label.

This means:
- Column A ("LAYER") gets no header label → resolves to a generic key → `findCol(row, "layer", ...)` finds nothing → all layer names are empty strings
- Same issue cascades to target %, current %, hex color, etc. — some may accidentally map correctly via the fallback matching, others don't
- Since all `layer.name` values are `""`, the `totalRow` and `cashRow` lookups both fail (no name matches "TOTAL" or "CASH"), so `totalInvested` falls back to summing all layers including CASH and TOTAL rows → **200%**
- All rows have `key={layer.name}` = `""` → duplicate key warnings in console

### Fix

**`src/hooks/usePortfolioData.ts`** (line 707):
- Change `fetchSheet({ gid: GIDS.layers })` to `fetchSheet({ gid: GIDS.layers, range: "A2:H11" })`
- This skips the title row and starts from the actual headers in row 2, matching the sheet structure (rows 2–11 = headers + 9 data rows including CASH and TOTAL)

**`src/components/LayersTab.tsx`**:
- Fix duplicate keys: use index-prefixed keys (`key={`layer-${i}`}`) for all `.map()` calls on layer arrays

### Validation
- Layer names (Compute, Energy, Materials, etc.) will appear in legend and detail table
- TOTAL row found → center label shows correct ~100% invested
- CASH row found → rendered separately
- No duplicate key warnings

### Files
- `src/hooks/usePortfolioData.ts` — add range to layers fetch
- `src/components/LayersTab.tsx` — fix duplicate keys

