

## Collapsible Watchlist Rows

### What changes
Make each watchlist row compact by default — showing only **Line 1** (Ticker · Name · Layer · Status) and **Line 2** (Target · Current · ±%) — with the rest (trigger text, rationale, review card, action buttons) revealed on click/expand.

### How

**File: `src/components/WatchlistTab.tsx`**

1. Add `expandedTickers` state (`Set<string>`) to the `WatchlistRow` component (local state per row using `useState`).

2. Restructure `WatchlistRow` layout:
   - **Always visible (collapsed):** Lines 1 & 2 (ticker/name/layer/status + target/current/%) plus a small expand chevron (▸/▾) on the right side.
   - **Expandable (on click):** Lines 3–6 (trigger condition, rationale, review card, action buttons) — wrapped in a conditional render toggled by clicking the row header area.

3. The row header div gets `cursor: pointer` and an `onClick` that toggles the expanded state.

4. Use a simple `ChevronRight`/`ChevronDown` icon (from lucide-react, already available in the project) at the far right of line 1 to indicate expandability.

5. No external state needed — each `WatchlistRow` manages its own `expanded` boolean via `useState(false)`.

### Visual behaviour
- Collapsed: single compact row (~2 lines of content)
- Expanded: full detail card as it appears today
- Smooth transition not strictly necessary but can add CSS transition on max-height if desired

