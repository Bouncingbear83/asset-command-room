# Fix the Watchlist segments debug table

## Likely cause
The table appears only when the address has `debug=segments` as its own setting, and only on the Watchlist tab. When you're already on the Watchlist, the address ends `?tab=watchlist`. Adding `?debug=segments` to that gives `?tab=watchlist?debug=segments`. The app reads that as one setting, a tab called "watchlist?debug=segments". It doesn't recognise that tab, so it opens Command, and it never sees the debug switch. The address that works is `?tab=watchlist&debug=segments`, but you shouldn't have to know that.

The first step is to confirm this in the preview, signed in: open the malformed address and the `&` address, and check which one shows the table.

## Changes
1. Read the address leniently: treat a second `?` as `&`, and also accept `#debug=segments`. This applies both to choosing the tab and to the debug switch.
2. If `debug=segments` is present and no tab is named, open the Watchlist tab directly.
3. Show a small "Segments debug" label above the table, so it's obvious when the table is on.
4. Keep the debug setting in the address when you switch tabs, as it is kept now.

## Check
In the preview, open `/?debug=segments`, `/?tab=watchlist?debug=segments` and `/?tab=watchlist&debug=segments`. Each should land on the Watchlist with the parity table under the chips. Nothing else changes, and nothing writes to the sheet or the database.

## Technical details
- Add a shared `readUrlParams()` helper in `src/lib`, which normalises `location.search` (replacing extra `?` with `&`) and merges in hash params. `tabFromUrl()` in `Index.tsx` and the `debug` check in `BandChipView.tsx` both use it.
- `tabFromUrl()` defaults to Watchlist when `debug=segments` is present and no tab is named.
- Add a vitest for the helper covering the three address forms.
