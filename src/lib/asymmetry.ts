/**
 * Parse asymmetry_ratio strings as written by Research Commit v2.13.
 *
 * Single value:   "3.5:1"
 * With anchor:    "3.5:1 at $4.35 spot"
 * Multi-tranche:  "3.5:1 at $4.35 spot, 5:1 at T2 $3.50, 7:1 at T3 $2.80"
 *
 * The first pair is the spot/current asymmetry; subsequent pairs are
 * tranche/scenario projections. For display:
 *   - Bar variant → use `max` (highest right-tail figure)
 *   - Tooltip / full variant → render all `pairs`
 */

export interface AsymmetryPair {
  /** Right-tail multiple (the "N" in N:1). */
  ratio: number;
  /** Original substring describing this pair (verbatim, trimmed). */
  label: string;
  /** Optional anchor price extracted from "at $X" — null when absent. */
  anchorPrice: number | null;
  /** Optional anchor label, e.g. "spot", "T2", "T3" — null when absent. */
  anchorLabel: string | null;
}

export interface ParsedAsymmetry {
  /** Raw string echoed back, useful for debugging / "show source" UX. */
  raw: string;
  /** All parsed pairs in source order. Empty → unparseable. */
  pairs: AsymmetryPair[];
  /** Highest ratio across all pairs; null when no pairs parsed. */
  max: number | null;
  /** First pair (spot) ratio; null when no pairs parsed. */
  spot: number | null;
}

const EMPTY: ParsedAsymmetry = { raw: "", pairs: [], max: null, spot: null };

// Match "N:1" or "N.M:1" optionally followed by " at <anchor>"
// where <anchor> = "$<price> <label>" | "<label> $<price>" | "<label>"
const PAIR_RE =
  /(\d+(?:\.\d+)?)\s*:\s*1(?:\s+at\s+([^,]+?))?(?=\s*,|\s*$)/gi;

const PRICE_RE = /\$\s*(\d+(?:\.\d+)?)/;

export function parseAsymmetryRatio(raw: unknown): ParsedAsymmetry {
  if (raw === null || raw === undefined) return EMPTY;
  const str = String(raw).trim();
  if (!str) return EMPTY;

  const pairs: AsymmetryPair[] = [];
  let m: RegExpExecArray | null;
  PAIR_RE.lastIndex = 0;
  while ((m = PAIR_RE.exec(str)) !== null) {
    const ratio = Number(m[1]);
    if (!Number.isFinite(ratio)) continue;
    const anchorRaw = (m[2] ?? "").trim();
    let anchorPrice: number | null = null;
    let anchorLabel: string | null = null;
    if (anchorRaw) {
      const pm = anchorRaw.match(PRICE_RE);
      if (pm) anchorPrice = Number(pm[1]);
      const labelOnly = anchorRaw.replace(PRICE_RE, "").trim();
      if (labelOnly) anchorLabel = labelOnly;
    }
    pairs.push({
      ratio,
      label: m[0].trim(),
      anchorPrice: Number.isFinite(anchorPrice as number) ? anchorPrice : null,
      anchorLabel,
    });
  }

  if (pairs.length === 0) return { ...EMPTY, raw: str };
  const max = pairs.reduce((a, p) => (p.ratio > a ? p.ratio : a), -Infinity);
  return {
    raw: str,
    pairs,
    max: Number.isFinite(max) ? max : null,
    spot: pairs[0].ratio,
  };
}

/** Convenience: format pairs for tooltip display. */
export function formatAsymmetryTooltip(parsed: ParsedAsymmetry): string {
  if (parsed.pairs.length === 0) return parsed.raw || "—";
  return parsed.pairs.map((p) => p.label).join("\n");
}
