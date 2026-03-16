

## Problem

The `parseHoldings` filter (line 101-104) strictly checks `r["TICKER"]` and `r["MV (£)"]` by exact key. But the Google Sheets header parsing (lines 25-31) mangles long decorated headers — if the SIPP/ISA sheet headers are like `🌌 STELLAR — SIPP … MV (£)`, the parsed key becomes just `(£)` (last word). So `r["MV (£)"]` returns `undefined` for most rows, and the filter drops them.

Only 3 rows happen to match because their columns align by chance.

## Fix — `src/hooks/usePortfolioData.ts`

Update the `parseHoldings` filter (lines 101-104) to use `findCol` for flexible column matching, consistent with how other parsers work:

```ts
.filter((r) => {
  const ticker = findCol(r, "TICKER", "ticker");
  const mv = findCol(r, "MV (£)", "MV", "mv");
  return ticker && String(ticker).trim() !== "" && typeof mv === "number" && mv > 0;
})
```

Also update all the direct `r["TICKER"]`, `r["NAME"]`, `r["LAYER"]`, `r["MV (£)"]`, etc. references inside the `.map()` (lines 107-125) to use `findCol` instead, so they match regardless of how the header was parsed:

```ts
.map((r) => ({
  ticker: String(findCol(r, "TICKER", "ticker") ?? ""),
  name: String(findCol(r, "NAME", "name") ?? ""),
  layer: String(findCol(r, "LAYER", "layer") ?? ""),
  mv: parseMv(findCol(r, "MV (£)", "MV", "mv")),
  gl: parseGl(findCol(r, "G/L %", "G/L%", "gl")),
  day: parseDay(findCol(r, "DAY %", "Day %", "day")),
  notes: String(findCol(r, "NOTES", "notes") ?? ""),
  action: String(findCol(r, "ACTION", "action") ?? "HOLD"),
  // ... rest stays the same (already uses findCol)
```

Single file change. The `findCol` function already exists and does case-insensitive fallback matching.

