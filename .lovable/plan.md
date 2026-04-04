

## Update Transactions Tab + Add New JISAs Tab

### Summary
Two changes: (1) update the existing Transactions tab to match the spec (JISA account names, hover tooltips), and (2) build a new JISAs tab that fetches from a `JISA_HOLDINGS` sheet and displays three children's portfolios with summary cards, holdings table, layer allocation bars, and recent JISA transactions.

---

### 1. Transactions Tab Updates (`src/components/TransactionsTab.tsx`)

**Account filter chips** — change from `["All", "SIPP", "ISA", "JISA-1", "JISA-2", "JISA-3"]` to `["All", "SIPP", "ISA", "JISA-Bear", "JISA-Alfie", "JISA-Edie"]` to match actual ACCOUNT values in the sheet.

**Row hover tooltip** — Add a hover state or expandable row that shows TRIGGER (col K) and RATIONALE (col L). On desktop, show as a CSS tooltip on row hover. On mobile cards, show rationale inline if present.

---

### 2. New JISA Holdings Data (`src/hooks/usePortfolioData.ts`)

- Add `jisaHoldings: "XXXXXXXXX"` to `GIDS` (need the actual GID for JISA_HOLDINGS sheet — will use a placeholder and surface it for you to provide)
- Add `fetchSheet({ gid: GIDS.jisaHoldings, range: "A1:O" })` to the Promise.all
- Add `parseJisaHoldings()` mapping columns A-O:
  - `child` (Bear/Alfie/Edie), `ticker`, `name`, `type` (ETF/SINGLE_STOCK/FUND), `layer`, `shares`, `priceLocal`, `currency`, `mvGbp`, `weightPct`, `costGbp`, `glPct`, `codeGf`, `targetPct`, `notes`
- Add `jisaHoldings` to state and PortfolioData interface

---

### 3. New JISAs Tab Component (`src/components/JisasTab.tsx`)

**Props**: `jisaHoldings`, `transactions`, `layers` (for hex colours)

**Overview section** — Three summary cards side by side (Bear, Alfie, Edie):
- MV = sum of mvGbp per child
- G/L % = (sum MV - sum Cost) / sum Cost * 100
- Combined total below the three cards

**Filter chips** — `[All] [Bear] [Alfie] [Edie]`, default All

**Holdings table** — Grouped by child (with child header row when "All" selected):
- Columns: Ticker, Name, Type (badge), Layer (dot), Shares, MV £, Weight %, Target %, Drift (calculated: weight - target, colour-coded), G/L %
- Sorted by MV descending within each group
- Type badges: ETF = blue, SINGLE_STOCK = gold, FUND = gray

**Layer allocation bars** — Per child (or selected child):
- Simple horizontal stacked/segmented bar showing each layer's current % with a target marker
- Reuse layer hex colours from the main Layers tab

**Recent JISA transactions** — Filter main transactions where account starts with "JISA-", show most recent 10 in a compact table: Date, Child (extracted from account), Ticker, Action, Shares, Value £

**Mobile** — Table collapses to card layout, summary cards stack vertically

---

### 4. Wire Up in Index (`src/pages/Index.tsx`)

- Import `JisasTab`
- Add `"JISAs"` to TABS array after "Transactions"
- Render `<JisasTab jisaHoldings={portfolio.jisaHoldings} transactions={portfolio.transactions} layers={portfolio.layers} />`

---

### Question needed
I need the **Google Sheet GID** for the `JISA_HOLDINGS` sheet to wire up the data fetch. If you can provide that, I can implement everything in one pass.

### Files changed
- `src/hooks/usePortfolioData.ts` — add JISA_HOLDINGS GID, parse function, state
- `src/components/TransactionsTab.tsx` — fix account filter names, add row hover tooltip
- `src/components/JisasTab.tsx` — new component (~350 lines)
- `src/pages/Index.tsx` — add JISAs tab

