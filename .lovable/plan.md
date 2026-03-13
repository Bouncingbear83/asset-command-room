

## Root Cause: Price Map showing only one holding

The Google Sheets API returns column labels that include decorative header text. For example, the SIPP sheet's first column label is:

```text
"🌌  STELLAR — SIPP  ·  ~£575k · Pension wrapper · Long horizon TICKER"
```

This means `r["TICKER"]` is `undefined` for every holding, so `ticker` parses as `""` for all of them. The PriceMapView deduplicates by `h.ticker` — with every holding having ticker `""`, they all collapse into a single entry (Cameco, the first one with MA60 data).

LayerView doesn't deduplicate, so it shows everything fine. The inline 52W bars also work because they don't depend on ticker for dedup.

## Fix 1: Clean up column labels in `fetchSheet` (`usePortfolioData.ts`)

On line 25, after extracting column labels, detect long decorative labels (length > 20) and extract just the last word, which is the actual column name:

```ts
const cols: string[] = json.table.cols.map((c: any) => {
  const label = (c.label as string).trim();
  if (label.length > 20) {
    const parts = label.split(/\s+/);
    return parts[parts.length - 1];
  }
  return label;
});
```

This turns `"🌌  STELLAR — SIPP ... TICKER"` → `"TICKER"`, fixing the lookup for all sheets.

## Fix 2: Safer dedup in PriceMapView (`HoldingsTab.tsx`)

Change the dedup key from `h.ticker` to `h.ticker || h.name` as a safety net, so even if ticker is empty, holdings with different names aren't collapsed.

## Fix 3: Visual improvements — thicker, brighter bars

Both the inline range bar and PriceMapView bar are currently:
- **3px tall** with `var(--muted)` background (very dark, hard to see)
- **2px wide** price marker

Change to:
- **6px tall** track bar with a brighter background (`rgba(110,142,200,0.25)` — accent-tinted)
- **3px wide** price marker
- Slightly brighter low/high labels

### Files to edit
- `src/hooks/usePortfolioData.ts` — line 25 column label cleanup
- `src/components/HoldingsTab.tsx` — dedup key fix + bar thickness/color in both `InlineRangeBar` and `PriceMapView`

