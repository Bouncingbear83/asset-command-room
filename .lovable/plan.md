

## Surface Holdings in Buy/Exit Zones on Command Tab

### Problem
The Zone Alert Banner exists but only shows when the spreadsheet's `alert_status` field is explicitly set (e.g., "ADD_ZONE"). Currently all holdings appear as "CLEAR", so the banner never renders. The user wants holdings to be **dynamically detected** as being in buy or exit zones based on live price data.

### Approach
Combine two data sources — holdings (with `price`, `trigger_price_add`, `trigger_price_exit`) and scores (with `buyLow`, `buyHigh`) — to compute zone status client-side, independent of the spreadsheet's `alert_status`.

### Detection Logic

```text
For each holding:
  1. Match to scores data by ticker to get buyLow / buyHigh
  2. Parse trigger_price_add and trigger_price_exit from holdings

  BUY ZONE (ADD_ZONE):
    - price <= buyHigh (top of buy range), OR
    - price <= trigger_price_add (if set)

  EXIT ZONE:
    - price >= trigger_price_exit (if set)

  REVIEW:
    - price within 5% above buyHigh (approaching buy zone from above), OR
    - price within 5% below trigger_price_exit (approaching exit)

  Otherwise: CLEAR
```

### Changes

**File: `src/components/CommandTab.tsx`**

1. Accept `scores` data (already available via `usePortfolioData`) alongside `holdings`
2. Add a `computeZoneStatus(holding, scores)` function that implements the detection logic above
3. Replace the current `alertedHoldings` filter (line 435) which checks `alert_status !== "CLEAR"` with a computed approach:
   - For each holding, compute zone status dynamically
   - If the spreadsheet `alert_status` is already set (not CLEAR), prefer that
   - Otherwise use the computed status
4. The existing Zone Alert Banner rendering (lines 594-650) stays unchanged — it already handles `ADD_ZONE`, `EXIT_ZONE`, and `REVIEW` grouping with colors, pulsing dots, and trigger distance labels

**File: `src/pages/Index.tsx`**
- Pass `scores` to `CommandTab` if not already passed (need to verify)

### Result
The Zone Alert Banner will appear whenever any holding's live price falls into a buy range or approaches an exit trigger, even if the spreadsheet hasn't been updated. The banner retains its existing visual design with green/red/amber grouping, pulsing indicators, and distance-from-trigger percentages.

