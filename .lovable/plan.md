# Integrate Japan Sleeve (Bordier) into Holdings + Today's Movers

Bordier_GIA holdings currently live only inside the Japan Sleeve tab. The main Holdings view and most Command-tab calculations explicitly merge `portfolio.sipp + portfolio.isa`, excluding Bordier. CommandTab does already consume `portfolio.holdings` (which includes Bordier), so Movers / Layers / Tiers will pick them up automatically once we stop suppressing them — but we need a stale-price guard so manual JPY pricing doesn't pollute Movers.

The Japan Sleeve tab stays untouched as the canonical JPY / compliance / CGT view.

## 1. Holdings tab — full merge with Account badge + filter chip

**`src/pages/Index.tsx`**
- Pass `holdings={[...portfolio.sipp, ...portfolio.isa, ...portfolio.bordier]}` to `HoldingsTab` (line 198) and `DriversTab` (line 195). Refactor to use a single `allHoldings` const above the JSX to avoid drift.
- Same merge in `Transactions` holdings prop (line 200).
- Returns tab stays SIPP/ISA-only — sleeve P&L is account-segregated for tax purposes; Bordier P&L lives on its own tab.

**`src/lib/url-state-holdings.ts`**
- Extend `HOLDINGS_ACCOUNT_VALUES` to include `"BORDIER"` (alongside `SIPP`, `ISA`, `SIPP+ISA`). Account filter chip in `HoldingsFilters` will auto-render the new option.
- Update `normalizeAccount` to map raw `"Bordier_GIA"` (case/punctuation-insensitive) → `"BORDIER"`.

**`src/components/HoldingsTab.tsx`**
- Account filter logic already keys off `normalizeAccount(holding.account)` — extending the enum is enough; no inner logic change.
- Account badge: the existing Account column already renders `holding.account`. Add a small visual treatment so `Bordier_GIA` rows render with a distinct pill (gold border, label "BORDIER · JPY") instead of plain text. Single styling helper in the row renderer; no new column.
- Group-by `account` already works — Bordier becomes a third group automatically.
- MV stays GBP-only in the unified table; JPY price/cost remain exclusive to the Japan Sleeve tab.

## 2. Today's Movers — include Bordier with stale-price guard

**`src/components/CommandTab.tsx`** (Movers block, lines 774–792)
- `holdings` already contains Bordier rows (no change to the source).
- Add a stale-price filter inside the `deduped.set` loop: `if (h.prevClose != null && h.price === h.prevClose) return;` — this drops any row where today's price equals yesterday's close (the Japan Sleeve's existing stale-detection rule). Applies uniformly: a genuinely flat day on a liquid name is rare and harmless to omit; a stale Bordier price is correctly suppressed.
- When a Bordier row is included (i.e. price moved), append a small `JPY` marker after the ticker so the user knows the move came from manual repricing. Tiny mono caption, `var(--text-dim)`, no layout change.

## 3. Layers Allocation + Tier classification

These already read from `portfolio.holdings` which includes Bordier — verification only, no code change expected. If a downstream consumer (e.g. Layers card) re-merges sipp+isa explicitly, switch it to `holdings`.

Quick grep + spot check of:
- `src/components/LayersAllocation*` and any Tiers card on Command/Holdings
- DriversTab consumption (now receiving merged holdings via Index.tsx change above)

## Out of scope
- Returns tab (stays segregated for tax/account separation)
- JISA holdings unchanged
- No Supabase / edge function / schema changes
- No JPY in unified table — strict GBP

## Acceptance
- Holdings tab Account filter shows `SIPP / ISA / SIPP+ISA / BORDIER`; selecting BORDIER isolates the four Bordier names.
- Bordier rows render with a "BORDIER · JPY" pill in the Account cell.
- Today's Movers includes Bordier names only when `price !== prevClose`, marked with a `JPY` caption.
- Layers Allocation bars and Tier counts on Command/Holdings reflect total AUM including the sleeve.
- Japan Sleeve tab is untouched and still renders correctly.
