

## Fix: Missing Holdings (DHR, SDGR)

### Root Cause
The Holdings sheet fetch range is hardcoded to `A1:AF32`, which limits it to 32 rows. DHR and SDGR sit beyond row 32 in the Google Sheet and are simply never fetched.

### Fix
**File: `src/hooks/usePortfolioData.ts`** (line 719)
- Expand the range from `A1:AF32` to `A1:AF50` to accommodate all current and future holdings with comfortable headroom.

### That's it
One-line change. No logic or parsing changes needed — the existing `parseHoldings` function will pick up the new rows automatically.

