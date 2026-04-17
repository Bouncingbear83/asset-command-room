/**
 * Shared column-width tokens for the Intelligence list.
 * Both AssetRow and IntelligenceListHeader import from here so they never drift.
 *
 * Values mirror AssetRow exactly. Update both at once if you change a column.
 */

export const COL = {
  ticker: 96,
  layer: 84,
  score: 64,
  bars: { flex: 1, minWidth: 280 }, // 6 bars in equal grid
  disruption: 88,
  buyRange: 96,
  status: 110,
  chevron: 16,
  rowGap: 12,
  rowPadX: 12,
} as const;

export const SUB_LABELS = ["SUB", "DEM", "MOAT", "VAL", "MGMT", "DISR"] as const;
