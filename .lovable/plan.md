

## Fix: Apply deriveStatus to Disruption Watch and Header

### Problem
Disruption Watch rows use `item.status` directly (line 277), showing "MONITOR" even when the metric may be GREEN or RED based on actual thresholds. The section header is also hardcoded to amber `rag("AMBER")` (line 255).

### Fix

**File**: `src/components/MonitorTab.tsx`

1. **Line 277**: Replace `rag(item.status)` / `item.status || "MONITOR"` with `rag(deriveStatus(item))` / `deriveStatus(item)` — same pattern already used for cost curves and structural triggers

2. **Lines 255–257**: Replace the hardcoded amber header with the dynamic `worstStatus` / `headerLabel` helpers already used by the other two cards:
   - `rag("AMBER")` → `rag(worstStatus(liveDisruption))`  
   - Count string → `headerLabel(liveDisruption)`

### Scope
- Single file change: `src/components/MonitorTab.tsx`
- Reuses existing `deriveStatus`, `worstStatus`, `headerLabel` helpers — no new logic needed

