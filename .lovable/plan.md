## Root cause

The earlier fix made WL rows visible, but every one shows `+0.00%`. Database check on `watchlist_price_history`:

- Latest snapshot for ATI is `2026-06-13` at `198.48`, with `2026-06-12` also `198.48`.
- Today is `2026-06-15`, and the sheet's live `current` for ATI is `196.56`.

The MoversCard's WL branch derives `last`/`prev` from historical snapshots only (`pd.points[-1]` vs `pd.points[-2]`, or `traj.spark30d` equivalents). Because the ingest snapshots once per day and weekend/holiday snapshots repeat the previous close, the last two history values are identical for almost every WL ticker — so 1D change is mechanically 0.

The live price (`w.current` from the WL sheet, which is what the user sees on the spreadsheet) is never used as the comparator.

## Fix

In `src/components/command/MoversCard.tsx`, change the WL change calculation to mirror how holdings work: the sheet is the source of truth for "now", history is only the anchor for "then".

For each watchlist row with `w.current > 0`:

- **`last`** = `w.current` (live sheet price) whenever available; fall back to most recent history point otherwise.
- **`prev`** for `1D` = most recent history close (from `pd.points` or `traj.spark30d`, whichever exists).
- **`prev`** for `1W` = price from `pd.points[-6]` if available, else `traj.price7dAgo`.
- **`prev`** for `1M` = price from `pd.points[-22]` if available, else `traj.price30dAgo`.
- `change = (last - prev) / prev * 100` when `prev > 0`; otherwise `null`.

If `w.current` is missing and no history exists, drop the row (existing behaviour). The "No Δ data" section stays for rows where neither history nor a usable prev anchor exists.

`sparkPoints`, `sparkColor`, and the `noData` bucket logic remain unchanged.

### File touched
- `src/components/command/MoversCard.tsx` — WL branch inside the `rows` `useMemo`. No hook/schema changes.

### Out of scope
- Holdings branch (already correct: uses `h.day` from the sheet for 1D).
- Ingestion cadence or weekend duplication in `watchlist_price_history`.
