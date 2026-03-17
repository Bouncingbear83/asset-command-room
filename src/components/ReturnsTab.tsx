import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";
import { LiveHolding, LivePerformance } from "@/hooks/usePortfolioData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
  performance: LivePerformance[];
}

export default function ReturnsTab({ sipp, isa, performance }: Props) {
  const sippData =
    sipp.length > 0 ? sipp : SIPP_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));
  const isaData =
    isa.length > 0 ? isa : ISA_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));
  const all = [...sippData, ...isaData];

  const sippTotal = sippData.reduce((s, h) => s + (h.mv || 0), 0);
  const isaTotal = isaData.reduce((s, h) => s + (h.mv || 0), 0);
  const total = sippTotal + isaTotal;

  // Latest performance row for summary cards
  const sortedPerf = [...performance].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });
  const latest = sortedPerf[0];

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
  const fmtGbp = (v: number) => `£${(v / 1000).toFixed(0)}k`;

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total AUM", value: latest ? fmtGbp(latest.totalValue) : fmtGbp(total) },
          { label: "Cumulative TWR", value: latest ? fmtPct(latest.cumulativeTwrTotal) : "—", color: latest ? pctColor(latest.cumulativeTwrTotal) : undefined },
          { label: "SIPP TWR", value: latest ? fmtPct(latest.cumulativeTwrSipp) : "—", color: latest ? pctColor(latest.cumulativeTwrSipp) : undefined },
          { label: "ISA TWR", value: latest ? fmtPct(latest.cumulativeTwrIsa) : "—", color: latest ? pctColor(latest.cumulativeTwrIsa) : undefined },
        ].map((m) => (
          <div key={m.label} style={{ ...card, padding: 20, marginBottom: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, color: (m as any).color ?? "var(--text)", fontWeight: 300 }}>
              {m.value}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginTop: 6,
              }}
            >
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Performance history table */}
      {sortedPerf.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Performance History (TWR)</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rim)" }}>
                  {["Date", "SIPP", "ISA", "Total", "Deposits", "Period Rtn", "Cumul. TWR", "Note"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: h === "Date" || h === "Note" ? "left" : "right",
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "var(--text-dim)",
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPerf.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text-mid)" }}>{p.date}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>{fmtGbp(p.totalSipp)}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>{fmtGbp(p.totalIsa)}</td>
                    <td style={{ padding: "10px 14px", color: "var(--gold)", textAlign: "right", fontWeight: 700 }}>{fmtGbp(p.totalValue)}</td>
                    <td style={{ padding: "10px 14px", color: p.depositsTotal > 0 ? "var(--accent)" : "var(--text-dim)", textAlign: "right" }}>
                      {p.depositsTotal > 0 ? fmtGbp(p.depositsTotal) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", color: pctColor(p.subPeriodRtnTotal), textAlign: "right", fontWeight: 700 }}>
                      {fmtPct(p.subPeriodRtnTotal)}
                    </td>
                    <td style={{ padding: "10px 14px", color: pctColor(p.cumulativeTwrTotal), textAlign: "right", fontWeight: 700 }}>
                      {fmtPct(p.cumulativeTwrTotal)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-dim)", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.note || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Winners / Losers / Movers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
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
                {rows.map((h) => {
                  const val = h[key] ?? 0;
                  return (
                    <tr key={h.ticker + key} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--gold)", fontWeight: 700 }}>{h.ticker}</td>
                      <td style={{ padding: "10px 14px", color: "var(--text)", fontSize: 10 }}>{h.name}</td>
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
    </div>
  );
}
