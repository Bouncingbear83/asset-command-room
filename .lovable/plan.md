

## Plan: Fix 5 remaining issues

### Issue 1 — CASH parser still broken (AUM excludes cash)

The row-based fallback on line 917-918 does:
```
const label = labelA || labelB;
```
Column A contains `"Date(2026,3,7)"` which normalizes to `"date(2026,3,7)"` — this is truthy, so it always wins over column B's `"sipp"` / `"isa"`. The `label.includes("sipp")` check never matches.

**Fix:** Change the label selection logic to prefer whichever column contains a known keyword (sipp, isa, total, jisa), regardless of position:
```typescript
const labelA = normalizeToken(row[0]);
const labelB = normalizeToken(row[1]);
const KNOWN = ["sipp", "isa", "total", "jisa"];
const aIsLabel = KNOWN.some(k => labelA.includes(k));
const bIsLabel = KNOWN.some(k => labelB.includes(k));
const label = aIsLabel ? labelA : bIsLabel ? labelB : "";
const valueCol = bIsLabel && !aIsLabel ? 2 : 1;
```

**File:** `src/hooks/usePortfolioData.ts` lines 915-919

### Issue 2 — No thesis/change rationale in Holdings expanded row

Only 4 tickers have DB rationales. For the ~30 other holdings, `thesisRationale` is null so ThesisCard doesn't render. The Sheet's `fullThesis` and `changeNote` from `LiveScore` should display as fallback.

**Fix:** In `TriggerRows`, when `thesisRationale` is null/missing, show the Sheet score's `fullThesis` and `changeNote` if available (from the `score` prop which is a `LiveScore`).

**File:** `src/components/HoldingsTab.tsx` — TriggerRows component (~line 249-253)

### Issue 3 — Sparkline data disagreement

The sparkline uses `priceGbp` from the last 30 data points of `useDailyPrices` (75-day window). The scaling fix IS applied. The user may be seeing correct data that looks unexpected due to FX-converted prices. Add a console log temporarily to debug, and also ensure the sparkline tooltip/title shows the date range being used.

**Fix:** Add a `title` attribute to the sparkline SVG showing the date range (first–last date of the 30 points), so the user can verify what data is being shown.

**File:** `src/components/Sparkline.tsx`

### Issue 4 — Charts ending in 2025

The `useTickerHistory` fetches all `daily_prices` for a ticker. Data runs to 2026-04-09. However, `useTickerHistory.fetchHistory` has `[cache]` in its dependency array, which is problematic — when a ticker is fetched and cache updates, the next call to `fetchHistory` for a different ticker creates a new function identity. More critically, if there's a stale closure, `cache.has(ticker)` might return false when it shouldn't, causing re-fetches, or vice versa. But the real issue is likely the default Supabase 1000-row limit — for tickers with 1200+ rows, the query is silently truncated at row 1000, cutting off 2025-2026 data.

**Fix:** Add `.limit(5000)` to the `useTickerHistory` query. Also remove `cache` from the `useCallback` dependency array — use a ref instead to avoid stale closures.

**File:** `src/hooks/useTickerHistory.ts`

### Issue 5 — PriceChart toggle buttons not visible

The buttons ARE in the code. They may be rendering but invisible due to CSS variable issues (`--rim`, `--accent-dim`). More likely the chart is rendering with `preserveAspectRatio="none"` which may squash the header. Check layout.

**Fix:** Minor — ensure the button container renders outside the SVG and is clearly visible. The `btnStyle` uses `border: "1px solid var(--rim)"` which might be too subtle. Add slightly more contrast.

**File:** `src/components/PriceChart.tsx`

### Summary of file changes

| File | Change |
|------|--------|
| `src/hooks/usePortfolioData.ts` | Fix CASH label detection to prefer known keywords over date strings |
| `src/components/HoldingsTab.tsx` | Add Sheet thesis/changeNote fallback in TriggerRows when DB rationale is missing |
| `src/components/Sparkline.tsx` | Add title attribute showing date range for verification |
| `src/hooks/useTickerHistory.ts` | Add `.limit(5000)` to query; use ref for cache to fix stale closure |
| `src/components/PriceChart.tsx` | Improve toggle button visibility |

