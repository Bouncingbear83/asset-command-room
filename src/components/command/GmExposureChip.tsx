/**
 * GmExposureChip — shows G(m) micro-cap aggregate exposure.
 *
 * OB v3.13 §11.10a caps:
 *   Single name:  1% AUM
 *   Aggregate:    2.5% AUM
 *   Max positions: 4
 *
 * Detection: scans SCORES change_note and fullThesis for "G(m)" markers.
 * Also checks WATCHLIST rationale for staged G(m) candidates.
 *
 * Renders inline on CommandTab near the header/capital area.
 */

import type { LiveScore, LiveHolding, LiveWatchItem } from "@/hooks/usePortfolioData";

interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

const GM_MAX_POSITIONS = 4;
const GM_MAX_AGGREGATE_PCT = 2.5;
const GM_MAX_SINGLE_PCT = 1.0;

function isGmTagged(text: string): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return upper.includes("G(M)") || upper.includes("FRAMEWORK=G(M)") || upper.includes("RECLASS_PATTERN_GM");
}

function findGmTickers(scores: LiveScore[]): Set<string> {
  const tickers = new Set<string>();
  for (const s of scores) {
    const t = s.ticker.trim().toUpperCase();
    if (!t) continue;
    if (isGmTagged(s.changeNote) || isGmTagged(s.fullThesis)) {
      tickers.add(t);
    }
  }
  return tickers;
}

function findGmWatchlist(watchlist: LiveWatchItem[]): Set<string> {
  const tickers = new Set<string>();
  for (const w of watchlist) {
    const t = w.ticker.trim().toUpperCase();
    if (!t) continue;
    if (isGmTagged(w.rationale)) {
      tickers.add(t);
    }
  }
  return tickers;
}

export default function GmExposureChip({ scores, holdings, watchlist }: Props) {
  const gmScored = findGmTickers(scores);
  const gmWatchlisted = findGmWatchlist(watchlist);
  const allGm = new Set([...gmScored, ...gmWatchlisted]);

  // Find HELD G(m) positions and their AUM%
  const heldGm: { ticker: string; aum_pct: number }[] = [];
  for (const h of holdings) {
    const t = h.ticker.trim().toUpperCase();
    if (allGm.has(t)) {
      // Check if this ticker is HELD in scores
      const score = scores.find((s) => s.ticker.trim().toUpperCase() === t);
      if (score && score.heldStatus.toUpperCase() === "HELD") {
        heldGm.push({ ticker: t, aum_pct: h.aum_pct ?? 0 });
      }
    }
  }

  const deployedCount = heldGm.length;
  const aggregateAum = heldGm.reduce((sum, h) => sum + h.aum_pct, 0);
  const stagedCount = allGm.size - deployedCount;

  // Breach detection
  const countBreach = deployedCount > GM_MAX_POSITIONS;
  const aggBreach = aggregateAum > GM_MAX_AGGREGATE_PCT;
  const singleBreach = heldGm.some((h) => h.aum_pct > GM_MAX_SINGLE_PCT);
  const anyBreach = countBreach || aggBreach || singleBreach;
  const anyWarn = !anyBreach && (deployedCount >= GM_MAX_POSITIONS || aggregateAum > GM_MAX_AGGREGATE_PCT * 0.8);

  // Don't render if there are zero G(m) names anywhere
  if (allGm.size === 0) return null;

  const borderColor = anyBreach
    ? "rgba(239,68,68,0.4)"
    : anyWarn
    ? "rgba(245,158,11,0.4)"
    : "var(--rim)";
  const bgColor = anyBreach
    ? "rgba(239,68,68,0.06)"
    : anyWarn
    ? "rgba(245,158,11,0.06)"
    : "var(--panel)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        border: `1px solid ${borderColor}`,
        background: bgColor,
        borderRadius: 2,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.08em",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--gold)",
          letterSpacing: "0.12em",
        }}
      >
        G(m)
      </span>

      <span style={{ color: "var(--text)" }}>
        {deployedCount}/{GM_MAX_POSITIONS} deployed
      </span>

      <span
        style={{
          color: aggBreach ? "var(--red)" : anyWarn ? "var(--amber)" : "var(--text-dim)",
        }}
      >
        {aggregateAum.toFixed(1)}%/{GM_MAX_AGGREGATE_PCT}% AUM
      </span>

      {stagedCount > 0 && (
        <span style={{ color: "var(--text-dim)" }}>
          {stagedCount} staged
        </span>
      )}

      {singleBreach && (
        <span
          style={{
            color: "var(--red)",
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          1% breach
        </span>
      )}
    </div>
  );
}
