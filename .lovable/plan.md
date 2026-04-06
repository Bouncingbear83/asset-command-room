

## Fix: Monitor Tab — Derive Status from Proximity Instead of Trusting Sheet

### Problem
The screenshot shows "AI inference" and "Humanoid production" with "breached" text (from `proximityIndicator`) but a GREEN badge. The badge reads `metric.status` directly from the spreadsheet, which is stale/incorrect. The proximity calculation independently computes the real state but only renders as a text label — it doesn't influence the badge or the header rollup.

### Fix
In `MonitorTab.tsx`, compute an **effective status** for each cost curve metric by running the proximity logic and overriding the sheet status when a breach or near-breach is detected.

### Technical detail

**File**: `src/components/MonitorTab.tsx`

1. Add a helper `effectiveStatus(metric)` that:
   - Runs `proximityIndicator(metric)` 
   - If result label is `"breached"` → return `"AMBER"` (it breached the amber threshold)
   - If proximity ratio ≤ 1 on the red threshold → return `"RED"`
   - Otherwise fall back to `metric.status`

2. Actually, simpler approach: extend `proximityIndicator` to also return a derived RAG status, or add a new `deriveStatus(metric)` function that checks current vs amber and red thresholds using the same floor/ceiling logic:
   - Current breaches red threshold → `"RED"`
   - Current breaches amber threshold → `"AMBER"`  
   - Within 30% of amber → `"WATCH"`
   - Otherwise → `"GREEN"`

3. On each row render (line 184), replace `metric.status` with `deriveStatus(metric)` for the badge
4. For the header rollup (`worstStatus` / `headerLabel`), map items through `deriveStatus` before computing
5. Apply same logic to structural triggers where applicable (line 216)

### Scope
- Only changes `src/components/MonitorTab.tsx`
- No data model or parsing changes needed
- The derived status is purely a display-time calculation

