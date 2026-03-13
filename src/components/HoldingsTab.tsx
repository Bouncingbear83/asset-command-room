import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";
import { LiveHolding } from "@/hooks/usePortfolioData";

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
}

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  HOLD: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  ADD: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  "SIZE UP": { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  REVIEW: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  TRIM: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  EXIT: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  SELL: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  CAP: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  WATCH: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
};

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

function HoldingsTable({ holdings }: { holdings: LiveHolding[] }) {
  const total = holdings.reduce((s, h) => s + (h.mv || 0), 0);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <thead>
          <tr>
            {["Ticker", "Name", "Layer", "MV £", "G/L %", "Day %", "Price", "Notes", "Action"].map((h) => (
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
                  whiteSpace: "nowrap",
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
              <td style={{ padding: "10px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>{h.name}</td>
              <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 10 }}>{h.layer}</td>
              <td style={{ padding: "10px 12px", color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>
                {h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
              </td>
              <td
                style={{ padding: "10px 12px", color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}
              >
                {h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: h.day > 0 ? "var(--green)" : h.day < 0 ? "var(--red)" : "var(--text-dim)",
                  textAlign: "right",
                }}
              >
                {h.day != null ? `${h.day >= 0 ? "+" : ""}${h.day.toFixed(2)}%` : "—"}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--text-mid)", textAlign: "right" }}>
                {h.price != null
                  ? `${h.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${h.currency}`
                  : "—"}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "var(--text-dim)",
                  fontSize: 10,
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {h.notes}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <span
                  style={{
                    ...(ACTION_STYLE[h.action] ?? ACTION_STYLE.MONITOR),
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
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={3}
              style={{
                padding: "12px",
                color: "var(--text-mid)",
                fontWeight: 700,
                borderTop: "1px solid var(--rim)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
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
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              £{total.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </td>
            <td colSpan={5} style={{ borderTop: "1px solid var(--rim)" }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function HoldingsTab({ sipp, isa }: Props) {
  // Use live data if available, otherwise fall back to static
  const sippData =
    sipp.length > 0 ? sipp : SIPP_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));
  const isaData =
    isa.length > 0 ? isa : ISA_HOLDINGS.map((h) => ({ ...h, day: 0, price: null, currency: "USD", costGbp: null }));

  const sippTotal = sippData.reduce((s, h) => s + (h.mv || 0), 0);
  const isaTotal = isaData.reduce((s, h) => s + (h.mv || 0), 0);

  return (
    <div>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>SIPP Holdings</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>
            £{sippTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            <span style={{ color: "var(--text-dim)", fontSize: 10 }}> · long horizon</span>
          </span>
        </div>
        <HoldingsTable holdings={sippData} />
      </div>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>ISA Holdings</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>
            £{isaTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            <span style={{ color: "var(--text-dim)", fontSize: 10 }}> · flexible wrapper</span>
          </span>
        </div>
        <HoldingsTable holdings={isaData} />
      </div>
    </div>
  );
}
