import { useState } from "react";
import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";
import { LiveHolding, LivePerformance } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
  performance: LivePerformance[];
}

const CHART_WIDTH = 960;
const CHART_HEIGHT = 320;
const CHART_PADDING = { top: 16, right: 20, bottom: 36, left: 56 };

function formatChartDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

function buildChartGeometry(rows: LivePerformance[]) {
  const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const values = rows.flatMap((row) => [
    row.cumulativeTwrTotal, row.cumulativeTwrSipp, row.cumulativeTwrIsa,
    row.sp500Tr, row.msciWorldTr,
  ]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const mapY = (value: number) => CHART_PADDING.top + ((max - value) / range) * innerHeight;

  const points = rows.map((row, index) => {
    const ratio = rows.length === 1 ? 0.5 : index / (rows.length - 1);
    const x = CHART_PADDING.left + innerWidth * ratio;

    return {
      label: formatChartDate(row.date),
      x,
      totalY: mapY(row.cumulativeTwrTotal),
      sippY: mapY(row.cumulativeTwrSipp),
      isaY: mapY(row.cumulativeTwrIsa),
      sp500Y: mapY(row.sp500Tr),
      msciY: mapY(row.msciWorldTr),
      total: row.cumulativeTwrTotal,
      sipp: row.cumulativeTwrSipp,
      isa: row.cumulativeTwrIsa,
      sp500: row.sp500Tr,
      msci: row.msciWorldTr,
    };
  });

  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, index) => {
    const value = max - (range / (tickCount - 1)) * index;
    return {
      value,
      y: mapY(value),
    };
  });

  const xStep = Math.max(1, Math.ceil(rows.length / 6));
  const xTicks = points.filter((_, index) => index % xStep === 0 || index === points.length - 1);

  return { points, yTicks, xTicks };
}

interface PeriodReturn {
  label: string;
  total: number | null;
  sipp: number | null;
  isa: number | null;
  sp500: number | null;
  alpha: number | null;
}

function computePeriodReturns(sortedNewestFirst: LivePerformance[]): PeriodReturn[] {
  if (sortedNewestFirst.length < 2) return [];
  const latest = sortedNewestFirst[0];
  const latestDate = new Date(latest.date);

  // Guard against invalid dates
  if (isNaN(latestDate.getTime())) return [];

  const nearest = (target: Date) => {
    const t = target.getTime();
    let best = sortedNewestFirst[sortedNewestFirst.length - 1];
    let bestDiff = Math.abs(new Date(best.date).getTime() - t);
    for (const row of sortedNewestFirst) {
      const d = new Date(row.date).getTime();
      if (isNaN(d)) continue;
      const diff = Math.abs(d - t);
      if (diff < bestDiff) { best = row; bestDiff = diff; }
    }
    return best;
  };

  const calcReturn = (endTwr: number, startTwr: number) =>
    ((1 + endTwr / 100) / (1 + startTwr / 100) - 1) * 100;

  const qMonth = Math.floor(latestDate.getMonth() / 3) * 3;
  const currentQtrStart = new Date(latestDate.getFullYear(), qMonth, 1);
  const prevQtrStart = new Date(latestDate.getFullYear(), qMonth - 3, 1);

  const ago = (months: number) => {
    const d = new Date(latestDate);
    d.setMonth(d.getMonth() - months);
    return d;
  };

  const periods: { label: string; start: Date; end?: Date }[] = [
    { label: "Current QTR", start: currentQtrStart },
    { label: "Previous QTR", start: prevQtrStart, end: currentQtrStart },
    { label: "Last 6M", start: ago(6) },
    { label: "Last 1Y", start: ago(12) },
    { label: "Last 3Y", start: ago(36) },
    { label: "Last 5Y", start: ago(60) },
  ];

  const oldest = new Date(sortedNewestFirst[sortedNewestFirst.length - 1].date);

  const results = periods.map(({ label, start, end }) => {
    if (start.getTime() < oldest.getTime() - 45 * 86400000) {
      return { label, total: null, sipp: null, isa: null, sp500: null, alpha: null };
    }
    const startRow = nearest(start);
    const endRow = end ? nearest(end) : latest;
    const totalRtn = calcReturn(endRow.cumulativeTwrTotal, startRow.cumulativeTwrTotal);
    const sp500Rtn = (endRow.sp500Tr != null && startRow.sp500Tr != null)
      ? calcReturn(endRow.sp500Tr, startRow.sp500Tr) : null;
    return {
      label,
      total: totalRtn,
      sipp: calcReturn(endRow.cumulativeTwrSipp, startRow.cumulativeTwrSipp),
      isa: calcReturn(endRow.cumulativeTwrIsa, startRow.cumulativeTwrIsa),
      sp500: sp500Rtn,
      alpha: sp500Rtn != null ? totalRtn - sp500Rtn : null,
    };
  });

  // "Since Stellar" — chain sub-period returns from 05/04/2025
  const sortedOldestFirst = [...sortedNewestFirst].reverse();
  const stellarIdx = sortedOldestFirst.findIndex(r => {
    const d = new Date(r.date);
    return d.getFullYear() === 2025 && d.getMonth() === 3 && d.getDate() === 5;
  });

  if (stellarIdx >= 0) {
    const chainField = (rows: LivePerformance[], startIdx: number, field: keyof LivePerformance) => {
      let cum = 1;
      for (let i = startIdx + 1; i < rows.length; i++) {
        const rtn = (rows[i][field] as number) || 0;
        cum *= (1 + rtn / 100);
      }
      return (cum - 1) * 100;
    };

    const stellarStartRow = sortedOldestFirst[stellarIdx];
    const sippRtn = chainField(sortedOldestFirst, stellarIdx, "subPeriodRtnSipp");
    const isaRtn = chainField(sortedOldestFirst, stellarIdx, "subPeriodRtnIsa");
    const totalRtn = chainField(sortedOldestFirst, stellarIdx, "subPeriodRtnTotal");
    // S&P from cumulative values
    const sp500Rtn = (latest.sp500Tr != null && stellarStartRow.sp500Tr != null)
      ? calcReturn(latest.sp500Tr, stellarStartRow.sp500Tr) : null;
    const alpha = sp500Rtn != null ? totalRtn - sp500Rtn : null;

    // Insert after "Last 1Y" (index 3)
    const insertIdx = results.findIndex(r => r.label === "Last 3Y");
    const stellarRow: PeriodReturn = { label: "Since Stellar (Apr '25)", total: totalRtn, sipp: sippRtn, isa: isaRtn, sp500: sp500Rtn, alpha };
    if (insertIdx >= 0) {
      results.splice(insertIdx, 0, stellarRow);
    } else {
      results.push(stellarRow);
    }
  }

  return results;
}

