# Vault upsert timeout investigation — 14 November 2026

## Diagnosis

The reported nightly timeout could not be reproduced. No root cause has been established, and this change must not be described as a proven fix for the historical timeout.

- `git diff d1e09f2^ HEAD -- supabase/functions/tracker-write/index.ts supabase/functions/tracker-write/v2-contract.ts` was empty before this work. The November 11 source_ref change did not change vault writes.
- `index.ts` already used one bulk `.upsert(payload, { onConflict: 'path' }).select('path,type,identifier')`, with no exact-count request and no per-row database calls.
- No non-internal triggers exist on `public.vault_notes_meta`.
- `fts` is already a stored generated column, weighting title/identifier/type A and body B. Its GIN index exists; no catalog creation timestamps are available to attribute these objects to November 11.
- Recomputing the search expression for 100 notes through `EXPLAIN (ANALYZE, BUFFERS)` took 26.594 ms, using the path primary-key index (204 buffer hits).
- Table statistics: 970 live rows, 0 dead rows; last autovacuum 14:12:46 UTC, autoanalyze 14:12:48 UTC. Heap 1,968 kB, GIN index 17 MB. These observations do not establish historical bloat or GIN cleanup as the cause.
- No current blocking sessions were found. Historical database and edge analytics queries for November 12–14 around 03:00 returned no records. Other-workflow contention at 03:00 remains unverified.
- `authenticator` has statement_timeout=8s and lock_timeout=8s; `service_role` has no explicit role override. No timeout setting was changed. The effective timeout inside the historical requests could not be established.
- Successful bulk-returning statements in query statistics had mean 1,404 ms and max 7,736 ms; failed canceled statements do not establish their cause in these statistics.

## Changes

Only VAULT_META_UPSERT behavior changed:

1. Increase its validation limit from 50 to 100 for the requested 100-row acceptance test. Other mode limits/validation are unchanged.
2. Add count/timing/error-code-only diagnostics to its database call. No headers, tokens, paths, or note contents are logged.
3. Return HTTP 502 if returned-row count differs from requested-row count, rather than reporting partial success.
4. Preserve bulk path-conflict upsert, minimal returned columns, success contract, DB-error 502 contract, and shared Bearer INGEST_SECRET authentication.

No migration was applied; migration name and SQL: none. No policies, grants, indexes, generated columns, or other modes were changed.

## Verification

39 tracker-write Deno tests passed, 0 failed: 18 v1 regression tests, 17 v2 validation tests, and 4 new bulk/error handler tests. The vault limit test was updated because accepting 100 necessarily replaces the prior 51-row rejection.

Existing notes were read through the database read tool, then re-upserted with identical content (body length <=10,000); no synthetic notes were inserted. Timings include client network overhead:

| Phase | Rows | HTTP | Affected | Seconds |
|---|---:|---:|---:|---:|
| Before | 10 | 200 | 10 | 0.984 |
| Before | 50 | 200 | 50 | 0.645 |
| Before | 100 | 400 | — | 0.203 (old limit) |
| After, first deployed request | 50 | 200 | 50 | 2.284 |
| After | 100 | 200 | 100 | 0.832 |
| After, repeat | 50 | 200 | 50 | 0.556 |
| After, repeat | 100 | 200 | 100 | 0.716 |

Server-side DB timings from the deployed logs: 1,027 / 682 / 448 / 596 ms respectively. Every 50-row request met <3s; every 100-row request met <5s. Affected and requested counts matched, and returned records contained only path/type/identifier.

source_ref regression: re-applied the existing source_ref to an existing OPEN row whose resolution fields were already null; UPDATE returned 200/affected=1 and a database read confirmed the same source_ref, OPEN status, and null resolution fields. The updated_at trigger necessarily refreshed its timestamp.

Only tracker-write was deployed; deployment was live-verified by 2026-11-14T14:20:15Z. Submitted source SHA-256: `d184513cede426a09b96be9aeb8c27ee15ddaa2cff9238c90da47f98e54c0281`.

## Remaining uncertainty

The historical ~20s retries are user-reported, not reproduced before/after measurements. New safe diagnostics will distinguish database latency/error codes on a recurrence, but cannot retrospectively prove lock contention or platform load at 03:00. No speculative schema change or timeout increase was made.