import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 24 };
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

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  HOLD: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  ADD: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  EXIT: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
};

function HoldingsTable({ holdings }: { holdings: typeof SIPP_HOLDINGS }) {
  const total = holdings.reduce((s, h) => s + h.mv, 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
      <thead>
        <tr>
          {["Ticker", "Name", "Layer", "MV £", "G/L %", "Notes", "Action"].map((h) => (
            <th
              key={h}
              style={{
                fontSize: 9,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                padding: "8px 12px",
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
        {holdings.map((h) => (
          <tr key={h.ticker} style={{ borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
            <td style={{ padding: "10px 12px", color: "var(--gold)", fontWeight: 700 }}>{h.ticker}</td>
            <td style={{ padding: "10px 12px", color: "var(--text)" }}>{h.name}</td>
            <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 10 }}>{h.layer}</td>
            <td style={{ padding: "10px 12px", color: "var(--text)", textAlign: "right" }}>£{h.mv.toLocaleString()}</td>
            <td style={{ padding: "10px 12px", color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>
              {h.gl >= 0 ? "+" : ""}
              {h.gl.toFixed(1)}%
            </td>
            <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 10, maxWidth: 200 }}>{h.notes}</td>
            <td style={{ padding: "10px 12px" }}>
              <span
                style={{
                  ...ACTION_STYLE[h.action],
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  padding: "2px 8px",
                  borderRadius: 2,
                  whiteSpace: "nowrap",
                }}
              >
                {h.action}
              </span>
            </td>
          </tr>
        ))}
        <tr>
          <td
            colSpan={3}
            style={{ padding: "12px", color: "var(--text-mid)", fontWeight: 700, borderTop: "1px solid var(--rim)" }}
          >
            TOTAL
          </td>
          <td
            style={{
              padding: "12px",
              color: "var(--gold)",
              fontWeight: 700,
              textAlign: "right",
              borderTop: "1px solid var(--rim)",
            }}
          >
            £{total.toLocaleString()}
          </td>
          <td colSpan={3} style={{ borderTop: "1px solid var(--rim)" }} />
        </tr>
      </tbody>
    </table>
  );
}

export default function HoldingsTab({ liveData }: { liveData?: any[] }) {
  return (
    <div>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>SIPP Holdings</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            ~£575k · Long horizon
          </span>
        </div>
        <HoldingsTable holdings={SIPP_HOLDINGS} />
      </div>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>ISA Holdings</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            ~£424k · Flexible wrapper
          </span>
        </div>
        <HoldingsTable holdings={ISA_HOLDINGS} />
      </div>
    </div>
  );
}
