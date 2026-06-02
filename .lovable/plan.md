## Problem

In `src/components/CommandTab.tsx` (Today's Movers card, lines ~1216–1410):

1. The WATCHLIST sub-section is gated by `hasWatchlistSection = watchlist?.length > 0`. When `watchlist` is empty *or still loading*, the entire block — including the placeholder row — disappears. Given the user says the section is "no longer" visible at all, this gate is currently failing.
2. Even when `watchlist` is populated, `wlMovers` filters out any ticker that exists in `holdingsTickers` (line 1223). If the watchlist sheet currently has every active name also held, `wlMovers` ends up empty *and* the placeholder would still need `hasWatchlistSection` to be true to render.
3. The original intent (per the `todays-movers-logic` memory) is that the WATCHLIST stripe should *always* surface inside Today's Movers so the user has a single glance at watchlist price action.

## Fix

Make the WATCHLIST sub-section a permanent part of the Today's Movers card with explicit, informative empty states, and tighten the filter so a held ticker still shows when it has a tier-1 watchlist entry that the user is tracking separately.

### 1. Always render the WATCHLIST sub-section

In `CommandTab.tsx`:

- Remove the `hasWatchlistSection &&` gate at line 1323.
- Render the WATCHLIST header (label + ▲/▼ counts) unconditionally inside the card.
- Adjust the card's outer render guard at line 1257 so the card itself is shown when `topMovers.length > 0` **or** watchlist data has loaded (i.e., not still in initial loading state). The watchlist row will always appear with a sensible state.

### 2. Three clear empty states for the sub-section body

| Condition | Copy |
|---|---|
| `watchlist` array is empty (sheet empty / not yet loaded) | `Watchlist empty — no tickers being tracked` |
| Watchlist has items but `wlMovers.length === 0` (all filtered out as held, or no price data) | `No watchlist price moves today — awaiting next refresh` |
| `wlTop.length > 0` | Render the existing row list (unchanged) |

All states share the existing borderTop / padding styling.

### 3. Stop double-filtering held tickers

Currently any watchlist row whose ticker matches a holding is removed (line 1223). That removes legitimate "watching to add more / size up" candidates. Change the rule so a watchlist row is included unless the *exact same* row would already appear in `topMovers` (i.e., it's already shown above as a holdings mover). Compare against the set of tickers actually rendered in `topMovers`, not all `deduped.keys()`.

### 4. Sanity-check `watchlist` loading

Add a one-line guard so the card render guard doesn't flicker the card off when `watchlist` is `undefined` mid-load: treat `watchlist ?? []` consistently and only consider it "loaded" once `usePortfolioData`'s overall `loading` is false.

## Files touched

| File | Change |
|---|---|
| `src/components/CommandTab.tsx` | Lines ~1216–1257: rewrite `holdingsTickers` to use the `topMovers` ticker set; update the card render guard. Lines ~1323–1410: drop `hasWatchlistSection &&`, render header always, branch body across the three empty states above. |

No data-layer, hook, or styling-token changes — purely presentational in CommandTab.

## Verification

- Holdings-only scenario: watchlist sheet empty → WATCHLIST header + "Watchlist empty" copy renders.
- Watchlist loaded but all held / no price moves → header + "No watchlist price moves today" renders.
- Normal day with watchlist movers → rows render exactly as before (no visual regression to existing layout, sparklines, entry chips, mobile/desktop branches).