function toPolyline(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export default function ReturnsTab({ sipp, isa, performance }: Props) {
  const isMobile = useIsMobile();
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);

  const sippData =
    sipp.length > 0 ? sipp : SIPP_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));
  const isaData =
    isa.length > 0 ? isa : ISA_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));
  const all = [...sippData, ...isaData];

  const sippTotal = sippData.reduce((s, h) => s + (h.mv || 0), 0);
  const isaTotal = isaData.reduce((s, h) => s + (h.mv || 0), 0);
  const total = sippTotal + isaTotal;

  const sortedPerf = [...performance].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });
  const latest = sortedPerf[0];

  const chartRows = [...performance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const chartGeometry = chartRows.length > 0 ? buildChartGeometry(chartRows) : null;
  const periodReturns = computePeriodReturns(sortedPerf);

  const winners = [...all]
    .filter((h) => h.gl > 0)
    .sort((a, b) => b.gl - a.gl)
    .slice(0, 6);
  const losers = [...all]
    .filter((h) => h.gl < 0)
    .sort((a, b) => a.gl - b.gl)
    .slice(0, 6);
  const movers = [...all]
    .filter((h) => h.day != null)
    .sort((a, b) => Math.abs(b.day || 0) - Math.abs(a.day || 0))
    .slice(0, 6);

  const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
  const cardHeader: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--rim)",
  };
  const cardTitle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: "var(--text-mid)",
  };

  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  const pctColor = (v: number) => (v >= 0 ? "var(--green)" : "var(--red)");
  const fmtGbp = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`;

  const visiblePerf = historyExpanded
    ? (showAllRows ? sortedPerf : sortedPerf.slice(0, 5))
    : [];

  // Precompute benchmark values
  const sp500Val = latest?.sp500Tr ?? 0;
  const msciVal = latest?.msciWorldTr ?? 0;
  const sippTwr = latest?.cumulativeTwrSipp ?? 0;
  const isaTwr = latest?.cumulativeTwrIsa ?? 0;
  const totalTwr = latest?.cumulativeTwrTotal ?? 0;
  const sippCount = sippData.filter((h) => h.mv > 0).length;
  const isaCount = isaData.filter((h) => h.mv > 0).length;

  const fmtGbpShort = (v: number) => v >= 1000 ? `£${Math.round(v / 1000).toLocaleString("en-GB")}k` : fmtGbp(v);

  const accountCards = [
    { title: "SIPP", aum: sippTotal, twr: sippTwr, alphaSp: sippTwr - sp500Val, alphaMsci: sippTwr - msciVal, footer: `Long horizon · ${sippCount} positions`, highlight: false },
    { title: "ISA", aum: isaTotal, twr: isaTwr, alphaSp: isaTwr - sp500Val, alphaMsci: isaTwr - msciVal, footer: `Flex wrapper · ${isaCount} positions`, highlight: false },
    { title: "PORTFOLIO", aum: total, twr: totalTwr, alphaSp: totalTwr - sp500Val, alphaMsci: totalTwr - msciVal, footer: `${sippCount + isaCount} positions`, highlight: true },
  ];

  return (
    <div>
      {/* Three account cards with embedded benchmarks */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {accountCards.map((ac) => (
          <div key={ac.title} style={{
            ...card, padding: isMobile ? 16 : 24, marginBottom: 0, borderRadius: 12,
            ...(ac.highlight ? { borderLeft: "3px solid var(--gold)" } : {}),
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: ac.highlight ? "var(--gold)" : "var(--text-dim)", marginBottom: 16 }}>{ac.title}</div>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{fmtGbpShort(ac.aum)}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 16 }}>AUM</div>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: pctColor(ac.twr) }}>{fmtPct(ac.twr)}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 16 }}>TWR since inception</div>

            <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>vs S&P 500</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: pctColor(ac.alphaSp) }}>{fmtPct(ac.alphaSp)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>vs MSCI World</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: pctColor(ac.alphaMsci) }}>{fmtPct(ac.alphaMsci)}</span>
              </div>
            </div>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", opacity: 0.6 }}>{ac.footer}</div>
          </div>
        ))}
      </div>

      {periodReturns.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Period Returns (TWR)</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rim)" }}>
                  {["Period", "SIPP", "ISA", "Portfolio", "S&P 500", "Alpha"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: h === "Period" ? "left" : "right",
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: h === "Alpha" ? "var(--gold)" : "var(--text-dim)",
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodReturns.map((pr) => (
                  <tr key={pr.label} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text-mid)" }}>{pr.label}</td>
                    {[pr.sipp, pr.isa, pr.total].map((val, i) => (
                      <td key={i} style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: val == null ? "var(--text-dim)" : pctColor(val) }}>
                        {val == null ? "—" : fmtPct(val)}
                      </td>
                    ))}
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 400, color: pr.sp500 == null ? "var(--text-dim)" : "var(--text-dim)" }}>
                      {pr.sp500 == null ? "—" : fmtPct(pr.sp500)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: pr.alpha == null ? "var(--text-dim)" : pctColor(pr.alpha) }}>
                      {pr.alpha == null ? "—" : fmtPct(pr.alpha)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {chartGeometry && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Portfolio Growth (Cumulative TWR)</span>
          </div>
          <div style={{ padding: "18px 20px 16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
              {[
                { label: "Portfolio Total", color: "#C8A96E", dashed: false, width: 3 },
                { label: "SIPP", color: "#2EC4B6", dashed: false, width: 2 },
                { label: "ISA", color: "#9B5DE5", dashed: false, width: 2 },
                { label: "S&P 500 TR", color: "#888780", dashed: true, width: 1.5 },
                { label: "MSCI World TR", color: "#378ADD", dashed: true, width: 1.5 },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  <svg width="20" height="12" style={{ display: "inline-block" }}>
                    <line x1="0" y1="6" x2="20" y2="6" stroke={item.color} strokeWidth={item.width} strokeDasharray={item.dashed ? "4 3" : "none"} />
                  </svg>
                  {item.label}
                </div>
              ))}
            </div>

            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} style={{ width: "100%", height: 320, display: "block" }} role="img" aria-label="Portfolio cumulative time weighted return chart with benchmarks">
              {chartGeometry.yTicks.map((tick) => (
                <g key={`y-${tick.value}`}>
                  <line x1={CHART_PADDING.left} y1={tick.y} x2={CHART_WIDTH - CHART_PADDING.right} y2={tick.y} stroke="var(--rim)" strokeDasharray="4 4" />
                  <text x={CHART_PADDING.left - 10} y={tick.y + 4} fill="var(--text-dim)" fontFamily="var(--font-mono)" fontSize="10" textAnchor="end">
                    {tick.value.toFixed(0)}%
                  </text>
                </g>
              ))}

              {chartGeometry.xTicks.map((tick, index) => (
                <g key={`x-${tick.label}-${index}`}>
                  <line x1={tick.x} y1={CHART_HEIGHT - CHART_PADDING.bottom} x2={tick.x} y2={CHART_HEIGHT - CHART_PADDING.bottom + 6} stroke="var(--rim)" />
                  <text x={tick.x} y={CHART_HEIGHT - 10} fill="var(--text-dim)" fontFamily="var(--font-mono)" fontSize="10" textAnchor="middle">
                    {tick.label}
                  </text>
                </g>
              ))}

              <line x1={CHART_PADDING.left} y1={CHART_HEIGHT - CHART_PADDING.bottom} x2={CHART_WIDTH - CHART_PADDING.right} y2={CHART_HEIGHT - CHART_PADDING.bottom} stroke="var(--rim)" />

              {/* Benchmark dashed lines — subtle reference */}
              <polyline fill="none" stroke="#888780" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.5"
                points={toPolyline(chartGeometry.points.map((p) => ({ x: p.x, y: p.sp500Y })))} />
              <polyline fill="none" stroke="#378ADD" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.5"
                points={toPolyline(chartGeometry.points.map((p) => ({ x: p.x, y: p.msciY })))} />

              {/* Portfolio lines — visually dominant */}
              <polyline fill="none" stroke="#2EC4B6" strokeWidth="2" opacity="0.8"
                points={toPolyline(chartGeometry.points.map((p) => ({ x: p.x, y: p.sippY })))} />
              <polyline fill="none" stroke="#9B5DE5" strokeWidth="2" opacity="0.8"
                points={toPolyline(chartGeometry.points.map((p) => ({ x: p.x, y: p.isaY })))} />
              <polyline fill="none" stroke="#C8A96E" strokeWidth="3"
                points={toPolyline(chartGeometry.points.map((p) => ({ x: p.x, y: p.totalY })))} />
            </svg>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {[
          { title: "Top Winners (All Time)", rows: winners, key: "gl" as const },
          { title: "Under Pressure", rows: losers, key: "gl" as const },
          { title: "Today's Movers", rows: movers, key: "day" as const },
        ].map(({ title, rows, key }) => (
          <div key={title} style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>{title}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <tbody>
                {rows.map((holding) => {
                  const val = holding[key] ?? 0;
                  return (
                    <tr key={holding.ticker + key} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--gold)", fontWeight: 700 }}>{holding.ticker}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text)", fontSize: 10 }}>{holding.name}</td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: val >= 0 ? "var(--green)" : "var(--red)",
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {val >= 0 ? "+" : ""}
                        {val.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {sortedPerf.length > 0 && (
        <div style={card}>
          <div
            style={{ ...cardHeader, cursor: "pointer", userSelect: "none" }}
            onClick={() => { setHistoryExpanded(!historyExpanded); setShowAllRows(false); }}
          >
            <span style={cardTitle}>Performance History (TWR)</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
              {historyExpanded ? "▲ Collapse" : `▼ Expand (${sortedPerf.length} rows)`}
            </span>
          </div>
          {historyExpanded && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--rim)" }}>
                    {["Date", "SIPP", "ISA", "Total", "Deposits", "Period Rtn", "Cumul. TWR", "Note"].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: "10px 14px",
                          textAlign: header === "Date" || header === "Note" ? "left" : "right",
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: "var(--text-dim)",
                          fontWeight: 700,
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePerf.map((row, index) => (
                    <tr key={`${row.date}-${index}`} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--text-mid)" }}>{row.date}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>{fmtGbp(row.totalSipp)}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>{fmtGbp(row.totalIsa)}</td>
                      <td style={{ padding: "10px 14px", color: "var(--gold)", textAlign: "right", fontWeight: 700 }}>{fmtGbp(row.totalValue)}</td>
                      <td style={{ padding: "10px 14px", color: row.depositsTotal > 0 ? "var(--accent)" : "var(--text-dim)", textAlign: "right" }}>
                        {row.depositsTotal > 0 ? fmtGbp(row.depositsTotal) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: pctColor(row.subPeriodRtnTotal), textAlign: "right", fontWeight: 700 }}>
                        {fmtPct(row.subPeriodRtnTotal)}
                      </td>
                      <td style={{ padding: "10px 14px", color: pctColor(row.cumulativeTwrTotal), textAlign: "right", fontWeight: 700 }}>
                        {fmtPct(row.cumulativeTwrTotal)}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--text-dim)", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.note || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!showAllRows && sortedPerf.length > 5 && (
                <div
                  onClick={() => setShowAllRows(true)}
                  style={{
                    padding: "10px 20px",
                    textAlign: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--accent)",
                    cursor: "pointer",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    borderTop: "1px solid var(--rim)",
                  }}
                >
                  Show all {sortedPerf.length} rows ▼
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
