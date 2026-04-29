BEGIN;

ALTER TABLE scores_snapshot
  ADD COLUMN IF NOT EXISTS return_profile TEXT,
  ADD COLUMN IF NOT EXISTS compounder_subtype TEXT;

ALTER TABLE scores_snapshot
  DROP CONSTRAINT IF EXISTS scores_snapshot_return_profile_check;

ALTER TABLE scores_snapshot
  ADD CONSTRAINT scores_snapshot_return_profile_check
  CHECK (
    return_profile IS NULL OR return_profile IN (
      'COMPOUNDER',
      'RECLASSIFICATION',
      'CYCLE',
      'HEDGE',
      'VEHICLE',
      'PRE_PRODUCTION',
      'CASH'
    )
  );

ALTER TABLE scores_snapshot
  DROP CONSTRAINT IF EXISTS scores_snapshot_compounder_subtype_check;

ALTER TABLE scores_snapshot
  ADD CONSTRAINT scores_snapshot_compounder_subtype_check
  CHECK (
    compounder_subtype IS NULL OR compounder_subtype IN (
      'STELLAR_COMPOUNDER',
      'GENERIC_COMPOUNDER'
    )
  );

ALTER TABLE scores_snapshot
  DROP CONSTRAINT IF EXISTS scores_snapshot_subtype_requires_compounder_check;

ALTER TABLE scores_snapshot
  ADD CONSTRAINT scores_snapshot_subtype_requires_compounder_check
  CHECK (
    compounder_subtype IS NULL
    OR (return_profile = 'COMPOUNDER' AND compounder_subtype IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_scores_snapshot_return_profile
  ON scores_snapshot (return_profile)
  WHERE return_profile IS NOT NULL;

COMMIT;