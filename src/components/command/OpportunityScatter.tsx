import { useMemo, useState, useCallback } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ZAxis,
} from "recharts";
import { LiveHolding, LiveWatchItem, LiveScore } from "@/hooks/usePortfolioData";
import { useIrrBb } from "@/hooks/useIrrBb";
import { useQuartetMap } from "@/hooks/useQuartetMap";
import { useScoresSnapshot } from "@/hooks/useScoresSnapshot";
import { computeLiveAsymmetry } from "@/lib/liveAsymmetry";
import { formatIrr } from "@/lib/computeIrrBb";
import { formatRatio } from "@/lib/liveAsymmetry";

import { normaliseTicker } from "@/lib/tickerAlias";
import { useFactSheet } from "@/components/factsheet/FactSheetProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { IS_NUMERIC_TICKER } from "@/hooks/useIrrBb";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };

const LAYER_COLORS: Record<string, string> = {
  Compute: "#5ABFA0",
  Energy: "#D4A04E",
  Materials: "#7B8FCC",
  Biological: "#CC6B6B",
  Sovereignty: "#9B7EC8",
  Robotics: "#6BAFC8",
  Hedge: "#8A8A9A",
};

const Y_MAX = 45; // percent; clamps display
const X_MAX = 9;

type Filter = "all" | "held" | "wl";

interface Dot {
  ticker: string;
  name: string;
  label: string;
  layer: string;
  irrBb: number;      // percent
  asymmetry: number;   // ratio
  held: boolean;
  weight: number;      // AUM % or fixed small
  score: number | null;
  color: string;
}

interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

