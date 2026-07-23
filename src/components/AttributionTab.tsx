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
import RegimePanel from "@/components/RegimePanel";
import Test5Panel from "@/components/Test5Panel";

type SubView = "performance" | "regime" | "signals";

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

const WINDOW_DAYS: Record<WindowLabel, number> = {
  "7d": 7, "30d": 30, "60d": 60, "90d": 90,
};

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
  if (v == null) return "\u2014";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function fmtGbp(v: number | null | undefined): string {
  if (v == null) return "\u2014";
  const sign = v >= 0 ? "+" : "";
  return `${sign}\u00a3${Math.abs(v).toLocaleString("en-GB", {
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

/** Exclude positions with no start-of-window presence */
function filterNoStart(rows: RollingWindowRow[]): RollingWindowRow[] {
  return rows.filter((r) => r.mv_start != null && r.mv_start > 0);
}

// ── Custom Tooltip Components ──

function DailyTooltip({ active, payload }: any) {
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
        AUM: \u00a3{((d.total_mv_gbp || 0) / 1000).toFixed(0)}k
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
  const hasFlows = (d.net_capital_flow_gbp ?? 0) !== 0;
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
        {d.dimension_value}
      </div>
      <div>
        Positions: <span style={{ color: "var(--gold)" }}>{d.position_count}</span>
      </div>
      <div>
        MV: <span style={{ color: "var(--gold)" }}>\u00a3{((d.mv_start_gbp || 0) / 1000).toFixed(0)}k</span>
      </div>
      <div style={{ color: pctColor(d.price_return_pct) }}>
        Price Return: {fmtPct(d.price_return_pct)}
      </div>
      {hasFlows && (
        <>
          <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
            MV Return: {fmtPct(d.mv_return_pct)}
          </div>
          <div style={{ color: "var(--amber)" }}>
            Flows: {fmtGbp(d.net_capital_flow_gbp)} ({d.trade_count} trades)
          </div>
        </>
      )}
      {d.top_contributor && (
        <div style={{ color: "var(--green)", marginTop: 2 }}>
          Best: {d.top_contributor}
        </div>
      )}
      {d.bottom_contributor && (
        <div style={{ color: "var(--red)" }}>
          Worst: {d.bottom_contributor}
        </div>
      )}
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

  const [subView, setSubView] = useState<SubView>("performance");
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

  // Rolling window data for the selected window
  const windowDays = WINDOW_DAYS[windowLabel];
  const windowData = useMemo(() => {
    const filtered = filterNoStart(rollingWindow);
    return filtered.filter((r) => r.window_days === windowDays);
  }, [rollingWindow, windowDays]);

  // Top 5 / Bottom 5 using price returns (clean of capital flows)
  const { top5, bottom5 } = useMemo(() => {
    const sorted = [...windowData]
      .filter((r) => r.price_return_pct != null)
      .sort((a, b) => (b.price_return_pct ?? 0) - (a.price_return_pct ?? 0));
    return {
      top5: sorted.slice(0, 5),
      bottom5: sorted.slice(-5).reverse(),
    };
  }, [windowData]);

  // Heatmap: all positions sorted by price return
  const heatmapData = useMemo(() => {
    return [...windowData]
      .filter((r) => r.price_return_pct != null)
      .sort((a, b) => (b.price_return_pct ?? 0) - (a.price_return_pct ?? 0));
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
          \u25cf LOADING ATTRIBUTION DATA...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <div style={card}>
          <div style={{ ...cardBody, color: "var(--amber)" }}>
            <span style={monoSm}>\u26a0 {error}</span>
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

  const SUB_VIEWS: { key: SubView; label: string }[] = [
    { key: "performance", label: "Performance" },
    { key: "regime", label: "Regime" },
    { key: "signals", label: "Signals" },
  ];

  return (
    <div>
      {/* ── Sub-view Toggle ── */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 12,
          borderBottom: "1px solid var(--rim)",
        }}
      >
        {SUB_VIEWS.map((sv) => (
          <button
            key={sv.key}
            onClick={() => setSubView(sv.key)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: subView === sv.key ? 700 : 400,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              padding: "10px 20px",
              cursor: "pointer",
              border: "none",
              borderBottom: subView === sv.key
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              background: "transparent",
              color: subView === sv.key ? "var(--accent)" : "var(--text-dim)",
              transition: "all 0.15s ease",
            }}
          >
            {sv.label}
          </button>
        ))}
      </div>

      {/* ── Regime Sub-view ── */}
      {subView === "regime" && <RegimePanel />}

      {/* ── Signals Sub-view ── */}
      {subView === "signals" && <Test5Panel />}

      {/* ── Performance Sub-view (original content) ── */}
      {subView === "performance" && (
      <>
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
              \u00a3{(summary.aum / 1000).toFixed(0)}k
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
                  dataKey="dimension_value"
                  tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                  stroke="var(--rim)"
                  width={96}
                />
                <Tooltip content={<BarTooltip />} />
                <ReferenceLine x={0} stroke="var(--text-dim)" strokeDasharray="2 4" />
                <Bar dataKey="price_return_pct" radius={[0, 2, 2, 0]}>
                  {dimensionData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        (entry.price_return_pct ?? 0) >= 0
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
                  {["Group", "#", "MV (£k)", "Return", "Flows (£k)", "Best", "Worst"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          ...monoSm,
                          textAlign: h === "Group" || h === "Best" || h === "Worst" ? "left" : "right",
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
                {dimensionData.map((row) => {
                  const hasFlows = (row.net_capital_flow_gbp ?? 0) !== 0;
                  return (
                    <tr key={row.dimension_value}>
                      <td
                        style={{
                          ...monoTicker,
                          padding: "5px 8px",
                          fontSize: 10,
                          borderBottom: "1px solid var(--rim)",
                        }}
                      >
                        {row.dimension_value}
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
                        {((row.mv_start_gbp || 0) / 1000).toFixed(0)}
                      </td>
                      <td
                        style={{
                          ...monoVal,
                          textAlign: "right",
                          padding: "5px 8px",
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
                          padding: "5px 8px",
                          color: hasFlows ? "var(--amber)" : "var(--text-dim)",
                          borderBottom: "1px solid var(--rim)",
                          fontSize: 10,
                        }}
                      >
                        {hasFlows
                          ? `${((row.net_capital_flow_gbp || 0) / 1000).toFixed(1)}`
                          : "\u2014"}
                      </td>
                      <td
                        style={{
                          ...monoVal,
                          padding: "5px 8px",
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
                          padding: "5px 8px",
                          color: "var(--red)",
                          borderBottom: "1px solid var(--rim)",
                          fontSize: 10,
                        }}
                      >
                        {row.bottom_contributor || "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 3. Top 5 / Bottom 5 Movers (price returns, capital-flow-clean) ── */}
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
              <HeatCell key={`${row.ticker}-${row.account}`} row={row} />
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
            \u2691 Dashed amber border = capital flow detected (buy/sell during window). Returns shown are price-only (clean). Hover for flow details.
          </div>
        )}
      </div>
      </>
      )}
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
          items.map((row, i) => {
            const pnlGbp = row.mv_start && row.price_return_pct != null
              ? row.mv_start * row.price_return_pct / 100
              : null;
            return (
              <div
                key={`${row.ticker}-${row.account}`}
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
                  {row.has_capital_flow && (
                    <span
                      style={{
                        ...monoSm,
                        fontSize: 8,
                        padding: "1px 4px",
                        color: "var(--amber)",
                        border: "1px dashed var(--amber)",
                      }}
                    >
                      FLOW
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                  <span
                    style={{
                      ...monoVal,
                      color: pctColor(row.price_return_pct),
                    }}
                  >
                    {fmtPct(row.price_return_pct)}
                  </span>
                  <span
                    style={{
                      ...monoSm,
                      color: pctColor(pnlGbp),
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {fmtGbp(pnlGbp)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HeatCell({ row }: { row: RollingWindowRow }) {
  const ret = row.price_return_pct ?? 0;
  const abs = Math.abs(ret);
  const isFlow = row.has_capital_flow;

  // Intensity: 0-5% = dim, 5-15% = mid, 15%+ = full
  let opacity: number;
  if (abs < 2) opacity = 0.15;
  else if (abs < 5) opacity = 0.3;
  else if (abs < 10) opacity = 0.5;
  else if (abs < 20) opacity = 0.7;
  else opacity = 0.9;

  const bg = ret >= 0
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
      title={`${row.ticker}: ${fmtPct(ret)} (price return)${isFlow ? `\n\u26a0 Capital flow: ${fmtGbp(row.net_capital_flow_gbp)} (${row.trade_count} trades)` : ""}\n${row.layer} \u00b7 ${row.return_profile ?? "\u2014"}`}
    >
      <div style={{ ...monoTicker, fontSize: 9 }}>
        {row.ticker}{isFlow ? " \u2691" : ""}
      </div>
      <div
        style={{
          ...monoVal,
          fontSize: 10,
          color: ret >= 0 ? "var(--green)" : "var(--red)",
        }}
      >
        {fmtPct(ret)}
      </div>
    </div>
  );
}
