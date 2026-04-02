

## Fix Layers Chart Labels, Invested %, Cash Bar, and Mobile Nav Bleed

### Issues

1. **Gap labels all say "under"** — The `GapLabel` component reads `props.payload.current` and `props.payload.target`, but Recharts' `<Bar label>` prop does NOT pass the full data object as `payload`. Both values resolve to `undefined → 0`, making `gap` unreliable. Need to pass `chartData` via closure and use `props.index`.

2. **Says 100% invested despite showing cash** — `investedPct` uses `totalRow?.current` from the sheet, which represents the sum of all layer current percentages (adds to ~100). It should instead be calculated as `100 - cashPct`.

3. **Chart doesn't show cash/dry powder** — User wants CASH as its own bar in the allocation chart so dry powder is visually represented.

4. **Nav bleed on mobile** — The CSS mobile tab styles apply but the inline styles in `Index.tsx` may still be conflicting (the tabs use the CSS class system now, so this should just be a CSS tweak — ensure `letter-spacing` on `.stellar-tab` doesn't cause bleed at 9px).

---

### Plan

**File: `src/components/LayersAllocation.tsx`**

1. **Fix GapLabel** — Convert `GapLabel` from a standalone function to a closure inside the component (or pass `chartData` as a prop). Use `props.index` to look up `chartData[index]` for correct `current` and `target` values.

2. **Fix investedPct** — Change calculation from `totalRow?.current` to `100 - (cashRow?.current ?? 0)`. This correctly reflects the percentage of AUM that is invested vs cash.

3. **Add CASH bar to chart** — Include the cash row in `chartData` (at the bottom of the sorted list). Give it a distinct muted color. Its `current` = cash %, `target` = 0 (no target for cash). The gap label for cash can just show the percentage without "over/under".

**File: `src/index.css`**

4. **Fix nav bleed** — Reduce `letter-spacing` on `.stellar-tab` at mobile from `0.18em` to `0.08em`, ensuring tab labels don't run together. Also add `flex-shrink: 0` to prevent tabs from compressing.

### Technical Detail

The Recharts `<Bar label={<GapLabel />}>` clones the element with props `{ x, y, width, height, value, index }`. The original data entry is NOT in `props.payload` — it varies by Recharts version. The reliable fix:

```typescript
// Inside LayersAllocation component:
const GapLabel = useCallback((props: any) => {
  const d = chartData[props.index];
  if (!d) return null;
  const gap = d.current - d.target;
  // ... render
}, [chartData]);
```

For `investedPct`:
```typescript
const investedPct = 100 - (cashRow?.current ?? 0);
```

### Files changed
- `src/components/LayersAllocation.tsx` — fix gap labels, invested %, add cash bar
- `src/index.css` — reduce mobile tab letter-spacing to prevent bleed

