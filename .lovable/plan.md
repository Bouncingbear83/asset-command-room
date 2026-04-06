

## Add Error Logging to ingest-daily-snapshot

### Change
In `supabase/functions/ingest-daily-snapshot/index.ts`, add a `console.error` call inside each table's error branch (the `if (error)` block around line 78) so errors appear in edge function logs.

### Detail
The upsert loop already checks `if (error)` per table. Add one line before the existing `results[key]` assignment:

```typescript
console.error(`${table} error:`, JSON.stringify(error));
```

This uses `table` (the actual DB table name) for clarity. Single file change, single line addition inside the existing `if (error)` block.

### File
- `supabase/functions/ingest-daily-snapshot/index.ts` — add `console.error` inside the error branch (~line 78)

