/**
 * Shared column-width tokens for the Intelligence list.
 * Both AssetRow and IntelligenceListHeader import from here so they never drift.
 *
 * All cells are FIXED-WIDTH; chips inside are natural-sized but their containing
 * cell is locked, so 6D bars and trailing chips align across every row.
 */

export const COL = {
  ticker: 96,
  layer: 100,            // widest label is "SOVEREIGNTY"
  stack: 110,            // "PROCESS_TOOLING"
  score: 64,
  bars: { flex: 1, minWidth: 420 }, // 6 bars in equal grid
  lband: 56,
  disruption: 84,        // "GREEN 100" fits
  buyRange: 92,          // "IN ZONE" / "+287%" / "£1400–1500"
  status: 104,           // "WATCHLIST" fits
  chevron: 20,
  rowGap: 12,
  rowPadX: 12,
} as const;

export const SUB_LABELS = ["SUB", "DEM", "MOAT", "VAL", "MGMT", "DISR"] as const;
