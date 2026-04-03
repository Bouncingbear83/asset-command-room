

## Fix Watchlist Category Hierarchy

### Current order
1. Buy Targets → 2. Active Monitoring (`MONITOR`) → 3. Waiting for Entry (`WAIT`, `WATCH`) → 4. Pre-IPO → 5. Research

### Requested order
1. **Buy** (T1, T2, etc.) — green
2. **Active Monitoring** (`ACTIVE_MONITORING`) — amber
3. **Monitoring** (`MONITOR`) — accent
4. **Wait** (`WAIT`, `WATCH`) — grey
5. **Research** — blue
6. **Pre-IPO** — purple
7. **Exited** — new, dimmed/muted

### Changes needed

**File: `src/components/WatchlistTab.tsx`**

1. **Rename status constant** — `MONITOR_STATUSES` becomes `ACTIVE_MONITORING_STATUSES = ["ACTIVE_MONITORING"]` for the amber section
2. **Add new `MONITORING_STATUSES = ["MONITOR"]`** — separate section with accent styling, rendered 3rd
3. **Add `EXITED_STATUSES = ["EXITED"]`** — new category at the bottom, dimmed rows
4. **Reorder `WAIT_STATUSES`** to position 4th (after Monitoring)
5. **Swap Pre-IPO and Research** — Research now comes before Pre-IPO
6. **Add `activeMonitoringMemo`** filtering for `ACTIVE_MONITORING`, add `monitoringMemo` filtering for `MONITOR`, add `exitedMemo` filtering for `EXITED`
7. **Render sections** in new order with appropriate colors:
   - Active Monitoring: amber dot
   - Monitoring: accent dot
   - Wait: grey dot
   - Research: blue dot
   - Pre-IPO: purple dot
   - Exited: muted/dim dot, dimmed rows

8. **Add status badge styles** for `ACTIVE_MONITORING` (amber) and `EXITED` (muted grey)

**File: `src/components/CommandTab.tsx`**

9. Update the monitor items filter to use `ACTIVE_MONITORING` status instead of `MONITOR` (since Active Monitoring is the higher-priority category to surface on Command)

### Files changed
- `src/components/WatchlistTab.tsx` — restructure categories, add Monitoring + Exited sections
- `src/components/CommandTab.tsx` — update filter to match new status name

