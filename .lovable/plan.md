

## Acknowledge Cash in Holdings and Layers

The user has added CASH rows to the Holdings sheet and the Layers sheet now includes CASH and TOTAL rows. The AUM % figures in the sheet already account for cash. Two things need updating:

### 1. `src/hooks/usePortfolioData.ts` — `parseHoldings` filter

Currently filters `mv > 0` which is fine for cash (£143k), but also requires a non-empty ticker. The CASH row has ticker="CASH" so it should pass through. However, the `parseHoldings` filter also expects valid holding fields. No code change needed here — CASH rows with ticker="CASH" and mv>0 already pass.

**But**: `parseLayers` needs to include CASH and TOTAL rows. Currently it maps all rows. The new sheet has extra columns: `hex color`, `key holdings`, `gap / notes`, `priority`. We should parse these so LayersTab can display them.

### 2. `src/hooks/usePortfolioData.ts` — `parseLayers` enhancement

Add fields to `parseLayers` output:
- `hexColor`: from "hex color" column
- `keyHoldings`: from "key holdings" column  
- `gapNotes`: from "gap / notes" column
- `priority`: from "priority" column
- `mv`: already parsed

This replaces the need for the hardcoded `layerGapEntries` in LayersTab — we now have gap/notes and priority directly from the sheet.

### 3. `src/components/LayersTab.tsx` — Use sheet data for Layer Gap Actions

Replace the hardcoded `layerGapEntries` fallback with data from `liveData`. Each layer row now carries `gapNotes` and `priority` from the sheet. Render the "Layer Gap Actions" card from live layer data instead of intelligence state (when live data is available).

Also show `keyHoldings` in the bar chart section next to each layer name or as a subtitle.

Filter out the TOTAL row from the bar chart display (it's a summary, not a layer). Show CASH as a distinct row with appropriate styling (no target bar, just current %).

### 4. `src/pages/Index.tsx` — AUM header total

The header AUM currently sums `sipp + isa` holdings MV. Since cash is now in the holdings sheet as a row with ticker="CASH", it will be in either `sipp` or `isa` array depending on its account value. If cash rows have account="SIPP"/"ISA", the totals already include cash. If not, we may need to handle unmatched account values. The sheet image shows separate SIPP/ISA cash lines, so they should land in the correct arrays — **no change needed**.

### Summary of changes

| File | Change |
|---|---|
| `usePortfolioData.ts` | Add `hexColor`, `keyHoldings`, `gapNotes`, `priority` to `parseLayers`. Use `findCol` for robust matching. |
| `LayersTab.tsx` | Show key holdings per layer, use live `gapNotes`/`priority` for the Gap Actions card, filter out TOTAL row from bar chart, style CASH row distinctly (no target). |

