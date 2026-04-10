

## Plan: Fix data truncation — PostgREST 1000-row limit

### Root cause
Supabase PostgREST has a default server-side maximum of 1000 rows per response. The `.limit(5000)` in the JS client cannot exceed this cap. ASML has 1,260 rows ordered ascending — so only the first 1000 are returned, cutting off ~April 2025 through April 2026.

### Fix

**`src/hooks/useTickerHistory.ts`**
- Change query to order by `snapshot_date` **descending** so the most recent data is fetched first
- Reverse the array client-side after fetching
- This guarantees the latest prices are always included even if the 1000-row cap applies
- For tickers with >1000 rows, paginate with a second request to get the remaining older data (fetch desc first 1000, then fetch the next batch if needed)

Simple approach (covers all current tickers since max is ~1260 rows):
1. First fetch: `order desc, limit 1000` → gets most recent 1000 rows
2. If exactly 1000 rows returned, fetch again with `order desc, limit 1000, offset 1000` for remaining
3. Combine and sort ascending client-side

**`src/components/PriceChart.tsx`**
- No changes needed — once the data arrives correctly, the chart will render through April 2026

### Result
All tickers will show data through the present day. The most recent data is always prioritized even if pagination isn't needed.

