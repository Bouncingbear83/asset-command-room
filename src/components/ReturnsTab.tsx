import { SIPP_HOLDINGS, ISA_HOLDINGS, SIPP_AUM, ISA_AUM, AUM_TOTAL } from "@/data/portfolio";

export default function ReturnsTab() {
  const allHoldings = [...SIPP_HOLDINGS, ...ISA_HOLDINGS];
  const winners = [...allHoldings]
    .filter((h) => h.gl > 0)
    .sort((a, b) => b.gl - a.gl)
    .slice(0, 5);
  const losers = [...allHoldings]
    .filter((h) => h.gl < 0)
    .sort((a, b) => a.gl - b.gl)
    .slice(0, 5);

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

  const metrics = [
    { label: "Total AUM", value: `£${(AUM_TOTAL / 1000).toFixed(0)}k`, sub: "SIPP + ISA combined" },
    { label: "SIPP", value: `£${(SIPP_AUM / 1000).toFixed(0)}k`, sub: "Long horizon" },
    { label: "ISA", value: `£${(ISA_AUM / 1000).toFixed(0)}k`, sub: "Flexible wrapper" },
    { label: "Target CAGR", value: "15–20%", sub: "Annual compound return" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ ...card, padding: 20, marginBottom: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--text)", fontWeight: 300 }}>
              {m.value}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginTop: 4,
              }}
            >
              {m.label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Top Winners</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <tbody>
              {winners.map((h) => (
                <tr key={h.ticker} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--gold)", fontWeight: 700 }}>{h.ticker}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text)" }}>{h.name}</td>
                  <td style={{ padding: "10px 16px", color: "var(--green)", textAlign: "right", fontWeight: 700 }}>
                    +{h.gl.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--text-mid)", textAlign: "right" }}>
                    £{h.mv.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Positions Under Pressure</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <tbody>
              {losers.map((h) => (
                <tr key={h.ticker} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                  <td style={{ padding: "10px 16px", color: "var(--gold)", fontWeight: 700 }}>{h.ticker}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text)" }}>{h.name}</td>
                  <td style={{ padding: "10px 16px", color: "var(--red)", textAlign: "right", fontWeight: 700 }}>
                    {h.gl.toFixed(1)}%
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--text-mid)", textAlign: "right" }}>
                    £{h.mv.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
