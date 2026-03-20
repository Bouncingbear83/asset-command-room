

## Fix: Watchlist summary, Buy T2 highlighting, sorting, Returns scaling, AUM cash

### Issues

1. **Watchlist execute-ready count is 0** — `getSortPriority` checks `alertStatus` for EXECUTE, but the BUY T1 status items like HEXA-B aren't being counted. The "execute-ready" label actually needs to count items with status `BUY NOW` or `BUY T1` (i.e. actionable buy statuses), not just `alertStatus === "EXECUTE"`.

2. **BUY T2 items not green, not in callout box** — `BuyHighlightBox` only includes `BUY NOW` and `BUY T1`. Need to add `BUY T2`. `STATUS_STYLE` also lacks a `BUY T2` entry so it renders with fallback styling instead of green.

3. **No sorting visible / wrong sort order** — The status sort order is missing `BUY T2`, `MONITOR`. Need to update `STATUS_ORDER` to: `BUY NOW` → `BUY T1` → `BUY T2` → `WAIT` → `MONITOR` → `RESEARCH` → `PRE-IPO`.

4. **Returns showing 1.4% instead of 140%** — The `calcReturn` formula `((1 + endTwr / 100) / (1 + startTwr / 100) - 1) * 100` is correct for whole-percent TWR inputs. But if the sheet stores cumulative TWR as fractions (e.g. `0.014` meaning 1.4%), then `parseRawPct` reads it as `0.014` and `calcReturn` divides by 100 again, producing tiny numbers. The actual issue: sheet TWR values are likely stored as fractions (0–1 scale), not whole percentages. `parseRawPct` should detect this — if cumulative TWR values are all < 2, they're fractions and need `* 100`. Alternatively, since these are cumulative TWR values that could legitimately be small whole percentages, the safest fix is: use `parsePercentLike` for cumulative TWR fields (which handles the fraction detection), and keep `parseRawPct` only for sub-period returns which are truly small.

5. **AUM missing cash** — The header AUM calculation sums only holdings MV. CASH sheet is never fetched. Need to fetch CASH tab and add it to the total.

### Plan

**1. Fetch CASH sheet and add to AUM**

In `usePortfolioData.ts`:
- Add CASH fetch: `fetchSheetGrid({ gid: GIDS.cash, range: "A1:C3" })`
- Parse to extract `cash_sipp` and `cash_isa` values
- Expose `cashSipp`, `cashIsa`, `cashTotal` on the hook return

In `Index.tsx`:
- Add cash to the AUM calculation: `sippTotal + cashSipp`, `isaTotal + cashIsa`

**2. Fix Watchlist summary and Buy T2**

In `WatchlistTab.tsx`:
- Add `"BUY T2"` to `STATUS_STYLE` with green styling
- Add `"BUY T2"` and `"MONITOR"` to `STATUS_ORDER` (BUY NOW=1, BUY T1=2, BUY T2=3, WAIT=4, MONITOR=5, RESEARCH=6, PRE-IPO=7)
- Expand `buyItems` filter to include `BUY T2`
- Change `executeCount` to count items with buy-actionable statuses (`BUY NOW`, `BUY T1`, `BUY T2`) — label it "buy-ready" instead of "execute-ready"

**3. Fix Returns TWR scaling**

In `usePortfolioData.ts`:
- Change cumulative TWR parsing from `parseRawPct` to `parsePercentLike` so that fractional values like `0.014` get correctly scaled to `1.4`
- Keep sub-period returns on `parseRawPct` since those are computed differently

In `ReturnsTab.tsx`:
- Verify `calcReturn` formula works with correctly-scaled inputs — it should, since `(1 + 1.4/100) / (1 + 0/100) - 1) * 100 = 1.4` which is correct

### Files affected

- `src/hooks/usePortfolioData.ts` — CASH fetch, TWR parsing fix, expose cash values
- `src/components/WatchlistTab.tsx` — BUY T2 styling/sorting/callout, summary label fix
- `src/pages/Index.tsx` — add cash to AUM display

