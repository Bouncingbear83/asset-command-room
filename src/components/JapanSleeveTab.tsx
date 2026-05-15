import { Fragment, useMemo, useState } from "react";
import type { LiveHolding, LiveScore, LiveWatchItem } from "@/hooks/usePortfolioData";

interface JapanSleeveTabProps {
  bordier: LiveHolding[];
  scores: LiveScore[];
  watchlist: LiveWatchItem[];
  totalPortfolioAum: number;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const CGT_RATE = 0.20;
const LIQUIDITY_CAPPED = new Set(["4047.T"]);
const FEDERATION_RULE9 = new Set(["7741.T"]);

const fmtGbp = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`;
const fmtGbpK = (v: number) => `£${(v / 1000).toFixed(1)}k`;
const fmtJpy = (v: number | null) => v == null ? "—" : `¥${Math.round(v).toLocaleString("en-GB")}`;
const fmtPct = (v: number, dp = 1) => `${v.toFixed(dp)}%`;
const fmtFx = (v: number | null) => v == null ? "—" : v.toFixed(5);

function reclassPillStyle(status: string): React.CSSProperties {
  const s = status.toUpperCase();
  if (s === "COMPLETE") return { background: "rgba(67,160,71,0.12)", color: "var(--green)", borderColor: "rgba(67,160,71,0.3)" };
  if (s === "IN_PROGRESS" || s === "IN-PROGRESS") return { background: "rgba(255,179,0,0.12)", color: "var(--amber)", borderColor: "rgba(255,179,0,0.3)" };
  if (s === "PRE") return { background: "rgba(138,138,154,0.08)", color: "var(--text-dim)", borderColor: "var(--rim)" };
  return { background: "transparent", color: "var(--text-dim)", borderColor: "var(--rim)" };
}

function substrateColor(sub: number | null, level: string): string {
  if (sub != null && sub >= 22) return "var(--green)";
  if ((level || "").toUpperCase() === "L3") return "var(--amber)";
  return "var(--red)";
}

export default function JapanSleeveTab({ bordier, scores, watchlist, totalPortfolioAum, loading, error, onRefresh }: JapanSleeveTabProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [watchOpen, setWatchOpen] = useState(false);

  const scoresByTicker = useMemo(() => {
    const m = new Map<string, LiveScore>();
    scores.forEach((s) => { if (s.ticker) m.set(s.ticker.toUpperCase(), s); });
    return m;
  }, [scores]);

  const enriched = useMemo(() => bordier.map((h) => {
    const s = scoresByTicker.get(h.ticker.toUpperCase());
    const fx = h.shares && h.price && h.mv ? h.mv / (h.shares * h.price) : null;
    return {
      ...h,
      score: s?.score ?? null,
      substrate: s?.substrate ?? null,
      substrateLevel: s?.substrateLevel ?? "",
      reclassStatus: s?.reclassStatus ?? "PRE",
      fullThesis: s?.fullThesis ?? "",
      fx,
    };
  }), [bordier, scoresByTicker]);

  const sleeveAum = enriched.reduce((sum, h) => sum + (h.mv || 0), 0);
  const prevAum = enriched.reduce((sum, h) => {
    if (h.shares && h.prevClose && h.fx) return sum + (h.shares * h.prevClose * h.fx);
    return sum + (h.mv || 0);
  }, 0);
  const dailyDelta = prevAum > 0 ? ((sleeveAum - prevAum) / prevAum) * 100 : 0;
  const totalAumWithSleeve = totalPortfolioAum + sleeveAum;
  const pctOfTotal = totalAumWithSleeve > 0 ? (sleeveAum / totalAumWithSleeve) * 100 : 0;
  const avgSubstrate = enriched.length > 0
    ? enriched.filter((h) => h.substrate != null).reduce((s, h) => s + (h.substrate || 0), 0) /
      Math.max(1, enriched.filter((h) => h.substrate != null).length)
    : 0;
  const fxRate = enriched.find((h) => h.fx != null)?.fx ?? null;

  const stalePositions = enriched.filter((h) => h.price != null && h.prevClose != null && h.price > 0 && h.price === h.prevClose);
  const failingCriterion = enriched.filter((h) => !((h.substrate != null && h.substrate >= 22) || (h.score != null && h.score >= 80)));
  const unrealisedGain = enriched.reduce((sum, h) => sum + ((h.mv || 0) - (h.costGbp || 0)), 0);
  const cgtLiability = enriched.reduce((sum, h) => {
    const g = (h.mv || 0) - (h.costGbp || 0);
    return g > 0 ? sum + g * CGT_RATE : sum;
  }, 0);

  const tseWatch = watchlist.filter((w) => w.ticker.endsWith(".T") && (w.status?.toUpperCase() === "WATCH" || w.status?.toUpperCase() === "PRE-IPO"));

  // Styles
  const s = {
    page: { padding: "24px var(--app-px, 40px)", color: "var(--text)", fontFamily: "var(--font-ui)" } as React.CSSProperties,
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 } as React.CSSProperties,
    h1: { fontFamily: "var(--font-serif, 'Cormorant Garamond', serif)", fontSize: 28, color: "var(--gold)", margin: 0, fontStyle: "italic" } as React.CSSProperties,
    sub: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--text-dim)", marginTop: 4 },
    refreshBtn: { background: "none", border: "1px solid var(--rim)", color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", padding: "6px 14px", cursor: "pointer", textTransform: "uppercase" as const },
    kpiBand: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: "var(--rim)", border: "1px solid var(--rim)", marginBottom: 16 } as React.CSSProperties,
    kpi: { background: "var(--panel)", padding: "14px 16px" } as React.CSSProperties,
    kpiLabel: { fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--text-dim)" },
    kpiVal: { fontFamily: "var(--font-mono)", fontSize: 20, color: "var(--gold)", fontWeight: 600, marginTop: 6 },
    kpiSub: { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 2 },
    main: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16, alignItems: "start" } as React.CSSProperties,
    panel: { background: "var(--panel)", border: "1px solid var(--rim)" } as React.CSSProperties,
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
    th: { textAlign: "left" as const, padding: "10px 8px", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--text-dim)", borderBottom: "1px solid var(--rim)", whiteSpace: "nowrap" as const },
    td: { padding: "10px 8px", borderBottom: "1px solid rgba(138,138,154,0.08)", verticalAlign: "middle" as const },
    mono: { fontFamily: "var(--font-mono)" },
    pill: { display: "inline-block", border: "1px solid", borderRadius: 2, padding: "2px 6px", fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" as const },
    sectionTitle: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "var(--gold)", padding: "12px 16px 8px", borderBottom: "1px solid var(--rim)" },
    panelBody: { padding: 16, fontSize: 12, lineHeight: 1.6 },
    staleBanner: { background: "rgba(255,179,0,0.08)", border: "1px solid rgba(255,179,0,0.4)", padding: "10px 14px", marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)", letterSpacing: "0.06em" } as React.CSSProperties,
    errBanner: { background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.4)", padding: "8px 14px", marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--red)", letterSpacing: "0.06em" } as React.CSSProperties,
  };

  return (
    <div style={s.page} className="japan-sleeve">
      <style>{`
        @media (max-width: 767px) {
          .japan-sleeve { padding: 14px 12px !important; }
          .js-header { flex-direction: column !important; gap: 10px; align-items: stretch !important; }
          .js-h1 { font-size: 22px !important; }
          .js-refresh { width: 100%; padding: 10px !important; }
          .js-kpi-band { grid-template-columns: repeat(2, 1fr) !important; }
          .js-kpi-val { font-size: 16px !important; }
          .js-main { grid-template-columns: 1fr !important; }
          .js-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .js-table { min-width: 880px; }
          .js-expand-grid { grid-template-columns: 1fr !important; }
          .js-notes { max-width: 140px !important; }
        }
      `}</style>
      <div style={s.header} className="js-header">
        <div>
          <h1 style={s.h1} className="js-h1">Japan Sleeve</h1>
          <div style={s.sub}>Bordier GIA · TSE substrate · manual pricing · CGT-applicable</div>
        </div>
        <button style={s.refreshBtn} className="js-refresh" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh from Sheet"}
        </button>
      </div>

      {error && <div style={s.errBanner}>⚠ {error}</div>}

      {stalePositions.length > 0 && (
        <div style={s.staleBanner}>
          ⚠ Manual price refresh required for {stalePositions.map((p) => p.ticker).join(", ")}
        </div>
      )}

      <div style={s.kpiBand} className="js-kpi-band">
        <div style={s.kpi}>
          <div style={s.kpiLabel}>Sleeve AUM</div>
          <div style={s.kpiVal} className="js-kpi-val">{loading && sleeveAum === 0 ? "—" : fmtGbpK(sleeveAum)}</div>
          <div style={{ ...s.kpiSub, color: dailyDelta >= 0 ? "var(--green)" : "var(--red)" }}>
            {dailyDelta >= 0 ? "▲" : "▼"} {Math.abs(dailyDelta).toFixed(2)}% today
          </div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>% of Total AUM</div>
          <div style={s.kpiVal} className="js-kpi-val">{loading && pctOfTotal === 0 ? "—" : fmtPct(pctOfTotal, 2)}</div>
          <div style={s.kpiSub}>vs {fmtGbpK(totalAumWithSleeve)} total</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>Positions</div>
          <div style={s.kpiVal} className="js-kpi-val">{enriched.length || (loading ? "—" : 0)}</div>
          <div style={s.kpiSub}>TSE-listed</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>Avg Substrate</div>
          <div className="js-kpi-val" style={{ ...s.kpiVal, color: avgSubstrate >= 22 ? "var(--green)" : "var(--gold)" }}>
            {avgSubstrate > 0 ? avgSubstrate.toFixed(1) : "—"}
          </div>
          <div style={s.kpiSub}>sub-score across sleeve</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLabel}>JPY/GBP</div>
          <div style={s.kpiVal} className="js-kpi-val">{fmtFx(fxRate)}</div>
          <div style={s.kpiSub}>implied from MV/shares</div>
        </div>
      </div>

      <div style={s.main} className="js-main">
        {/* Position table */}
        <div style={s.panel}>
          <div style={s.sectionTitle}>Positions</div>
          <div className="js-table-wrap">
          <table style={s.table} className="js-table">
            <thead>
              <tr>
                {["Ticker", "Name", "Layer", "Score", "Substrate", "Reclass", "JPY Price", "JPY Cost", "FX", "MV (£)", "AUM %", "G/L %", "Notes"].map((c) => (
                  <th key={c} style={s.th}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && enriched.length === 0 && [0, 1, 2, 3].map((i) => (
                <tr key={i}>
                  <td colSpan={13} style={{ ...s.td, padding: 0 }}>
                    <div style={{ height: 32, background: "linear-gradient(90deg, transparent, rgba(138,138,154,0.06), transparent)", animation: "pulse 1.5s infinite" }} />
                  </td>
                </tr>
              ))}
              {!loading && enriched.length === 0 && (
                <tr><td colSpan={13} style={{ ...s.td, color: "var(--text-dim)", fontStyle: "italic", textAlign: "center", padding: 24 }}>No Bordier_GIA positions found in HOLDINGS.</td></tr>
              )}
              {enriched.map((h) => {
                const isOpen = expanded === h.ticker;
                const subColor = substrateColor(h.substrate, h.substrateLevel);
                const sleevePct = sleeveAum > 0 ? ((h.mv || 0) / sleeveAum) * 100 : 0;
                const jpyCost = h.costLocal != null ? h.costLocal : (h.costGbp && h.shares && h.fx ? (h.costGbp / h.fx) / h.shares : null);
                return (
                  <Fragment key={h.ticker}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : h.ticker)}>
                      <td style={{ ...s.td, ...s.mono, color: "var(--gold)", fontWeight: 600 }}>{h.ticker}</td>
                      <td style={s.td}>{h.name}</td>
                      <td style={{ ...s.td, ...s.mono, fontSize: 11, color: "var(--text-dim)" }}>{h.layer}</td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const }}>{h.score ?? "—"}</td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const, color: subColor, fontWeight: 600 }}>
                        {h.substrate ?? "—"}{h.substrateLevel ? <span style={{ color: "var(--text-dim)", marginLeft: 4, fontWeight: 400 }}>{h.substrateLevel}</span> : null}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.pill, ...reclassPillStyle(h.reclassStatus) }}>{h.reclassStatus || "—"}</span>
                      </td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const }}>{fmtJpy(h.price)}</td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const, color: "var(--text-dim)" }}>{fmtJpy(jpyCost)}</td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const, color: "var(--text-dim)" }}>{fmtFx(h.fx)}</td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const }}>{fmtGbp(h.mv || 0)}</td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const, color: "var(--text-dim)" }}>{fmtPct(sleevePct, 1)}</td>
                      <td style={{ ...s.td, ...s.mono, textAlign: "right" as const, color: (h.gl || 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                        {(h.gl || 0) >= 0 ? "+" : ""}{fmtPct(h.gl || 0, 1)}
                      </td>
                      <td style={{ ...s.td, color: "var(--text-dim)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }} title={h.notes}>
                        {h.notes ? (h.notes.length > 80 ? h.notes.slice(0, 80) + "…" : h.notes) : "—"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={13} style={{ ...s.td, background: "rgba(201,168,76,0.03)", borderLeft: "2px solid var(--gold)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "8px 12px" }}>
                            <div>
                              <div style={s.kpiLabel}>Full thesis</div>
                              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text)", lineHeight: 1.6 }}>{h.fullThesis || "No thesis recorded."}</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div><span style={s.kpiLabel}>Add trigger</span><div style={{ ...s.mono, fontSize: 11, marginTop: 4 }}>{h.add_trigger || "—"}</div></div>
                              <div><span style={s.kpiLabel}>Exit trigger</span><div style={{ ...s.mono, fontSize: 11, marginTop: 4 }}>{h.exit_trigger || "—"}</div></div>
                              <div><span style={s.kpiLabel}>Last review</span><div style={{ ...s.mono, fontSize: 11, marginTop: 4, color: "var(--text-dim)" }}>{h.trigger_review_date || "—"} {h.trigger_review_note ? `· ${h.trigger_review_note}` : ""}</div></div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {h.factor_primary && <span style={{ ...s.pill, color: "var(--gold)", borderColor: "rgba(201,168,76,0.3)" }}>{h.factor_primary}</span>}
                                {h.stack_layer && <span style={{ ...s.pill, color: "var(--text-dim)", borderColor: "var(--rim)" }}>{h.stack_layer}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Compliance / tax panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={s.panel}>
            <div style={s.sectionTitle}>Doctrine compliance</div>
            <div style={s.panelBody}>
              <div style={{ marginBottom: 12 }}>
                <div style={s.kpiLabel}>Capital criterion (sub ≥22 OR score ≥80)</div>
                <div style={{ marginTop: 6 }}>
                  {failingCriterion.length === 0
                    ? <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)", fontSize: 11 }}>✓ All positions pass</span>
                    : <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 11 }}>✗ Failing: {failingCriterion.map((p) => p.ticker).join(", ")}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {enriched.filter((h) => LIQUIDITY_CAPPED.has(h.ticker)).map((h) => (
                  <div key={h.ticker}>
                    <span style={{ ...s.pill, color: "var(--amber)", borderColor: "rgba(255,179,0,0.4)", background: "rgba(255,179,0,0.08)" }}>
                      Liquidity-capped · {h.ticker}
                    </span>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>One tranche only. Thin TSE liquidity.</div>
                  </div>
                ))}
                {enriched.filter((h) => FEDERATION_RULE9.has(h.ticker)).map((h) => (
                  <div key={h.ticker}>
                    <span style={{ ...s.pill, color: "var(--gold)", borderColor: "rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.06)" }}>
                      Federation Rule #9 · {h.ticker}
                    </span>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>Conglomerate with pre-reclass IT segment leg.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={s.panel}>
            <div style={s.sectionTitle}>Tax friction (GIA)</div>
            <div style={s.panelBody}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={s.kpiLabel}>Unrealised gain</span>
                <span style={{ ...s.mono, color: unrealisedGain >= 0 ? "var(--green)" : "var(--red)" }}>{unrealisedGain >= 0 ? "+" : ""}{fmtGbp(unrealisedGain)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={s.kpiLabel}>Indicative CGT @ 20%</span>
                <span style={{ ...s.mono, color: "var(--amber)" }}>{fmtGbp(cgtLiability)}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", fontStyle: "italic", marginTop: 8, lineHeight: 1.5 }}>
                Advisory only. GIA = no SIPP/ISA shelter. Unlike ii holdings, every realised gain is CGT-eligible.
              </div>
            </div>
          </div>

          <div style={s.panel}>
            <div style={s.sectionTitle}>FX exposure</div>
            <div style={s.panelBody}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={s.kpiLabel}>Total JPY in GBP</span>
                <span style={s.mono}>{fmtGbp(sleeveAum)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={s.kpiLabel}>Implied JPY/GBP</span>
                <span style={s.mono}>{fmtFx(fxRate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist block */}
      <div style={{ ...s.panel, marginTop: 16 }}>
        <div
          style={{ ...s.sectionTitle, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => setWatchOpen(!watchOpen)}
        >
          <span>TSE Watchlist ({tseWatch.length})</span>
          <span style={{ transform: watchOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </div>
        {watchOpen && (
          <table style={s.table}>
            <thead>
              <tr>
                {["Ticker", "Name", "Score", "Entry Target", "Current", "Distance"].map((c) => <th key={c} style={s.th}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {tseWatch.length === 0 && (
                <tr><td colSpan={6} style={{ ...s.td, color: "var(--text-dim)", textAlign: "center", padding: 20, fontStyle: "italic" }}>No TSE watchlist names.</td></tr>
              )}
              {tseWatch.map((w) => {
                const sc = scoresByTicker.get(w.ticker.toUpperCase());
                const entryNum = parseFloat(String(w.entry).replace(/[^0-9.\-]/g, ""));
                const dist = (w.current && entryNum) ? ((w.current - entryNum) / entryNum) * 100 : null;
                return (
                  <tr key={w.ticker}>
                    <td style={{ ...s.td, ...s.mono, color: "var(--gold)" }}>{w.ticker}</td>
                    <td style={s.td}>{w.name}</td>
                    <td style={{ ...s.td, ...s.mono, textAlign: "right" as const }}>{sc?.score ?? "—"}</td>
                    <td style={{ ...s.td, ...s.mono, textAlign: "right" as const, color: "var(--text-dim)" }}>{w.entry || "—"}</td>
                    <td style={{ ...s.td, ...s.mono, textAlign: "right" as const }}>{w.current != null ? fmtJpy(w.current) : "—"}</td>
                    <td style={{ ...s.td, ...s.mono, textAlign: "right" as const, color: dist == null ? "var(--text-dim)" : Math.abs(dist) < 5 ? "var(--amber)" : "var(--text-dim)" }}>
                      {dist == null ? "—" : `${dist >= 0 ? "+" : ""}${dist.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
