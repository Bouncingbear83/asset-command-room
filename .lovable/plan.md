

## Mobile Nav, Collapsible Narrative, Deploy Queue Improvements

### 1. Mobile-Friendly Nav Bar

**Problem**: Tab buttons at 430px are cramped — 8 tabs with `padding: 14px 10px` and `font-size: 10px` produce a long scrollable row with no visual affordance that it scrolls. Users don't realize there are more tabs off-screen.

**Fix** (`src/index.css`):
- Reduce tab padding to `12px 8px` on mobile
- Add a right fade/gradient mask on `.stellar-nav` to hint at scrollability
- Add `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on tabs for better swipe UX

```css
@media (max-width: 767px) {
  .stellar-nav {
    -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
    mask-image: linear-gradient(to right, black 85%, transparent 100%);
    scroll-snap-type: x mandatory;
  }
  .stellar-tab {
    padding: 12px 10px;
    font-size: 9px;
    scroll-snap-align: start;
  }
}
```

### 2. Collapsible Narrative Section

**Problem**: The Narrative card (Weekly Priorities, Macro Regime, Key Risk, Layer Narrative) takes significant vertical space. It's reference content — not something you act on every visit.

**Fix** (`src/components/CommandTab.tsx`):
- Wrap the narrative card in a `<details>` element (same pattern as Risk Controls, Macro Signals, Golden Rules)
- Summary shows "NARRATIVE" title + last updated date + a brief regime snippet
- Content is collapsed by default on mobile, open by default on desktop (use `open` attribute conditionally via `isMobile`)
- Keep Quick Commands outside the collapsible since those are actionable

### 3. Deploy Queue Improvements

**Problem**: On mobile, deploy queue rows use a two-line layout but it's still dense — rank number, ticker, tier badge, amount, then a second line with layer + context all jammed together. The `minWidth` and padding feel arbitrary.

**Fix** (`src/components/CommandTab.tsx`):
- Restructure each deploy item as a proper card-like block on mobile:
  - **Line 1**: `#1 · TICKER · T2` (rank, ticker bold, tier badge) — left-aligned
  - **Line 2**: `£2,400 · @150` (amount in gold, price) — left-aligned  
  - **Line 3**: `Materials · Deploy context text` (layer dim, context) — smaller, wrapping
- Add subtle bottom border between items with slightly more vertical padding (8px → 10px)
- On desktop, keep the current single-line layout but remove unnecessary `minWidth` constraints

### Files Changed
- `src/index.css` — nav scroll hint + snap for mobile
- `src/components/CommandTab.tsx` — narrative as `<details>`, deploy queue mobile card layout

