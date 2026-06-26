import { useMemo, useState, useCallback, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, ZAxis, Customized,
} from "recharts";
import { LiveHolding, LiveWatchItem, LiveScore } from "@/hooks/usePortfolioData";
import { useIrrBb } from "@/hooks/useIrrBb";
import { useQuartetMap } from "@/hooks/useQuartetMap";
import { useScoresSnapshot } from "@/hooks/useScoresSnapshot";
import { computeLiveAsymmetry } from "@/lib/liveAsymmetry";
import { computeIrrBb } from "@/lib/computeIrrBb";
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

// ── Score band colours ──
const SCORE_COLORS: Record<string, { fill: string; stroke: string }> = {
  S90: { fill: "#5abfa0", stroke: "#5abfa0" },   // 90+: bright green
  S75: { fill: "#7da4d8", stroke: "#7da4d8" },   // 75-89: teal-blue
  S60: { fill: "#d4a06a", stroke: "#d4a06a" },   // 60-74: amber
  SUB: { fill: "#6b6b7b", stroke: "#6b6b7b" },   // <60: muted
};

function scoreBand(score: number | null): string {
  if (score === null) return "SUB";
  if (score >= 90) return "S90";
  if (score >= 75) return "S75";
  if (score >= 60) return "S60";
  return "SUB";
}

// ── Layer colours (matches AssetRow palette) ──
const LAYER_COLORS: Record<string, { fill: string; stroke: string }> = {
  Compute:     { fill: "#6e8ec8", stroke: "#6e8ec8" },
  Energy:      { fill: "#c8925a", stroke: "#c8925a" },
  Materials:   { fill: "#c8a86e", stroke: "#c8a86e" },
  Biological:  { fill: "#5abfa0", stroke: "#5abfa0" },
  Sovereignty: { fill: "#9b59b6", stroke: "#9b59b6" },
  Robotics:    { fill: "#3498db", stroke: "#3498db" },
  Hedge:       { fill: "#c85a5a", stroke: "#c85a5a" },
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

// ── Zoom presets (now drive slider values) ──
type ZoomPreset = "full" | "deploy" | "dense";
const ZOOM_DEFAULTS: Record<ZoomPreset, { x: [number, number]; y: [number, number] }> = {
  full:   { x: [0, 10],  y: [0, 50] },
  deploy: { x: [1, 7],   y: [14, 50] },
  dense:  { x: [0.5, 5], y: [8, 35] },
};

type Filter = "all" | "held" | "wl";
type SizeMode = "holding" | "score" | "uniform";
type ColourMode = "profile" | "score" | "layer";
type PriceMode = "live" | "entry";

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
  aumWeight: number;
  score: number | null;
  // These are the "profile" default colours; the render function resolves the active colour mode
  profileFill: string;
  profileStroke: string;
  shape: ProfileShape;
  // Entry-state fields (WL only; null for held or missing buy_high)
  entryIrrBb: number | null;
  entryAsymmetry: number | null;
}

interface Props {
  scores: LiveScore[];
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
}

// ── Resolve fill/stroke based on colour mode ──
function resolveColour(d: Dot, mode: ColourMode): { fill: string; stroke: string } {
  if (mode === "score") {
    const c = SCORE_COLORS[scoreBand(d.score)] ?? SCORE_COLORS.SUB;
    return c;
  }
  if (mode === "layer") {
    const c = LAYER_COLORS[d.layer] ?? { fill: "#8A8A9A", stroke: "#8A8A9A" };
    return c;
  }
  return { fill: d.profileFill, stroke: d.profileStroke };
}

// ── Resolve dot radius based on size mode ──
function resolveRadius(d: Dot, mode: SizeMode): number {
  switch (mode) {
    case "holding":
      return d.held
        ? Math.max(5, Math.min(14, 3 + Math.max(d.aumWeight, 1.5) * 1.2))
        : Math.max(4, Math.min(8, 4));
    case "score": {
      const s = d.score ?? 50;
      // Stepped: <60=4, 60s=7, 70s=10, 80s=13, 90+=16
      if (s >= 90) return 16;
      if (s >= 80) return 13;
      if (s >= 75) return 11;
      if (s >= 70) return 9;
      if (s >= 60) return 7;
      return 4;
    }
    case "uniform":
      return 6;
  }
}

