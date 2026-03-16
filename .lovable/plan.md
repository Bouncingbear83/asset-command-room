

## Problem

Two root causes for "only 3 rows":

1. **Merged sheet not wired correctly**: You merged SIPP+ISA into one sheet (gid=408093485), but the code still fetches two GIDs — `sipp: "2109415850"` (now the setup/instructions page = 0 rows → falls back to 3 static rows) and `isa: "408093485"` (the merged sheet). The "By Account" view shows 3 static SIPP rows + the ISA live data.

2. **Header truncation bug** (also affects Scores + Disruption sheets): `fetchSheet` truncates any column label >20 chars to its **last word**. The Scores sheet column A label `"ticker COMPUTE LAYER"` becomes `"LAYER"`, so `r["ticker"]` returns undefined and most rows get filtered out. Same issue on the Disruption sheet where col A is `"ticker ── CURRENT HOLDINGS ── COMPUTE LAYER"` → becomes `"LAYER"`.

## Changes

### 1. Fix header parsing — `src/hooks/usePortfolioData.ts`

Replace the "last word" truncation (lines 25-32) with a known-column matching approach:

```
const KNOWN_COLS = ["ticker","name","layer","score","score_date","substrate",
  "demand","moat","valuation","mgmt","disruption","buy_low","buy_high",
  "full_thesis","currency","tier","action","change_note","mv","account",
  "aum_pct","g/l","day","shares","price_local","prev_close_local",
  "cost_gbp","cost_local","ccy_val","code_gf","code_ft","prefix",
  "ma60","high_52w","low_52w","add_trigger","exit_trigger","notes",
  "disruption_score","sub_avail","economics","govt_support","demand_vuln",
  "time_viability","status","last_checked","amber_trigger","red_trigger",
  "evidence","row_type","type","current","unit","amber_threshold",
  "red_threshold","last_updated","target","entry target","current price",
  "trigger condition","thesis / rationale","hex color","key holdings",
  "gap / notes","priority","target %","current %",
  "%_below_52w_high","%_above_52w_low"];
```

For labels >20 chars, scan for any known column name within the label (case-insensitive). First match wins. Fallback to last word.

### 2. Merge holdings fetch — `src/hooks/usePortfolioData.ts`

- Replace `GIDS.sipp` + `GIDS.isa` with single `GIDS.holdings = "408093485"`. Remove `GIDS.sipp`.
- Rename `GIDS.isa` to `GIDS.holdings`.
- In `load()`: fetch one sheet, parse with `parseHoldings`, then split by `account` field:
  ```ts
  const allHoldings = parseHoldings(holdingsRaw);
  const sipp = allHoldings.filter(h => h.account === "SIPP");
  const isa = allHoldings.filter(h => h.account === "ISA");
  ```
- Add `account` field to `parseHoldings` map: `account: String(findCol(r, "Account", "account") ?? "")`

### 3. Update `PortfolioData` interface + consumers

- Keep `sipp` and `isa` arrays in PortfolioData (downstream components unchanged).
- `HoldingsTab`, `ReturnsTab`, `Index.tsx` continue receiving `sipp`/`isa` props — no changes needed there.

### 4. Disruption sheet row filtering

The user added a `Row_Type` column. Update `parseDisruption` to:
- Use `findCol(r, "row_type", "Row_Type")` to check for "Data" or "Watchlist" rows
- Filter out "Header" rows
- Fallback to current string-contains filter if Row_Type column not present

