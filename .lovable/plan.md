## Issue
The Holdings data fetch in `usePortfolioData.ts` is hard-capped at `A1:AM50` (line 995). Any holdings entries beyond row 50 are silently omitted from the app.

## Fix
Change the range from `"A1:AM50"` to `"A1:AM"` (unbounded) so all holdings rows are fetched, matching the fix previously applied to the Watchlist range.

## File
- `src/hooks/usePortfolioData.ts` — line 995

## Impact
All holdings entries will be available regardless of how many rows the sheet grows to.