## Plan

1. **Fix Watchlist ingestion to cover the full WL schema**
   - Change the Watchlist fetch range from `A1:S5000` to `A1:Z5000`, matching the uploaded WL header through `SUBSTRATE_STAGE`.
   - This ensures all filled WL rows and newer right-side formula columns are available to the app.

2. **Make row parsing more robust for sparse/formula-driven bottom rows**
   - Keep any row with a non-empty `NAME` or `TICKER`, even if other formula columns are blank.
   - Preserve the current fallback for non-WL sheets so this does not loosen parsing globally more than needed.
   - Add dev-only diagnostics that show the last few parsed WL tickers so future truncation is obvious.

3. **Fix Watchlist tab visibility safeguards**
   - Make duplicate/empty ticker handling deterministic so bottom rows cannot disappear because of bucket `Set` logic.
   - Ensure fallback “Uncategorised” catches any valid WL row with unexpected/blank status, excluding only deliberate `EXITED` rows.

4. **Fix Asymmetry Snapshot coverage**
   - The current snapshot is driven by `SCORES`, so WL-only names can be absent even when they appear in Watchlist.
   - Add a Watchlist-backed fallback row for tickers that have WL data but no matching score row, using available WL fields where possible.
   - For rows without a complete quartet, show them as live Watchlist rows but with ratio fields as `—`, instead of silently dropping them.

5. **Validate**
   - Verify the uploaded bottom tickers (`LUVE.MI`, `SGL.DE`, `4042.T`, `4369.T`, `4109.T`, `KODT.ZA`, `NTG.DE`, `4186.T`, `DNR.MI`, `5631.T`, `SDF.DE`, `NTR`) are retained in the Watchlist data path.
   - Check the Watchlist tab and Asymmetry Snapshot no longer silently omit valid bottom WL entries.