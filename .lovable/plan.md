## Plan: Lock down `narrative_signals` to service-role-only

Drop the two read policies that were added in the prior migration so the table matches the rationales/service-role security model exactly.

### Migration
```sql
drop policy if exists "Authenticated users can read narrative_signals" on public.narrative_signals;
drop policy if exists "Anon can read narrative_signals" on public.narrative_signals;
```

### Result
- Only the `service role full access` policy remains.
- Frontend (anon + authenticated) cannot read or write the table.
- All schema, indexes, and CHECK constraints are unchanged.
