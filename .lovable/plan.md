## Holdings Cost Basis + Transaction Returns

### 1. Create shared XIRR utility (`src/lib/xirr.ts`)
- Newton-Raphson XIRR solver
- Helper to build cashflow arrays from transactions
- Per-holding calculation helper (totalCost, truePL, annualisedReturn, entryDate, trancheCount)

### 2. Holdings Tab — Add Cost Basis & True Returns
- Import transactions data (already fetched in usePortfolioData)
- Pass transactions to HoldingsTab component
- For each holding row, calculate cost basis, P&L, return %, ann. return, entry date, tranche count
- Add 6 new columns: Cost (£), P&L (£), Return %, Ann. Return, Entry, Tranches
- Add sort toggle for annualised return (default remains MV desc)
- Mobile: hide new columns, show in expanded detail

### 3. Transactions Tab — Enhanced Drill-Down
- Replace 3 summary cards with 6: Net Shares, Total Cost, Current MV, P&L (£), Total Return, Ann. Return
- Add "CLOSED" badge for exited positions
- Add running Cum. Shares and Cum. Cost columns to trade history table
- Use holdings data for current MV lookup

### 4. JISA Tab — Cost Basis from Transactions
- For each JISA holding, calculate cost/PL/return/ann. return from transactions
- Add Cost, P&L, Return %, Ann. Return columns to JISA holdings table

### Files to create
- `src/lib/xirr.ts` — shared XIRR utility + helpers

### Files to modify
- `src/components/HoldingsTab.tsx` — add columns, sort toggle
- `src/components/TransactionsTab.tsx` — enhanced drill-down cards + running P&L
- `src/components/JisasTab.tsx` — add cost basis columns
- `src/pages/Index.tsx` — pass transactions to HoldingsTab and JisasTab
