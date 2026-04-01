

## Fix: Mobile Layout "Spills" After Initial Render

### Root Cause

The problem is **not** the `useIsMobile` hook or CSS media queries — those are now correct. The real issue is that **child elements with intrinsic min-width are expanding the page wider than the viewport** after React hydrates. Once any child overflows, the `<html>` / `<body>` expands horizontally, and the CSS media query `(max-width: 767px)` **stops matching** because the document is now wider than 767px. This causes the mobile styles to deactivate — the "revert."

The flash-then-revert sequence:
1. CSS media queries apply mobile styles immediately (correct)
2. React renders content with wide tables/grids/flex rows
3. A child overflows → document width exceeds 767px
4. Media queries no longer match → desktop styles apply
5. Page is now stuck in desktop layout on a mobile screen

### Fix

**`src/index.css`** — Add global overflow containment:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  min-width: 0;           /* prevent flex/grid children from expanding parent */
}

html, body, #root {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;     /* clip any remaining overflow */
}

img, table, pre, code, svg {
  max-width: 100%;        /* prevent media/code from blowing out */
}
```

Key additions:
- `min-width: 0` on `*` — flex and grid items default to `min-width: auto`, which prevents them from shrinking below their content width. Setting it to 0 allows proper shrinking.
- `overflow-x: hidden` on `html, body, #root` — even if a deeply nested element is slightly too wide, the page won't expand horizontally and break the media query.
- `max-width: 100%` on content elements — prevents images, tables, code blocks from exceeding their container.

### Files changed
- `src/index.css` — 3 small additions to existing rules (no layout changes, no component changes)

### Why this works
The media query breakpoint stays valid because the document can never exceed the viewport width. The `min-width: 0` fix addresses the root cause (flex/grid children refusing to shrink), while `overflow-x: hidden` is a safety net.

