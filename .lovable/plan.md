

## Fix: Mobile Layout Flashing Then Reverting

### Root Cause

The `useIsMobile()` hook initialises state as `undefined` (`!!undefined = false` → desktop). The mobile-correct value only applies **after** the first React effect fires. This causes a flash: the page renders with desktop styles, then snaps to mobile — or in the Lovable preview's simulated mobile viewport, `window.innerWidth` may report the actual iframe width (>768px), so `isMobile` stays `false` permanently despite the visual viewport being 430px.

### Fix

Two-part approach:

**1. Fix the hook to be correct on first render** (`src/hooks/use-mobile.tsx`)

Use `window.matchMedia(...).matches` for the initial state (via a lazy initialiser) so the very first render already knows the correct value — no flash:

```typescript
const [isMobile, setIsMobile] = useState<boolean>(
  () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
);
```

Also use `mql.matches` in the change handler instead of `window.innerWidth`, as `matchMedia` is more reliable across iframe/scaling scenarios.

**2. Add CSS media query fallbacks** (`src/index.css`)

For the most critical layout shifts (padding, header stacking), add CSS media queries so the layout is mobile-correct even before JS hydrates:

```css
@media (max-width: 767px) {
  #root { --app-px: 16px; }
  .stellar-header { flex-direction: column !important; height: auto !important; padding: 12px 16px !important; }
  .stellar-nav { padding: 0 16px !important; }
  .stellar-page { padding: 16px 16px 60px !important; }
}
```

Then add the corresponding class names to the JSX elements in `Index.tsx` (e.g. `className="stellar-header"`) so both CSS and JS responsive logic coexist. The JS inline styles will override on hydration, but the CSS ensures no flash.

### Files changed
- `src/hooks/use-mobile.tsx` — lazy initialiser + matchMedia-based handler
- `src/index.css` — media query fallbacks for key layout elements
- `src/pages/Index.tsx` — add classNames to header, nav, page container

