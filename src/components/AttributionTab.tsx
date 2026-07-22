import { useMemo, useState, type CSSProperties } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  useAttribution,
  type Dimension,
  type WindowLabel,
  type RollingWindowRow,
  type PortfolioDailyRow,
} from "@/hooks/useAttribution";

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

const pillGroup: CSSProperties = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
};
const pillBase: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.12em",
  padding: "3px 10px",
  cursor: "pointer",
  border: "1px solid var(--rim)",
  background: "transparent",
  color: "var(--text-dim)",
  textTransform: "uppercase",
};
const pillActive: CSSProperties = {
  ...pillBase,
  background: "var(--accent-dim)",
  borderColor: "var(--accent)",
  color: "var(--accent)",
};

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
const monoTicker: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "var(--text)",
};

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "layer", label: "Layer" },
  { key: "factor_group", label: "Factor Group" },
  { key: "return_profile", label: "Profile" },
  { key: "reclass_status", label: "Reclass" },
  { key: "framework", label: "Framework" },
];

const WINDOWS: { key: WindowLabel; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "60d", label: "60D" },
  { key: "90d", label: "90D" },
];

// Colour palette for bar segments
const BAR_COLORS = [
  "var(--accent)",
  "var(--gold)",
  "var(--green)",
  "var(--amber)",
  "var(--red)",
  "var(--text-dim)",
  "#8b5cf6",
  "#ec4899",
];

// ── Helpers ──

function fmtDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function fmtGbp(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}£${Math.abs(v).toLocaleString("en-GB", {
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

/** G(m) distortion filter: exclude positions with mv_start from first 3 days of existence */
function filterGmDistortion(rows: RollingWindowRow[]): RollingWindowRow[] {
  return rows.filter((r) => {
    // If mv_start is null or zero, position didn't exist at window start: exclude from return calcs
    if (r.mv_start == null || r.mv_start === 0) return false;
    return true;
  });
}

// ── Custom Tooltip Components ──

function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as PortfolioDailyRow | undefined;
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
      <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>
        {fmtDate(d.snapshot_date)}
      </div>
      <div style={{ color: "var(--gold)" }}>
        AUM: £{((d.total_mv_gbp || 0) / 1000).toFixed(0)}k
      </div>
      <div style={{ color: pctColor(d.daily_return_pct) }}>
        Day: {fmtPct(d.daily_return_pct)}
      </div>
      <div style={{ color: pctColor(d.daily_pnl_gbp) }}>
        P&L: {fmtGbp(d.daily_pnl_gbp)}
      </div>
    </div>
  );
}

function BarTooltip({ active, payload }: any) {
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
        {d.group_name}
      </div>
      <div>
        Positions: <span style={{ color: "var(--gold)" }}>{d.position_count}</span>
      </div>
      <div>
        MV: <span style={{ color: "var(--gold)" }}>£{((d.total_mv_gbp || 0) / 1000).toFixed(0)}k</span>
      </div>
      <div style={{ color: pctColor(d.weighted_return_pct) }}>
        Return: {fmtPct(d.weighted_return_pct)}
      </div>
      <div style={{ color: pctColor(d.total_pnl_gbp) }}>
        P&L: {fmtGbp(d.total_pnl_gbp)}
      </div>
    </div>
  );
}

// ── Main Component ──

