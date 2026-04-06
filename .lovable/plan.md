

## Add Buy/Exit Zone Alert Banner to Command Tab

### Summary
Add a prominent alert banner at the top of the Command tab that surfaces all holdings currently in ADD_ZONE or EXIT_ZONE. This replaces the current approach where these alerts are only visible as small badges on individual holdings rows.

### Design

The banner sits above "Next Actions" — it's the first thing you see on the Command tab. Only renders when at least one holding has a non-CLEAR alert status.

```text
┌─────────────────────────────────────────────────────────────┐
│ 🟢 ADD ZONE                                                │
│  CCJ    $52.30  ↓12.3% from trigger   Add @ $55–60         │
│  SPRQ   £4.12   ↓8.1% from trigger    Add @ £4.50          │
│                                                             │
│ 🔴 EXIT ZONE                                                │
│  XYZ    $180.20  ↑5.2% above exit     Exit @ $170           │
└─────────────────────────────────────────────────────────────┘
```

- **ADD_ZONE** items: green left border, show current price, distance from `trigger_price_add`, and the add trigger note
- **EXIT_ZONE** items: red left border, show current price, distance from `trigger_price_exit`, and exit context
- **REVIEW** items: amber left border, grouped separately
- Each row shows: ticker (bold), current price, percentage distance from trigger, and the trigger price/note
- Pulsing dot indicator matching the zone colour for urgency
- Collapses gracefully on mobile (stacked layout)

### Technical details

**File**: `src/components/CommandTab.tsx`

1. Filter `holdings` for `alert_status` not equal to `CLEAR` (already computed as `alertedHoldings` on line 430)
2. Group by alert status: `ADD_ZONE`, `EXIT_ZONE`, `REVIEW`
3. For each holding, compute distance from trigger price:
   - ADD_ZONE: `((price - trigger_price_add) / trigger_price_add * 100)` — negative means below trigger (good)
   - EXIT_ZONE: `((price - trigger_price_exit) / trigger_price_exit * 100)` — positive means above exit
4. Render the banner card before the "Next Actions" card (line ~580), using existing `HOLDING_ALERT_STYLE` (already defined on line 43)
5. Only render the banner when `alertedHoldings.length > 0`

### Files changed
- `src/components/CommandTab.tsx` — add zone alert banner component above Next Actions card

