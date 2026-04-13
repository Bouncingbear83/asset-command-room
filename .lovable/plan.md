

## Plan: Extend HOLDINGS fetch range to include all rows

### Problem
The HOLDINGS sheet fetch range is hardcoded to `A1:AK35`, which cuts off at row 35. HEXA-B sits in row 36 and is excluded from the dashboard.

### Solution
Change the range from `A1:AK35` to `A1:AK50` in `src/hooks/usePortfolioData.ts`. Using 50 rows provides headroom for future additions without fetching excessive empty rows. The existing row-filtering logic (checking for valid ticker/name) already skips empty rows, so extra blank rows won't cause issues.

### Files changed

| File | Change |
|------|--------|
| `src/hooks/usePortfolioData.ts` | `"A1:AK35"` → `"A1:AK50"` |

One-line change.

