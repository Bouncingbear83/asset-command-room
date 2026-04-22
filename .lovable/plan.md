

## Suggestions — pick one (or more)

Based on a sweep of the dashboard, here are the highest-leverage things to tackle next, ranked by impact × effort.

---

### 1. Unified "Action Inbox" on the Command tab ★ recommended
Right now actionable signals are spread across four places: Zone Alert Banner, Review Queue, Earnings Calendar (red/amber rows), and Watchlist "in zone" rows. You have to tab-hop to see everything that needs a decision today.

**Build:** A single ranked list at the top of Command tab — "Today's Decisions" — that merges:
- Zone breaches (cap/floor) from HOLDINGS
- W_EXIT / Q_REVIEW flags from Review Queue
- Earnings reporting in next 5 days
- Watchlist names with `vsTarget ≤ 0` (in entry zone)
- Stale watchlist reviews (overdue)

Each row: ticker · signal type · one-line context · "Deep Dive" button (already wired to Claude). Sorted by urgency.

**Why:** Collapses 4 scan-locations into 1. Matches how you actually use the dashboard each morning.

---

### 2. Persist the active tab in the URL
Refresh / share-link currently dumps you back on Command. Switching tab doesn't update the URL.

**Build:** Sync `active` tab state with `?tab=watchlist` query param (you already have `url-state.ts` and `url-state-holdings.ts` patterns). Two-way bind on mount + change.

**Why:** Tiny change, large UX win. Lets you bookmark "Holdings → grouped by account, sorted by P&L".

---

### 3. Claude prompt previews on hover
The copy-then-paste flow is solid but blind — you don't see what got copied until it's in Claude.

**Build:** Tooltip on every Claude button showing the exact prompt that will be copied. Uses existing `buildPrompt()` from `claudePromptUrl.ts`. Read-only, no behaviour change.

**Why:** Quick confidence check before opening a new tab. Catches stale context (e.g. wrong ticker selected in the dropdown).

---

### 4. Position-sizing calculator on the Watchlist "in zone" rows
When a watchlist name hits its entry zone, the next decision is *how much*. You currently have to mentally combine: layer gap, account cash, deploy target, concentration cap.

**Build:** When a watchlist row's `vsTarget ≤ 0`, surface a small "Suggested size" line:
- Pulls from layer gap (from LAYERS) + available cash (CASH) + deploy target (col N) + tier-based AUM cap
- Outputs: "£X into SIPP / £Y into ISA — fills layer gap to Z%"

**Why:** Closes the loop from signal → decision → execution. Removes the manual cross-reference.

---

### 5. Snapshot diff banner — "What changed since yesterday"
You have `daily_prices` + nightly snapshots in Supabase but no surfaced delta view.

**Build:** Small collapsible banner under Sync status: "Since yesterday's close: 3 zone alerts new, AVGO +4.2%, RKLB triggered ADD, 1 watchlist review overdue". One DB call, derived client-side.

**Why:** The "what do I need to know" answer in 2 seconds, before you've clicked anything.

---

### 6. Mobile polish pass on Command tab
Command tab is the daily driver but the deploy queue and zone alert banner overflow horizontally on phones. Other tabs (Holdings, Watchlist) already have mobile patterns; Command does not consistently.

**Build:** Apply the existing mobile patterns (horizontal-scroll chips, stacked cards) to the Command tab's three densest blocks: Quick Commands grid, Deploy Queue, Today's Movers.

---

### My pick
**#1 (Action Inbox) + #2 (URL tab persistence) together.** Inbox is the strategic win; URL persistence is the tiny quality-of-life fix that should ride along. Both touch `Index.tsx` and `CommandTab.tsx` so the diff stays contained.

Tell me which (or which combination) and I'll plan the implementation.

