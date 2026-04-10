

## Plan: Improve PriceChart x-axis clarity and add hover crosshair

### Problem 1 — X-axis appears to end at 2024
The x-axis only shows labels at year boundaries (where the year digit changes). For the 5Y view ending in 2025/2026, the last year label ("2025" or "2026") renders at the far right edge where it collides with the y-axis price labels (right padding = 60px). The data IS there (header shows the full range), but the axis labeling makes it look truncated.

**Fix:** Improve x-axis labeling strategy:
- For 1W/1M: show individual dates (e.g. "Apr 3", "Apr 7")
- For 1Y: show month labels ("Jan", "Apr", "Jul", "Oct")  
- For 5Y/MAX: keep year labels but also add the final date as a label at the right edge
- Ensure the last label never overlaps the y-axis by shifting it left if needed

### Problem 2 — No hover price indicator
Currently the chart is a static SVG with no interactivity beyond range buttons.

**Fix:** Add a vertical crosshair + tooltip on mouse hover:
- Track mouse position over the SVG using `onMouseMove` / `onMouseLeave`
- Map x-position to nearest data point index
- Draw a thin vertical line at that x position
- Show a small floating label with the date and price (e.g. "2024-06-15 · $294.96")
- Also show a small horizontal dot on the price line at that point
- Use React state for hover index; null when mouse leaves

### Problem 3 — Y-axis labels too subtle
The right-side price labels exist (fontSize 7) but are very small.

**Fix:** Increase y-axis label font size to 8-9px and add currency formatting.

### Files to modify

| File | Change |
|------|--------|
| `src/components/PriceChart.tsx` | Smarter x-axis labels based on range; hover crosshair with date+price tooltip; larger y-axis labels |

Single file change. No database or data changes needed.