export default function AttributionTab() {
  const {
    portfolioDaily,
    rollingWindow,
    dimensionData,
    loading,
    error,
    dimension,
    setDimension,
    window: windowLabel,
    setWindow,
    refresh,
  } = useAttribution();

  const [dailyRange, setDailyRange] = useState<"30" | "60" | "90" | "all">("90");

  // Filter daily data by range
  const filteredDaily = useMemo(() => {
    if (dailyRange === "all" || portfolioDaily.length === 0) return portfolioDaily;
    const days = parseInt(dailyRange);
    return portfolioDaily.slice(-days);
  }, [portfolioDaily, dailyRange]);

  // Cumulative return series from the filtered daily data
  const cumulativeDaily = useMemo(() => {
    if (filteredDaily.length === 0) return [];
    let cum = 0;
    return filteredDaily.map((d) => {
      const ret = d.daily_return_pct ?? 0;
      cum = (1 + cum / 100) * (1 + ret / 100) * 100 - 100;
      return { ...d, cumulative_pct: cum };
    });
  }, [filteredDaily]);

  // Rolling window data for the selected window, with G(m) filter
  const windowData = useMemo(() => {
    const filtered = filterGmDistortion(rollingWindow);
    return filtered.filter((r) => r.window_label === windowLabel);
  }, [rollingWindow, windowLabel]);

  // Top 5 / Bottom 5 (exclude capital-flow-contaminated positions)
  const { top5, bottom5 } = useMemo(() => {
    const clean = windowData.filter((r) => !r.has_capital_flow);
    const sorted = [...clean].sort(
      (a, b) => b.period_return_pct - a.period_return_pct
    );
    return {
      top5: sorted.slice(0, 5),
      bottom5: sorted.slice(-5).reverse(),
    };
  }, [windowData]);

  // Heatmap: all positions sorted by return
  const heatmapData = useMemo(() => {
    return [...windowData].sort(
      (a, b) => b.period_return_pct - a.period_return_pct
    );
  }, [windowData]);

  // Summary stats
  const summary = useMemo(() => {
    if (portfolioDaily.length === 0) return null;
    const latest = portfolioDaily[portfolioDaily.length - 1];
    const totalPnl = filteredDaily.reduce(
      (sum, d) => sum + (d.daily_pnl_gbp ?? 0),
      0
    );
    const winDays = filteredDaily.filter(
      (d) => (d.daily_return_pct ?? 0) > 0
    ).length;
    const totalDays = filteredDaily.filter(
      (d) => d.daily_return_pct != null
    ).length;
    return {
      aum: latest.total_mv_gbp,
      positions: latest.position_count,
      periodPnl: totalPnl,
      winRate: totalDays > 0 ? (winDays / totalDays) * 100 : 0,
    };
  }, [portfolioDaily, filteredDaily]);

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
          ● LOADING ATTRIBUTION DATA...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <div style={card}>
          <div style={{ ...cardBody, color: "var(--amber)" }}>
            <span style={monoSm}>⚠ {error}</span>
            <button
              onClick={refresh}
              style={{
                ...pillBase,
                marginLeft: 12,
                color: "var(--accent)",
                borderColor: "var(--accent)",
              }}
            >
              RETRY
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Summary Strip ── */}
      {summary && (
        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            padding: "12px 0 4px",
            borderBottom: "1px solid var(--rim)",
            marginBottom: 16,
          }}
        >
          <div style={monoSm}>
            AUM{" "}
            <span style={{ ...monoVal, color: "var(--gold)" }}>
              £{(summary.aum / 1000).toFixed(0)}k
            </span>
          </div>
          <div style={monoSm}>
            POSITIONS{" "}
            <span style={{ ...monoVal, color: "var(--text)" }}>
              {summary.positions}
            </span>
          </div>
          <div style={monoSm}>
            PERIOD P&L{" "}
            <span
              style={{ ...monoVal, color: pctColor(summary.periodPnl) }}
            >
              {fmtGbp(summary.periodPnl)}
            </span>
          </div>
          <div style={monoSm}>
            WIN RATE{" "}
            <span style={{ ...monoVal, color: "var(--text)" }}>
              {summary.winRate.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* ── 1. Portfolio Daily Return ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Portfolio Cumulative Return</span>
          <div style={pillGroup}>
            {(["30", "60", "90", "all"] as const).map((r) => (
              <button
                key={r}
                style={dailyRange === r ? pillActive : pillBase}
                onClick={() => setDailyRange(r)}
              >
                {r === "all" ? "ALL" : `${r}D`}
              </button>
            ))}
          </div>
        </div>
        <div style={cardBody}>
          {cumulativeDaily.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={cumulativeDaily}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--rim)"
                  vertical={false}
                />
                <XAxis
                  dataKey="snapshot_date"
                  tickFormatter={fmtDate}
                  tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                  stroke="var(--rim)"
                  interval="preserveStartEnd"
                  minTickGap={60}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                  stroke="var(--rim)"
                  width={48}
                />
                <Tooltip content={<DailyTooltip />} />
                <ReferenceLine y={0} stroke="var(--text-dim)" strokeDasharray="2 4" />
                <Line
                  type="monotone"
                  dataKey="cumulative_pct"
                  stroke="var(--gold)"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: "var(--gold)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ ...monoSm, padding: 20, textAlign: "center" }}>
              No daily snapshot data available
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Dimension Attribution Bar Chart ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Attribution by Dimension</span>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={pillGroup}>
              {DIMENSIONS.map((d) => (
                <button
                  key={d.key}
                  style={dimension === d.key ? pillActive : pillBase}
                  onClick={() => setDimension(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div style={pillGroup}>
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  style={windowLabel === w.key ? pillActive : pillBase}
                  onClick={() => setWindow(w.key)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={cardBody}>
          {dimensionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, dimensionData.length * 40 + 60)}>
              <BarChart
                data={dimensionData}
                layout="vertical"
                margin={{ left: 100, right: 20, top: 8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--rim)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                  stroke="var(--rim)"
                />
                <YAxis
                  type="category"
                  dataKey="group_name"
                  tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                  stroke="var(--rim)"
                  width={96}
                />
                <Tooltip content={<BarTooltip />} />
                <ReferenceLine x={0} stroke="var(--text-dim)" strokeDasharray="2 4" />
                <Bar dataKey="weighted_return_pct" radius={[0, 2, 2, 0]}>
                  {dimensionData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        (entry.weighted_return_pct ?? 0) >= 0
                          ? "var(--green)"
                          : "var(--red)"
                      }
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ ...monoSm, padding: 20, textAlign: "center" }}>
              No dimension data for {dimension} / {windowLabel}
            </div>
          )}

          {/* Dimension table below chart */}
          {dimensionData.length > 0 && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 12,
              }}
            >
              <thead>
                <tr>
                  {["Group", "Positions", "MV (£k)", "Wt. Return", "P&L"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          ...monoSm,
                          textAlign: h === "Group" ? "left" : "right",
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--rim)",
                          fontWeight: 400,
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {dimensionData.map((row) => (
                  <tr key={row.group_name}>
                    <td
                      style={{
                        ...monoTicker,
                        padding: "5px 8px",
                        fontSize: 10,
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {row.group_name}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        color: "var(--text-dim)",
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {row.position_count}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        color: "var(--gold)",
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {((row.total_mv_gbp || 0) / 1000).toFixed(0)}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        color: pctColor(row.weighted_return_pct),
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {fmtPct(row.weighted_return_pct)}
                    </td>
                    <td
                      style={{
                        ...monoVal,
                        textAlign: "right",
                        padding: "5px 8px",
                        color: pctColor(row.total_pnl_gbp),
                        borderBottom: "1px solid var(--rim)",
                      }}
                    >
                      {fmtGbp(row.total_pnl_gbp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 3. Top 5 / Bottom 5 Movers ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <MoverCard
          title="TOP 5 MOVERS"
          items={top5}
          windowLabel={windowLabel}
          accent="var(--green)"
        />
        <MoverCard
          title="BOTTOM 5 MOVERS"
          items={bottom5}
          windowLabel={windowLabel}
          accent="var(--red)"
        />
      </div>

      {/* ── 4. Position Heatmap ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>
            Position Returns Heatmap ({windowLabel})
          </span>
          <div style={pillGroup}>
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                style={windowLabel === w.key ? pillActive : pillBase}
                onClick={() => setWindow(w.key)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            ...cardBody,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: "12px 16px",
          }}
        >
          {heatmapData.length > 0 ? (
            heatmapData.map((row) => (
              <HeatCell key={row.ticker} row={row} />
            ))
          ) : (
            <div style={{ ...monoSm, padding: 20, width: "100%" }}>
              No position data for {windowLabel}
            </div>
          )}
        </div>
        {heatmapData.some((r) => r.has_capital_flow) && (
          <div
            style={{
              ...monoSm,
              padding: "6px 20px 12px",
              fontSize: 9,
              color: "var(--amber)",
            }}
          >
            ⚑ Dashed amber border = capital flow detected (buy/sell during window). MV return includes additions/trims, not just price.
            Excluded from Top/Bottom movers.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function MoverCard({
  title,
  items,
  windowLabel,
  accent,
}: {
  title: string;
  items: RollingWindowRow[];
  windowLabel: string;
  accent: string;
}) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={{ ...cardTitle, color: accent }}>{title}</span>
        <span style={{ ...monoSm, fontSize: 9 }}>{windowLabel}</span>
      </div>
      <div style={{ padding: "8px 0" }}>
        {items.length === 0 ? (
          <div style={{ ...monoSm, padding: "12px 20px" }}>No data</div>
        ) : (
          items.map((row, i) => (
            <div
              key={row.ticker}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 20px",
                borderBottom:
                  i < items.length - 1 ? "1px solid var(--rim)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    ...monoSm,
                    width: 16,
                    textAlign: "right",
                    color: "var(--text-dim)",
                  }}
                >
                  {i + 1}
                </span>
                <span style={monoTicker}>{row.ticker}</span>
                <span
                  style={{
                    ...monoSm,
                    fontSize: 8,
                    padding: "1px 6px",
                    border: "1px solid var(--rim)",
                    color: "var(--text-dim)",
                  }}
                >
                  {row.layer}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                <span
                  style={{
                    ...monoVal,
                    color: pctColor(row.period_return_pct),
                  }}
                >
                  {fmtPct(row.period_return_pct)}
                </span>
                <span
                  style={{
                    ...monoSm,
                    color: pctColor(row.period_pnl_gbp),
                    minWidth: 60,
                    textAlign: "right",
                  }}
                >
                  {fmtGbp(row.period_pnl_gbp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function HeatCell({ row }: { row: RollingWindowRow }) {
  const ret = row.period_return_pct;
  const abs = Math.abs(ret);
  const isFlow = row.has_capital_flow;

  // Intensity: 0-5% = dim, 5-15% = mid, 15%+ = full
  let opacity: number;
  if (abs < 2) opacity = 0.15;
  else if (abs < 5) opacity = 0.3;
  else if (abs < 10) opacity = 0.5;
  else if (abs < 20) opacity = 0.7;
  else opacity = 0.9;

  // Capital-flow-contaminated: use muted amber instead of green/red
  const bg = isFlow
    ? `rgba(200, 146, 90, ${opacity * 0.5})`
    : ret >= 0
      ? `rgba(90, 191, 160, ${opacity})`
      : `rgba(200, 90, 90, ${opacity})`;

  return (
    <div
      style={{
        background: bg,
        border: isFlow ? "1px dashed var(--amber)" : "1px solid var(--rim)",
        padding: "6px 8px",
        minWidth: 80,
        flex: "0 0 auto",
        textAlign: "center",
      }}
      title={`${row.ticker}: ${fmtPct(ret)} (${fmtGbp(row.period_pnl_gbp)})${isFlow ? "\n⚠ Capital flow detected: MV return includes buys/sells" : ""}\n${row.layer} · ${row.return_profile ?? "—"}`}
    >
      <div style={{ ...monoTicker, fontSize: 9 }}>
        {row.ticker}{isFlow ? " ⚑" : ""}
      </div>
      <div
        style={{
          ...monoVal,
          fontSize: 10,
          color: isFlow
            ? "var(--amber)"
            : ret >= 0 ? "var(--green)" : "var(--red)",
        }}
      >
        {fmtPct(ret)}
      </div>
    </div>
  );
}
