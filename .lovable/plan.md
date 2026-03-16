

## Plan: Use Row_Type column for filtering in Scores and Disruption parsers

The Scores and Disruption sheets now have a `Row_Type` column (column A) with values: `"Header"`, `"Data"`, or `"Watchlist"`. We should use this to simplify filtering instead of fragile regex/heuristic checks.

### Changes — `src/hooks/usePortfolioData.ts`

**1. Fix header parsing (line 42):** Change `label.length <= 20` to `!label.includes(" ")` so multi-word labels like `"ticker COMPUTE LAYER"` (exactly 20 chars) get scanned against KNOWN_COLS.

**2. Add `"row_type"` to KNOWN_COLS** (already present — confirmed).

**3. Simplify `parseScores` filter (lines 197-210):** Replace all the regex header checks with a `Row_Type` check:
```ts
.filter((r) => {
  const rowType = findCol(r, "row_type", "Row_Type", "ROW_TYPE");
  if (rowType) {
    const rt = String(rowType).trim().toLowerCase();
    return rt === "data" || rt === "watchlist";
  }
  // Fallback: original ticker-based filter
  const ticker = String(findCol(r, "ticker", "TICKER") ?? "").trim();
  return ticker !== "" && !ticker.includes(" ");
})
```

**4. `parseDisruption` filter (lines 262-274):** Already uses `Row_Type` with fallback — no change needed. Just confirm the header parsing fix lets it find the column.

**5. `fetchSheet` generic row filter (lines 61-73):** The generic filter also drops rows. Since we now have `Row_Type`, we should let all rows through from sheets that have it, and only apply the generic filter as fallback:
```ts
.filter((row: any) => {
  // If row_type column exists, let the parser handle filtering
  const rowType = row["row_type"] ?? row["Row_Type"] ?? row["ROW_TYPE"];
  if (rowType !== null && rowType !== undefined) return true;
  // Original generic filter for other sheets
  ...existing logic...
});
```

This ensures `fetchSheet` doesn't pre-filter rows that parsers need to see, while sheets without `Row_Type` (watchlist, layers, etc.) keep their existing behavior.

