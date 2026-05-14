
## Japan Sleeve tab

A new tab dedicated to the Bordier Geneva GIA sub-portfolio: JPY-denominated, manually priced, CGT-applicable, substrate-dense. Positioned between Holdings and Earnings.

### 1. Data plumbing

Extend `src/hooks/usePortfolioData.ts`:
- Today the holdings parser only splits rows into SIPP / ISA buckets. Add a third bucket `bordier` for any HOLDINGS row where `Account` equals `Bordier_GIA` (case-insensitive).
- Carry through the extra fields needed for JPY display: `price_local`, `prev_close_local`, `cost_local` (already in KNOWN_COLS but not currently retained in the holding shape — surface alongside the existing `costGbp`, `shares`, `currency`).
- Expose `bordierHoldings` from the hook return (and the sleeve total in `totals`, used for % of total AUM).
- Pull JPY/GBP FX from `PRICES` tab. First pass: derive an implied rate per row from `price_local / (mv / shares)` when both are present, then fall back to a manual rate. (Confirmed in design notes section below.)

No changes to Supabase, no new edge functions.

### 2. New components

```text
src/components/japan/
  JapanSleeveTab.tsx        # top-level layout + Refresh button
  JapanKpiBand.tsx          # 5 tiles
  JapanPositionsTable.tsx   # main table + expandable rows
  JapanComplianceCard.tsx   # doctrine flags, CGT, FX panel
  JapanStaleBanner.tsx      # yellow banner for stale prices
  JapanWatchlistBlock.tsx   # collapsible TSE watchlist
```

Wire `JapanSleeveTab` into `src/pages/Index.tsx`:
- Insert `"Japan Sleeve"` into `TABS` between `"Holdings"` and `"Earnings Calendar"`.
- Add slug `japan` to `TAB_SLUGS`.
- Render block: `{active === "Japan Sleeve" && <JapanSleeveTab portfolio={portfolio} priceData={priceData} />}`.

### 3. Layout details

**KPI band (full width, 5 tiles)**
- Sleeve AUM (£) — sum of `mv` across Bordier holdings, with daily delta (vs sum of `prev_close_local * shares / fx`).
- % of Total Portfolio AUM — `sleeveAUM / (sippTotal + isaTotal + sleeveAUM)`.
- Number of positions.
- Average substrate sub-score — joined from `portfolio.scores` on ticker (case-insensitive, matching existing convention from project memory).
- JPY/GBP FX rate.

**Positions table** columns:
`Ticker | Name | Layer | Score | Substrate | RECLASS | JPY Price | JPY Cost | FX | MV (£) | AUM % | G/L % | Notes`
- Monospace for ticker / numeric columns; sans-serif elsewhere.
- Substrate cell uses existing colour rules: ≥22 green, L3 amber, L2 or below red.
- RECLASS pill colours: PRE = dim, IN_PROGRESS = amber, COMPLETE = green.
- Notes truncated to ~80 chars with native `title` tooltip.
- Row click toggles an expansion row showing: full thesis (`scores.full_thesis`), add/exit triggers, last trigger review date and note, FACTOR_PRIMARY / STACK_LAYER badges.

**Right column compliance panel (~30%)**
- Sleeve capital criterion: list any positions failing `substrate ≥ 22 OR score ≥ 80`.
- Liquidity-capped warning pill for Kanto Denka (4047.T).
- Federation Rule #9 info pill for HOYA (7741.T).
- Tax friction:
  - Unrealised gain in £ (`mv − costGbp`).
  - Estimated CGT at 20% on positive unrealised gains, labelled "indicative, GIA only".
- FX exposure summary: total JPY exposure in GBP, last FX update date.

**Stale price banner**
- For each Bordier row, if `price_local === prev_close_local` (and both > 0), increment a counter. We do not yet store a "days unchanged" series, so the V1 rule is: flag when `price_local === prev_close_local`. Show a yellow banner: "Manual price refresh required for [tickers]". Note: the doctrine "more than 3 days" check needs daily snapshot history; flagged in section 5 below.

**Watchlist block (collapsible, default closed)**
- Filter `portfolio.watchlist` where `ticker` ends with `.T` and `status` is `WATCH` or `PRE-IPO`.
- Columns: Ticker, Name, Score (joined), ENTRY_TARGET, current spot, distance to entry %.

**Refresh button**
- Top right of the tab; calls `portfolio.refresh()` (already re-reads HOLDINGS / SCORES / PRICES / etc. in the existing hook).

### 4. Visual + copy

- Reuse existing Stellar tokens: `--gold`, `--green`, `--amber`, `--red`, `--text-dim`, `--rim`, `--panel`, `--font-mono`, `--font-ui`. No new colours.
- British spelling, no em-dashes (use commas or full stops).
- Loading state: skeleton rows (4) for positions table; KPI tiles render with `—` until data arrives.
- Error state: if `portfolio.error` is set, render a thin amber strip above the table; rest of the tab still tries to render available data.

### 5. Known follow-ups (NOT in V1, flagged for the user)

- True "stale > 3 days" detection requires capturing PRICE_LOCAL into the daily snapshot pipeline; current edge function `ingest-daily-snapshot` does not yet persist per-ticker JPY closes for Bordier names. V1 falls back to "price equals prev_close".
- A canonical JPY/GBP cell in the PRICES tab would be cleaner than the implied-rate derivation. Worth adding a single named cell once the sheet owner has time.
- Manual override input for FX rate is out of scope for V1 (read-only tab).

### Acceptance

- New tab visible between Holdings and Earnings, slug `?tab=japan` works on reload.
- Four current Bordier holdings render with correct JPY prices, GBP MV, score and substrate joins.
- CGT tile is non-zero for any position with positive unrealised gain.
- Stale banner appears for any position whose `price_local` matches `prev_close_local`.
- Watchlist block lists Murata (6981.T) and any other `.T` watchlist names.
