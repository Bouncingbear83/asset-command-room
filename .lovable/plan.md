

## Goal
Enrich Today's Movers on the Command tab with current price + a 30-day sparkline so each row gives both magnitude (% move, MV) and visual trend context at a glance.

## Current state
Each row shows: `TICKER · ▲/▼ DAY% · MV (£)`. No price, no trend.

## New row layout (desktop)
```
TICKER · PRICE · ▲/▼ DAY% · ━━━━╱╲━ (30d sparkline) · MV (£)
```

- **TICKER** — unchanged, 50px min
- **PRICE** — `currencySymbol + h.price.toFixed(2)`, mono 11px, `--text-mid`, 70px min. Same currency-symbol logic already used on the Zone Alerts card (`GBP/GBX→£`, `EUR→€`, `SEK→kr`, else `$`)
- **DAY %** — unchanged, with arrow + colour
- **Sparkline** — 30-day, reuses existing `<Sparkline />` from `src/components/Sparkline.tsx`. Width 90 × height 22. Colour driven by the sparkline's own 30-day pct change (`green/red/neutral`) — independent of today's % so it shows trend, not just today
- **MV** — unchanged, right-aligned

## Mobile (<700px)
Two-line stack to avoid horizontal cramping:
- Line 1: `TICKER · PRICE · ▲/▼ DAY%`
- Line 2: sparkline (full row width, ~140×20) · MV right-aligned

## Data wiring
- Add `useDailyPrices()` call inside `CommandTab` (already paginated, normalised, cached via single hook instance)
- For each mover: `const pd = priceData.get(normaliseTicker(m.ticker))` — render `<Sparkline points={pd.points} color={pd.sparklineColor} />` if `pd && pd.points.length >= 5`, otherwise render a faint `—` placeholder of the same width so rows don't jump
- Carry `price` and `currency` through the dedup map (currently only `ticker/day/mv`) by adding both fields when building `deduped`

## Out of scope
- No change to sort toggles (ALL / GAIN / LOSS), top-5 cap, dedup logic, or the up/down counters in the header
- No change to the Returns tab's Today's Movers (separate component, can be revisited later if you want parity)
- No new DB queries — `useDailyPrices` is already fetched elsewhere on the same page load and React will share the result via the hook's internal cache pattern (note: hook fires per-component instance; one extra paginated fetch on Command tab mount, ~2 pages, acceptable)

## Files touched
- `src/components/CommandTab.tsx` — add `useDailyPrices` import + call, extend `deduped` map shape, restyle the mover row with price + sparkline cells, add mobile two-line variant

