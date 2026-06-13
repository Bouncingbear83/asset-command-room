import { useMemo } from "react";
import { LiveHolding, LiveWatchItem, LiveScore } from "@/hooks/usePortfolioData";
import { useQuartetMap } from "@/hooks/useQuartetMap";
import { useScoresSnapshot } from "@/hooks/useScoresSnapshot";
import { computeLiveAsymmetry, formatRatio } from "@/lib/liveAsymmetry";
import { AsymmetryPill } from "@/components/AsymmetryPill";
import TickerButton from "@/components/factsheet/TickerButton";
import { useIsMobile } from "@/hooks/use-mobile";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };

interface AsymRow {
  ticker: string;
  score: number | null;
  held: boolean;
  baseRatio: number | null;
  stretchRatio: number | null;
  price: number | null;
  priceAtLastScore: number | null;
  priceDelta: number | null; // % change since score
  ratioDelta: number | null;
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

  const scoreMap = useMemo(() => {
    const m = new Map<string, { score: number | null; priceAtLastScore: number | null }>();
    for (const s of scores ?? []) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (t && !m.has(t)) m.set(t, { score: s.score ?? null, priceAtLastScore: s.priceAtLastScore ?? null });
    }
    return m;
  }, [scores]);

  const rows = useMemo(() => {
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
      if (asym.baseRatio === null || asym.baseRatio <= 0) continue;

      let ratioDelta: number | null = null;
      const pals = scoreEntry?.priceAtLastScore;
      if (pals && pals > 0 && asym.quartet.bullBase !== null && asym.quartet.bearThesisWeak !== null) {
        const scoreAsym = computeLiveAsymmetry(asym.quartet, pals);
        if (scoreAsym.baseRatio !== null && asym.baseRatio !== null) {
          ratioDelta = Math.round((asym.baseRatio - scoreAsym.baseRatio) * 10) / 10;
        }
      }

      const livePrice = entry?.priceUsed ?? sp.price;
      const priceDelta = livePrice !== null && pals && pals > 0
        ? ((livePrice - pals) / pals) * 100 : null;

      out.push({
        ticker: sp.ticker, score: scoreEntry?.score ?? null, held: sp.held,
        baseRatio: asym.baseRatio, stretchRatio: asym.stretchRatio,
        price: livePrice, priceAtLastScore: pals ?? null,
        priceDelta, ratioDelta, asymmetry: asym,
      });
    }
    return out.sort((a, b) => (b.baseRatio ?? -1) - (a.baseRatio ?? -1)).slice(0, 8);
  }, [holdings, watchlist, scores, quartetMap, scoreMap]);

  if (rows.length === 0) return null;

  const thStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
    color: "var(--text-dim)", padding: "8px 6px", borderBottom: "1px solid var(--rim)", textAlign: "right", fontWeight: 400,
  };
  const tdStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 11, padding: "8px 6px", borderBottom: "1px solid rgba(28,28,48,0.3)",
    verticalAlign: "middle",
  };

  return (
    <div style={card}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: "1px solid var(--rim)",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)" }}>Top Asymmetry</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>{rows.length} LIVE</span>
      </div>
      <div style={{ overflowX: "auto", padding: isMobile ? "0 4px" : "0 8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 50 }}>Ticker</th>
              {!isMobile && <th style={{ ...thStyle, textAlign: "center", width: 36 }}></th>}
              <th style={{ ...thStyle, textAlign: "right", width: 30 }}>Scr</th>
              <th style={{ ...thStyle, textAlign: "right", minWidth: 60 }}>Price</th>
              <th style={{ ...thStyle, textAlign: "right", minWidth: 48 }}>Px Δ</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 48 }}>Base</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 48 }}>Stretch</th>
              <th style={{ ...thStyle, textAlign: "right", minWidth: 44 }}>Δ Ratio</th>
              {!isMobile && <th style={{ ...thStyle, textAlign: "right", minWidth: 36 }}>Band</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const deltaColor = r.ratioDelta === null ? "var(--text-dim)"
                : r.ratioDelta > 0 ? "var(--green)" : r.ratioDelta < -0.3 ? "var(--red)" : "var(--amber)";
              const pxColor = r.priceDelta === null ? "var(--text-dim)"
                : r.priceDelta < 0 ? "var(--green)" : "var(--amber)";
              const statusColor = r.held ? "var(--gold)" : "var(--text-dim)";
              const hasPwt = r.asymmetry.divergence !== null && r.asymmetry.divergence > 0.5;

              return (
                <tr key={r.ticker}>
                  <td style={{ ...tdStyle, textAlign: "left" }}>
                    <TickerButton ticker={r.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{r.ticker}</TickerButton>
                  </td>
                  {!isMobile && (
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em", color: statusColor, border: `1px solid ${statusColor}`, padding: "0 3px", borderRadius: 1, opacity: 0.7 }}>
                        {r.held ? "HELD" : "WL"}
                      </span>
                    </td>
                  )}
                  <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-dim)" }}>{r.score ?? "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-mid)" }}>
                    {r.price !== null ? r.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", color: pxColor, fontSize: 10 }}>
                    {r.priceDelta !== null ? `${r.priceDelta >= 0 ? "+" : ""}${r.priceDelta.toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", padding: "6px 4px" }}>
                    <AsymmetryPill asymmetry={r.asymmetry} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", color: r.stretchRatio !== null ? "var(--text-mid)" : "var(--text-dim)", fontSize: 10 }}>
                    {r.stretchRatio !== null ? formatRatio(r.stretchRatio) : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <span style={{ color: deltaColor, fontSize: 10 }}>
                      {r.ratioDelta !== null ? `${r.ratioDelta >= 0 ? "▲" : "▼"} ${r.ratioDelta >= 0 ? "+" : ""}${r.ratioDelta.toFixed(1)}` : "—"}
                    </span>
                    {hasPwt && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--red)", background: "var(--red-dim)", padding: "1px 3px", borderRadius: 2, marginLeft: 4 }}
                        title={`Simple ${formatRatio(r.baseRatio)} vs pwt ${formatRatio(r.asymmetry.probWeightedRatio)}`}
                      >pwt</span>
                    )}
                  </td>
                  {!isMobile && (
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", color: "var(--text-dim)", opacity: 0.6 }}>
                      {r.asymmetry.band || "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 14px", textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", letterSpacing: "0.12em", opacity: 0.7 }}>
          FULL TABLE ON SCORES TAB →
        </span>
      </div>
    </div>
  );
}
