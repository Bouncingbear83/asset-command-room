
# Mobile chrome polish — Intelligence + Holdings

Scope: tighten headings + filter bars at ≤767px only. Desktop untouched.

## What I'll inspect to confirm issues at 430px

From the current code I already know:
- `IntelligenceHeader` and `HoldingsHeader` use desktop-sized typography + horizontal padding
- `FilterDisclosure` button sits next to a wide `alwaysVisible` row containing SearchBox + MobileSortSelect + GroupToggle — at 430px the GroupToggle (4 chips with icons + labels) wraps awkwardly and pushes the Filters button onto its own line
- SearchBox is fixed-ish width and doesn't fill the row
- Header meta lines ("Showing N of M") stack but with desktop spacing
- Rationale-coverage banner uses desktop padding

## Changes (mobile-only, all gated by `useIsMobile` or `@media (max-width: 767px)`)

### Headings
- `IntelligenceHeader.tsx` + `HoldingsHeader.tsx`: reduce title font-size, tighten padding (12px → 10px vertical, 16px → 12px horizontal), drop letter-spacing slightly, allow meta line to wrap cleanly
- Rationale coverage banner in `IntelligenceTab.tsx`: smaller font, tighter padding, dismiss button stays tappable (≥32px hit area)

### Filter bar layout (`IntelligenceFilters.tsx` + `HoldingsFilters.tsx`)
Reorganise the `alwaysVisible` row on mobile into two stacked rows:
- Row A: SearchBox (full width, `flex: 1`)
- Row B: Sort select (left, flex: 1) + Filters disclosure button (right) + Group toggle as compact dropdown OR icon-only chips

Convert `GroupToggle` on mobile to **icon-only** chips (drop the label text, keep the Lucide icon + tooltip) so all 4 fit in ~140px instead of ~280px. Desktop keeps icon+label.

### Chip rows (when disclosure is open)
- Reduce chip padding (`5px 10px` → `4px 8px`) and font-size (10px → 9px) on mobile
- Tighten gap between rows (`10px` → `6px`)

### Files to edit
- `src/components/intelligence/IntelligenceHeader.tsx`
- `src/components/holdings/HoldingsHeader.tsx`
- `src/components/intelligence/IntelligenceFilters.tsx`
- `src/components/holdings/HoldingsFilters.tsx`
- `src/components/shared/filters/GroupToggle.tsx` (add `compact` / icon-only mode driven by `useIsMobile`)
- `src/components/shared/filters/Chip.tsx` (mobile size variant via CSS)
- `src/components/shared/filters/SearchBox.tsx` (full-width on mobile)
- `src/pages/IntelligenceTab.tsx` (rationale banner mobile styling)

### What stays exactly as-is
- All desktop layouts (≥768px)
- AssetRow / HoldingsTab card layouts (already shipped and working)
- All sort/filter/group/search/URL behaviour
- AssetExpansion + PriceChart
