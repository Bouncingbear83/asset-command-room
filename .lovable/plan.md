

## Fix JISA Tab: Portfolio Values & Annualised Returns

### Problem 1 — Portfolio values are wrong
The `parseJisaHoldings` function in `usePortfolioData.ts` computes per-row `mvGbp = costGbp + glGbp`. But in the JISA_HOLDINGS sheet, **Book Cost (cols Y/Z/AA) is in local currency** (e.g. ASML = €5,160 EUR), while GL£ (cols AE/AF/AG) is in GBP. Adding them produces nonsense MVs. As a result the per-child summary cards show wrong totals (e.g. Bear £80,198 instead of the true £66,248).

The sheet itself already contains the correct values:
- **Row 17 (A17:C17)** = JISA holdings MV in GBP per child (Bear/Alfie/Edie) — `£66,135 / £54,930 / £21,960`
- **Row 18 (A18:C18)** = JISA cash balances per child — `£113 / £59 / £38`
- **Row 20 (A20:C20)** = Total portfolio (holdings + cash) per child — `£66,248 / £54,989 / £21,998` ← what the cards should show

### Problem 2 — Annualised returns are absurd (+652% pa, +161% pa, etc.)
XIRR over ~3–6 month holding periods extrapolates short-term gains into massive annualised numbers. This is mathematically valid but misleading. For positions held less than ~12 months, we should suppress the annualised figure (or show plain total return % only).

### Changes

**1. `src/hooks/usePortfolioData.ts` — `parseJisaHoldings`**
- Compute per-row `mvGbp` correctly. The simplest robust fix: use **`shares × price_local × fx_to_gbp`** (price in col I, FX in col E with rates from rows 13/14). For GBP/GBX assets no FX needed; for USD/EUR look up the EUR/GBP and USD/GBP rates from rows 13–14 of the same grid.
- Also extract per-child **MV totals** (row index for "TOTAL" row, cols J/K/L = `TAR | JB/AB/EB`... actually use row labelled "TOTAL" cols 9/10/11 which contain `£66,135 / £54,930 / £21,960` — these are the authoritative MV totals).
- Extract per-child **cash balances** (row containing only £-values immediately after EB header row — A18:C18).
- Return these alongside the per-row holdings as new fields on the data object, e.g. `jisaTotals: { Bear: { mv, cash, portfolio }, Alfie: {...}, Edie: {...} }`.

**2. `src/components/JisasTab.tsx` — Summary cards**
- Use `jisaTotals[child].portfolio` (holdings + cash) for the headline £ figure on each card instead of summing the parsed per-row `mvGbp`.
- Update the `Combined:` line to sum the three portfolio totals.
- Optionally show "Holdings £X · Cash £Y" as a sub-line beneath the headline.

**3. `src/components/JisasTab.tsx` — Annualised return display**
- In `calcHoldingReturns` results, suppress `annualisedReturn` display when `daysHeld < 365`. Show "—" or just the total return % instead.
- Same logic for the per-child group header (no annualised summary if youngest position < 1y).

**4. `src/lib/xirr.ts`** — no changes needed; the XIRR math is correct. Just gate the display.

### Files touched
- `src/hooks/usePortfolioData.ts`
- `src/components/JisasTab.tsx`

### Expected result after fix
- Bear card → **£66,248** (was £80,198)
- Alfie card → **£54,989**
- Edie card → **£21,998**
- Combined → **£143,235** (was £174,712)
- "Ann. Return" column shows "—" for positions held <1 year; total return % still visible

