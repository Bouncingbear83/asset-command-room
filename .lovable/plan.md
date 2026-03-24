

## Make the App Mobile-Friendly

### Problem
The app uses fixed `40px` padding, a wide header with stats that don't wrap, horizontally overflowing tabs, and content that assumes desktop widths. On a 430px viewport everything is cramped.

### Changes

**File: `src/pages/Index.tsx`**

1. **Header** — Stack vertically on mobile:
   - Reduce padding from `40px` to `16px` on small screens
   - Move the AUM/SIPP/ISA/TARGET stats row below the logo, wrapping into a 2×2 grid
   - Reduce header height from fixed `56px` to `auto`

2. **Tab nav** — Make scrollable and touch-friendly:
   - Reduce padding from `0 40px` to `0 16px`
   - Reduce individual tab padding from `20px` to `12px 10px`
   - Hide the scrollbar with `scrollbarWidth: "none"` / `msOverflowStyle: "none"`

3. **Status bar** — Reduce padding to `5px 16px`

4. **Macro banner** — Reduce padding to `0 16px`, allow wrapping

5. **Page container** — Reduce padding from `32px 40px 80px` to `16px 16px 60px` on mobile

6. **Responsive detection** — Use a simple inline media-query approach: check `window.innerWidth` via a `useIsMobile()` hook (already exists at `src/hooks/use-mobile.tsx`) to toggle between mobile/desktop style objects.

**File: `src/components/CommandTab.tsx`**

7. **Quick Commands grid** — Currently uses `gridTemplateColumns: "1fr 1fr"` for the command buttons; keep as-is (already works at 430px)

**File: `src/components/HoldingsTab.tsx`**

8. **Table overflow** — Wrap the table in a horizontally scrollable container on mobile so columns don't get crushed

**File: `src/components/WatchlistTab.tsx`**

9. **Row padding** — Reduce card padding from `20px` to `12px` on mobile

**General pattern**: Import `useIsMobile` in `Index.tsx` and pass an `isMobile` boolean down as needed, or use the hook directly in child components. All style changes are conditional on this flag — desktop layout stays untouched.

### Summary of visual changes
- Tighter padding throughout (40px → 16px)
- Header stats wrap below logo on mobile
- Tabs scroll horizontally without visible scrollbar
- Tables get horizontal scroll containers
- No layout breakage on desktop

