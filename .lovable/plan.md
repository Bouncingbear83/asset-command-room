

## Issues and Fixes

### 1. Price Map showing only one holding

The `PriceMapView` filters holdings where `h.ma60 && h.high_52w && h.low_52w && h.price != null` (line 367-369). The column parsing in `parseHoldings` uses exact uppercase names (`MA60`, `HIGH_52w`, `LOW_52w`) — if the sheet uses different casing or naming, the values parse as `null` and get filtered out.

**Fix in `usePortfolioData.ts` `parseHoldings`:**
- Add case-insensitive column lookup: check `r["MA60"]`, `r["ma60"]`, `r["Ma60"]` etc.
- Same for `HIGH_52w` / `high_52w` / `HIGH_52W` and `LOW_52w` / `low_52w` / `LOW_52W`
- Also try `PRICE_LOCAL` / `price_local` for the price field used in the filter
- Add a small helper `findCol(r, ...candidates)` to try multiple column name variants

### 2. Watchlist "VS Target" column is broken

Current logic (line 77): `curr <= entryNum` → shows "✓ IN RANGE" or "above". Two problems:
- The entry string may contain a range like "£45–£50" or currency prefixes that confuse `parseFloat` after stripping non-numeric chars (e.g. "4550" from "£45–£50")
- No visual indicator of *how far* the current price is from the target

**Fix in `WatchlistTab.tsx`:**
- Parse entry target more robustly: if the string contains a range separator (–, -, to), extract the upper bound as the comparison value
- Calculate percentage distance: `((current - entryTarget) / entryTarget) * 100`
- Replace the simple "IN RANGE" / "above" with a colored percentage badge:
  - **At or below target** (≤ 0%): green chip showing "✓ AT TARGET" or the negative percentage
  - **0–10% above**: amber chip showing "+X.X%"
  - **10%+ above**: red chip showing "+X.X%"
- Add a small inline bar showing relative distance visually (a thin horizontal gauge, similar to Price Map style)

### Files to edit
- `src/hooks/usePortfolioData.ts` — case-insensitive column lookup for MA60, HIGH_52w, LOW_52w
- `src/components/WatchlistTab.tsx` — rewrite VS Target column with percentage distance + visual bar

