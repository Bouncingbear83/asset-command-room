import { useMemo } from "react";
import { LiveHolding, LiveWatchItem, LiveScore } from "@/hooks/usePortfolioData";
import { useQuartetMap } from "@/hooks/useQuartetMap";
import { useScoresSnapshot } from "@/hooks/useScoresSnapshot";
import { computeLiveAsymmetry, formatRatio } from "@/lib/liveAsymmetry";
import { AsymmetryPill } from "@/components/AsymmetryPill";
import TickerButton from "@/components/factsheet/TickerButton";
import { useIsMobile } from "@/hooks/use-mobile";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
};

interface AsymRow {
  ticker: string;
  score: number | null;
  held: boolean;
  baseRatio: number | null;
  stretchRatio: number | null;
  band: string | null;
  price: number | null;
  priceAtLastScore: number | null;
  ratioAtScore: number | null; // base ratio computed at score-time price
  ratioDelta: number | null;   // baseRatio - ratioAtScore (positive = improved)
  quartetAgeDays: number | null;
  belowBear: boolean;
  aboveBull: boolean;
  quartet: ReturnType<typeof computeLiveAsymmetry>["quartet"];
  asymmetry: ReturnType<typeof computeLiveAsymmetry>;
}

interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

export default function AsymmetryCompact({ scores, holdings, watchlist }: Props) {
  const isMobile = useIsMobile();
  const { byTicker: snapshotMap } = useScoresSnapshot();
  const quartetMap = useQuartetMap(scores ?? [], holdings ?? [], watchlist ?? [], snapshotMap);

  // Score lookup
  const scoreMap = useMemo(() => {
    const m = new Map<string, { score: number | null; priceAtLastScore: number | null }>();
    for (const s of scores ?? []) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (t && !m.has(t)) m.set(t, { score: s.score ?? null, priceAtLastScore: s.priceAtLastScore ?? null });
    }
    return m;
  }, [scores]);

  const rows = useMemo(() => {
    // Build spine from HOLDINGS + WATCHLIST
    type Spine = { ticker: string; price: number | null; held: boolean };
    const spineByTicker = new Map<string, Spine>();

    for (const h of holdings ?? []) {
      const t = String(h.ticker ?? "").trim().toUpperCase();
      if (!t) continue;
      const price = h.price > 0 ? h.price : null;
      const existing = spineByTicker.get(t);
      if (!existing) spineByTicker.set(t, { ticker: h.ticker || t, price, held: true });
      else { existing.held = true; if (existing.price === null && price !== null) existing.price = price; }
    }
    for (const w of watchlist ?? []) {
      const t = String(w.ticker ?? "").trim().toUpperCase();
      if (!t) continue;
      const price = typeof w.current === "number" && w.current > 0 ? w.current : null;
      const existing = spineByTicker.get(t);
      if (!existing) spineByTicker.set(t, { ticker: w.ticker || t, price, held: false });
      else if (existing.price === null && price !== null) existing.price = price;
    }

    const out: AsymRow[] = [];

    for (const sp of spineByTicker.values()) {
      const t = sp.ticker.toUpperCase();
      const entry = quartetMap.get(t);
      const scoreEntry = scoreMap.get(t);

      const asym = entry?.asymmetry ?? computeLiveAsymmetry(
        { bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null },
        sp.price,
      );

      // Only include rows with a computable base ratio > 0
      if (asym.baseRatio === null || asym.baseRatio <= 0) continue;

      // Compute ratio at score-time price for delta
      let ratioAtScore: number | null = null;
      let ratioDelta: number | null = null;
      const pals = scoreEntry?.priceAtLastScore;
      if (pals && pals > 0 && asym.quartet.bullBase !== null && asym.quartet.bearThesisWeak !== null) {
        const scoreAsym = computeLiveAsymmetry(asym.quartet, pals);
        ratioAtScore = scoreAsym.baseRatio;
        if (ratioAtScore !== null && asym.baseRatio !== null) {
          ratioDelta = asym.baseRatio - ratioAtScore;
        }
      }

      out.push({
        ticker: sp.ticker,
        score: scoreEntry?.score ?? null,
        held: sp.held,
        baseRatio: asym.baseRatio,
        stretchRatio: asym.stretchRatio,
        band: asym.band,
        price: entry?.priceUsed ?? sp.price,
        priceAtLastScore: pals ?? null,
        ratioAtScore,
        ratioDelta,
        quartetAgeDays: asym.quartetAgeDays,
        belowBear: asym.belowBear,
        aboveBull: asym.aboveBull,
        quartet: asym.quartet,
        asymmetry: asym,
      });
    }

    // Sort by base ratio descending, top opportunities first
    return out.sort((a, b) => (b.baseRatio ?? -1) - (a.baseRatio ?? -1)).slice(0, 8);
  }, [holdings, watchlist, scores, quartetMap, scoreMap]);

  if (rows.length === 0) return null;

  const mp = isMobile ? "10px 12px" : "10px 16px";

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>Top Asymmetry</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>
          {rows.length} LIVE
        </span>
      </div>
      <div style={{ padding: mp }}>
        {rows.map((r) => {
          const deltaStr = r.ratioDelta !== null
            ? `${r.ratioDelta >= 0 ? "+" : ""}${r.ratioDelta.toFixed(1)}`
            : null;
          const deltaColor = r.ratioDelta === null
            ? "var(--text-dim)"
            : r.ratioDelta > 0
            ? "var(--green)"
            : r.ratioDelta < -0.3
            ? "var(--red)"
            : "var(--amber)";

          // Price change since score
          const priceDelta = r.price !== null && r.priceAtLastScore && r.priceAtLastScore > 0
            ? ((r.price - r.priceAtLastScore) / r.priceAtLastScore) * 100
            : null;

          const statusColor = r.held ? "var(--gold)" : "var(--text-dim)";

          return (
            <div
              key={r.ticker}
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 4 : 10,
                padding: "8px 0",
                borderBottom: "1px solid rgba(28,28,48,0.3)",
              }}
            >
              {/* Row 1: ticker + status + score + ratio */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: isMobile ? "100%" : "auto", minWidth: 0 }}>
                <TickerButton
                  ticker={r.ticker}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 50 }}
                >
                  {r.ticker}
                </TickerButton>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 7,
                  letterSpacing: "0.1em",
                  color: statusColor,
                  border: `1px solid ${statusColor}`,
                  padding: "0 3px",
                  borderRadius: 1,
                  opacity: 0.7,
                }}>
                  {r.held ? "HELD" : "WL"}
                </span>
                {r.score !== null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{r.score}</span>
                )}
              </div>

              {/* Ratio pill + delta */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: isMobile ? 0 : "auto" }}>
                <AsymmetryPill asymmetry={r.asymmetry} />

                {/* Delta arrow: ratio change since scoring */}
                {deltaStr !== null && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: deltaColor,
                      letterSpacing: "0.04em",
                    }}
                    title={`Ratio at score: ${formatRatio(r.ratioAtScore)} → now: ${formatRatio(r.baseRatio)}${priceDelta !== null ? ` (price ${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(1)}%)` : ""}`}
                  >
                    {r.ratioDelta! >= 0 ? "▲" : "▼"} {deltaStr}
                  </span>
                )}

                {/* Context: price move since score */}
                {priceDelta !== null && (
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: priceDelta < 0 ? "var(--green)" : "var(--amber)",
                    opacity: 0.7,
                  }}>
                    px {priceDelta >= 0 ? "+" : ""}{priceDelta.toFixed(1)}%
                  </span>
                )}

                {/* Prob-weighted divergence flag */}
                {r.asymmetry.divergence !== null && r.asymmetry.divergence > 0.5 && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      color: "var(--red)",
                      background: "var(--red-dim)",
                      padding: "1px 4px",
                      borderRadius: 2,
                      letterSpacing: "0.04em",
                    }}
                    title={`Simple ${formatRatio(r.baseRatio)} vs prob-wgt ${formatRatio(r.asymmetry.probWeightedRatio)}: substrate-fail scenario pulls expected downside wider`}
                  >
                    pwt {formatRatio(r.asymmetry.probWeightedRatio)}
                  </span>
                )}

                {/* Band */}
                {!isMobile && r.band && (
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: "0.1em",
                    color: "var(--text-dim)",
                    opacity: 0.6,
                  }}>
                    {r.band}
                  </span>
                )}

                {/* Quartet age warning */}
                {r.quartetAgeDays !== null && r.quartetAgeDays > 90 && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--amber)" }} title={`Quartet ${r.quartetAgeDays}d old`}>
                    {r.quartetAgeDays}d
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Link to full Scores tab */}
        <div style={{
          paddingTop: 10,
          textAlign: "center",
        }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--gold)",
              letterSpacing: "0.12em",
              opacity: 0.7,
              cursor: "default",
            }}
          >
            FULL TABLE ON SCORES TAB →
          </span>
        </div>
      </div>
    </div>
  );
}
