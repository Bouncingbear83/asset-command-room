

## Add "Active Monitoring" Category to Watchlist + Surface on Command Tab

### What
Add a new watchlist section called **Active Monitoring** — positioned 2nd (after Buy Targets, before Waiting for Entry). These are assets you already hold or are closely tracking that need active attention but aren't buy candidates. Surface them on the Command tab in the "This Week's Actions" card.

### How it works

**Trigger**: Assets with status `MONITOR` in the Google Sheet will be categorized as "Active Monitoring" instead of being lumped into "Waiting for Entry".

---

### File: `src/components/WatchlistTab.tsx`

1. **Split MONITOR out of WAIT_STATUSES** — Change `WAIT_STATUSES` from `["WAIT", "WATCH", "MONITOR"]` to `["WAIT", "WATCH"]`
2. **Add new category constant**: `MONITOR_STATUSES = ["MONITOR"]`
3. **Add `activeMonitoring` memo** — filter `liveData` for MONITOR status, sort by name
4. **Render new section** between Buy Targets and Waiting for Entry with an amber dot color and label "Active Monitoring"
5. **Style**: Use the existing `MONITOR` status style (amber-toned). Rows are not dimmed (unlike Research/Pre-IPO)

### File: `src/components/CommandTab.tsx`

1. **Filter watchlist for MONITOR items** — `const monitorItems = watchlist.filter(w => w.status.trim().toUpperCase() === "MONITOR")`
2. **Add an "Active Monitoring" sub-section** inside the "This Week's Actions" card, after the weekly actions and before "Watch this week"
3. **Each monitor item shows**: ticker (bold), current price, and entry target distance — compact one-line format with an amber MONITOR badge
4. This gives immediate visibility on the Command tab without needing to switch to Watchlist

### Section Order (Watchlist tab)
1. Buy Targets (green)
2. **Active Monitoring** (amber) — NEW
3. Waiting for Entry (grey)
4. Pre-IPO (purple)
5. Research (blue)

### Files changed
- `src/components/WatchlistTab.tsx` — new category filter + section
- `src/components/CommandTab.tsx` — surface MONITOR items in weekly actions

