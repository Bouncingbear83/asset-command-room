

## Problem

The Google Sheets SIPP/ISA tabs have a placeholder row (e.g. "Add new rows above this line") that passes the filter on line 41 of `usePortfolioData.ts` because it matches the `NAME` check — any row with text in the NAME column gets through.

## Fix

Add a guard in `parseHoldings` (line 99) or tighten the `fetchSheet` filter (line 41) to skip rows where `TICKER` is empty/missing or where `NAME` contains placeholder text like "add new" or similar.

The simplest and most robust approach: in `parseHoldings`, filter out any row where `TICKER` is falsy or where `MV (£)` is not a valid number. A real holding always has both a ticker and a market value.

### File: `src/hooks/usePortfolioData.ts`

**Line 99-120** — wrap `parseHoldings` with a pre-filter:

```ts
function parseHoldings(rows: Record<string, any>[]) {
  return rows
    .filter((r) => {
      const ticker = r["TICKER"];
      const mv = r["MV (£)"];
      return ticker && String(ticker).trim() !== "" && typeof mv === "number" && mv > 0;
    })
    .map((r) => ({
      // ... existing mapping unchanged
    }));
}
```

This filters out any placeholder/instruction rows that lack a real ticker or have no market value. Single file, single change.

