import { useMemo, type CSSProperties } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { useRegimeAnalysis, type RegimeRow } from "@/hooks/useRegimeAnalysis";

// ── Styles (matches Stellar design system) ──

const card: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  marginBottom: 16,
};
const cardHeader: CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--rim)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
};
const cardTitle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
};
const cardBody: CSSProperties = { padding: "16px 20px" };
const monoSm: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
};
const monoVal: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.04em",
};

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "\u2014";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function fmtGbp(v: number | null | undefined): string {
  if (v == null) return "\u2014";
  return `\u00a3${Math.abs(v).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return "var(--text-dim)";
  if (v > 0) return "var(--green)";
  if (v < 0) return "var(--red)";
  return "var(--text-dim)";
}

const REGIME_COLOURS: Record<string, string> = {
  PRE: "var(--accent)",
  IN_PROGRESS: "var(--gold)",
  COMPLETE: "var(--green)",
  UNKNOWN: "var(--text-dim)",
  N_A: "var(--text-dim)",
};

function regimeColour(status: string): string {
  return REGIME_COLOURS[status] ?? "var(--text-dim)";
}

// ── Custom Tooltip ──

function RegimeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      style={{
        background: "var(--deep)",
        border: "1px solid var(--rim)",
        padding: "8px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
      }}
    >
      <div style={{ color: "var(--text)", marginBottom: 4, fontWeight: 700 }}>
        {d.label}
      </div>
      {d.pre_return != null && (
        <div style={{ color: "var(--accent)" }}>
          PRE: {fmtPct(d.pre_return)}
        </div>
      )}
      {d.in_progress_return != null && (
        <div style={{ color: "var(--gold)" }}>
          IN_PROGRESS: {fmtPct(d.in_progress_return)}
        </div>
      )}
      {d.complete_return != null && (
        <div style={{ color: "var(--green)" }}>
          COMPLETE: {fmtPct(d.complete_return)}
        </div>
      )}
      {d.alpha != null && (
        <div
          style={{
            color: d.alpha >= 0 ? "var(--green)" : "var(--red)",
            marginTop: 4,
            borderTop: "1px solid var(--rim)",
            paddingTop: 4,
          }}
        >
          Alpha (PRE vs COMPLETE): {fmtPct(d.alpha)}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function RegimePanel() {
  const { data, alphaDecay, loading, error, refresh } = useRegimeAnalysis();

  // Pivot data for the summary table: one row per reclass_status, 30d window
  const summary30d = useMemo(() => {
    return data
      .filter((r) => r.window_days === 30)
      .sort((a, b) => b.price_return_pct - a.price_return_pct);
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "var(--accent)",
          }}
        >
          {"\u25cf"} LOADING REGIME DATA...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <span style={{ ...monoSm, color: "var(--amber)" }}>
          {"\u26a0"} {error}
        </span>
        <button
          onClick={refresh}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            padding: "3px 10px",
            marginLeft: 12,
            cursor: "pointer",
            border: "1px solid var(--accent)",
            background: "transparent",
            color: "var(--accent)",
          }}
        >
          RETRY
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── 1. Alpha Decay Chart: returns by regime across windows ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Alpha Decay by Reclassification Regime</span>
          <span style={{ ...monoSm, fontSize: 9 }}>
            Rule #12: reclassification is where the returns are
          </span>
        </div>
        <div style={cardBody}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={alphaDecay} barCategoryGap="25%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--rim)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                stroke="var(--rim)"
              />
              <YAxis
                tick={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                stroke="var(--rim)"
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              />
              <Tooltip content={<RegimeTooltip />} />
              <ReferenceLine y={0} stroke="var(--rim)" />
              <Bar
                dataKey="pre_return"
                name="PRE"
                fill="var(--accent)"
                opacity={0.85}
              />
              <Bar
                dataKey="in_progress_return"
                name="IN_PROGRESS"
                fill="var(--gold)"
                opacity={0.85}
              />
              <Bar
                dataKey="complete_return"
                name="COMPLETE"
                fill="var(--green)"
                opacity={0.85}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 2. Alpha Spread Line: PRE minus COMPLETE across windows ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Alpha Spread (PRE minus COMPLETE)</span>
          <span style={{ ...monoSm, fontSize: 9 }}>
            Positive = PRE outperforming
          </span>
        </div>
        <div style={cardBody}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={alphaDecay}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--rim)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                stroke="var(--rim)"
              />
              <YAxis
                tick={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                stroke="var(--rim)"
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              />
              <ReferenceLine y={0} stroke="var(--rim)" strokeDasharray="6 3" />
              <Tooltip content={<RegimeTooltip />} />
              <Line
                type="monotone"
                dataKey="alpha"
                name="Alpha"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ fill: "var(--accent)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 3. Regime Summary Table (30d) ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Regime Summary (30D)</span>
        </div>
        <div style={cardBody}>
          {summary30d.length === 0 ? (
            <span style={monoSm}>No regime data for 30d window</span>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Regime",
                    "#",
                    "MV Start",
                    "Price Return",
                    "Flows",
                    "Top",
                    "Bottom",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        ...monoSm,
                        padding: "6px 8px",
                        textAlign: h === "Regime" ? "left" : "right",
                        borderBottom: "1px solid var(--rim)",
                        fontWeight: 700,
                        fontSize: 9,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary30d.map((row) => (
                  <tr key={row.reclass_status}>
                    <td
                      style={{
                        ...monoVal,
                        padding: "6px 8px",
                        fontWeight: 700,
                        color: regimeColour(row.reclass_status),
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {row.reclass_status}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {row.position_count}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "6px 8px",
                        color: "var(--gold)",
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {fmtGbp(row.mv_start_gbp)}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "6px 8px",
                        color: pctColor(row.price_return_pct),
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {fmtPct(row.price_return_pct)}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "6px 8px",
                        color:
                          row.net_capital_flow_gbp !== 0
                            ? "var(--amber)"
                            : "var(--text-dim)",
                        borderBottom: "1px solid var(--rim)",
                        fontSize: 10,
                      }}
                    >
                      {row.net_capital_flow_gbp !== 0
                        ? `${(row.net_capital_flow_gbp / 1000).toFixed(1)}k`
                        : "\u2014"}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "6px 8px",
                        color: "var(--green)",
                        borderBottom: "1px solid var(--rim)",
                        fontSize: 10,
                      }}
                    >
                      {row.top_contributor || "\u2014"}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "6px 8px",
                        color: "var(--red)",
                        borderBottom: "1px solid var(--rim)",
                        fontSize: 10,
                      }}
                    >
                      {row.bottom_contributor || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
