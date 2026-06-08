## Problem

You expect ~92 rows on the WATCH filter (your actual Watchlist). The card currently shows whatever happens to come out of `scores` (the SCORES sheet), with a fragile dedup that drops or duplicates watchlist rows. That is the wrong spine.

Also: `DNR.MI` is in your Watchlist but silently absent from the snapshot. Root cause is in `AsymmetrySnapshotCard` (`src/components/CommandTab.tsx`, lines 435–594):

- The loop iterates **scores** and only then runs a "watchlist-only fallback" over `wlByKey`.
- `wlByKey` is keyed by **every variant** of every watchlist ticker (alias, upper, `.`/`-` swap, `ROOT:<root>`, `NAME:<name>`). The fallback iterates each entry — so:
  - If one variant of a WL ticker (e.g. `ROOT:DNR` from some scores row like `DNR` or `DNR.US`) is in `seen`, **other variants of the same WL row still push again** → duplicates (the VARDA/X-ENERGY/4369.T warning you already saw).
  - Conversely, when *all* variants collide with `seen` keys produced by an unrelated scores row, the WL ticker is **silently dropped**. `ROOT:` keys are the worst offender — any two tickers sharing the pre-dot root collide (e.g. `DNR` vs `DNR.MI` vs `DNR.AX`).
- Net effect: the count is unstable and certain watchlist names disappear depending on what else is in scores.

## Fix

Rewrite the row-building in `AsymmetrySnapshotCard` so the **spine is Holdings ∪ Watchlist** (the 92 you actually own/watch), and `scores` is just a *quartet lookup* joined onto that spine.

### Algorithm

1. Build a `scoresByKey` lookup (same key strategy: alias, upper, `.`/`-` swap, `ROOT:`, `NAME:`).
2. Iterate the **union of Holdings + Watchlist**, deduped by canonical ticker (one row per real ticker).
3. For each spine row:
   - Pull price from holdings.price → watchlist.current.
   - Look up quartet via `scoresByKey` (first matching key wins; prefer non-`ROOT:`/non-`NAME:` matches to avoid false joins).
   - Compute `computeLiveAsymmetry(quartet, price)`.
   - `status = HELD if in holdings else WATCH`.
   - `reason` reflects why ratio is null (no price / quartet missing / above bull / below bear).
4. Sort by selected ratio. Render. `key={canonicalTicker}` — no index suffix needed.

### Why this fixes both complaints

- `WATCH` filter will return **exactly your watchlist count** (≈92), because every WL ticker contributes exactly one row.
- `DNR.MI` can no longer be eaten by a `ROOT:DNR` collision with some unrelated scores row.
- `ALL` count becomes `unique(Holdings ∪ Watchlist)`, which is what "live" should mean here.
- Duplicate-key React warnings go away because canonical ticker is unique by construction.

### Files touched

- `src/components/CommandTab.tsx` — replace the `rows` `useMemo` (lines ~435–594) and the row `key` (line 747). Remove the index-suffix hack added previously.
- No backend/schema changes. No changes to `usePortfolioData`, `liveAsymmetry`, or any other component.

### Verification

After the edit, in console:
```
window.__asymDebug.spineCount        // ≈ holdings+watchlist unique tickers
window.__asymDebug.watchCount        // ≈ 92
window.__asymDebug.missingQuartet    // list of WL tickers with no scores match
```
And confirm `DNR.MI` appears in the WATCH filter.

## Out of scope

- Changing how `scores` / `watchlist` are fetched or parsed.
- Touching any other tab.
- Any cosmetic changes to the table.

Approve and I'll implement just this.
