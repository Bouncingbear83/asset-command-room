# Fix "No current price" on Asymmetry for rows that clearly have a price

## What the user is seeing
Names in the Asymmetry snapshot are tagged "No current price" even though those tickers DO have a current price in HOLDINGS or WATCHLIST. So the price-lookup join is failing, not the data.

## Suspected root causes (to confirm with a one-shot diagnostic, then fix)

1. **Watchlist "current price" column header drift.** `parseWatchlist` only matches `"current price" | "CURRENT PRICE" | "Current Price"`. If the sheet header is `Current_Price`, `current_price`, `Price`, `CURRENT`, or has a trailing space / NBSP, `w.current` becomes `null` and the watchlist never contributes a price.
2. **Ticker join mismatch between SCORES ↔ HOLDINGS/WATCHLIST.** `normaliseTicker` only uppercases + strips whitespace and applies a tiny alias map. It does NOT reconcile exchange-suffix drift (`4109` vs `4109.T`, `KODT` vs `KODT.ZA`, `RHM.DE` vs `RHM`, etc.), nor `.`/`-` swaps. If SCORES carries a bare ticker and HOLDINGS/WATCHLIST carries the suffixed form (or vice versa), the lookup misses.
3. **Hidden whitespace / zero-width chars** on one side only — already partially handled by `normaliseTicker`, but only after uppercasing; need to verify with raw dump.

## Plan

### Step 1 — Add a temporary DEV-only diagnostic (no UX change)
In `AsymmetrySnapshotCard`, when `import.meta.env.DEV`, stash on `window.__asymDebug`:
- `priceKeys`: all keys in `priceByKey` (so we can see exactly what HOLDINGS/WATCHLIST contributed).
- `wlSample`: first 10 `{ raw: w.ticker, name: w.name, current: w.current, currentRaw: w.currentRaw, keys: addKeys(w.ticker) }` — confirms the column-header parse.
- `missingPrice`: for every row pushed with `reason === "No current price"`, log `{ scoreTicker, keysTried: addKeys(s.ticker), name: s.name }`.

Also `console.info("[asym]", ...)` a compact summary so the user can copy-paste back if needed.

### Step 2 — Harden Watchlist current-price parsing
In `parseWatchlist`, extend the header list and normalise:
```ts
const currentRawVal = findCol(row,
  "current price", "CURRENT PRICE", "Current Price",
  "current_price", "CURRENT_PRICE", "Current_Price",
  "price", "PRICE", "Price",
  "current", "CURRENT", "Current"
);
```
(Keep existing `currentRaw` string for display.)

### Step 3 — Stronger ticker-join in Asymmetry
Replace `addKeys` with a key-set that also includes:
- raw uppercase with whitespace/zero-width stripped,
- `.` ↔ `-` swap variants (use existing `tickerVariants`),
- the bare root before the first `.` (e.g. `4109.T` → also key on `4109`), to bridge SCORES ↔ holdings drift,
- the `name` (uppercased, trimmed) as a last-resort key — populate both `priceByKey` and `wlByKey` under the name key too, and try it in `lookupPrice` only when ticker keys miss.

Order in `lookupPrice`: ticker variants first, then root, then name fallback. Never overwrite an existing key.

### Step 4 — Reason text reflects the new logic
If a row still has no price after Step 3, keep `"No current price"`; otherwise the reason will naturally switch to a quartet-component message (e.g. "Missing BULL_BASE") or disappear.

### Step 5 — Verify
1. Reload preview, open Command tab, expand Asymmetry.
2. In console: `Object.keys(window.__asymDebug.priceKeys).length`, then `window.__asymDebug.missingPrice` — confirm none of the user's HOLDINGS/WATCHLIST names appear.
3. Visually scan: rows previously tagged "No current price" should now either show a real ratio or a quartet-related reason.
4. Remove the DEV diagnostic (or leave behind a single `window.__asymDebug` since the watchlist debug pattern is already accepted) — confirm with user before removing.

## Files touched
- `src/hooks/usePortfolioData.ts` — widen `parseWatchlist` current-price headers.
- `src/components/CommandTab.tsx` — stronger `addKeys` / `lookupPrice`, DEV-only `window.__asymDebug`.

No business-logic or backend changes; this is presentation-layer data-joining only.
