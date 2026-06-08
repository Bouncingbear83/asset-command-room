## Status of the one-line fix
`src/hooks/usePortfolioData.ts` line 199 already reads:

```ts
next[cols[index] || `col_${index}`] = cell?.v ?? cell?.f ?? null;
```

So the SCORES quartet rescue is in place. What needs to happen now is **confirming** SOI.PA / STVN / TER / TMO / TXG / VNP.TO / WAF.DE actually carry quartet values through to the UI, **and** dealing with the side effect on the Command tab's WATCHLIST movers stripe (which now reports "Watchlist empty"). Both stem from the same gviz quirk and are best handled together.

## Why a broad `cell?.f` fallback can over-reach
`cell.f` is the *formatted display string* gviz returns for every cell, including dates rendered as `"Date(2026,3,7)"` and currency cells like `"$153.00"`. For SCORES quartet columns this is exactly what we want (rescues the safeNum text values 100/165). For other sheets it can:

- Inject formatted strings into otherwise-null cells, flipping `hasContent` and `populatedCount` decisions inside the `fetchSheet` row filter.
- Convert a numeric `current` price on WATCHLIST into a `"$153.00"` string, which `parseNum` then can't read.

That is the most likely reason the Command-tab WATCHLIST movers list now sees `watchlist.length === 0` or all-null prices.

## Plan

1. **Narrow the fallback** so only the SCORES quartet columns use `cell.f`, every other column keeps the pre-fix `cell?.v ?? null` behaviour:

   ```ts
   const QUARTET_COLS = new Set([
     "bull_base","bull_stretch","bear_thesis_weak","bear_substrate_fail","bull_bear_at_date",
   ]);
   row.c?.forEach((cell, i) => {
     const col = cols[i] || `col_${i}`;
     const allowFallback = QUARTET_COLS.has(col.toLowerCase());
     next[col] = cell?.v ?? (allowFallback ? cell?.f ?? null : null);
   });
   ```

2. **Add a `.catch(() => [])`** to the WATCHLIST fetch (line 1047) so a transient gviz failure can never wipe the watchlist again:

   ```ts
   fetchSheet({ gid: GIDS.watchlist, range: "A1:Z5000" }).catch((e) => {
     console.error("[watchlist fetch] failed:", e);
     return [];
   }),
   ```

3. **Verify** after reload:
   - Console: `[watchlist parseWatchlist] in=… out=…` shows non-zero `out`.
   - Command tab → Today's Movers → WATCHLIST stripe renders ticker rows again.
   - SCORES tab: TXG / SOI.PA / STVN / TER / TMO / VNP.TO / WAF.DE all show their quartet values (BULL_BASE, BEAR_THESIS_WEAK, etc.) — the original regression that prompted the line-199 fix stays fixed.

## Files touched
- `src/hooks/usePortfolioData.ts` only.

No component edits required; Command tab and Holdings/Scores re-render automatically once parsing is corrected.
