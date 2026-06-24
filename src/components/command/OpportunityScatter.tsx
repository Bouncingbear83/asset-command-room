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
import { PROFILE_PALETTE } from "@/components/intelligence/profileChips";

import { normaliseTicker } from "@/lib/tickerAlias";
import { useFactSheet } from "@/components/factsheet/FactSheetProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { IS_NUMERIC_TICKER } from "@/hooks/useIrrBb";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };

// ── Return Profile colour map (primary visual axis) ──
const PROFILE_COLORS: Record<string, { fill: string; stroke: string }> = {
  STELLAR_COMPOUNDER:  { fill: PROFILE_PALETTE.COMPOUNDER.fg,       stroke: PROFILE_PALETTE.COMPOUNDER.fg },
  GENERIC_COMPOUNDER:  { fill: "transparent",                        stroke: PROFILE_PALETTE.COMPOUNDER.fg },
  RECLASSIFICATION:    { fill: PROFILE_PALETTE.RECLASSIFICATION.fg,  stroke: PROFILE_PALETTE.RECLASSIFICATION.fg },
  CYCLE:               { fill: PROFILE_PALETTE.CYCLE.fg,             stroke: PROFILE_PALETTE.CYCLE.fg },
  PRE_PRODUCTION:      { fill: PROFILE_PALETTE.PRE_PRODUCTION.fg,    stroke: PROFILE_PALETTE.PRE_PRODUCTION.fg },
  HEDGE:               { fill: PROFILE_PALETTE.HEDGE.fg,             stroke: PROFILE_PALETTE.HEDGE.fg },
  VEHICLE:             { fill: PROFILE_PALETTE.VEHICLE.fg,           stroke: PROFILE_PALETTE.VEHICLE.fg },
  UNKNOWN:             { fill: "#8A8A9A",                            stroke: "#8A8A9A" },
};

// ── Shape by profile: circle=compounder, diamond=reclass, square=cycle, triangle=other ──
type ProfileShape = "circle" | "diamond" | "square" | "triangle";
const PROFILE_SHAPE: Record<string, ProfileShape> = {
  STELLAR_COMPOUNDER: "circle",
  GENERIC_COMPOUNDER: "circle",
  RECLASSIFICATION: "diamond",
  CYCLE: "square",
  PRE_PRODUCTION: "triangle",
  HEDGE: "square",
  VEHICLE: "square",
  UNKNOWN: "circle",
};

// ── Zoom presets ──
type ZoomPreset = "full" | "deploy" | "dense";
const ZOOM_DOMAINS: Record<ZoomPreset, { x: [number, number]; y: [number, number] }> = {
  full:   { x: [0, 9],   y: [0, 45] },
  deploy: { x: [1, 7],   y: [14, 45] },
  dense:  { x: [0.5, 5], y: [8, 35] },
};

type Filter = "all" | "held" | "wl";

interface Dot {
  ticker: string;
  name: string;
  label: string;
  layer: string;
  profileKey: string;
  profileLabel: string;
  irrBb: number;
  asymmetry: number;
  held: boolean;
  weight: number;
  score: number | null;
  fillColor: string;
  strokeColor: string;
  shape: ProfileShape;
}

interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

