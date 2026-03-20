

## Fix: Ibiden duplicating in Watchlist

### Root Cause

The watchlist is fetched with range `A2:K50`, which skips the header row (row 1). The Google Sheets visualization API auto-detects headers from the first row of the returned range. Since row 2 is actual data (Ibiden Co), the API either:
- Treats the Ibiden row as column headers, losing that row and producing garbled column labels for all subsequent rows
- Assigns generic column labels, causing `resolveColumnLabel` to mismap columns

Either way, the column resolution breaks, and `findCol` with its fuzzy matching returns incorrect values, producing repeated "Ibiden Co" entries.

### Fix

**In `usePortfolioData.ts`**: Change the watchlist fetch range from `A2:K50` to `A1:K50` so the actual header row is included. The `fetchSheet` function already handles header-row parsing via the gviz API's auto-detection — it just needs to see the real headers.

This is a one-line change on the fetch call (~line 705).

### Files
- `src/hooks/usePortfolioData.ts` — change watchlist range from `A2:K50` to `A1:K50`

