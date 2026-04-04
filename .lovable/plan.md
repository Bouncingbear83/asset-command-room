

## Fix JISA Holdings — Sheet Structure Mismatch

### Problem
The JISA_HOLDINGS sheet (GID 134287003) has a **wide/pivoted** layout, not the assumed per-child-per-row format. Each row is one stock, with child-specific data spread across columns:

```text
Col  Header                   Content
A    Pillar (=Layer)          "Sovereignty", "Energy", etc.
B    Target %                 4.00%, 5.00%, etc.
C    Ticker                   RKLB, EXUS, etc.
D    Name                     Rocket Lab Corp, etc.
E    FX                       USD/GBP/GBX
F-H  Lookup tickers           GF, FT, BV FX
I    Price                    Live price
J-L  TAR | JB/AB/EB           Target £ per child
M-O  HOL | JB/AB/EB           Shares held per child
P-R  ACT | JB/AB/EB           Actual value (local ccy)
S-U  DEL | JB/AB/EB           Delta (target - actual)
V-X  % JB/AB/EB               Portfolio weight %
Y-AA BV | JB/AB/EB            Book cost per child
AB-AD GL | JB/AB/EB           G/L local ccy
AE-AG GL£ | JB/AB/EB          G/L in GBP
AH-AJ GL% | JB/AB/EB          G/L %
```

Current code fetches `A1:O` (15 cols) and tries to parse as if each row is one child+holding. Need to fetch the full range and unpivot per-child.

Row 17 = TOTAL row with portfolio totals per child.

### Fix

**File: `src/hooks/usePortfolioData.ts`**

1. Change fetch range from `A1:O` to `A1:AJ` (all 36 columns)
2. Rewrite `parseJisaHoldings` to use `fetchSheetGrid` instead of `fetchSheet` (cleaner for wide pivoted data with complex multi-line headers)
3. For each data row (skip TOTAL, USD/GBP rows), emit **3 records** (one per child: Bear, Alfie, Edie) by reading the child-specific columns:
   - `shares`: cols M/N/O (JB/AB/EB)
   - `mvGbp`: cols P/Q/R (ACT values — but these are local ccy, so use GL£ cols AE/AF/AG + BV cols Y/Z/AA to get MV in GBP = cost + GL£)
   - `weightPct`: cols V/W/X
   - `costGbp`: cols Y/Z/AA
   - `glPct`: cols AH/AI/AJ
   - `targetPct`: col B (same for all children)
   - `layer`: col A (Pillar)
   - `ticker`: col C, `name`: col D, `currency`: col E
4. Parse the TOTAL row (row 17) separately for portfolio totals per child
5. Skip rows where shares=0 for a given child

**File: `src/components/JisasTab.tsx`**

6. Minor: the `type` field won't exist in this sheet — remove the TYPE column/badge or derive it from the ticker (ETF vs single stock)
7. Update MV calculation: `mvGbp = costGbp + glGbp` (since the sheet provides both)

### Files changed
- `src/hooks/usePortfolioData.ts` — rewrite JISA fetch range + parseJisaHoldings to handle wide/pivoted format
- `src/components/JisasTab.tsx` — remove TYPE column, adjust for actual data shape

