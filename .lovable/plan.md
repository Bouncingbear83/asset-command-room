

## Plan: Keep Price Map tab + add inline range bar + add sorting

### 1. Add inline 52W range bar to TriggerRows (both views)

In the `TriggerRows` component, add a third `<tr>` after ADD and EXIT rows:
- Only renders when `h.ma60`, `h.high_52w`, `h.low_52w`, and `h.price` are all present
- Label "52W" in accent color on left
- Compact horizontal range bar (same design as PriceMapView) showing low→high track, price marker, dashed gold MA60 marker
- Right side: status chip + percentage distance from MA60 in DM Mono
- Same `detailRowS` styling as the other trigger rows

### 2. Add sort controls to Price Map view

Add a sort selector row at the top of PriceMapView with three sort options:
- **% above 52W Low** — `((price - low_52w) / low_52w) * 100`, ascending (closest to low first)
- **% below 52W High** — `((high_52w - price) / high_52w) * 100`, ascending (closest to high first)  
- **60d MA distance** — `((price - ma60) / ma60) * 100`, ascending

Use toggle buttons matching the existing `ToggleButton` style. Default sort: MA distance.

Apply sort within each layer group (keeping the layer grouping intact).

### Files to edit
- `src/components/HoldingsTab.tsx`

