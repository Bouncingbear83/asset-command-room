

## Restore Day% Column + Top Movers on Command Tab + Fix Mobile Layout

### Problem
1. The Holdings tab **Layer View** (default view) doesn't apply mobile column hiding — all columns still show, causing horizontal overflow at 430px.
2. The **Day %** column was hidden on mobile in the Account view but the user wants it back (it's sortable and useful).
3. No "Top Movers" section on the Command tab.

### Changes

**`src/components/HoldingsTab.tsx`**

1. **Layer View — apply mobile responsiveness**: Import and use `useIsMobile` in `LayerView`. On mobile, hide `Name`, `Notes`, and `Price` columns (keep Ticker, MV, G/L%, Day%, Action). Reduce cell padding to `6px`. This matches the pattern already in `HoldingsTable`.

2. **Account View (HoldingsTable) — restore Day% on mobile**: Remove `day` from the mobile-hidden columns list. The user wants it visible and sortable. Still hide `name`, `layer`, and `notes` on mobile.

**`src/components/CommandTab.tsx`**

3. **Add "Top Movers Today" card** between "Next Actions" and "Deploy Queue":
   - Combine SIPP + ISA holdings, deduplicate by ticker, sort by absolute `day` value descending.
   - Show top 5 movers: Ticker, Day%, direction arrow, MV.
   - Color green for positive, red for negative.
   - Compact single-line rows, no expand needed.
   - Card title: `TODAY'S MOVERS` with count of positive/negative (e.g., `12 ▲ · 5 ▼`).

### Section order on Command tab (updated)
1. Next Actions
2. **Today's Movers** (new)
3. Deploy Queue
4. Earnings This Week
5. Risk Controls (collapsed)
6. Macro Signals (collapsed)
7. Narrative + Quick Commands
8. Commit Research
9. Golden Rules

### Mobile visual result
- Holdings Layer View: 5 columns (Ticker, MV, G/L%, Day%, Action) — fits 430px
- Holdings Account View: 5 columns (Ticker, MV, G/L%, Day%, Action) — fits 430px
- Command tab: compact movers card, same single-column flow

