

## Disruption tab: rationale bug

### Root cause

In `src/components/ScoresTab.tsx` line 486, the Disruption table row passes a prefixed key to the toggle handler:

```tsx
onClick={() => toggleDisruptionExpand(`d-${d.ticker}`)}
```

But `toggleDisruptionExpand` (line 250-261) treats the argument as a ticker and calls:

```tsx
fetchDisruptionRationales(ticker);  // fetching "d-NVDA" instead of "NVDA"
```

So Supabase is queried for ticker `"d-NVDA"`, returns nothing, and the cache lookup at line 481 (`disruptionCache.get(d.ticker)` — using the un-prefixed real ticker) is always empty. Result: "No disruption rationale data for X" even when rows exist in `disruption_rationales`.

The `d-` prefix on the expanded-set key was intentional (to namespace it from the Scores-tab rows that use the same `expanded` Set with the bare ticker), but it leaked into the fetch call.

### Fix

Update `toggleDisruptionExpand` to take the real ticker, build the namespaced key internally, and fetch using the real ticker. Update the callsite to pass `d.ticker`.

```tsx
// new signature
const toggleDisruptionExpand = (ticker: string) => {
  const key = `d-${ticker}`;
  setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else { next.add(key); fetchDisruptionRationales(ticker); }
    return next;
  });
};

// callsite
onClick={() => toggleDisruptionExpand(d.ticker)}
```

The existing `expanded.has(\`d-${d.ticker}\`)` check at line 480 stays correct because the Set still stores the prefixed key.

### Files touched

- `src/components/ScoresTab.tsx` — lines 250-261 (function) and line 486 (callsite).

### Expected result

Expanding any row in the Disruption view fetches rationales for the real ticker, populates `disruptionCache` under the bare ticker, and the `DisruptionRationalePanel` renders.

