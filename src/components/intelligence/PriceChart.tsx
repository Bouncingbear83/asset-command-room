import { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { useTickerHistory } from "@/hooks/useTickerHistory";

export type PriceChartRange = "1W" | "1M" | "1Y" | "5Y" | "MAX";

interface Props {
  ticker: string;
  currency?: string;
  defaultRange?: PriceChartRange;
}

const RANGE_DAYS: Record<PriceChartRange, number | null> = {
  "1W": 7,
  "1M": 31,
  "1Y": 365,
  "5Y": 365 * 5,
  MAX: null,
};

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", GBX: "p", JPY: "¥" };

function fmtPrice(value: number, sym: string): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000) return `${sym}${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  if (value >= 100) return `${sym}${value.toFixed(0)}`;
  if (value >= 10) return `${sym}${value.toFixed(1)}`;
  return `${sym}${value.toFixed(2)}`;
}

function fmtTick(date: string): string {
  // YYYY-MM-DD → "Jan '26"
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function fmtTooltipDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PriceChart({ ticker, currency = "USD", defaultRange = "1Y" }: Props) {
  const [range, setRange] = useState<PriceChartRange>(defaultRange);
  const { fetchHistory, getHistory } = useTickerHistory();

  useEffect(() => {
    fetchHistory(ticker);
  }, [ticker, fetchHistory]);

  const { points, loading } = getHistory(ticker);

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (days === null) return points;
    if (points.length === 0) return points;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return points.filter((p) => p.date >= cutoffStr);
  }, [points, range]);

  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency} `;

  const chartData = useMemo(
    () => filtered.map((p) => ({ date: p.date, price: p.priceLocal })),
    [filtered],
  );

  const yDomain = useMemo<[number, number] | undefined>(() => {
    if (chartData.length === 0) return undefined;
    const vals = chartData.map((d) => d.price).filter((v) => Number.isFinite(v));
    if (vals.length === 0) return undefined;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.08 || max * 0.02 || 1;
    return [min - pad, max + pad];
  }, [chartData]);

  const isEmpty = !loading && chartData.length === 0;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Range toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, justifyContent: "flex-end" }}>
        {(Object.keys(RANGE_DAYS) as PriceChartRange[]).map((r) => {
          const active = r === range;
          return (
            <button
              key={r}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRange(r);
              }}
              style={{
                padding: "3px 9px",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: active ? "var(--gold-dim, rgba(201,168,76,0.12))" : "transparent",
                color: active ? "var(--gold)" : "var(--text-dim)",
                border: `1px solid ${active ? "rgba(201,168,76,0.4)" : "var(--rim)"}`,
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          );
        })}
      </div>

      {isEmpty ? (
        <div style={{
          height: 220,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: "rgba(28,28,48,0.18)",
          border: "1px solid var(--rim)",
          borderRadius: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-dim)",
        }}>
          <span>No price history available.</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>Daily snapshots populate held + watchlist tickers.</span>
        </div>
      ) : loading && chartData.length === 0 ? (
        <div style={{
          height: 220,
          background: "rgba(28,28,48,0.18)",
          border: "1px solid var(--rim)",
          borderRadius: 4,
        }} />
      ) : (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={fmtTick}
                stroke="var(--text-dim)"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--rim)" }}
                minTickGap={40}
              />
              <YAxis
                domain={yDomain ?? ["auto", "auto"]}
                tickFormatter={(v: number) => fmtPrice(v, sym)}
                stroke="var(--text-dim)"
                tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--rim)" }}
                width={56}
                tickCount={4}
              />
              <Tooltip
                cursor={{ stroke: "var(--rim)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--rim)",
                  borderRadius: 4,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  padding: "6px 10px",
                }}
                labelStyle={{ color: "var(--text-dim)", fontSize: 10, marginBottom: 2 }}
                itemStyle={{ color: "var(--accent)" }}
                labelFormatter={(label: string) => fmtTooltipDate(label)}
                formatter={(value: number) => [fmtPrice(value, sym), "Price"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--accent)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: "var(--accent)" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default PriceChart;
