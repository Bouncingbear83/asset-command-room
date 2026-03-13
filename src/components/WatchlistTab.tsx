import { WATCHLIST } from "@/data/portfolio";

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  WAIT: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  WATCH: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  "BUY T1": { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  RESEARCH: { background: "rgba(28,28,48,0.5)", color: "var(--text-dim)", border: "1px solid var(--rim)" },
};

export default function WatchlistTab() {
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

  const buys = WATCHLIST.filter((w) => w.status === "BUY T1");
  const watches = WATCHLIST.filter((w) => w.status !== "BUY T1");

  return (
    <div>
      {buys.length > 0 && (
        <div style={{ ...card, borderColor: "rgba(90,191,160,0.3)" }}>
          <div style={cardHeader}>
            <span style={cardTitle}>⚡ Active Buys — Execute Now</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--green)",
                background: "var(--green-dim)",
                border: "1px solid rgba(90,191,160,0.2)",
                padding: "3px 10px",
                borderRadius: 2,
                letterSpacing: "0.15em",
              }}
            >
              {buys.length} POSITIONS
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <thead>
              <tr>
                {["Name", "Layer", "Entry Target", "Trigger", "Rationale", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      padding: "8px 16px",
                      borderBottom: "1px solid var(--rim)",
                      textAlign: "left",
                      fontWeight: 400,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buys.map((w) => (
                <tr key={w.name} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                  <td style={{ padding: "12px 16px", color: "var(--text)", fontWeight: 600 }}>{w.name}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: 10 }}>{w.layer}</td>
                  <td style={{ padding: "12px 16px", color: "var(--gold)" }}>{w.entry}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>{w.trigger}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-dim)", maxWidth: 240 }}>{w.rationale}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        ...STATUS_STYLE[w.status],
                        padding: "3px 10px",
                        borderRadius: 2,
                        fontSize: 9,
                        letterSpacing: "0.15em",
                      }}
                    >
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Price Alert Targets</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
            DO NOT BUY WITHOUT TRIGGER
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <thead>
            <tr>
              {["Name", "Layer", "Entry Target", "Trigger", "Rationale", "Status"].map((h) => (
                <th
                  key={h}
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--rim)",
                    textAlign: "left",
                    fontWeight: 400,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {watches.map((w) => (
              <tr key={w.name} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <td style={{ padding: "12px 16px", color: "var(--text)", fontWeight: 600 }}>{w.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: 10 }}>{w.layer}</td>
                <td style={{ padding: "12px 16px", color: "var(--gold)" }}>{w.entry}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>{w.trigger}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-dim)", maxWidth: 240 }}>{w.rationale}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span
                    style={{
                      ...(STATUS_STYLE[w.status] ?? STATUS_STYLE.WATCH),
                      padding: "3px 10px",
                      borderRadius: 2,
                      fontSize: 9,
                      letterSpacing: "0.15em",
                    }}
                  >
                    {w.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
