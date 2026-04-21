

## Plan (amended & approved)

### 1. Add `normaliseTicker` helper + diagnostic logs to `src/hooks/useDailyPrices.ts`

```ts
const normaliseTicker = (t: string | null | undefined): string =>
  String(t ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
```

- Use it when building Map keys (replacing the current `.toUpperCase().trim()`).
- After the pagination loop log: `pages fetched`, `total rows`, `distinct tickers`.
- After Map build log: sorted keys + `map.get("RKLB")`.

### 2. Update `src/components/HoldingsTab.tsx`

- Import `normaliseTicker` from `useDailyPrices`.
- Replace all three lookup sites (table cell sparkline render, sort comparator, mobile card) currently using `h.ticker.toUpperCase().trim()` with `normaliseTicker(h.ticker)`.
- Add two diagnostic logs (one-time per render):
  - `console.log("[HoldingsTab] holdings tickers:", allHoldings.map(h => JSON.stringify(h.ticker)));`
  - `console.log("[HoldingsTab] RKLB lookup:", priceData?.get(normaliseTicker("RKLB")));`
- **Amendment 1** — add a third log to flag internal-whitespace data hygiene issues:
  ```ts
  console.log("[HoldingsTab] tickers with internal whitespace:",
    allHoldings.filter(h => /\s/.test(String(h.ticker).trim())).map(h => JSON.stringify(h.ticker))
  );
  ```
  Any hits indicate a Google Sheet hygiene issue to fix at source.

### 3. After user shares console output

- If hidden chars / whitespace: confirmed fixed by `normaliseTicker`. Strip logs.
- If internal-whitespace flagged: report tickers; fix in the sheet (not in the consumer).
- **Amendment 2** — if suffixed tickers (e.g. `RKLB.O`) appear: do **not** add a suffix-strip fallback. Suffixes are legitimate (`HEXA-B.ST`) and silent stripping would break them. Fix at the sheet or ingest layer instead.
- Strip all diagnostic logs once root cause is confirmed.

### Out of scope

- No source/context filters.
- No Sparkline threshold changes.
- No suffix-stripping in `normaliseTicker`.
- No DB changes.

### Files touched

- `src/hooks/useDailyPrices.ts` — add helper, normalise Map keys, 2 diagnostic logs.
- `src/components/HoldingsTab.tsx` — import helper, update 3 lookups, 3 diagnostic logs.

