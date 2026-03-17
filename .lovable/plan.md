

## Root Cause Analysis

Two distinct bugs preventing data from displaying:

### Bug 1: Watchlist — Key Mismatch
`parseWatchlist` (line 177-188) uses hardcoded uppercase keys like `r["NAME"]`, `r["TICKER"]`, `r["ENTRY TARGET"]`, etc. But `fetchSheet` maps headers to lowercase KNOWN_COLS entries (`"name"`, `"ticker"`, `"entry target"`, `"trigger condition"`, `"thesis / rationale"`, `"status"`). So every field resolves to empty string.

**Fix**: Rewrite `parseWatchlist` to use `findCol()` (the same helper every other parser uses) instead of direct key access.

### Bug 2: Layers — Row Filter Drops Everything
`fetchSheet` generic filter (lines 76-79) only keeps rows that have a column matching `"ticker"`, `"name"`, `"type"`, or `"date"`. The Layers sheet has columns: `layer`, `target %`, `current %`, `mv (£)`, `hex color`, `key holdings`, `gap / notes`, `priority`. None of these match the filter criteria, so **every row is silently dropped**.

**Fix**: Add `"layer"` to the filter's recognized key check so rows with a valid layer column pass through.

### Changes: `src/hooks/usePortfolioData.ts`

| Location | Change |
|---|---|
| `parseWatchlist` (lines 177-188) | Replace all `r["UPPERCASE"]` accesses with `findCol(r, ...)` calls matching lowercase KNOWN_COLS and uppercase variants |
| `fetchSheet` filter (line 78) | Add `kl === "layer"` to the recognized-column check |

No other files need changes. Build error (`vite: command not found`) is a transient environment issue, not a code problem.

