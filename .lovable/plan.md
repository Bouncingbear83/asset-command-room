

## Update Cash Balance Fetch to Read from F2:F6

### Problem
The CASH sheet has been restructured. Cash balances for each account are now in column F, rows 2–6. The current code fetches range `A1:C5` and parses a header+data layout that no longer matches the sheet structure.

### Changes

**`src/hooks/usePortfolioData.ts`**:

1. **Update fetch range** — Change the CASH sheet fetch from `A1:C5` to `A1:F6` so the grid includes column F where balances live.

2. **Update parsing logic** — After fetching, read account labels from column A (or whichever column holds "SIPP", "ISA", etc.) and their corresponding cash balances from column F (index 5 in zero-based). The parsing should:
   - Iterate rows 2–6 (data rows after header)
   - Match labels case-insensitively for "SIPP", "ISA", "Total" (and optionally "JISA")
   - Read the numeric value from column F for each matched row
   - Keep existing fallback logic in case the layout doesn't match

3. **Update memory** — Record the new CASH sheet layout (A1:F6, balances in column F) in the data ownership memory file.

### Technical detail
- Current fetch: `fetchSheetGrid({ gid: GIDS.cash, range: "A1:C5" })`
- New fetch: `fetchSheetGrid({ gid: GIDS.cash, range: "A1:F6" })`
- Balance column index shifts from columns 0–2 to column 5 (F)

