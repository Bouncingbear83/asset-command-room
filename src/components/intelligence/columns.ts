/**
 * Shared column-width tokens for the Intelligence list.
 * Both AssetRow and IntelligenceListHeader import from here so they never drift.
 *
 * All cells are FIXED-WIDTH; chips inside are natural-sized but their containing
 * cell is locked, so 6D bars and trailing chips align across every row.
 */

export const COL = {
  ticker: 84,
  layer: 88,            // widest label is "SOVEREIGNTY"
  stack: 96,            // "PROCESS_TOOLING"
  score: 56,
  bars: { flex: 1, minWidth: 300 }, // 6 bars in equal grid — compressed
  lband: 48,
  disruption: 72,        // "GREEN 100" fits
  buyRange: 80,          // "IN ZONE" / "+287%" / "£1400–1500"
  asymmetry: 60,         // "5.2:1" fits
  irrBb: 60,             // "24.5%" fits
  status: 88,            // "WATCHLIST" fits
  chevron: 20,
  rowGap: 8,
  rowPadX: 10,
} as const;

export const SUB_LABELS = ["SUB", "DEM", "MOAT", "MoS", "MGMT", "DISR"] as const;
