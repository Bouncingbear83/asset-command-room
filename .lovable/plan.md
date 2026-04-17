

## Fix JISA G/L% column — wrong source mapping

### What's wrong

Looking at the screenshot:

| Ticker | G/L % shown | P&L £ shown | True G/L % (P&L ÷ Cost) | Return % shown |
|---|---|---|---|---|
| VWRP | +158.1% | £158 | 0.6% | +0.6% |
| SMH | +2467.1% | £2,467 | 39.5% | +39.5% |
| NVDA | +215.8% | £216 | 2.9% | +2.9% |

The **G/L % column is just echoing the £ P&L number with a `%` slapped on it.** It's reading from sheet columns AH/AI/AJ (indices 33/34/35), but those columns clearly contain GBP G/L values (same data as AE/AF/AG at indices 30/31/32 which we already use as `glGbpCol`), not percentages.

The **Return %** column is computed independently from transactions (`calcHoldingReturns` → `(mv − cost) / cost`) and is correct.

### Two options

**Option A — Drop the G/L % column entirely** (recommended)
Return % already captures the same concept (true % gain on cost basis) and is computed correctly from transactions. The sheet G/L% column is redundant and broken. Removing it tightens the table and removes the misleading number.

**Option B — Find the real G/L% columns in the JISA sheet**
Inspect the JISA sheet to locate the actual G/L % columns (likely further right than AH-AJ) and remap `glPctCol`. Keep both columns. Risk: more sheet drift.

### Recommendation

Go with **Option A**. Reasoning:
- Return % is doctrine-correct (Average Cost Method, computed from TRANSACTIONS) — matches the methodology used elsewhere in the dashboard
- The sheet's G/L % column adds nothing Return % doesn't already give
- Fewer columns = cleaner table, especially given Cost £ + P&L £ + Return % + Ann. Return already cover the return story

### Files touched (Option A)

- `src/components/JisasTab.tsx` — remove the `<th>G/L %</th>` and corresponding `<td>` from the desktop table; remove the duplicated G/L% chip from the mobile card (line 316); keep child-summary G/L (computed from cost vs MV — that one's correct).
- `src/hooks/usePortfolioData.ts` — leave `glPct` field in the interface for now (no harm, just unused); optionally drop `glPctCol` from `CHILDREN_MAP` later.

### Expected result

JISA holdings table goes from 13 columns → 12 columns. Return % becomes the single source of truth for per-holding % gain. No more "+2467.1%" lies.