export default function OpportunityScatter({ scores, holdings, watchlist }: Props) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("all");
  const { byTicker: irrMap, nameMap } = useIrrBb(scores, holdings, watchlist);
  const { byTicker: snapshotMap } = useScoresSnapshot();
  const quartetMap = useQuartetMap(scores ?? [], holdings ?? [], watchlist ?? [], snapshotMap);

  // Build AUM weight map
  const totalAum = useMemo(() => {
    let sum = 0;
    for (const h of holdings) sum += h.mv || 0;
    return sum;
  }, [holdings]);

  const aumByTicker = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of holdings) {
      const t = normaliseTicker(h.ticker);
      if (!t) continue;
      m.set(t, (m.get(t) || 0) + (h.mv || 0));
    }
    return m;
  }, [holdings]);

  const { open: openFactSheet } = useFactSheet();

  const dots = useMemo(() => {
    const out: Dot[] = [];
    for (const [t, entry] of irrMap) {
      if (entry.result.irrBb === null) continue;

      const qEntry = quartetMap.get(t);
      const asym = qEntry?.asymmetry ?? computeLiveAsymmetry(
        { bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null },
        null,
      );
      if (asym.baseRatio === null || asym.baseRatio <= 0) continue;

      const irrPct = Math.min(entry.result.irrBb * 100, Y_MAX);
      const asymClamped = Math.min(asym.baseRatio, X_MAX);
      const aumPct = totalAum > 0 ? ((aumByTicker.get(t) || 0) / totalAum) * 100 : 0;

      const isNumeric = IS_NUMERIC_TICKER.test(entry.ticker);
      const label = isNumeric && entry.name ? entry.name : entry.ticker;

      // Held: size by AUM weight. WL: size by score (conviction proxy).
      const weight = entry.held
        ? Math.max(aumPct, 1.5)
        : Math.max(((entry.score ?? 50) - 40) / 10, 0.8); // score 50→1, 70→3, 90→5

      out.push({
        ticker: entry.ticker,
        name: entry.name,
        label,
        layer: entry.layer || "Hedge",
        irrBb: Math.round(irrPct * 10) / 10,
        asymmetry: Math.round(asymClamped * 10) / 10,
        held: entry.held,
        weight,
        score: entry.score,
        color: LAYER_COLORS[entry.layer] || "#8A8A9A",
      });
    }
    return out;
  }, [irrMap, quartetMap, totalAum, aumByTicker]);

  const filtered = useMemo(() => {
    if (filter === "all") return dots;
    return dots.filter((d) => filter === "held" ? d.held : !d.held);
  }, [dots, filter]);

  const handleClick = useCallback((data: any) => {
    if (data?.ticker) openFactSheet(data.ticker);
  }, [openFactSheet]);

  // Hide on mobile
  if (isMobile) return null;
  if (dots.length < 3) return null;

  const fbtn = (f: Filter, label: string) => (
    <button
      onClick={() => setFilter(f)}
      style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
        padding: "3px 8px", border: `0.5px solid ${filter === f ? "var(--gold)" : "var(--rim)"}`,
        borderRadius: 2, cursor: "pointer", textTransform: "uppercase",
        background: filter === f ? "rgba(200,169,110,0.1)" : "transparent",
        color: filter === f ? "var(--gold)" : "var(--text-dim)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={card}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: "1px solid var(--rim)",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
        }}>
          Opportunity map
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {fbtn("all", "All")}
          {fbtn("held", "Held")}
          {fbtn("wl", "WL")}
        </div>
      </div>

      <div style={{ padding: "8px 6px 0" }}>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
            <XAxis
              dataKey="asymmetry"
              type="number"
              domain={[0, X_MAX]}
              tickCount={5}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{
                value: "Asymmetry ratio →",
                position: "bottom",
                offset: 10,
                style: { fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" },
              }}
            />
            <YAxis
              dataKey="irrBb"
              type="number"
              domain={[0, Y_MAX]}
              tickCount={5}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{
                value: "IRR-BB →",
                angle: -90,
                position: "insideLeft",
                offset: 4,
                style: { fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" },
              }}
            />
            <ZAxis dataKey="weight" range={[30, 300]} />

            {/* Deploy thresholds */}
            <ReferenceLine
              y={20}
              stroke="rgba(90,191,160,0.25)"
              strokeDasharray="4 4"
              label={{
                value: "Deploy 20%",
                position: "right",
                style: { fontFamily: "var(--font-mono)", fontSize: 8, fill: "rgba(90,191,160,0.45)" },
              }}
            />
            <ReferenceLine
              y={15}
              stroke="rgba(200,146,90,0.2)"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              x={2}
              stroke="rgba(200,146,90,0.15)"
              strokeDasharray="4 4"
            />

            <Tooltip
              cursor={false}
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload as Dot;
                return (
                  <div style={{
                    background: "var(--panel)", border: "1px solid var(--rim)",
                    padding: "8px 10px", borderRadius: 3,
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text)",
                    lineHeight: 1.6, maxWidth: 220,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{d.label}</div>
                    {d.name && d.label !== d.name && (
                      <div style={{ fontSize: 9, color: "var(--text-dim)", marginBottom: 4 }}>{d.name}</div>
                    )}
                    <div>IRR-BB: <span style={{ color: "var(--green)" }}>{d.irrBb.toFixed(1)}%</span></div>
                    <div>Asymmetry: <span style={{ color: "var(--gold)" }}>{d.asymmetry.toFixed(1)}:1</span></div>
                    <div>Score: {d.score ?? "—"} · {d.layer}</div>
                    <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>
                      {d.held ? `${d.weight.toFixed(1)}% AUM` : "Watchlist"}
                    </div>
                  </div>
                );
              }}
            />

            <Scatter
              data={filtered}
              onClick={handleClick}
              style={{ cursor: "pointer" }}
            >
              {filtered.map((d, i) => (
                <Cell
                  key={d.ticker}
                  fill={d.color}
                  fillOpacity={d.held ? 0.7 : 0.55}
                  stroke={d.color}
                  strokeWidth={d.held ? 1.5 : 1}
                  strokeDasharray="none"
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 12, justifyContent: "center", padding: "4px 14px 12px",
        flexWrap: "wrap",
      }}>
        {Object.entries(LAYER_COLORS).filter(([k]) => k !== "Hedge").map(([layer, color]) => (
          <div key={layer} style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.06em" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
            {layer}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid var(--text-dim)" }} />
          Held
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1px dashed var(--text-dim)" }} />
          WL
        </div>
      </div>
    </div>
  );
}
