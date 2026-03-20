

## Fix: Ibiden duplicates when sorting by Status in Watchlist

### Root cause

The React `key` on each watchlist row (line 296) is `` `${item.name}-${item.ticker}` ``. When the array is re-sorted, if two items happen to produce the same key (or if React's reconciliation gets confused by the key staying the same while position changes), it can render ghost duplicates.

More critically, since the fetch range is `A1:K50` and the gviz API auto-detects headers, the header row *should* be consumed — but if it's not perfectly detected, row 1 could sneak through as a data row with name="Name", which passes the `.filter()` check. However, the user specifically sees Ibiden duplicating, not a header row.

The safest fix: use the array **index** as part of the key to guarantee uniqueness across re-sorts.

### Fix

**`src/components/WatchlistTab.tsx`**:

1. Change the main table row key from `` key={`${item.name}-${item.ticker}`} `` to `` key={`${idx}-${item.name}-${item.ticker}`} `` (using the `.map((item, idx)` index).

2. Apply the same fix to the BuyHighlightBox items (line 169) which uses the same key pattern.

### Files
- `src/components/WatchlistTab.tsx` — fix keys on lines 169 and 296

