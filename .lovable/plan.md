## G(m) Drill-Through + Framework Filter

### 1. New file: `src/utils/frameworkDetection.ts`
Ship the shared framework detection utility exactly as specified in the prompt (patterns for G(m), G, H, F; `detectFramework`, `detectWatchlistFramework`, `buildFrameworkIndex` returning `Map<ticker, FrameworkEntry>`).

### 2. Refactor `src/components/command/GmExposureChip.tsx`
- Remove the local `isGmTagged` / `findGmTickers` / `findGmWatchlist` helpers.
- Build the index via `buildFrameworkIndex(scores, watchlist)` and filter for `framework === "G(m)"` to derive `allGm`, `heldGm`, `deployedCount`, `aggregateAum`, `stagedCount`. All existing breach/warn logic and colour thresholds stay identical.
- Wrap the chip in a `position: relative` container. Convert the chip itself into a `<button>` (`cursor: pointer`, keeps all current inline styling) with `aria-expanded` toggled on click. Append a small `▾` chevron after the "staged" span (or after AUM% when staged=0).
- On open, render an absolutely-positioned popover directly below the chip (`top: calc(100% + 6px)`, `left: 0`, `zIndex: 40`, `background: var(--panel)`, `border: 1px solid var(--rim)`, `borderRadius: 2`, `minWidth: 320`, `padding: 10px 12px`). Popover contents:
  - Section header "DEPLOYED · {n}" (mono, 9px, gold), then a table row per held G(m) ticker with columns **Ticker | Score | Status | AUM%**. Each row has a 2px left border in `var(--green)`.
  - Section header "STAGED · {n}" below, rows with columns **Ticker | Score | Status | Entry Target**, 2px left border in `var(--rim)`.
  - Score comes from the matching `LiveScore.totalScore`; Status from `LiveScore.heldStatus` (or watchlist item status if scores-miss); Entry Target from the matching `LiveWatchItem.entry`. If lookup misses, render `—`.
  - Ticker cell uses `TickerButton` for consistency with the rest of the app.
- Close behaviour: second click on the chip toggles closed; a `useEffect` attaches a `mousedown` listener on `document` that closes if the click target is outside the container ref.
- No changes to props — `scores`, `holdings`, `watchlist` already provide everything needed.

### 3. `src/components/WatchlistTab.tsx` — Framework filter row
- Import `buildFrameworkIndex`, `FrameworkTag` from `@/utils/frameworkDetection`.
- Add `const [frameworkFilter, setFrameworkFilter] = useState<Set<FrameworkTag>>(() => new Set())`.
- `const frameworkIndex = useMemo(() => buildFrameworkIndex(scores, liveData), [scores, liveData])` (WatchlistTab's watchlist prop is `liveData`).
- In the existing `filtered` useMemo (near line 578, alongside the stackFilter check), add the framework AND-filter clause exactly as specified. Include `frameworkFilter` and `frameworkIndex` in the dep array.
- Insert a new `ChipFilterRow` immediately after the Stack `ChipFilterRow` (around line 1177) with `label="Framework"`, `values={["G(m)", "G", "H", "F"] as const}`, `selected={frameworkFilter}`, toggle/reset handlers per spec, `isMobile={isMobile}`.

### 4. Styling / constraints
- Reuse existing CSS variables only: `--panel`, `--rim`, `--gold`, `--text`, `--text-dim`, `--text-mid`, `--font-mono`, `--green`, `--red`, `--amber`.
- Mono font, 9–11px, letter-spacing 0.08–0.15em throughout the popover.
- No new npm dependencies.

### Files touched
- `src/utils/frameworkDetection.ts` (new)
- `src/components/command/GmExposureChip.tsx` (refactor + popover)
- `src/components/WatchlistTab.tsx` (framework filter state + clause + chip row)

### Out of scope
No changes to any other filters, sort logic, hooks, or backend. Framework filter is purely additive (empty set = pass-through), matching the driver/stack filter pattern.