// ── Custom dot renderer (shape per profile) ──
function DotShape(props: any) {
  const { cx, cy, payload, sizeMode, colourMode } = props;
  if (!cx || !cy || !payload) return null;
  const d = payload as Dot;
  const r = resolveRadius(d, sizeMode ?? "holding");
  const { fill: fillColor, stroke: strokeColor } = resolveColour(d, colourMode ?? "profile");
  const isHollow = colourMode === "profile" && d.profileFill === "transparent";
  const baseOpacity = d.held ? 0.8 : 0.55;
  const sw = d.held ? 1.5 : 1;

  switch (d.shape) {
    case "diamond": {
      const s = r * 1.15;
      return (
        <path
          d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`}
          fill={fillColor}
          fillOpacity={baseOpacity}
          stroke={strokeColor}
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
          fill={fillColor}
          fillOpacity={baseOpacity}
          stroke={strokeColor}
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
          fill={fillColor}
          fillOpacity={baseOpacity}
          stroke={strokeColor}
          strokeWidth={sw}
          style={{ cursor: "pointer" }}
        />
      );
    }
    default: {
      return (
        <circle
          cx={cx} cy={cy} r={r}
          fill={isHollow ? "transparent" : fillColor}
          fillOpacity={isHollow ? 0 : baseOpacity}
          stroke={strokeColor}
          strokeWidth={isHollow ? 2 : sw}
          style={{ cursor: "pointer" }}
        />
      );
    }
  }
}

// ── Range Slider Component ──
function RangeSlider({
  min, max, value, onChange, step = 1, label, formatter,
}: {
  min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void;
  step?: number; label: string; formatter?: (v: number) => string;
}) {
  const fmt = formatter ?? ((v: number) => String(v));
  const range = max - min;
  const loPos = ((value[0] - min) / range) * 100;
  const hiPos = ((value[1] - min) / range) * 100;

  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"lo" | "hi" | null>(null);

  const posToValue = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return min;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + pct * range;
    return Math.round(raw / step) * step;
  }, [min, range, step]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const v = posToValue(e.clientX);
    const distLo = Math.abs(v - value[0]);
    const distHi = Math.abs(v - value[1]);
    dragging.current = distLo <= distHi ? "lo" : "hi";
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [posToValue, value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const v = posToValue(e.clientX);
    if (dragging.current === "lo") {
      if (v < value[1]) onChange([v, value[1]]);
    } else {
      if (v > value[0]) onChange([value[0], v]);
    }
  }, [posToValue, value, onChange]);

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  return (
    <div style={{ flex: 1, minWidth: 100 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)",
        letterSpacing: "0.08em", marginBottom: 4,
      }}>
        <span style={{ textTransform: "uppercase" }}>{label}</span>
        <span style={{ color: "var(--text-mid)", fontSize: 9 }}>
          {fmt(value[0])} – {fmt(value[1])}
        </span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: "relative", height: 20, cursor: "pointer",
          touchAction: "none",
        }}
      >
        {/* Track bg */}
        <div style={{
          position: "absolute", top: 8, left: 0, right: 0, height: 3,
          background: "rgba(255,255,255,0.06)", borderRadius: 2,
        }} />
        {/* Active range */}
        <div style={{
          position: "absolute", top: 8, height: 3, borderRadius: 2,
          left: `${loPos}%`, width: `${hiPos - loPos}%`,
          background: "rgba(90,191,160,0.35)",
        }} />
        {/* Low thumb */}
        <div style={{
          position: "absolute", top: 4, width: 12, height: 12, borderRadius: "50%",
          background: "var(--green, #5abfa0)", border: "1.5px solid rgba(255,255,255,0.6)",
          left: `calc(${loPos}% - 6px)`, pointerEvents: "none",
        }} />
        {/* High thumb */}
        <div style={{
          position: "absolute", top: 4, width: 12, height: 12, borderRadius: "50%",
          background: "var(--green, #5abfa0)", border: "1.5px solid rgba(255,255,255,0.6)",
          left: `calc(${hiPos}% - 6px)`, pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

// ── Arrow overlay for @ Entry mode ──
function ArrowLayer(props: any) {
  const { xAxisMap, yAxisMap, arrows, arrowFilter } = props;
  if (!arrows || arrows.length === 0) return null;
  const xAxis = xAxisMap && Object.values(xAxisMap)[0] as any;
  const yAxis = yAxisMap && Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const xScale = xAxis.scale;
  const yScale = yAxis.scale;

  const visible = arrowFilter === "improved"
    ? arrows.filter((a: any) => a.improved)
    : arrowFilter === "deteriorated"
    ? arrows.filter((a: any) => !a.improved)
    : arrows;

  return (
    <g>
      <defs>
        <marker id="arrowhead-green" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4 Z" fill="rgba(90,191,160,0.6)" />
        </marker>
        <marker id="arrowhead-red" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4 Z" fill="rgba(200,90,90,0.6)" />
        </marker>
      </defs>
      {visible.map((a: any) => {
        const x1 = xScale(a.liveX);
        const y1 = yScale(a.liveY);
        const x2 = xScale(a.entryX);
        const y2 = yScale(a.entryY);
        if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
        const color = a.improved ? "rgba(90,191,160,0.35)" : "rgba(200,90,90,0.35)";
        const ghostColor = a.improved ? "rgba(90,191,160,0.15)" : "rgba(200,90,90,0.15)";
        const marker = a.improved ? "url(#arrowhead-green)" : "url(#arrowhead-red)";
        return (
          <g key={a.ticker}>
            <circle cx={x1} cy={y1} r={4} fill="none" stroke={ghostColor} strokeWidth={1} strokeDasharray="2 2" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} markerEnd={marker} />
          </g>
        );
      })}
    </g>
  );
}

export default function OpportunityScatter({ scores, holdings, watchlist }: Props) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("all");
  const [hiddenProfiles, setHiddenProfiles] = useState<Set<string>>(new Set());
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [hiddenScoreBands, setHiddenScoreBands] = useState<Set<string>>(new Set());
  const [sizeMode, setSizeMode] = useState<SizeMode>("holding");
  const [colourMode, setColourMode] = useState<ColourMode>("profile");
  const [priceMode, setPriceMode] = useState<PriceMode>("live");
  const [arrowFilter, setArrowFilter] = useState<"all" | "improved" | "deteriorated">("all");

  // Range slider state
  const [irrRange, setIrrRange] = useState<[number, number]>([0, 50]);
  const [asymRange, setAsymRange] = useState<[number, number]>([0, 10]);

  const toggleProfile = useCallback((key: string) => {
    setHiddenProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const toggleLayer = useCallback((key: string) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const toggleScoreBand = useCallback((key: string) => {
    setHiddenScoreBands((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const { byTicker: irrMap } = useIrrBb(scores, holdings, watchlist);
  const { byTicker: snapshotMap } = useScoresSnapshot();
  const quartetMap = useQuartetMap(scores ?? [], holdings ?? [], watchlist ?? [], snapshotMap);

  // Build buyHigh + IRR inputs lookup from scores
  const scoreInputMap = useMemo(() => {
    const m = new Map<string, { buyHigh: number | null }>();
    for (const s of scores) {
      const t = normaliseTicker(s.ticker);
      if (!t) continue;
      m.set(t, { buyHigh: (s as any).buyHigh ?? null });
    }
    return m;
  }, [scores]);

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

      // Compute entry-state for WL dots with buy_high
      let entryIrrBb: number | null = null;
      let entryAsymmetry: number | null = null;
      if (!entry.held) {
        const buyHigh = scoreInputMap.get(t)?.buyHigh ?? null;
        if (buyHigh !== null && buyHigh > 0) {
          const qEntry2 = quartetMap.get(t);
          const quartet = qEntry2?.quartet ?? { bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null };
          // IRR-BB at entry price
          const entryResult = computeIrrBb(
            entry.result.bullBase,
            buyHigh,
            entry.result.bbTargetDate,
            entry.result.divYield,
            null,
            false,
          );
          if (entryResult.irrBb !== null) {
            entryIrrBb = Math.round(Math.min(entryResult.irrBb * 100, 50) * 10) / 10;
          }
          // Asymmetry at entry price
          const entryAsym = computeLiveAsymmetry(quartet, buyHigh);
          if (entryAsym.baseRatio !== null && entryAsym.baseRatio > 0) {
            entryAsymmetry = Math.round(Math.min(entryAsym.baseRatio, 10) * 10) / 10;
          }
        }
      }

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
        aumWeight: aumPct,
        score: entry.score,
        profileFill: colors.fill,
        profileStroke: colors.stroke,
        shape,
        entryIrrBb,
        entryAsymmetry,
      });
    }
    return out;
  }, [irrMap, quartetMap, totalAum, aumByTicker, profileMap, scoreInputMap]);

  const filtered = useMemo(() => {
    let out = dots;
    if (filter !== "all") out = out.filter((d) => filter === "held" ? d.held : !d.held);
    if (hiddenProfiles.size > 0) out = out.filter((d) => !hiddenProfiles.has(d.profileKey));
    if (hiddenLayers.size > 0) out = out.filter((d) => !hiddenLayers.has(d.layer));
    if (hiddenScoreBands.size > 0) out = out.filter((d) => !hiddenScoreBands.has(scoreBand(d.score)));
    // In entry mode, swap WL dot positions to entry-state values
    if (priceMode === "entry") {
      out = out.map((d) => {
        if (d.held || d.entryIrrBb === null || d.entryAsymmetry === null) return d;
        return { ...d, irrBb: d.entryIrrBb!, asymmetry: d.entryAsymmetry! };
      });
    }
    return out;
  }, [dots, filter, hiddenProfiles, hiddenLayers, hiddenScoreBands, priceMode]);

  // Build arrow data: WL dots that have entry-state displacement
  const arrows = useMemo(() => {
    if (priceMode !== "entry") return [];
    return dots
      .filter((d) => {
        if (d.held) return false;
        if (d.entryIrrBb === null || d.entryAsymmetry === null) return false;
        // Only show arrows with meaningful displacement (>2pp IRR or >0.3 asym)
        const dIrr = Math.abs(d.entryIrrBb - d.irrBb);
        const dAsym = Math.abs(d.entryAsymmetry - d.asymmetry);
        return dIrr > 2 || dAsym > 0.3;
      })
      .filter((d) => {
        // Also apply visibility filters
        if (filter === "held") return false;
        if (hiddenProfiles.size > 0 && hiddenProfiles.has(d.profileKey)) return false;
        if (hiddenLayers.size > 0 && hiddenLayers.has(d.layer)) return false;
        if (hiddenScoreBands.size > 0 && hiddenScoreBands.has(scoreBand(d.score))) return false;
        return true;
      })
      .map((d) => ({
        ticker: d.ticker,
        liveX: d.asymmetry,
        liveY: d.irrBb,
        entryX: d.entryAsymmetry!,
        entryY: d.entryIrrBb!,
        improved: d.entryIrrBb! >= d.irrBb,
      }));
  }, [dots, priceMode, filter, hiddenProfiles, hiddenLayers, hiddenScoreBands]);

  const handleClick = useCallback((data: any) => {
    if (data?.ticker) openFactSheet(data.ticker);
  }, [openFactSheet]);

  // Preset helper: applies slider values
  const applyPreset = useCallback((p: ZoomPreset) => {
    const d = ZOOM_DEFAULTS[p];
    setAsymRange(d.x);
    setIrrRange(d.y);
  }, []);

  if (isMobile) return null;
  if (dots.length < 3) return null;

  const domain = { x: asymRange, y: irrRange };

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

  const presetBtn = (p: ZoomPreset, lbl: string) => {
    const d = ZOOM_DEFAULTS[p];
    const isActive = asymRange[0] === d.x[0] && asymRange[1] === d.x[1]
      && irrRange[0] === d.y[0] && irrRange[1] === d.y[1];
    return (
      <button
        onClick={() => applyPreset(p)}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em",
          padding: "2px 6px", border: `0.5px solid ${isActive ? "var(--green, #5abfa0)" : "var(--rim)"}`,
          borderRadius: 2, cursor: "pointer", textTransform: "uppercase",
          background: isActive ? "rgba(90,191,160,0.08)" : "transparent",
          color: isActive ? "var(--green, #5abfa0)" : "var(--text-dim)",
        }}
      >
        {lbl}
      </button>
    );
  };

  const segBtn = <T extends string>(value: T, current: T, set: (v: T) => void, lbl: string) => (
    <button
      onClick={() => set(value)}
      style={{
        fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.06em",
        padding: "2px 6px", border: "none", cursor: "pointer", textTransform: "uppercase",
        background: current === value ? "rgba(255,255,255,0.08)" : "transparent",
        color: current === value ? "var(--text)" : "var(--text-dim)",
        borderBottom: current === value ? "1px solid var(--text-mid)" : "1px solid transparent",
      }}
    >
      {lbl}
    </button>
  );

  return (
    <div style={card}>
      {/* Header row: title + filter */}
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

      {/* Controls row: presets + toggles + sliders */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 14px",
        flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}>
        {/* Left: presets */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {presetBtn("full", "Full")}
          {presetBtn("deploy", "Deploy")}
          {presetBtn("dense", "Dense")}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: "var(--rim)", alignSelf: "center" }} />

        {/* Size toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 1,
          }}>Size</span>
          <div style={{ display: "flex", gap: 0 }}>
            {segBtn("holding" as SizeMode, sizeMode, (v) => setSizeMode(v), "Holding")}
            {segBtn("score" as SizeMode, sizeMode, (v) => setSizeMode(v), "Score")}
            {segBtn("uniform" as SizeMode, sizeMode, (v) => setSizeMode(v), "Flat")}
          </div>
        </div>

        {/* Colour toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 1,
          }}>Colour</span>
          <div style={{ display: "flex", gap: 0 }}>
            {segBtn("profile" as ColourMode, colourMode, (v) => setColourMode(v), "Profile")}
            {segBtn("score" as ColourMode, colourMode, (v) => setColourMode(v), "Score")}
            {segBtn("layer" as ColourMode, colourMode, (v) => setColourMode(v), "Layer")}
          </div>
        </div>

        {/* Price mode toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 1,
          }}>Price</span>
          <div style={{ display: "flex", gap: 0 }}>
            {segBtn("live" as PriceMode, priceMode, (v) => setPriceMode(v), "Live")}
            {segBtn("entry" as PriceMode, priceMode, (v) => setPriceMode(v), "@ Entry")}
          </div>
        </div>

        {priceMode === "entry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 1,
            }}>Arrows</span>
            <div style={{ display: "flex", gap: 0 }}>
              {segBtn("all" as const, arrowFilter, (v) => setArrowFilter(v), "All")}
              {segBtn("improved" as const, arrowFilter, (v) => setArrowFilter(v), "\u2191 Better")}
              {segBtn("deteriorated" as const, arrowFilter, (v) => setArrowFilter(v), "\u2193 Worse")}
            </div>
          </div>
        )}

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: "var(--rim)", alignSelf: "center" }} />

        {/* Range sliders */}
        <div style={{ display: "flex", gap: 16, flex: 1, minWidth: 200 }}>
          <RangeSlider
            min={0} max={50} step={1}
            value={irrRange} onChange={setIrrRange}
            label="IRR-BB" formatter={(v) => `${v}%`}
          />
          <RangeSlider
            min={0} max={10} step={0.5}
            value={asymRange} onChange={setAsymRange}
            label="Asymmetry" formatter={(v) => `${v}:1`}
          />
        </div>
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
            <ZAxis dataKey="aumWeight" range={[30, 300]} />

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

            {priceMode === "entry" && arrows.length > 0 && (
              <Customized component={(props: any) => <ArrowLayer {...props} arrows={arrows} arrowFilter={arrowFilter} />} />
            )}

            <Tooltip
              cursor={false}
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload as Dot;
                const { fill, stroke } = resolveColour(d, colourMode);
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
                      color: stroke,
                      border: `1px solid ${stroke}`,
                      background: fill === "transparent" ? "transparent" : `${fill}22`,
                    }}>
                      {d.profileLabel}
                    </div>
                    <div>IRR-BB: <span style={{ color: "var(--green)" }}>{d.irrBb.toFixed(1)}%</span>
                      {priceMode === "entry" && !d.held && d.entryIrrBb !== null && d.entryIrrBb !== d.irrBb && (
                        <span style={{ fontSize: 8, color: "var(--text-dim)", marginLeft: 4 }}>
                          (live: {dots.find((x) => x.ticker === d.ticker)?.irrBb.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <div>Asymmetry: <span style={{ color: "var(--gold)" }}>{d.asymmetry.toFixed(1)}:1</span>
                      {priceMode === "entry" && !d.held && d.entryAsymmetry !== null && d.entryAsymmetry !== d.asymmetry && (
                        <span style={{ fontSize: 8, color: "var(--text-dim)", marginLeft: 4 }}>
                          (live: {dots.find((x) => x.ticker === d.ticker)?.asymmetry.toFixed(1)}:1)
                        </span>
                      )}
                    </div>
                    <div>Score: {d.score ?? "\u2014"} \u00b7 {d.layer}</div>
                    <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>
                      {d.held ? `${d.aumWeight.toFixed(1)}% AUM` : "Watchlist"}
                    </div>
                  </div>
                );
              }}
            />

            <Scatter
              data={filtered}
              onClick={handleClick}
              shape={(props: any) => (
                <DotShape {...props} sizeMode={sizeMode} colourMode={colourMode} />
              )}
            >
              {filtered.map((d) => (
                <Cell key={d.ticker} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend: adapts to colour mode */}
      <div style={{
        display: "flex", gap: 10, justifyContent: "center", padding: "4px 14px 10px",
        flexWrap: "wrap",
      }}>
        {colourMode === "profile" && (
          <>
            <LegendDot shape="circle" fill={PROFILE_COLORS.STELLAR_COMPOUNDER.fill} stroke={PROFILE_COLORS.STELLAR_COMPOUNDER.stroke} label="Stellar" active={!hiddenProfiles.has("STELLAR_COMPOUNDER")} onClick={() => toggleProfile("STELLAR_COMPOUNDER")} />
            <LegendDot shape="circle" fill="transparent" stroke={PROFILE_COLORS.GENERIC_COMPOUNDER.stroke} label="Generic" active={!hiddenProfiles.has("GENERIC_COMPOUNDER")} onClick={() => toggleProfile("GENERIC_COMPOUNDER")} />
            <LegendDot shape="diamond" fill={PROFILE_COLORS.RECLASSIFICATION.fill} stroke={PROFILE_COLORS.RECLASSIFICATION.stroke} label="Reclass" active={!hiddenProfiles.has("RECLASSIFICATION")} onClick={() => toggleProfile("RECLASSIFICATION")} />
            <LegendDot shape="square" fill={PROFILE_COLORS.CYCLE.fill} stroke={PROFILE_COLORS.CYCLE.stroke} label="Cycle" active={!hiddenProfiles.has("CYCLE")} onClick={() => toggleProfile("CYCLE")} />
            <LegendDot shape="triangle" fill={PROFILE_COLORS.PRE_PRODUCTION.fill} stroke={PROFILE_COLORS.PRE_PRODUCTION.stroke} label="Pre-Prod" active={!hiddenProfiles.has("PRE_PRODUCTION")} onClick={() => toggleProfile("PRE_PRODUCTION")} />
          </>
        )}
       {colourMode === "score" && (
          <>
            <LegendSquare color={SCORE_COLORS.S90.fill} label="90+" active={!hiddenScoreBands.has("S90")} onClick={() => toggleScoreBand("S90")} />
            <LegendSquare color={SCORE_COLORS.S75.fill} label="75–89" active={!hiddenScoreBands.has("S75")} onClick={() => toggleScoreBand("S75")} />
            <LegendSquare color={SCORE_COLORS.S60.fill} label="60–74" active={!hiddenScoreBands.has("S60")} onClick={() => toggleScoreBand("S60")} />
            <LegendSquare color={SCORE_COLORS.SUB.fill} label="<60" active={!hiddenScoreBands.has("SUB")} onClick={() => toggleScoreBand("SUB")} />
          </>
        )}
        {colourMode === "layer" && (
          <>
            {Object.entries(LAYER_COLORS).map(([name, c]) => (
              <LegendSquare key={name} color={c.fill} label={name} active={!hiddenLayers.has(name)} onClick={() => toggleLayer(name)} />
            ))}
          </>
        )}

        <div style={{ width: 1, height: 14, background: "var(--rim)", alignSelf: "center" }} />

        {/* Size mode indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>
          <svg width="10" height="10"><circle cx="5" cy="5" r="4.5" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" /></svg>
          {sizeMode === "holding" ? "Held" : sizeMode === "score" ? "Score" : "Flat"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>
          <svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--text-dim)" strokeWidth="0.8" strokeDasharray="2 1" /></svg>
          WL
        </div>
      </div>
    </div>
  );
}

// ── Legend helper: shaped dot (for Profile mode) ──
function LegendDot({ shape, fill, stroke, label, active = true, onClick }: { shape: ProfileShape; fill: string; stroke: string; label: string; active?: boolean; onClick?: () => void }) {
  const sz = 9;
  const cx = sz / 2, cy = sz / 2;
  const opacity = active ? 0.8 : 0.15;
  const sw = active ? 1 : 0.6;
  const sFill = active ? fill : "transparent";
  const sStroke = active ? stroke : "rgba(255,255,255,0.2)";
  let el: JSX.Element;
  switch (shape) {
    case "diamond": {
      const s = 4;
      el = <path d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`} fill={sFill} fillOpacity={opacity} stroke={sStroke} strokeWidth={sw} />;
      break;
    }
    case "square":
      el = <rect x={1} y={1} width={sz - 2} height={sz - 2} fill={sFill} fillOpacity={opacity} stroke={sStroke} strokeWidth={sw} rx={1} />;
      break;
    case "triangle": {
      const s = 4;
      el = <path d={`M${cx},${cy - s} L${cx + s},${cy + s * 0.7} L${cx - s},${cy + s * 0.7} Z`} fill={sFill} fillOpacity={opacity} stroke={sStroke} strokeWidth={sw} />;
      break;
    }
    default:
      el = <circle cx={cx} cy={cy} r={3.5} fill={sFill} fillOpacity={sFill === "transparent" ? 0 : opacity} stroke={sStroke} strokeWidth={sFill === "transparent" ? 2 : sw} />;
  }
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.06em",
        color: active ? "var(--text-dim)" : "rgba(255,255,255,0.2)",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        transition: "opacity 0.15s",
      }}
    >
      <svg width={sz} height={sz}>{el}</svg>
      {label}
    </div>
  );
}

// ── Legend helper: coloured square (for Score/Layer mode) ──
function LegendSquare({ color, label, active = true, onClick }: { color: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.06em",
        color: active ? "var(--text-dim)" : "rgba(255,255,255,0.2)",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        transition: "opacity 0.15s",
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: 1,
        background: color,
        opacity: active ? 0.75 : 0.15,
        transition: "opacity 0.15s",
      }} />
      {label}
    </div>
  );
}