// ── Custom dot renderer (shape per profile) ──
function DotShape(props: any) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  const d = payload as Dot;
  const r = Math.max(4, Math.min(12, 3 + d.weight * 1.2));
  const baseOpacity = d.held ? 0.8 : 0.55;
  const sw = d.held ? 1.5 : 1;

  switch (d.shape) {
    case "diamond": {
      const s = r * 1.15;
      return (
        <path
          d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`}
          fill={d.fillColor}
          fillOpacity={baseOpacity}
          stroke={d.strokeColor}
          strokeWidth={sw}
          style={{ cursor: "pointer" }}
        />
      );
    }
    case "square": {
      const half = r * 0.85;
      return (
        <rect
          x={cx - half} y={cy - half} width={half * 2} height={half * 2}
          fill={d.fillColor}
          fillOpacity={baseOpacity}
          stroke={d.strokeColor}
          strokeWidth={sw}
          rx={1}
          style={{ cursor: "pointer" }}
        />
      );
    }
    case "triangle": {
      const s = r * 1.1;
      return (
        <path
          d={`M${cx},${cy - s} L${cx + s},${cy + s * 0.7} L${cx - s},${cy + s * 0.7} Z`}
          fill={d.fillColor}
          fillOpacity={baseOpacity}
          stroke={d.strokeColor}
          strokeWidth={sw}
          style={{ cursor: "pointer" }}
        />
      );
    }
    default: {
      return (
        <circle
          cx={cx} cy={cy} r={r}
          fill={d.fillColor}
          fillOpacity={d.fillColor === "transparent" ? 0 : baseOpacity}
          stroke={d.strokeColor}
          strokeWidth={d.fillColor === "transparent" ? 2 : sw}
          style={{ cursor: "pointer" }}
        />
      );
    }
  }
}

export default function OpportunityScatter({ scores, holdings, watchlist }: Props) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("all");
  const [zoom, setZoom] = useState<ZoomPreset>("full");
  const { byTicker: irrMap } = useIrrBb(scores, holdings, watchlist);
  const { byTicker: snapshotMap } = useScoresSnapshot();
  const quartetMap = useQuartetMap(scores ?? [], holdings ?? [], watchlist ?? [], snapshotMap);

  // Build profile lookup from scores
  const profileMap = useMemo(() => {
    const m = new Map<string, { returnProfile: string; compounderSubtype: string; stellarType: string }>();
    for (const s of scores) {
      const t = normaliseTicker(s.ticker);
      if (!t) continue;
      m.set(t, {
        returnProfile: (s as any).returnProfile ?? "",
        compounderSubtype: (s as any).compounderSubtype ?? "",
        stellarType: (s as any).stellarType ?? "",
      });
    }
    return m;
  }, [scores]);

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

      const irrPct = Math.min(entry.result.irrBb * 100, 50);
      const asymClamped = Math.min(asym.baseRatio, 10);
      const aumPct = totalAum > 0 ? ((aumByTicker.get(t) || 0) / totalAum) * 100 : 0;

      const isNumeric = IS_NUMERIC_TICKER.test(entry.ticker);
      const label = isNumeric && entry.name ? entry.name : entry.ticker;

      // Resolve profile
      const prof = profileMap.get(t);
      let profileKey = "UNKNOWN";
      let profileLabel = "Unknown";
      if (prof?.returnProfile === "COMPOUNDER") {
        profileKey = prof.compounderSubtype === "STELLAR_COMPOUNDER"
          ? "STELLAR_COMPOUNDER" : prof.compounderSubtype === "GENERIC_COMPOUNDER"
          ? "GENERIC_COMPOUNDER" : "STELLAR_COMPOUNDER";
        profileLabel = profileKey === "STELLAR_COMPOUNDER" ? "Stellar Compounder" : "Generic Compounder";
      } else if (prof?.returnProfile === "RECLASSIFICATION") {
        profileKey = "RECLASSIFICATION";
        profileLabel = "Reclassification";
      } else if (prof?.returnProfile === "CYCLE") {
        profileKey = "CYCLE";
        profileLabel = "Cycle";
      } else if (prof?.returnProfile === "PRE_PRODUCTION") {
        profileKey = "PRE_PRODUCTION";
        profileLabel = "Pre-Production";
      } else if (prof?.returnProfile === "HEDGE") {
        profileKey = "HEDGE";
        profileLabel = "Hedge";
      } else if (prof?.returnProfile === "VEHICLE") {
        profileKey = "VEHICLE";
        profileLabel = "Vehicle";
      }

      const colors = PROFILE_COLORS[profileKey] ?? PROFILE_COLORS.UNKNOWN;
      const shape = PROFILE_SHAPE[profileKey] ?? "circle";

      const weight = entry.held
        ? Math.max(aumPct, 1.5)
        : Math.max(((entry.score ?? 50) - 40) / 10, 0.8);

      out.push({
        ticker: entry.ticker,
        name: entry.name,
        label,
        layer: entry.layer || "Hedge",
        profileKey,
        profileLabel,
        irrBb: Math.round(irrPct * 10) / 10,
        asymmetry: Math.round(asymClamped * 10) / 10,
        held: entry.held,
        weight,
        score: entry.score,
        fillColor: colors.fill,
        strokeColor: colors.stroke,
        shape,
      });
    }
    return out;
  }, [irrMap, quartetMap, totalAum, aumByTicker, profileMap]);

  const filtered = useMemo(() => {
    if (filter === "all") return dots;
    return dots.filter((d) => filter === "held" ? d.held : !d.held);
  }, [dots, filter]);

  const handleClick = useCallback((data: any) => {
    if (data?.ticker) openFactSheet(data.ticker);
  }, [openFactSheet]);

  if (isMobile) return null;
  if (dots.length < 3) return null;

  const domain = ZOOM_DOMAINS[zoom];

  const fbtn = (f: Filter, lbl: string) => (
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
      {lbl}
    </button>
  );

  const zbtn = (z: ZoomPreset, lbl: string) => (
    <button
      onClick={() => setZoom(z)}
      style={{
        fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em",
        padding: "2px 6px", border: `0.5px solid ${zoom === z ? "var(--green, #5abfa0)" : "var(--rim)"}`,
        borderRadius: 2, cursor: "pointer", textTransform: "uppercase",
        background: zoom === z ? "rgba(90,191,160,0.08)" : "transparent",
        color: zoom === z ? "var(--green, #5abfa0)" : "var(--text-dim)",
      }}
    >
      {lbl}
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

      <div style={{
        display: "flex", gap: 4, padding: "6px 14px 0", justifyContent: "flex-end",
      }}>
        {zbtn("full", "Full")}
        {zbtn("deploy", "Deploy")}
        {zbtn("dense", "Dense")}
      </div>

      <div style={{ padding: "4px 6px 0" }}>
        <ResponsiveContainer width="100%" height={290}>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
            <XAxis
              dataKey="asymmetry"
              type="number"
              domain={domain.x}
              tickCount={6}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{
                value: "Asymmetry ratio \u2192",
                position: "bottom",
                offset: 10,
                style: { fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" },
              }}
            />
            <YAxis
              dataKey="irrBb"
              type="number"
              domain={domain.y}
              tickCount={6}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              label={{
                value: "IRR-BB \u2192",
                angle: -90,
                position: "insideLeft",
                offset: 4,
                style: { fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" },
              }}
            />
            <ZAxis dataKey="weight" range={[30, 300]} />

            {/* Deploy threshold: 20% IRR-BB */}
            <ReferenceLine
              y={20}
              stroke="rgba(90,191,160,0.3)"
              strokeDasharray="4 4"
              label={{
                value: "Deploy 20%",
                position: "right",
                style: { fontFamily: "var(--font-mono)", fontSize: 8, fill: "rgba(90,191,160,0.5)" },
              }}
            />
            {/* Actionable threshold: 15% IRR-BB */}
            <ReferenceLine
              y={15}
              stroke="rgba(200,146,90,0.25)"
              strokeDasharray="4 4"
              label={{
                value: "Actionable 15%",
                position: "right",
                style: { fontFamily: "var(--font-mono)", fontSize: 8, fill: "rgba(200,146,90,0.4)" },
              }}
            />
            {/* Lane 2 dual-gate minimum: 2:1 asymmetry */}
            <ReferenceLine
              x={2}
              stroke="rgba(155,89,182,0.25)"
              strokeDasharray="4 4"
              label={{
                value: "Lane 2 gate 2:1",
                position: "top",
                style: { fontFamily: "var(--font-mono)", fontSize: 8, fill: "rgba(155,89,182,0.45)" },
              }}
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
                    lineHeight: 1.6, maxWidth: 230,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{d.label}</div>
                    {d.name && d.label !== d.name && (
                      <div style={{ fontSize: 9, color: "var(--text-dim)", marginBottom: 2 }}>{d.name}</div>
                    )}
                    <div style={{
                      display: "inline-block", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                      padding: "1px 5px", borderRadius: 2, marginBottom: 4,
                      color: d.strokeColor,
                      border: `1px solid ${d.strokeColor}`,
                      background: d.fillColor === "transparent" ? "transparent" : `${d.fillColor}22`,
                    }}>
                      {d.profileLabel}
                    </div>
                    <div>IRR-BB: <span style={{ color: "var(--green)" }}>{d.irrBb.toFixed(1)}%</span></div>
                    <div>Asymmetry: <span style={{ color: "var(--gold)" }}>{d.asymmetry.toFixed(1)}:1</span></div>
                    <div>Score: {d.score ?? "\u2014"} \u00b7 {d.layer}</div>
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
              shape={<DotShape />}
            >
              {filtered.map((d) => (
                <Cell key={d.ticker} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 10, justifyContent: "center", padding: "4px 14px 10px",
        flexWrap: "wrap",
      }}>
        <LegendDot shape="circle" fill={PROFILE_COLORS.STELLAR_COMPOUNDER.fill} stroke={PROFILE_COLORS.STELLAR_COMPOUNDER.stroke} label="Stellar" />
        <LegendDot shape="circle" fill="transparent" stroke={PROFILE_COLORS.GENERIC_COMPOUNDER.stroke} label="Generic" />
        <LegendDot shape="diamond" fill={PROFILE_COLORS.RECLASSIFICATION.fill} stroke={PROFILE_COLORS.RECLASSIFICATION.stroke} label="Reclass" />
        <LegendDot shape="square" fill={PROFILE_COLORS.CYCLE.fill} stroke={PROFILE_COLORS.CYCLE.stroke} label="Cycle" />
        <LegendDot shape="triangle" fill={PROFILE_COLORS.PRE_PRODUCTION.fill} stroke={PROFILE_COLORS.PRE_PRODUCTION.stroke} label="Pre-Prod" />

        <div style={{ width: 1, height: 14, background: "var(--rim)", alignSelf: "center" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>
          <svg width="10" height="10"><circle cx="5" cy="5" r="4.5" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" /></svg>
          Held
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>
          <svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--text-dim)" strokeWidth="0.8" strokeDasharray="2 1" /></svg>
          WL
        </div>
      </div>
    </div>
  );
}

// ── Legend helper ──
function LegendDot({ shape, fill, stroke, label }: { shape: ProfileShape; fill: string; stroke: string; label: string }) {
  const sz = 9;
  const cx = sz / 2, cy = sz / 2;
  let el: JSX.Element;
  switch (shape) {
    case "diamond": {
      const s = 4;
      el = <path d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`} fill={fill} fillOpacity={0.8} stroke={stroke} strokeWidth={1} />;
      break;
    }
    case "square":
      el = <rect x={1} y={1} width={sz - 2} height={sz - 2} fill={fill} fillOpacity={0.8} stroke={stroke} strokeWidth={1} rx={1} />;
      break;
    case "triangle": {
      const s = 4;
      el = <path d={`M${cx},${cy - s} L${cx + s},${cy + s * 0.7} L${cx - s},${cy + s * 0.7} Z`} fill={fill} fillOpacity={0.8} stroke={stroke} strokeWidth={1} />;
      break;
    }
    default:
      el = <circle cx={cx} cy={cy} r={3.5} fill={fill} fillOpacity={fill === "transparent" ? 0 : 0.8} stroke={stroke} strokeWidth={fill === "transparent" ? 2 : 1} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.06em" }}>
      <svg width={sz} height={sz}>{el}</svg>
      {label}
    </div>
  );
}
