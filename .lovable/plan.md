

## Plan: Extend watchlist range and add expandable rows with price charts to JISA tab

### 1. Extend watchlist fetch range

The current fetch is `range: "A1:N40"` — capping at 40 rows. Extend to `"A1:N80"` to capture all watchlist entries.

**File:** `src/hooks/usePortfolioData.ts` — change `range: "A1:N40"` to `range: "A1:N80"`

### 2. Add expandable holdings with price charts to JISA tab

The JISA tab currently shows flat, non-interactive rows. We'll add the same expand-on-click pattern used in HoldingsTab: clicking a row toggles an expanded section showing a price chart (using `useTickerHistory` and `PriceChart`).

**File:** `src/components/JisasTab.tsx`

- Import `useTickerHistory` and `PriceChart`
- Add `expanded` state (`Set<string>`) tracking which rows are open
- On row click, toggle expansion and call `fetchHistory(ticker)`
- Render a `PriceChart` below the clicked row when expanded (threshold >= 2 points, matching HoldingsTab)
- Add a chevron indicator to show expand/collapse state
- Works for both mobile card view and desktop table view

### Files changed

| File | Change |
|------|--------|
| `src/hooks/usePortfolioData.ts` | Watchlist range `N40` → `N80` |
| `src/components/JisasTab.tsx` | Add expand/collapse with `useTickerHistory` + `PriceChart` per holding |

