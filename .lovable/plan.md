

## Fix: "In Zone" count should reflect items trading below entry target

### Root cause

The "In Zone" count currently checks `alertStatus === "IN_ZONE"` — this reads from the sheet's Alert Status column (col J/K). That column appears to be empty/WAITING for MP, DHR, and NKT, even though these stocks are clearly trading below their entry targets (negative "vs Target" values: -14.4%, -4.9%, -3.8%).

"In Zone" should mean "currently trading at or below entry target" — i.e., the stock is in the buy zone based on price, regardless of whether the alert system has flagged it.

### Fix

**`src/components/WatchlistTab.tsx`**:

1. Change `inZoneCount` calculation from checking `alertStatus === "IN_ZONE"` to checking `item.vsTarget < 0` (price is below entry target) AND the item is NOT already in a BUY status (to avoid double-counting buy-ready items).

2. Alternatively, count items where `vsTarget <= 0` that aren't already in the BUY_STATUSES set — these are stocks trading below entry target but not yet flagged as buy-ready.

The simplest correct logic: **In Zone = items where current price ≤ entry target** (i.e., `vsTarget <= 0`). This would include the 3 buys + MP/DHR/NKT. If we want "In Zone" to be distinct from "Buy Ready", then: `In Zone = vsTarget <= 0 AND status NOT in BUY_STATUSES`.

Given the screenshot shows 3 buys and 3 separate in-zone items, the distinct count makes more sense:
- Buy Ready: Hexagon (BUY T1), MP Materials (BUY T2), Siemens Energy (BUY T2) = 3
- In Zone: MP (-14.4%), DHR (-4.9%), NKT (-3.8%) = 3 items below target that aren't buys... but MP IS a buy (BUY T2). So actually In Zone should just be items with negative vsTarget regardless of buy status.

Simplest: **In Zone = count of items where `vsTarget < 0`** = MP, DHR, NKT = 3 (Hexagon is +5.4% so not in zone). This matches what the user expects.

### Implementation

```typescript
const inZoneCount = statusSorted.filter((item) => item.vsTarget < 0).length;
```

One line change replacing the `alertStatus === "IN_ZONE"` check.

### Files
- `src/components/WatchlistTab.tsx` — line 222, change inZoneCount logic

