import { useState, useMemo } from "react";
import { LiveJisaHolding, LiveTransaction, LiveLayer, LivePerformance } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import { calcHoldingReturns, HoldingReturns } from "@/lib/xirr";

interface Props {
  jisaHoldings: LiveJisaHolding[];
  transactions: LiveTransaction[];
  layers: LiveLayer[];
  performance: LivePerformance[];
}

const CHILDREN = ["Bear", "Alfie", "Edie"] as const;
const JISA_ACCOUNT_MAP: Record<string, string> = { Bear: "JISA-Bear", Alfie: "JISA-Alfie", Edie: "JISA-Edie" };

const BUY_ACTIONS = ["BUY", "SIZE_UP"];
const SELL_ACTIONS = ["SELL", "TRIM", "EXIT"];

function actionBadgeStyle(action: string): React.CSSProperties {
  if (BUY_ACTIONS.includes(action)) return { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" };
  if (SELL_ACTIONS.includes(action)) return { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" };
  if (action === "DIVIDEND") return { background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" };
  return { background: "rgba(255,255,255,0.05)", color: "var(--text-dim)" };
}

function formatCurrency(val: number | null, prefix = "£"): string {
  if (val === null || val === undefined) return "—";
  return `${prefix}${Math.abs(val).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function formatPct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
}

const badge: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
  padding: "2px 8px", borderRadius: 4, display: "inline-block",
};

const cardStyle: React.CSSProperties = {
  background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 6,
  padding: "12px 16px", flex: "1 1 0", minWidth: 140,
};

const metaLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em",
  textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4,
};

const metaVal: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--gold)",
};

export default function JisasTab({ jisaHoldings, transactions, layers, performance }: Props) {
  const isMobile = useIsMobile();
  const [childFilter, setChildFilter] = useState<string>("All");

  const layerHexMap = useMemo(() => {
    const map: Record<string, string> = {};
    layers.forEach(l => { if (l.hexColor) map[l.name.toLowerCase()] = l.hexColor; });
    return map;
  }, [layers]);

  // Calculate returns for each JISA holding from transactions
  const holdingsWithReturns = useMemo(() => {
    return jisaHoldings.map(h => {
      const account = JISA_ACCOUNT_MAP[h.child] || `JISA-${h.child}`;
      const r = transactions.length > 0
        ? calcHoldingReturns(h.ticker, account, h.mvGbp || 0, transactions)
        : undefined;
      return { ...h, returns: r };
    });
  }, [jisaHoldings, transactions]);

  // Summary per child
  const childSummaries = useMemo(() => {
    return CHILDREN.map(child => {
      const holdings = holdingsWithReturns.filter(h => h.child === child);
      const mv = holdings.reduce((s, h) => s + (h.mvGbp || 0), 0);
      const cost = holdings.reduce((s, h) => s + (h.returns?.totalCost || h.costGbp || 0), 0);
      const gl = cost > 0 ? ((mv - cost) / cost) * 100 : 0;
      return { child, mv, cost, gl, count: holdings.length };
    });
  }, [holdingsWithReturns]);

  // JISA performance metrics from PERFORMANCE sheet
  const childPerfMetrics = useMemo(() => {
    if (!performance || performance.length === 0) return {} as Record<string, { inception: number; stellar: number; ytd: number; m12: number }>;

    const SUB_RTN_KEY: Record<string, keyof LivePerformance> = {
      Bear: "subPeriodRtnJb", Alfie: "subPeriodRtnAb", Edie: "subPeriodRtnEb",
    };
    const CUM_TWR_KEY: Record<string, keyof LivePerformance> = {
      Bear: "cumulativeTwrJb", Alfie: "cumulativeTwrAb", Edie: "cumulativeTwrEb",
    };

    const sorted = [...performance].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];

    const findRowIndex = (target: string) => {
      // Find exact or nearest row
      let best = -1;
      let bestDiff = Infinity;
      sorted.forEach((r, i) => {
        const diff = Math.abs(new Date(r.date).getTime() - new Date(target).getTime());
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      });
      return best;
    };

    const chainReturn = (child: string, startIdx: number) => {
      const key = SUB_RTN_KEY[child];
      let cum = 1;
      for (let i = startIdx + 1; i < sorted.length; i++) {
        const rtn = (sorted[i][key] as number) || 0;
        cum *= (1 + rtn / 100);
      }
      return (cum - 1) * 100;
    };

    const stellarIdx = findRowIndex("2025-04-05");
    const ytdIdx = findRowIndex("2025-12-31");
    const now = new Date();
    const m12Ago = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    const m12Idx = findRowIndex(m12Ago);

    const result: Record<string, { inception: number; stellar: number; ytd: number; m12: number }> = {};
    for (const child of CHILDREN) {
      const twrKey = CUM_TWR_KEY[child];
      const inception = (latest[twrKey] as number) || 0;
      result[child] = {
        inception,
        stellar: stellarIdx >= 0 ? chainReturn(child, stellarIdx) : 0,
        ytd: ytdIdx >= 0 ? chainReturn(child, ytdIdx) : 0,
        m12: m12Idx >= 0 ? chainReturn(child, m12Idx) : 0,
      };
    }
    return result;
  }, [performance]);

  const combinedMv = childSummaries.reduce((s, c) => s + c.mv, 0);

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    const items = childFilter === "All" ? holdingsWithReturns : holdingsWithReturns.filter(h => h.child === childFilter);
    return [...items].sort((a, b) => (b.mvGbp || 0) - (a.mvGbp || 0));
  }, [holdingsWithReturns, childFilter]);

  // Group by child
  const groupedHoldings = useMemo(() => {
    if (childFilter !== "All") return [{ child: childFilter, holdings: filteredHoldings }];
    return CHILDREN.map(child => ({
      child,
      holdings: filteredHoldings.filter(h => h.child === child),
    })).filter(g => g.holdings.length > 0);
  }, [filteredHoldings, childFilter]);

  // Layer allocation per child
  const layerAllocation = useMemo(() => {
    const children = childFilter === "All" ? [...CHILDREN] : [childFilter];
    return children.map(child => {
      const holdings = jisaHoldings.filter(h => h.child === child);
      const totalMv = holdings.reduce((s, h) => s + (h.mvGbp || 0), 0);
      const layerMap: Record<string, { current: number; target: number }> = {};
      holdings.forEach(h => {
        const layer = h.layer || "Other";
        if (!layerMap[layer]) layerMap[layer] = { current: 0, target: 0 };
        layerMap[layer].current += totalMv > 0 ? ((h.mvGbp || 0) / totalMv) * 100 : 0;
        layerMap[layer].target += h.targetPct || 0;
      });
      return { child, layers: Object.entries(layerMap).map(([name, vals]) => ({ name, ...vals })) };
    });
  }, [jisaHoldings, childFilter]);

  // Recent JISA transactions
  const recentJisaTxns = useMemo(() => {
    return transactions
      .filter(t => t.account.startsWith("JISA-"))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [transactions]);

  const toggleBtn = (label: string, active: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
    padding: "4px 12px", cursor: "pointer", borderRadius: 4,
    border: active ? "1px solid var(--gold)" : "1px solid var(--rim)",
    background: active ? "rgba(200,169,110,0.12)" : "transparent",
    color: active ? "var(--gold)" : "var(--text-dim)",
  });

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {childSummaries.map(c => (
          <div key={c.child} style={cardStyle}>
            <div style={metaLabel}>{c.child.toUpperCase()}</div>
            <div style={metaVal}>{formatCurrency(c.mv)}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: c.gl >= 0 ? "var(--green)" : "var(--red)", marginTop: 2 }}>
              {formatPct(c.gl)} G/L
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 20, letterSpacing: "0.1em" }}>
        Combined: <span style={{ color: "var(--gold)", fontWeight: 700 }}>{formatCurrency(combinedMv)}</span>
      </div>

      {/* Filter Chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {["All", ...CHILDREN].map(c => (
          <button key={c} style={toggleBtn(c, childFilter === c)} onClick={() => setChildFilter(c)}>{c}</button>
        ))}
      </div>

      {/* Holdings Table */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {filteredHoldings.map((h, i) => {
            const drift = (h.weightPct || 0) - (h.targetPct || 0);
            const hexColor = layerHexMap[h.layer.toLowerCase()] || "var(--text-dim)";
            const r = h.returns;
            const hasReturns = r && r.totalCost > 0;
            return (
              <div key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)", border: "1px solid var(--rim)", borderRadius: 6, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{h.ticker}</span>
                  {hasReturns && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: r!.annualisedReturn >= 0 ? "var(--green)" : "var(--red)" }}>
                      {r!.annualisedReturn >= 0 ? "+" : ""}{r!.annualisedReturn.toFixed(1)}% pa
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{h.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <span>{formatCurrency(h.mvGbp)}</span>
                  <span>{h.weightPct?.toFixed(1)}%</span>
                  <span style={{ color: (h.glPct || 0) >= 0 ? "var(--green)" : "var(--red)" }}>{formatPct(h.glPct)}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: hexColor, display: "inline-block" }} />
                    {h.layer}
                  </span>
                </div>
                {hasReturns && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <span>Cost: {formatCurrency(r!.totalCost)}</span>
                    <span style={{ color: r!.truePL >= 0 ? "var(--green)" : "var(--red)" }}>P&L: {r!.truePL >= 0 ? "+" : ""}£{Math.abs(r!.truePL).toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--rim)", color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                <th style={{ textAlign: "left", padding: "8px 6px" }}>Ticker</th>
                <th style={{ textAlign: "left", padding: "8px 6px" }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px 6px" }}>Layer</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Shares</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>MV £</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Weight %</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Target %</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Drift</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>G/L %</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Cost £</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>P&L £</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Return %</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Ann. Return</th>
              </tr>
            </thead>
            <tbody>
              {groupedHoldings.map(group => (
                <>
                  {childFilter === "All" && (
                    <tr key={`hdr-${group.child}`}>
                      <td colSpan={13} style={{ padding: "10px 6px 4px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "var(--gold)", textTransform: "uppercase", borderBottom: "1px solid var(--rim)" }}>
                        {group.child}
                      </td>
                    </tr>
                  )}
                  {group.holdings.map((h, i) => {
                    const drift = (h.weightPct || 0) - (h.targetPct || 0);
                    const driftAbs = Math.abs(drift);
                    const driftColor = driftAbs <= 2 ? "var(--green)" : driftAbs <= 5 ? "var(--amber)" : "var(--red)";
                    const hexColor = layerHexMap[h.layer.toLowerCase()] || "var(--text-dim)";
                    const r = h.returns;
                    const hasReturns = r && r.totalCost > 0;
                    return (
                      <tr key={`${group.child}-${h.ticker}-${i}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "7px 6px", fontWeight: 700, color: "var(--gold)" }}>{h.ticker}</td>
                        <td style={{ padding: "7px 6px", color: "var(--text)" }}>{h.name}</td>
                        <td style={{ padding: "7px 6px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: hexColor, display: "inline-block" }} />
                            <span style={{ color: "var(--text-dim)" }}>{h.layer}</span>
                          </span>
                        </td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{h.shares ?? "—"}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{formatCurrency(h.mvGbp)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{h.weightPct?.toFixed(1) ?? "—"}%</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text-dim)" }}>{h.targetPct?.toFixed(1) ?? "—"}%</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: driftColor }}>{drift >= 0 ? "+" : ""}{drift.toFixed(1)}%</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: (h.glPct || 0) >= 0 ? "var(--green)" : "var(--red)" }}>{formatPct(h.glPct)}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text-dim)", fontSize: 10 }}>{hasReturns ? formatCurrency(r!.totalCost) : "—"}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: hasReturns ? (r!.truePL >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)" }}>{hasReturns ? `${r!.truePL >= 0 ? "+" : ""}£${Math.abs(r!.truePL).toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: hasReturns ? (r!.truePLpct >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)" }}>{hasReturns ? `${r!.truePLpct >= 0 ? "+" : ""}${r!.truePLpct.toFixed(1)}%` : "—"}</td>
                        <td style={{ padding: "7px 6px", textAlign: "right", color: hasReturns ? (r!.annualisedReturn >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)", fontWeight: hasReturns ? 700 : 400, fontSize: hasReturns ? 12 : 11 }}>{hasReturns ? `${r!.annualisedReturn >= 0 ? "+" : ""}${r!.annualisedReturn.toFixed(1)}% pa` : "—"}</td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
          {filteredHoldings.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No JISA holdings data available</div>
          )}
        </div>
      )}

      {/* Layer Allocation Bars */}
      {layerAllocation.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>Layer Allocation</div>
          {layerAllocation.map(({ child, layers: childLayers }) => (
            <div key={child} style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--gold)", marginBottom: 4 }}>{child}</div>
              <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden", border: "1px solid var(--rim)", position: "relative" }}>
                {childLayers.map(l => {
                  const hex = layerHexMap[l.name.toLowerCase()] || "var(--text-dim)";
                  return l.current > 0 ? (
                    <div
                      key={l.name}
                      style={{ width: `${l.current}%`, background: hex, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
                      title={`${l.name}: ${l.current.toFixed(1)}% (target ${l.target.toFixed(1)}%)`}
                    >
                      {l.current > 8 && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#fff", textShadow: "0 0 3px rgba(0,0,0,0.7)" }}>
                          {l.current.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ) : null;
                })}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                {childLayers.map(l => {
                  const hex = layerHexMap[l.name.toLowerCase()] || "var(--text-dim)";
                  return (
                    <span key={l.name} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: hex, display: "inline-block" }} />
                      {l.name} {l.current.toFixed(1)}% <span style={{ opacity: 0.5 }}>/ {l.target.toFixed(1)}%</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent JISA Transactions */}
      {recentJisaTxns.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>Recent JISA Transactions</div>
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentJisaTxns.map((t, i) => (
                <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", display: "flex", flexWrap: "wrap", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span>{t.date}</span>
                  <span>{t.account.replace("JISA-", "")}</span>
                  <span style={{ color: "var(--gold)", fontWeight: 700 }}>{t.ticker}</span>
                  <span style={{ ...badge, ...actionBadgeStyle(t.action) }}>{t.action}</span>
                  <span>{t.shares ?? "—"}</span>
                  <span>{formatCurrency(t.valueGbp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rim)", color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Child</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Ticker</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>Action</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Shares</th>
                  <th style={{ textAlign: "right", padding: "8px 6px" }}>Value £</th>
                </tr>
              </thead>
              <tbody>
                {recentJisaTxns.map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "7px 6px", color: "var(--text-dim)" }}>{t.date}</td>
                    <td style={{ padding: "7px 6px", color: "var(--text)" }}>{t.account.replace("JISA-", "")}</td>
                    <td style={{ padding: "7px 6px", fontWeight: 700, color: "var(--gold)" }}>{t.ticker}</td>
                    <td style={{ padding: "7px 6px" }}><span style={{ ...badge, ...actionBadgeStyle(t.action) }}>{t.action}</span></td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{t.shares ?? "—"}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{formatCurrency(t.valueGbp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
