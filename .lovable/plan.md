

# Plan: Split Scores tables, add Disruption panel, add sub-score trends

## 1. Split Scores into Holdings vs Watchlist tables

The `parseScores` function already passes through both `"data"` and `"watchlist"` Row_Type rows. We need to:

- Add a `rowType` field to the `parseScores` map: `rowType: String(findCol(r, "row_type", "Row_Type", "ROW_TYPE") ?? "data")`
- In `ScoresTab`, split `sorted` into two arrays: `holdings = sorted.filter(s => s.rowType !== "watchlist")` and `watchlist = sorted.filter(s => s.rowType === "watchlist")`
- Render two separate table cards: "Stellar Alignment Scores" (holdings) and "Watchlist Scores" (watchlist entries)
- Summary counters at top update to show holdings count only (or both with labels)

**Files**: `usePortfolioData.ts` (add `rowType` to parseScores), `ScoresTab.tsx` (split into two tables)

## 2. Add Disruption panel on row click

Reuse the same `DisruptionPanel` pattern from `HoldingsTab`:

- Add `expanded` state (`Set<string>`) to `ScoresTab`
- Make each row clickable with a chevron indicator
- When expanded, render a `DisruptionPanel` row below showing: disruption score /100, status badge, sub-scores (sub_avail, economics, govt_support, demand_vuln, time_viability), evidence text, amber/red triggers
- Import `Shield`, `ChevronRight`, `ChevronDown` from lucide-react
- Either extract `DisruptionPanel` to a shared component or duplicate it in ScoresTab

**File**: `ScoresTab.tsx`

## 3. Sub-score trend arrows (like Score trend)

The `scoreLog` data already contains `substrate`, `demand`, `moat`, `valuation`, `mgmt` fields. The current `ScoreTrend` component only reads `score`. We'll generalize it:

- Rename/refactor `ScoreTrend` to accept a `field` parameter (e.g. `"score" | "substrate" | "demand" | "moat" | "valuation" | "mgmt"`)
- For each sub-score cell, render the same ↑/↓/→ arrow with delta value by comparing the last two scoreLog entries for that ticker and field
- This means changing `ScoreTrend` signature to `{ ticker, scoreLog, field }` and using `entries[i][field]` instead of `entries[i].score`

**File**: `ScoresTab.tsx`

## Summary of file changes

| File | Change |
|---|---|
| `usePortfolioData.ts` | Add `rowType` field to `parseScores` output |
| `ScoresTab.tsx` | Split into 2 tables by rowType, add expandable disruption panel, generalize ScoreTrend for sub-scores |

