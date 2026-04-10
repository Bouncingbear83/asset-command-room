

## Plan: Fix chart text legibility and verify data completeness

### Problem 1 — Text is unreadable in the chart
The SVG uses `preserveAspectRatio="none"` which stretches the chart to fill its container width. This distorts all text (x-axis labels, y-axis prices, hover tooltip) — squashing them vertically or stretching horizontally, making them illegible.

**Fix:** Change the SVG to `preserveAspectRatio="xMidYMid meet"` and set an explicit `aspect-ratio` on the container so the chart maintains proper proportions. Alternatively (and better), render all text labels as HTML overlays positioned absolutely outside the SVG, so they're never distorted by the SVG scaling. The SVG would only contain the lines/paths.

The recommended approach: use a wrapper `div` with `position: relative`, render the SVG paths inside it, and render x-axis labels, y-axis labels, and hover tooltip as absolutely-positioned HTML `<span>` elements. This guarantees crisp, readable text at any container width.

### Problem 2 — Data appears to end in early 2025
The DB confirms ASML has 1,260 rows through 2026-04-09. The `.limit(5000)` fix is in the code. The user may be seeing cached/stale data from before the fix was deployed. However, there could also be a race condition — the `cacheRef` check `if (cacheRef.current.has(ticker))` would skip re-fetching if old data was cached in a previous render cycle.

**Fix:** Add a cache-busting mechanism: clear ticker from cache when the component unmounts or when the limit was previously hit. Also add a visible "last date" indicator on the chart itself (not just the header) so truncation is immediately obvious.

### Changes

| File | Change |
|------|--------|
| `src/components/PriceChart.tsx` | Remove `preserveAspectRatio="none"`; render all text (x-axis, y-axis, hover tooltip) as HTML elements positioned over the SVG; keep SVG for paths/lines only; increase font sizes to 11-12px for labels |

Single file change. No database modifications.

