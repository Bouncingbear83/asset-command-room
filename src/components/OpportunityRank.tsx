import { useMemo } from "react";
import { LiveHolding, LiveWatchItem, LiveScore } from "@/hooks/usePortfolioData";
import { useIrrBb, type IrrBbEntry } from "@/hooks/useIrrBb";
import { useQuartetMap } from "@/hooks/useQuartetMap";
import { useScoresSnapshot } from "@/hooks/useScoresSnapshot";
import { computeLiveAsymmetry } from "@/lib/liveAsymmetry";
import { formatYears } from "@/lib/computeIrrBb";
import { AsymmetryPill } from "@/components/AsymmetryPill";
import { IrrBbPill } from "@/components/IrrBbPill";
import { TickerLabel } from "@/components/shared/TickerLabel";
import { useIsMobile } from "@/hooks/use-mobile";
import { normaliseTicker } from "@/lib/tickerAlias";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };

interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

export default function OpportunityRank({ scores, holdings, watchlist }: Props) {
  const isMobile = useIsMobile();
  const { byTicker: irrMap, nameMap, ranked, isBootstrap, loading } = useIrrBb(scores, holdings, watchlist);
  const { byTicker: snapshotMap } = useScoresSnapshot();
  const quartetMap = useQuartetMap(scores ?? [], holdings ?? [], watchlist ?? [], snapshotMap);

  // Build asymmetry results keyed by ticker
  const asymMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeLiveAsymmetry>>();
    for (const [t, entry] of quartetMap) {
      if (entry.asymmetry) m.set(t, entry.asymmetry);
    }
    return m;
  }, [quartetMap]);

  // Build live price map
  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of holdings) {
      const t = normaliseTicker(h.ticker);
      if (t && h.price > 0 && !m.has(t)) m.set(t, h.price);
    }
    for (const w of watchlist) {
      const t = normaliseTicker(w.ticker);
      const p = typeof w.current === "number" && w.current > 0 ? w.current : null;
      if (t && p && !m.has(t)) m.set(t, p);
    }
    return m;
  }, [holdings, watchlist]);

  // Split ranked into those with IRR-BB and those without
  const { withIrr, withoutIrr } = useMemo(() => {
    const withIrr: IrrBbEntry[] = [];
    const withoutIrr: IrrBbEntry[] = [];
    for (const entry of ranked) {
      if (entry.result.irrBb !== null) {
        withIrr.push(entry);
      } else {
        withoutIrr.push(entry);
      }
    }
    return { withIrr: withIrr.slice(0, 10), withoutIrr: withoutIrr.slice(0, 3) };
  }, [ranked]);

  // Bootstrap state: show banner
  if (isBootstrap && !loading) {
    return (
      <div style={card}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", borderBottom: "1px solid var(--rim)",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)" }}>
            Opportunity rank
          </span>
        </div>
        <div style={{ padding: "20px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
          Awaiting first snapshot with IRR-BB data.
          <br />
          <span style={{ fontSize: 9, opacity: 0.6 }}>Run Daily Snapshot or patch bb_target_date on SCORES tab.</span>
        </div>
      </div>
    );
  }

  if (withIrr.length === 0 && withoutIrr.length === 0) return null;

  const thStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "var(--text-dim)", padding: "8px 6px", borderBottom: "1px solid var(--rim)", textAlign: "right", fontWeight: 400,
  };
  const tdStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 11, padding: "7px 6px", borderBottom: "1px solid rgba(28,28,48,0.3)",
    verticalAlign: "middle",
  };

  const renderRow = (entry: IrrBbEntry, isNa: boolean = false) => {
    const t = normaliseTicker(entry.ticker);
    const asym = asymMap.get(t) ?? computeLiveAsymmetry(
      { bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null },
      priceMap.get(t) ?? null,
    );
    const statusColor = entry.held ? "var(--gold)" : "var(--text-dim)";

    return (
      <tr key={entry.ticker} style={isNa ? { opacity: 0.55 } : undefined}>
        <td style={{ ...tdStyle, textAlign: "left", minWidth: isMobile ? 60 : 100 }}>
          <TickerLabel
            ticker={entry.ticker}
            name={entry.name}
            compact={isMobile}
            clickable
          />
        </td>
        {!isMobile && (
          <td style={{ ...tdStyle, textAlign: "center" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.08em",
              color: statusColor, border: `1px solid ${statusColor}`,
              padding: "0 3px", borderRadius: 1, opacity: 0.7,
            }}>
              {entry.held ? "HELD" : "WL"}
            </span>
          </td>
        )}
        <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-dim)" }}>
          {entry.score ?? "\u2014"}
        </td>
        <td style={{ ...tdStyle, textAlign: "center", padding: "5px 4px" }}>
          <IrrBbPill result={entry.result} showNa={isNa} />
        </td>
        <td style={{ ...tdStyle, textAlign: "center", padding: "5px 4px" }}>
          <AsymmetryPill asymmetry={asym} />
        </td>
        {!isMobile && (
          <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-dim)", fontSize: 10 }}>
            {formatYears(entry.result.yearsRemaining)}
          </td>
        )}
      </tr>
    );
  };

  return (
    <div style={card}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: "1px solid var(--rim)",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
        }}>
          Opportunity rank
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em",
        }}>
          {withIrr.length} ranked · by IRR-BB
        </span>
      </div>

      <div style={{ overflowX: "auto", padding: isMobile ? "0 4px" : "0 8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", minWidth: isMobile ? 60 : 100 }}>Name</th>
              {!isMobile && <th style={{ ...thStyle, textAlign: "center", width: 36 }}></th>}
              <th style={{ ...thStyle, textAlign: "right", width: 30 }}>Scr</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 58 }}>IRR-BB</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 48 }}>Asym</th>
              {!isMobile && <th style={{ ...thStyle, textAlign: "right", minWidth: 36 }}>Yrs</th>}
            </tr>
          </thead>
          <tbody>
            {withIrr.map((e) => renderRow(e))}
            {withoutIrr.length > 0 && (
              <>
                <tr>
                  <td colSpan={isMobile ? 4 : 6} style={{
                    fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "var(--text-dim)", padding: "6px",
                    background: "rgba(28,28,48,0.2)",
                  }}>
                    No IRR-BB target
                  </td>
                </tr>
                {withoutIrr.map((e) => renderRow(e, true))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "10px 14px", textAlign: "center" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)",
          letterSpacing: "0.12em", opacity: 0.7,
        }}>
          FULL VIEW ON INTELLIGENCE TAB &rarr;
        </span>
      </div>
    </div>
  );
}
