## Problem

In the Layers tab → "Layer Detail" section, each layer row renders a thin profile-breakdown bar beneath it. Today only the **Compounder** segments are visible:

- Solid blue (Stellar Compounder) renders correctly
- Hatched blue (Generic Compounder) renders correctly
- All other profiles (Reclass purple, Cycle amber, Hedge grey, Vehicle slate, Pre-Prod orange) render as **invisible / transparent**, even though the chip labels below the bar show the correct percentages

Same issue affects:
- The 8×8 colour swatches in the per-layer chip labels (showing as empty boxes)
- Likely the swatches in `ProfileLegend` at the top of the tab

## Root cause

In `src/components/LayerProfileBreakdown.tsx`, the segment / swatch divs use the `background` **shorthand** property combined with a conditional `backgroundColor`:

```tsx
style={{
  width: `${widthPct}%`,
  background: fillFor(key),                  // string like "#b27bc9" OR a linear-gradient(...)
  backgroundSize: backgroundSizeFor(key),    // only set for GENERIC
  backgroundColor: key === "GENERIC_COMPOUNDER" ? "rgba(125,164,216,0.18)" : undefined,
}}
```

For non-Compounder keys this expands to `background: "#b27bc9"` with no explicit width/height handling on a flex item that has no content. Combined with the surrounding `background: "rgba(0,0,0,0.25)"` track and the fact the segment divs are empty (no min-height enforcement separate from flex stretch), the colour does not paint reliably — most browsers end up showing the track colour through.

The Compounder cases work because:
- STELLAR uses the same code path but happens to be the widest segment in most rows, so any rendering quirk is masked
- GENERIC uses `linear-gradient` (a `background-image`) which forces the browser to paint regardless

## Fix

Refactor `LayerProfileBreakdown.tsx` so colour application is explicit and consistent:

1. **Replace the `fillFor` / mixed-shorthand pattern** with two separate helpers:
   - `segmentBackgroundColor(key)` → always returns a solid CSS colour (the palette `fg`)
   - `segmentBackgroundImage(key)` → returns the diagonal-stripe gradient only for `GENERIC_COMPOUNDER`, otherwise `"none"`

2. **In each segment div** (the bar in `LayerProfileBreakdown`, the chip swatch in the labels row, the legend dot in `ProfileLegend`, and the matrix cell shading in `ProfileMatrix`), set:
   ```tsx
   style={{
     backgroundColor: segmentBackgroundColor(key),
     backgroundImage: segmentBackgroundImage(key),
     backgroundSize: key === "GENERIC_COMPOUNDER" ? "6px 6px" : undefined,
     // existing width / height / border / etc.
   }}
   ```
   No more `background:` shorthand, no more `undefined` `backgroundColor` for the non-Generic branches.

3. **Add an explicit `minHeight: "100%"` / `height: "100%"` on bar segments** so flex stretch is not relied upon to give them paint area, eliminating any zero-height edge case.

4. **For `GENERIC_COMPOUNDER`** keep the faded-blue `backgroundColor` (`rgba(125,164,216,0.18)`) under the diagonal stripes so the pattern reads clearly on the dark track.

5. **Verify the same change in three call sites** inside the file: bar segments (~line 240), label swatches (~line 273), and legend dots (~line 333). The matrix cell already uses `background:` with an `rgba(...)` derived from `paletteFor(k).fg` — keep that as-is unless the same symptom appears there (it should not, because the matrix uses a computed `rgba()` rather than a hex via shorthand).

## Out of scope

- No changes to `LayersTab.tsx`, `Index.tsx`, palette tokens, or doctrine bands
- No changes to data plumbing (`buildProfileMixIndex` is correct — `cell.mvGbp / layerMv` is the right ratio)
- No changes to the matrix or label copy

## Files touched

- `src/components/LayerProfileBreakdown.tsx` (only)
