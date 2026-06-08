## Plan

1. **Extend SCORES ingestion to include all quartet columns**
   - Fetch the SCORES sheet through the currently required quartet/modifier range (`A1:AQ5000`) instead of the open-ended `A1:AQ` range.
   - Keep parsing `BULL_BASE`, `BULL_STRETCH`, `BEAR_THESIS_WEAK`, `BEAR_SUBSTRATE_FAIL`, and `BULL_BEAR_AT_DATE` from the sheet headers.

2. **Harden quartet field parsing**
   - Parse quartet values through the same tolerant `findCol`/`parseNum` path, but make sure blank cells stay `null` and numeric strings/dates remain accepted.
   - Add a dev-only diagnostic summary for SCORES rows with a ticker and any quartet fields, showing whether quartet, current price, and computed ratio are present.

3. **Fix Asymmetry Snapshot row generation**
   - For score-backed rows, do not silently reduce them to blank when the score row has quartet values but current price matching fails.
   - Match current prices against both alias-normalised and raw uppercase ticker keys so dotted exchange tickers (`KODT.ZA`, `.T`, `.DE`, `.MI`) are less likely to miss.
   - Preserve the existing watchlist-only fallback only for names with no score row.

4. **Make blanks explainable in the table**
   - When a row still cannot compute a ratio, show the quartet details in the expanded row and include a concise reason such as `No current price`, `Missing bear weak`, or `Above bull base`, rather than an unexplained blank.

5. **Validate against live sheet examples**
   - Check affected rows like `4109.T`, `KODT.ZA`, `4186.T`, `5631.T`, and any other WATCHLIST rows with quartet fields.
   - Confirm rows with full quartet + current price display ratios, while true incomplete-quartet rows remain `—` with an explicit reason.