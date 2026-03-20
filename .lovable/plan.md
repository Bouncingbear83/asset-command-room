

## Layers: Fix Missing Layer Names + Better Visualization

### Problem 1: Missing Layer Names

The layer name column in the sheet is likely "Layer" or "Layer Name". In `resolveColumnLabel`, the regex `/\bname\b/` at line 120 fires before any "layer" check, so a header like "Layer Name" resolves to `"name"` — colliding with other name columns. Meanwhile, `parseLayers` calls `findCol(row, "layer", "LAYER", "name", "NAME")` which tries "layer" first, but the column was already mapped to "name" by the resolver.

**Fix**: Add a specific check in `resolveColumnLabel` before the generic `name` regex:
```
if (labelLower === "layer" || labelLower === "layer name") return "layer";
```

### Problem 2: Visualization Alternatives

The current horizontal progress bars are hard to read for comparing weights — it's difficult to judge relative sizes and gaps at a glance. Three strong alternatives:

**Option A: Stacked bar / donut chart** — A single donut (or two concentric rings: current vs target) gives an immediate portfolio-level view. Each segment is colored by layer. Hovering shows the detail. Clean and Ive-like.

**Option B: Side-by-side horizontal bars** — For each layer, show TWO thin bars: one for current (filled), one for target (outline/dotted). This makes the gap visually obvious per-layer. Add a small "gap" label inline.

**Option C: Grouped vertical bar chart** — Vertical bars, grouped by layer. Each group has a "current" bar and a "target" bar side by side. The gap is immediately visible as the height difference. Numbers above each bar.

**Recommendation**: **Option A (donut) + detail table below**. A donut chart for the portfolio-level overview (current allocation) with a second faint ring for targets, plus a clean tabular breakdown below showing Layer Name, Current %, Target %, Gap, and MV. This separates "at a glance" from "detail" — better information hierarchy.

### Plan

**1. Fix layer name resolution** (`usePortfolioData.ts`)
- Add `if (labelLower === "layer" || labelLower === "layer name") return "layer";` before the generic name regex in `resolveColumnLabel`

**2. Redesign Layers visualization** (`LayersTab.tsx`)
- **Top section**: Dual-ring donut chart (inner = target allocation, outer = current allocation). Each layer colored by its `hexColor`. Centered text shows total invested %. Built with SVG arcs (no library needed).
- **Below donut**: Clean detail table with columns: Layer Name (colored), Key Holdings, Current %, Target %, Gap (colored ±), MV. CASH row at bottom. TOTAL summary row with border-top.
- **Keep**: Gap Actions and Pre-IPO Watch cards below in the 2-column grid.

### Files
- `src/hooks/usePortfolioData.ts` — fix `resolveColumnLabel` for "layer" column
- `src/components/LayersTab.tsx` — donut chart + detail table redesign
