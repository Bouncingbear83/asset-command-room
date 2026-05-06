## Status check vs Part 11 spec

**Already done** (previous migrations + edge function update):
- `holdings_snapshot`: 4 new columns added (`factor_primary`, `factor_group`, `stack_layer`, `substrate_level`)
- `factor_group_weights` table created with `UNIQUE (factor_group, snapshot_date)`, RLS enabled, authenticated SELECT policy, indexes on `snapshot_date` and `factor_group`
- `ingest-daily-snapshot` edge function: `factorGroupWeights` block added mirroring `layerWeights` (uses generic `upsert(rows)` — accepts new columns automatically, no explicit column list to maintain)

**Still missing from the Part 11 spec**:

1. **`holdings_snapshot` indexes** — `idx_hs_factor_group`, `idx_hs_stack_layer`
2. **`scores_snapshot` columns** — `substrate_level text`, `stack_layer text` (for time-series L-band tracking)
3. **`factor_group_weights.priority` column** — `text`, plus partial index `idx_fgw_priority ON (priority) WHERE priority != 'OK'`

**Edge function**: no further changes needed. Both `holdingsSnapshot` and `scoresSnapshot` already use generic `upsert(rows, { onConflict })` with no explicit column list, so the new fields flow through automatically once the schema migration runs. `factorGroupWeights` block is already in place and will pick up `priority` the same way.

### Proposed migration

```sql
-- holdings_snapshot indexes
CREATE INDEX IF NOT EXISTS idx_hs_factor_group ON public.holdings_snapshot(factor_group);
CREATE INDEX IF NOT EXISTS idx_hs_stack_layer  ON public.holdings_snapshot(stack_layer);

-- scores_snapshot L-band tracking columns
ALTER TABLE public.scores_snapshot
  ADD COLUMN IF NOT EXISTS substrate_level text,
  ADD COLUMN IF NOT EXISTS stack_layer     text;

-- factor_group_weights priority + partial index
ALTER TABLE public.factor_group_weights
  ADD COLUMN IF NOT EXISTS priority text;

CREATE INDEX IF NOT EXISTS idx_fgw_priority
  ON public.factor_group_weights(priority)
  WHERE priority <> 'OK';
```

No frontend code changes; new fields will appear in the regenerated `src/integrations/supabase/types.ts` after the migration runs and are ready for follow-up UI work.
