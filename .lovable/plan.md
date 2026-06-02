## Cleanup: zero-price rows in `daily_prices`

I found **35 rows across 19 tickers** where `price_local = 0` and `price_gbp = 0` (all from the `sheets` source, between 2026-04-16 and 2026-05-18). These are missed-day artefacts that distort sparklines, MAs and % changes.

### Affected tickers
- Heavy: `2802.T` (12 days, 2026-04-29 → 2026-05-10 — looks like Japan Golden Week)
- 2 days each: `LYC`, `NVDA`, `NTR`, `PRY`, `RSW`
- 1 day each: `ALB`, `CCJ`, `DHR`, `ETN`, `FCX`, `LEU`, `LHX`, `MP`, `RUFFER`, `SGLN`, `SLVP`, `SPUT`, `WINTON`

### Action
Run a single delete against `daily_prices`:

```sql
DELETE FROM daily_prices WHERE price_local = 0 OR price_gbp = 0;
```

Removing the rows (rather than zero-filling or forward-filling) keeps the time series sparse on holidays — `useDailyPrices` already handles gaps correctly, and MA20/MA50 will compute cleanly over the remaining valid points.

### Optional follow-up (not doing unless you confirm)
Add a guard so future ingests can't reintroduce zeros — either a CHECK constraint (`price_local > 0 AND price_gbp > 0`) on `daily_prices`, or a filter in the `ingest-daily-snapshot` Edge Function. Say the word and I'll add one.

No frontend changes needed.