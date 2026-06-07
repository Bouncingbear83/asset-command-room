## Problem

The last few rows of the Watchlist sheet are not appearing in the app. Root cause is in `src/hooks/usePortfolioData.ts`:

1. **`fetchSheet` row filter (lines 194–210)** drops any row that lacks a recognized id key AND has fewer than 3 populated cells. A sparse trailing watchlist row (e.g. only Ticker + Name filled, others blank) can be dropped before it ever reaches `parseWatchlist`.
2. The watchlist fetch uses `range: "A1:S"` — gviz technically supports open-ended row syntax, but in practice it sometimes truncates at the last fully-populated row when no upper bound is given. A bounded high upper bound (e.g. `A1:S5000`) is more reliable.

`parseWatchlist`'s own filter (line 395) is already permissive — keeps any row where `ticker` OR `name` is non-empty. The drop is happening upstream.

## Fix

Two targeted changes in `src/hooks/usePortfolioData.ts`, no UI or other behaviour changes:

### 1. Make the watchlist fetch range bounded

Change line 996 from `range: "A1:S"` to `range: "A1:S5000"` so gviz returns every row in the sheet up to a guaranteed-high bound.

### 2. Loosen the upstream row filter so a single id cell is always enough

In `fetchSheet` (lines 194–210), keep the "row has any content" guard and the `row_type` guard, but when a row has a populated ticker / name / layer / type / date / key cell, accept it regardless of `populatedCount`. Only fall back to the `populatedCount >= 3` heuristic for rows that lack BOTH a row_type and any id cell. Practically this means dropping the `|| populatedCount(row) >= 3` widening and replacing it with `return hasId;` for id-bearing rows, while still allowing the populatedCount fallback for sheets like `macroState`/`cash` that have no id column. (Implementation: if `hasId` → keep; else keep only if `populatedCount(row) >= 3`.) This is already the existing logic shape — the bug is that `hasId` returns false for a watchlist row whose only populated cell happens to be ticker but whose key in `row` is `"ticker"` (which the current check already covers). I'll re-verify by logging once during dev and, if needed, also accept any row whose ticker column is non-empty via direct key lookup (`row["ticker"]`, `row["TICKER"]`, `row["Ticker"]`) as a final safety net.

### 3. Defensive verification

Add a one-shot `console.debug` (gated by `import.meta.env.DEV`) that prints the raw watchlist row count from gviz vs. the count after `fetchSheet`'s filter vs. the count after `parseWatchlist`, so any future regression is immediately visible.

## Out of scope

- No schema, sheet, or backend changes.
- No changes to other parsers (holdings, scores, layers, etc.).
- No new dependencies.

## Files touched

- `src/hooks/usePortfolioData.ts` — range bump on the watchlist fetch, filter loosening in `fetchSheet`, dev-only debug log.
