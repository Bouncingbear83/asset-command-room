

## Fix: Monitor Tab Card Headers Should Reflect Worst Child Status

### Problem
The "Cost Curve Metrics" and "Structural Triggers" card header badges are hardcoded to show "MONITOR" (amber) whenever any rows exist, regardless of their actual statuses. If all metrics are GREEN, the header still shows amber. If any are RED, the header still shows amber. The header should reflect the worst status among its children.

### Current behavior (lines 127, 158)
- Cost Curves: always shows `"MONITOR"` if `liveCostCurves.length > 0`
- Structural Triggers: always shows `"MONITOR"` if `liveStructural.length > 0`

### Fix
Add a helper function that scans an array of monitor items and returns the worst status using priority: RED/TRIGGERED/FIRED > AMBER > WATCH/MONITOR > GREEN/CLEAR/PASS/NORMAL.

Then replace the hardcoded `"MONITOR"` in both card headers with the result of this function. The header label text should also update accordingly (e.g., "2 RED" or "ALL CLEAR" instead of just "3 METRICS").

### Technical detail

**File**: `src/components/MonitorTab.tsx`

1. Add a `worstStatus(items)` helper that iterates items, maps each `item.status` to a severity level (RED=3, AMBER=2, WATCH/MONITOR=1, GREEN=0), and returns the status string with the highest severity. Defaults to "CLEAR" for empty arrays.

2. Add a `headerLabel(items)` helper that counts items by RAG level and returns a summary like "2 RED, 1 AMBER" or "ALL GREEN".

3. Line 127: replace `liveCostCurves.length > 0 ? "MONITOR" : "CLEAR"` with `worstStatus(liveCostCurves)`
4. Line 158: replace `liveStructural.length > 0 ? "MONITOR" : "CLEAR"` with `worstStatus(liveStructural)`
5. Update the label text on lines 128 and 159 to use `headerLabel()` instead of just showing the count.

### Files changed
- `src/components/MonitorTab.tsx` — add `worstStatus` + `headerLabel` helpers; update two card header badges

