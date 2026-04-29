## Goal

Wire up the new `LayerProfileBreakdown` props in `LayersTab`, then pass `holdings`, `scores`, and a navigation handler from `Index.tsx` so that the Layers tab actually renders profile-by-layer bars and the matrix can deep-link into Holdings filtered to the clicked tickers.

## Changes

### 1. `src/components/LayersTab.tsx`

Update the function signature to destructure the three new props that already exist on the `Props` interface:

```ts
export default function LayersTab({
  liveData,
  watchlist,
  narrative,
  holdings = [],
  scores = [],
  onNavigateToHoldings,
}: Props) {
```

No other changes needed — the body already references `holdings`, `scores`, and `onNavigateToHoldings`.

### 2. `src/pages/Index.tsx`

Update the `LayersTab` render line (currently line 173) to:

- Pass `portfolio.sipp + portfolio.isa` (already-held positions in `LiveHolding` shape) as `holdings`.
- Pass `portfolio.scores` as `scores`.
- Pass an `onNavigateToHoldings` handler that:
  1. Updates the URL search params to `?tab=holdings&tickers=TICK1,TICK2,...` using the existing `setSearchParams` / URL machinery.
  2. Switches the active tab to `"Holdings"` via `setActive("Holdings")`.

Concretely:

```tsx
{active === "Layers" && (
  <LayersTab
    liveData={portfolio.layers}
    watchlist={portfolio.watchlist}
    narrative={portfolio.narrativeData}
    holdings={[...portfolio.sipp, ...portfolio.isa]}
    scores={portfolio.scores}
    onNavigateToHoldings={(tickers) => {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "holdings");
      if (tickers.length > 0) params.set("tickers", tickers.join(","));
      else params.delete("tickers");
      window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
      setActive("Holdings");
    }}
  />
)}
```

The existing `tab → URL` sync effect in `Index.tsx` will then re-normalise the URL on the next tick, but the `tickers` param survives because the Holdings tab reads it on mount via `holdingsStateFromParams(searchParams)`.

JISA holdings are intentionally excluded from the layer profile mix (consistent with the existing Layers tab using `portfolio.layers`, which is sourced from the main LAYERS sheet, not JISA).

## Out of scope

- No schema changes.
- No new doctrine bands or per-layer profile targets.
- No edits to `LayerProfileBreakdown.tsx`, `HoldingsTab.tsx`, or `url-state-holdings.ts` (already done in the prior step).