/**
 * Stellar Doctrine Rule #14 — Asymmetry Snapshot eligibility.
 *
 * The Command-tab Asymmetry Snapshot ranks structural upside. Per Rule #12
 * doctrine, asymmetry is structurally highest pre-reclassification, so the
 * filter must include qualifying WATCHLIST names — NOT held-only.
 *
 * Inclusion criteria (any-of):
 *   - HELD     AND score ≥ 75
 *   - WATCHLIST AND score ≥ 65 AND reclass_status starts with "PRE"
 *
 * Anything else is excluded from the snapshot (Research, Rejected, Exited,
 * sub-threshold scores, post-reclass watchlist names).
 */

import type { AssetIntelligence } from "@/types/intelligence";

export const RULE14_HELD_MIN_SCORE = 75;
export const RULE14_WATCHLIST_MIN_SCORE = 65;

export function isAsymmetrySnapshotEligible(a: AssetIntelligence): boolean {
  const score = a.score ?? 0;
  if (a.held_status === "HELD") return score >= RULE14_HELD_MIN_SCORE;
  if (a.held_status === "WATCHLIST") {
    if (score < RULE14_WATCHLIST_MIN_SCORE) return false;
    const rc = (a.reclass_status ?? "").trim().toUpperCase();
    return rc.startsWith("PRE");
  }
  return false;
}

/** Filter helper. */
export function filterAsymmetrySnapshot(assets: AssetIntelligence[]): AssetIntelligence[] {
  return assets.filter(isAsymmetrySnapshotEligible);
}

/**
 * Rule #14 chip label — short qualifier shown next to eligible tickers.
 * Returns null when the asset doesn't qualify.
 */
export function rule14ChipLabel(a: AssetIntelligence): string | null {
  if (!isAsymmetrySnapshotEligible(a)) return null;
  if (a.held_status === "HELD") return "Asymmetry • Held";
  return "Asymmetry • Pre-Reclass";
}
