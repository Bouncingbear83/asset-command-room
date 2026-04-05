

## Create Historical Database Tables

### Summary
Create 11 database tables to store nightly snapshots of portfolio data, enabling historical analysis, sparklines, drift tracking, and audit trails. All tables are append-only (no updates needed from the app) and will be populated by the existing n8n automation workflow.

### Tables to Create (single migration)

All 11 tables in one migration, in dependency order (no cross-references):

1. **daily_prices** — EOD prices per ticker (~53 rows/day)
2. **fx_rates** — Daily FX rates (~5 rows/day)
3. **holdings_snapshot** — Nightly SIPP/ISA portfolio snapshot (~35 rows/day)
4. **jisa_snapshot** — Nightly JISA holdings snapshot (~33 rows/day)
5. **layer_weights_snapshot** — Nightly layer allocations (~8 rows/day)
6. **scores_snapshot** — Nightly scoring snapshot (~35 rows/day)
7. **disruption_snapshot** — Nightly disruption sub-scores (~35 rows/day)
8. **score_rationales** — Event-driven scoring reasoning (~100-300 rows/year)
9. **disruption_rationales** — Event-driven disruption reasoning (~100-300 rows/year)
10. **macro_snapshot** — Daily macro indicators (1 row/day)
11. **alerts_log** — Immutable alert audit trail (~5-20 rows/week)

### Technical details

- Single SQL migration containing all `CREATE TABLE`, `CREATE INDEX`, and unique constraint statements exactly as specified in the user's schemas
- Use validation triggers instead of CHECK constraints (per guidelines)
- No CHECK constraints needed — the schemas use only UNIQUE constraints and defaults
- Enable RLS on all tables but with permissive read policies (data is portfolio-level, not multi-tenant; n8n writes via service role key)
- RLS policies: `SELECT` for `anon` and `authenticated` roles (read-only app); writes happen via service role from n8n
- No code changes needed — these tables support future features and n8n ingestion

### RLS Strategy

Each table gets:
- RLS enabled
- A single `SELECT` policy for `authenticated` (the app user can read)
- Writes are done by n8n using the service role key, which bypasses RLS

### Files changed
- Database migration only (no application code changes)

