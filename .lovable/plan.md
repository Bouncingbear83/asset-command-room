

## Transactions Tab — New Component + Data Integration

### Overview
Add a read-only Transactions tab that fetches trade history from the Google Sheet, displays summary cards + filterable table, and supports ticker drill-down for position-level detail.

### Files to Create/Edit

#### 1. `src/hooks/usePortfolioData.ts` — Add transactions + scores fetch

- Add `transactions: "1970586669"` to `GIDS`
- Add `fetchSheet({ gid: GIDS.transactions, range: "A1:O" })` to the `Promise.all` in `load()`
- Add `parseTransactions()` function mapping columns A–O to: `DATE`, `ACCOUNT`, `TICKER`, `ACTION`, `SHARES`, `PRICE`, `CURRENCY`, `FX_RATE`, `VALUE_GBP`, `TRANCHE`, `LAYER`, `NOTES`, `SCORE_AT_ENTRY`, `LAYER_NAME`, `ACCOUNT_NAME`
- Add parsed transactions to state and return type
- Scores data is already fetched — will be passed through for drill-down cross-reference

#### 2. `src/components/TransactionsTab.tsx` — New component (~400 lines)

**Props**: `transactions`, `scores`, `layers` (for hex colours)

**Summary Cards** (row of 4):
- Deployed YTD — sum of VALUE_GBP where ACTION is BUY/SIZE_UP, current year
- Exited YTD — sum of VALUE_GBP where ACTION is SELL/TRIM/EXIT
- Net Deployed — deployed minus exited
- Trades YTD — count excluding DIVIDEND

**Filter Bar**:
- Account toggle buttons: All / SIPP / ISA / JISA-1 / JISA-2 / JISA-3
- Action toggle buttons: All / BUY / SELL / DIVIDEND (grouped)
- Layer dropdown (populated from unique layers in data)
- Date range inputs (from/to)

**Transaction Table**:
- Columns: Date, Ticker, Action, Shares, Price, Ccy, Value £, Tranche, Layer, Account, Score
- Sorted newest-first by default
- Action badges colour-coded (BUY/SIZE_UP green, SELL/TRIM/EXIT red, DIVIDEND blue)
- Layer dots use hex from layers data
- Mobile: collapse to card layout per row
- Ticker is clickable → drill-down view

**Ticker Drill-Down** (replaces table when a ticker is clicked):
- Back button to return to full list
- Header: Ticker, Name, Layer, Current Score, Tier
- Position Summary cards: Net Shares (by account), Total Cost £, Avg Price
- Transaction History table (filtered to that ticker, excluding dividends)
- Dividends section (filtered to DIVIDEND actions)
- Score at entry vs current score delta

#### 3. `src/pages/Index.tsx` — Add tab

- Import `TransactionsTab`
- Add `"Transactions"` to `TABS` array after `"Holdings"`
- Render `<TransactionsTab>` with transactions, scores, and layers props

### Styling
- Matches existing dark theme (panel/rim/gold variables)
- Action badges follow existing pattern from HoldingsTab
- Summary cards match CommandTab card styling
- Table alternates bg-transparent / bg-white/5
- Mobile responsive: table → card view at small widths

### No database changes needed
All data comes from Google Sheets. Read-only display.

