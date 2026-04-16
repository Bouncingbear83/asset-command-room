

## Fix: Zone Alerts EXIT ZONE logic is inverted

### Problem
`TRIGGER_PRICE_EXIT` represents a **stop-loss floor** — the price at which you'd exit a losing position. The current code flags positions when `price >= triggerExit`, which catches every position trading **above** its stop (i.e., nearly everything). The correct behavior is to flag only when price **drops to or near** the stop-loss.

### Corrected rules

| Zone | Condition | Proximity (15%) | % from trigger |
|------|-----------|-----------------|----------------|
| **ADD ZONE** | `price <= triggerAdd * 1.15` | Price within 15% above buy target | `((triggerAdd - price) / triggerAdd) * 100` |
| **EXIT ZONE** | `price <= triggerExit * 1.15` | Price within 15% above stop-loss | `((triggerExit - price) / triggerExit) * 100` (negative = breached) |

Both zones trigger when price **falls toward** a target. ADD = buying opportunity approaching. EXIT = stop-loss approaching or breached.

### Changes

**`src/components/CommandTab.tsx`** — `computeZoneStatus` function (line ~447):
- Change EXIT_ZONE condition from `price >= triggerExit * 0.85` to `price <= triggerExit * (1 + ZONE_PROXIMITY_THRESHOLD)`
- Update the `% from trigger` display for EXIT_ZONE rows to show distance above/below stop

After this fix, EXIT ZONE should be empty or near-empty (only positions whose price has fallen close to their stop-loss floor). ADD ZONE remains unchanged (DHR should still appear).

