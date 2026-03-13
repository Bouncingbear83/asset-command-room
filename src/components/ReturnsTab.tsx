import { SIPP_HOLDINGS, ISA_HOLDINGS, SIPP_AUM, ISA_AUM } from "@/data/portfolio";
import { LiveHolding } from "@/hooks/usePortfolioData";

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
}

export default function ReturnsTab({ sipp, isa }: Props) {
  const sippData =
    sipp.length > 0 ? sipp : SIPP_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));
  const isaData =
    isa.length > 0 ? isa : ISA_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));
  const all = [...sippData, ...isaData];

  const sippTotal = sippData.reduce((s, h) => s + (h.mv || 0), 0);
  const isaTotal = isaData.reduce((s, h) => s + (h.mv || 0), 0);
  const total = sippTotal + isaTotal;

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

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total AUM", value: `£${(total / 1000).toFixed(0)}k` },
          { label: "SIPP", value: `£${(sippTotal / 1000).toFixed(0)}k` },
          { label: "ISA", value: `£${(isaTotal / 1000).toFixed(0)}k` },
          { label: "Target CAGR", value: "15–20%" },
        ].map((m) => (
          <div key={m.label} style={{ ...card, padding: 20, marginBottom: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, color: "var(--text)", fontWeight: 300 }}>
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
