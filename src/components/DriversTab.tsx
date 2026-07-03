import React, { useMemo, useState } from "react";
import { useFactorGroupWeights } from "@/hooks/useFactorGroupWeights";
import { FACTOR_GROUP_COLORS, FACTOR_GROUP_VALUES, DriverChip, StackBadge } from "@/components/holdings/DriverChip";
import type { LiveHolding } from "@/hooks/usePortfolioData";

interface Props {
  holdings: LiveHolding[];
}

// Rule #13: per-group caps. AI_INFRA is tighter (OB v3.13).
const DEFAULT_WARN_PCT = 35;
const DEFAULT_BREACH_PCT = 40;
const AI_INFRA_WARN_PCT = 30;
const AI_INFRA_BREACH_PCT = 35;

function capsForGroup(group: string): { warn: number; breach: number } {
  return group === "AI_INFRA"
    ? { warn: AI_INFRA_WARN_PCT, breach: AI_INFRA_BREACH_PCT }
    : { warn: DEFAULT_WARN_PCT, breach: DEFAULT_BREACH_PCT };
}

const WARN_PCT = DEFAULT_WARN_PCT; // retained for non-group-specific UI text
const BREACH_PCT = DEFAULT_BREACH_PCT;
const TIGHTEN_DELTA_PP = 5; // pp by which a driver drawdown must exceed portfolio drawdown to flag
const TIGHTEN_MIN_LATEST_PCT = 30; // only flag drivers sitting near the cap

function activationHint(distinctDays: number): string {
  const remaining = Math.max(0, 14 - distinctDays);
  if (remaining === 0) return "";
  const d = new Date();
  d.setDate(d.getDate() + remaining);
  const iso = d.toISOString().slice(0, 10);
  return `Activates around ${iso} (${remaining} more day${remaining === 1 ? "" : "s"} of data needed).`;
}

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  marginBottom: 16,
};
const cardHeader: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
};
const cardBody: React.CSSProperties = { padding: "16px 20px" };
const monoSm: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-dim)",
};

function priorityFor(pct: number, raw: string | null, group?: string): "OK" | "WARN" | "BREACH" {
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "BREACH" || u === "WARN" || u === "OK") return u as any;
  const caps = group ? capsForGroup(group) : { warn: DEFAULT_WARN_PCT, breach: DEFAULT_BREACH_PCT };
  if (pct >= caps.breach) return "BREACH";
  if (pct >= caps.warn) return "WARN";
  return "OK";
}

function priorityIcon(p: "OK" | "WARN" | "BREACH") {
  return p === "BREACH" ? "🔴" : p === "WARN" ? "🟡" : "✅";
}

function priorityWash(p: "OK" | "WARN" | "BREACH") {
  if (p === "BREACH") return "rgba(239,68,68,0.10)";
  if (p === "WARN") return "rgba(245,158,11,0.10)";
  return "transparent";
}

export default function DriversTab({ holdings }: Props) {
  const { latest, latestDate, history, distinctDays, loading, error } = useFactorGroupWeights();

  const rowsByGroup = useMemo(() => {
    const m = new Map<string, { current_pct: number; mv_gbp: number | null; priority: string | null }>();
    for (const r of latest) m.set(r.factor_group, { current_pct: r.current_pct, mv_gbp: r.mv_gbp, priority: r.priority });
    return m;
  }, [latest]);

  const allGroups = useMemo(() => {
    const set = new Set<string>(FACTOR_GROUP_VALUES as readonly string[]);
    latest.forEach((r) => set.add(r.factor_group));
    return Array.from(set);
  }, [latest]);

  const sortedGroups = useMemo(() => {
    return [...allGroups].sort((a, b) => {
      const av = rowsByGroup.get(a)?.current_pct ?? 0;
      const bv = rowsByGroup.get(b)?.current_pct ?? 0;
      return bv - av;
    });
  }, [allGroups, rowsByGroup]);

  const { nBreach, nWarn, nOk } = useMemo(() => {
    let b = 0, w = 0, o = 0;
    sortedGroups.forEach((g) => {
      const row = rowsByGroup.get(g);
      if (!row) return;
      const p = priorityFor(row.current_pct, row.priority, g);
      if (p === "BREACH") b++;
      else if (p === "WARN") w++;
      else o++;
    });
    return { nBreach: b, nWarn: w, nOk: o };
  }, [sortedGroups, rowsByGroup]);

  // Holdings grouped by FACTOR_GROUP (HELD only)
  const holdingsByGroup = useMemo(() => {
    const m = new Map<string, LiveHolding[]>();
    for (const h of holdings) {
      const g = String((h as any).factor_group ?? "").trim().toUpperCase();
      if (!g) continue;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(h);
    }
    for (const [k, arr] of m) {
      arr.sort((a, b) => (Number((b as any).aum_pct ?? 0) - Number((a as any).aum_pct ?? 0)));
    }
    return m;
  }, [holdings]);

  // Trend data
  const trendByGroup = useMemo(() => {
    const m = new Map<string, { date: string; pct: number }[]>();
    for (const r of history) {
      if (!m.has(r.factor_group)) m.set(r.factor_group, []);
      m.get(r.factor_group)!.push({ date: r.snapshot_date, pct: r.current_pct });
    }
    return m;
  }, [history]);

  const trendDates = useMemo(() => {
    return Array.from(new Set(history.map((r) => r.snapshot_date))).sort();
  }, [history]);

  const maxBarPct = Math.max(BREACH_PCT + 5, ...sortedGroups.map((g) => rowsByGroup.get(g)?.current_pct ?? 0));

  // Heatmap: derive layer order dynamically from holdings, with a preferred order overlay.
  const PREFERRED_LAYER_ORDER = ["Anchor", "Core", "Satellite", "Spec", "Hedge", "Cash"];
  const layerOrder = useMemo(() => {
    const present = new Set<string>();
    for (const h of holdings) {
      const l = String((h as any).layer ?? "").trim();
      if (l) present.add(l);
    }
    const preferred = PREFERRED_LAYER_ORDER.filter((l) => present.has(l));
    const extras = Array.from(present).filter((l) => !PREFERRED_LAYER_ORDER.includes(l)).sort();
    return [...preferred, ...extras];
  }, [holdings]);

  // Matrix: { [driver]: { [layer]: { aum: number, count: number } } }
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, { aum: number; count: number }>>();
    for (const h of holdings) {
      const g = String((h as any).factor_group ?? "").trim().toUpperCase();
      const l = String((h as any).layer ?? "").trim();
      if (!g || !l) continue;
      if (!m.has(g)) m.set(g, new Map());
      const lm = m.get(g)!;
      const cell = lm.get(l) ?? { aum: 0, count: 0 };
      cell.aum += Number((h as any).aum_pct ?? 0);
      cell.count += 1;
      lm.set(l, cell);
    }
    return m;
  }, [holdings]);

  // Cap-tightening: per-driver drawdown series + portfolio drawdown proxy
  const tightening = useMemo(() => {
    if (distinctDays < 14) return null;
    const dates = trendDates;
    const groups = Array.from(trendByGroup.keys());
    const ddByGroup = new Map<string, number[]>();
    for (const g of groups) {
      const series = trendByGroup.get(g)!.slice().sort((a, b) => a.date.localeCompare(b.date));
      const byDate = new Map(series.map((p) => [p.date, p.pct]));
      let peak = -Infinity;
      const dd: number[] = [];
      for (const d of dates) {
        const v = byDate.get(d);
        if (v == null) { dd.push(NaN); continue; }
        peak = Math.max(peak, v);
        dd.push(peak > 0 ? ((peak - v) / peak) * 100 : 0); // pp
      }
      ddByGroup.set(g, dd);
    }
    // Portfolio drawdown proxy: weight per-driver dd by latest current_pct
    const totalLatest = Array.from(rowsByGroup.values()).reduce((s, r) => s + (r.current_pct || 0), 0) || 1;
    const portfolioDd: number[] = dates.map((_, i) => {
      let acc = 0, wsum = 0;
      for (const g of groups) {
        const v = ddByGroup.get(g)![i];
        if (!isFinite(v)) continue;
        const w = (rowsByGroup.get(g)?.current_pct ?? 0) / totalLatest;
        acc += v * w;
        wsum += w;
      }
      return wsum > 0 ? acc / wsum : 0;
    });
    const flagged: { group: string; driverDd: number; portfolioDd: number; delta: number; latest: number }[] = [];
    const allRows: { group: string; driverDd: number; portfolioDd: number; delta: number; latest: number; isFlagged: boolean }[] = [];
    const lastIdx = dates.length - 1;
    for (const g of groups) {
      const driverDd = ddByGroup.get(g)![lastIdx] ?? 0;
      const pDd = portfolioDd[lastIdx] ?? 0;
      const latest = rowsByGroup.get(g)?.current_pct ?? 0;
      const delta = driverDd - pDd;
      const isFlagged = delta >= TIGHTEN_DELTA_PP && latest >= TIGHTEN_MIN_LATEST_PCT;
      const row = { group: g, driverDd, portfolioDd: pDd, delta, latest, isFlagged };
      allRows.push(row);
      if (isFlagged) flagged.push(row);
    }
    allRows.sort((a, b) => b.delta - a.delta);
    return { dates, groups, ddByGroup, portfolioDd, allRows, flagged };
  }, [distinctDays, trendDates, trendByGroup, rowsByGroup]);

  const [heatMetric, setHeatMetric] = useState<"aum" | "count">("aum");

  if (loading) {
    return (
      <div style={{ padding: "24px var(--app-px, 40px)", ...monoSm }}>Loading driver concentration…</div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: "24px var(--app-px, 40px)", color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        Error loading driver weights: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px var(--app-px, 40px) 40px" }}>
      {/* SECTION 1: Bar chart */}
      <section style={card}>
        <div style={cardHeader}>
          <div style={cardTitle}>Driver Concentration</div>
          <div style={{ ...monoSm, marginTop: 4 }}>
            Rule #13 · Cap 40%/35% · AI_INFRA tighter 35%/30% · As of {latestDate ?? "—"}
          </div>
        </div>
        <div style={cardBody}>
          {sortedGroups.length === 0 ? (
            <div style={monoSm}>No driver weight rows for the latest snapshot.</div>
          ) : (
            <DriverBars groups={sortedGroups} rowsByGroup={rowsByGroup} maxPct={maxBarPct} />
          )}
          <div style={{ ...monoSm, marginTop: 14 }}>
            Driver concentration as of {latestDate ?? "—"} — {nBreach} breach, {nWarn} warn, {nOk} ok
          </div>
        </div>
      </section>

      {/* SECTION 1b: Driver × Layer heatmap */}
      <section style={card}>
        <div style={cardHeader}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={cardTitle}>Driver × Layer Matrix</div>
              <div style={{ ...monoSm, marginTop: 4 }}>
                Cells = {heatMetric === "aum" ? "AUM% per (driver, layer) pair" : "position count per (driver, layer) pair"}
              </div>
            </div>
            <div style={{ display: "inline-flex", border: "1px solid var(--rim)", borderRadius: 2, overflow: "hidden" }}>
              {(["aum", "count"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setHeatMetric(m)}
                  style={{
                    padding: "5px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    background: heatMetric === m ? "var(--gold)" : "transparent",
                    color: heatMetric === m ? "#0a0a1a" : "var(--text-mid)",
                    border: "none",
                  }}
                >
                  {m === "aum" ? "AUM %" : "Count"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={cardBody}>
          {layerOrder.length === 0 || sortedGroups.length === 0 ? (
            <div style={monoSm}>No holdings data to render matrix.</div>
          ) : (
            <DriverLayerHeatmap
              groups={sortedGroups}
              layers={layerOrder}
              matrix={matrix}
              metric={heatMetric}
            />
          )}
        </div>
      </section>
      <section style={card}>
        <div style={cardHeader}>
          <div style={cardTitle}>Driver Headroom</div>
        </div>
        <div style={{ ...cardBody, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {sortedGroups.map((g) => {
            const row = rowsByGroup.get(g);
            const pct = row?.current_pct ?? 0;
            const p = priorityFor(pct, row?.priority ?? null, g);
            const color = FACTOR_GROUP_COLORS[g] ?? "#8a8a9a";
            const caps = capsForGroup(g);
            const headroom = Math.max(0, caps.breach - pct);
            return (
              <div
                key={g}
                style={{
                  border: "1px solid var(--rim)",
                  background: priorityWash(p),
                  padding: 12,
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    padding: "3px 8px",
                    borderRadius: 2,
                    background: `color-mix(in srgb, ${color} 22%, transparent)`,
                    color,
                    border: `1px solid color-mix(in srgb, ${color} 50%, transparent)`,
                  }}
                >
                  {g.replace(/_/g, " ")}
                </div>
                <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--gold)", fontWeight: 700 }}>
                  {pct.toFixed(2)}%
                </div>
                <div style={{ ...monoSm, marginTop: 4 }}>
                  {headroom.toFixed(2)}pp to {caps.breach}% cap {priorityIcon(p)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: 30-Day Trend */}
      <section style={card}>
        <div style={cardHeader}>
          <div style={cardTitle}>30-Day Driver Trend</div>
        </div>
        <div style={cardBody}>
          {distinctDays < 14 ? (
            <div style={monoSm}>
              Driver trend monitor activates once 14 days of data is available. Currently {distinctDays} day{distinctDays === 1 ? "" : "s"} collected. {activationHint(distinctDays)}
            </div>
          ) : (
            <DriverTrendChart dates={trendDates} byGroup={trendByGroup} />
          )}
        </div>
      </section>

      {/* SECTION 3b: Cap-Tightening Monitor */}
      <section style={card}>
        <div style={cardHeader}>
          <div style={cardTitle}>Cap-Tightening Monitor (40 → 35)</div>
          <div style={{ ...monoSm, marginTop: 4 }}>
            Flag = driver drawdown exceeds portfolio drawdown by ≥{TIGHTEN_DELTA_PP}pp while sitting ≥{TIGHTEN_MIN_LATEST_PCT}% AUM.
          </div>
        </div>
        <div style={cardBody}>
          {!tightening ? (
            <div style={monoSm}>
              Cap-tightening monitor activates once 14 days of data is available. Currently {distinctDays} day{distinctDays === 1 ? "" : "s"} collected. {activationHint(distinctDays)}
            </div>
          ) : (
            <CapTighteningPanel data={tightening} />
          )}
        </div>
      </section>

      {/* SECTION 4: Holdings by Driver */}
      <section style={card}>
        <div style={cardHeader}>
          <div style={cardTitle}>Holdings by Driver</div>
        </div>
        <div style={cardBody}>
          {sortedGroups.map((g) => (
            <DriverHoldingsRow
              key={g}
              group={g}
              positions={holdingsByGroup.get(g) ?? []}
              currentPct={rowsByGroup.get(g)?.current_pct ?? 0}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DriverBars({
  groups, rowsByGroup, maxPct,
}: {
  groups: string[];
  rowsByGroup: Map<string, { current_pct: number; mv_gbp: number | null; priority: string | null }>;
  maxPct: number;
}) {
  const labelWidth = 170;
  const valueWidth = 70;
  const warnLeft = `calc(${labelWidth}px + (100% - ${labelWidth + valueWidth}px) * ${WARN_PCT / maxPct})`;
  const breachLeft = `calc(${labelWidth}px + (100% - ${labelWidth + valueWidth}px) * ${BREACH_PCT / maxPct})`;

  return (
    <div style={{ position: "relative" }}>
      {/* Reference lines */}
      <div style={{
        position: "absolute", top: 0, bottom: 22, width: 0,
        left: warnLeft,
        borderLeft: "1px dashed #f59e0b",
        zIndex: 1,
      }} />
      <div style={{
        position: "absolute", top: 0, bottom: 22, width: 0,
        left: breachLeft,
        borderLeft: "1px solid #ef4444",
        zIndex: 1,
      }} />

      {groups.map((g) => {
        const row = rowsByGroup.get(g);
        const pct = row?.current_pct ?? 0;
        const p = priorityFor(pct, row?.priority ?? null, g);
        const color = FACTOR_GROUP_COLORS[g] ?? "#8a8a9a";
        const widthPct = Math.max(0, Math.min(100, (pct / maxPct) * 100));
        return (
          <div key={g} style={{ display: "flex", alignItems: "center", height: 28, gap: 0 }}>
            <div style={{
              width: labelWidth,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-mid)",
              letterSpacing: "0.06em",
              paddingRight: 8,
              textAlign: "right",
            }}>{g.replace(/_/g, " ")}</div>
            <div style={{
              flex: 1,
              position: "relative",
              height: 18,
              background: priorityWash(p),
              border: "1px solid var(--rim)",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${widthPct}%`,
                background: color,
                opacity: 0.85,
                transition: "width 0.3s",
              }} />
            </div>
            <div style={{
              width: valueWidth,
              textAlign: "right",
              paddingLeft: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--gold)",
            }}>{pct.toFixed(2)}%</div>
          </div>
        );
      })}

      {/* Legend below */}
      <div style={{ display: "flex", gap: 16, marginTop: 10, marginLeft: labelWidth, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
        <span><span style={{ display: "inline-block", width: 18, borderTop: "1px dashed #f59e0b", verticalAlign: "middle", marginRight: 4 }} />WARN 35%</span>
        <span><span style={{ display: "inline-block", width: 18, borderTop: "1px solid #ef4444", verticalAlign: "middle", marginRight: 4 }} />BREACH 40%</span>
      </div>
    </div>
  );
}

function DriverTrendChart({
  dates, byGroup,
}: {
  dates: string[];
  byGroup: Map<string, { date: string; pct: number }[]>;
}) {
  const W = 720, H = 260, padL = 36, padR = 12, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const yMax = 50;
  const xFor = (i: number) => padL + (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const yFor = (pct: number) => padT + innerH - (Math.max(0, Math.min(yMax, pct)) / yMax) * innerH;

  const dateIdx = new Map(dates.map((d, i) => [d, i]));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block", maxWidth: "100%" }}>
        {/* Y grid */}
        {[0, 10, 20, 30, 40, 50].map((y) => (
          <g key={y}>
            <line x1={padL} x2={W - padR} y1={yFor(y)} y2={yFor(y)} stroke="var(--rim)" strokeWidth={0.5} />
            <text x={padL - 6} y={yFor(y) + 3} textAnchor="end" fontSize={9} fill="var(--text-dim)" fontFamily="var(--font-mono)">{y}%</text>
          </g>
        ))}
        {/* WARN/BREACH lines */}
        <line x1={padL} x2={W - padR} y1={yFor(WARN_PCT)} y2={yFor(WARN_PCT)} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} />
        <line x1={padL} x2={W - padR} y1={yFor(BREACH_PCT)} y2={yFor(BREACH_PCT)} stroke="#ef4444" strokeWidth={1} />

        {/* Lines per group */}
        {Array.from(byGroup.entries()).map(([g, points]) => {
          const color = FACTOR_GROUP_COLORS[g] ?? "#8a8a9a";
          const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
          const path = sorted.map((p, i) => {
            const idx = dateIdx.get(p.date) ?? i;
            return `${i === 0 ? "M" : "L"}${xFor(idx).toFixed(1)},${yFor(p.pct).toFixed(1)}`;
          }).join(" ");
          return (
            <g key={g}>
              <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
              {sorted.map((p, i) => (
                <circle key={i} cx={xFor(dateIdx.get(p.date) ?? i)} cy={yFor(p.pct)} r={1.6} fill={color}>
                  <title>{`${g} · ${p.date} · ${p.pct.toFixed(2)}%`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {/* X labels: first / mid / last */}
        {dates.length > 0 && [0, Math.floor(dates.length / 2), dates.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((idx) => (
          <text key={idx} x={xFor(idx)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--text-dim)" fontFamily="var(--font-mono)">{dates[idx].slice(5)}</text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        {Array.from(byGroup.keys()).map((g) => (
          <div key={g} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-mid)" }}>
            <span style={{ display: "inline-block", width: 14, height: 2, background: FACTOR_GROUP_COLORS[g] ?? "#8a8a9a" }} />
            {g.replace(/_/g, " ")}
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverHoldingsRow({
  group, positions, currentPct,
}: {
  group: string;
  positions: LiveHolding[];
  currentPct: number;
}) {
  const [open, setOpen] = useState(false);
  const color = FACTOR_GROUP_COLORS[group] ?? "#8a8a9a";

  return (
    <div style={{ borderBottom: "1px solid var(--rim)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "10px 0", background: "none", border: "none",
          cursor: "pointer", color: "var(--text-mid)", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", width: 10 }}>{open ? "▾" : "▸"}</span>
          <DriverChip value={group} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            {positions.length} position{positions.length === 1 ? "" : "s"}
          </span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>{currentPct.toFixed(2)}%</span>
      </button>
      {open && (
        <div style={{ padding: "4px 0 14px" }}>
          {positions.length === 0 ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", padding: "6px 0 6px 22px" }}>
              {group === "AGRI_INPUTS"
                ? "No held positions in this driver. CF Industries queued post-Q1 print."
                : "No held positions in this driver."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  <th style={th}>Ticker</th>
                  <th style={th}>Name</th>
                  <th style={{ ...th, textAlign: "right" }}>AUM%</th>
                  <th style={th}>Stack</th>
                  <th style={th}>L-band</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((h) => (
                  <tr key={`${h.ticker}-${(h as any).account ?? ""}`} style={{ borderTop: "1px solid var(--rim)" }}>
                    <td style={td}>{h.ticker}</td>
                    <td style={{ ...td, color: "var(--text-mid)" }}>{(h as any).name ?? ""}</td>
                    <td style={{ ...td, textAlign: "right", color: "var(--gold)" }}>{Number((h as any).aum_pct ?? 0).toFixed(2)}%</td>
                    <td style={td}><StackBadge value={(h as any).stack_layer} /></td>
                    <td style={td}>{(h as any).substrate_level || "—"}</td>
                    <td style={td}>{(h as any).action || "HOLD"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", fontWeight: 400 };
const td: React.CSSProperties = { padding: "6px 8px", color: "var(--text-mid)" };

function DriverLayerHeatmap({
  groups, layers, matrix, metric,
}: {
  groups: string[];
  layers: string[];
  matrix: Map<string, Map<string, { aum: number; count: number }>>;
  metric: "aum" | "count";
}) {
  const labelW = 160;
  const cellMin = 80;
  const colTotals: Record<string, { aum: number; count: number }> = {};
  layers.forEach((l) => (colTotals[l] = { aum: 0, count: 0 }));
  const rowTotals = new Map<string, { aum: number; count: number }>();
  groups.forEach((g) => rowTotals.set(g, { aum: 0, count: 0 }));
  for (const g of groups) {
    const lm = matrix.get(g);
    if (!lm) continue;
    for (const l of layers) {
      const c = lm.get(l);
      if (!c) continue;
      colTotals[l].aum += c.aum;
      colTotals[l].count += c.count;
      const rt = rowTotals.get(g)!;
      rt.aum += c.aum;
      rt.count += c.count;
    }
  }

  const fmt = (c: { aum: number; count: number } | undefined) =>
    !c ? "" : metric === "aum" ? `${c.aum.toFixed(1)}%` : String(c.count);
  const intensity = (c: { aum: number; count: number } | undefined) => {
    if (!c) return 0;
    return metric === "aum" ? Math.min(1, c.aum / 15) : Math.min(1, c.count / 5);
  };

  const cellStyle: React.CSSProperties = {
    minWidth: cellMin,
    padding: "8px 10px",
    textAlign: "center",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    border: "1px solid var(--rim)",
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    fontWeight: 400,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: labelW + (layers.length + 1) * cellMin }}>
        <thead>
          <tr>
            <th style={{ ...headStyle, minWidth: labelW, textAlign: "left" }}>Driver \ Layer</th>
            {layers.map((l) => <th key={l} style={headStyle}>{l}</th>)}
            <th style={{ ...headStyle, color: "var(--gold)" }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const color = FACTOR_GROUP_COLORS[g] ?? "#8a8a9a";
            const lm = matrix.get(g);
            const rt = rowTotals.get(g)!;
            return (
              <tr key={g}>
                <td style={{ ...cellStyle, textAlign: "left", fontSize: 10 }}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 6px",
                    background: `color-mix(in srgb, ${color} 22%, transparent)`,
                    color,
                    border: `1px solid color-mix(in srgb, ${color} 50%, transparent)`,
                    fontSize: 9,
                    letterSpacing: "0.06em",
                  }}>{g.replace(/_/g, " ")}</span>
                </td>
                {layers.map((l) => {
                  const c = lm?.get(l);
                  const op = intensity(c);
                  return (
                    <td
                      key={l}
                      title={c ? `${g} · ${l} · ${c.count} position${c.count === 1 ? "" : "s"} · ${c.aum.toFixed(2)}% AUM` : `${g} · ${l} · empty`}
                      style={{
                        ...cellStyle,
                        background: c ? `color-mix(in srgb, ${color} ${Math.round(op * 70)}%, transparent)` : "transparent",
                        color: c ? "var(--gold)" : "var(--text-dim)",
                      }}
                    >
                      {c ? fmt(c) : "·"}
                    </td>
                  );
                })}
                <td style={{ ...cellStyle, color: "var(--gold)" }}>
                  {metric === "aum" ? `${rt.aum.toFixed(1)}%` : rt.count}
                </td>
              </tr>
            );
          })}
          <tr>
            <td style={{ ...headStyle, textAlign: "left", color: "var(--gold)" }}>TOTAL</td>
            {layers.map((l) => {
              const c = colTotals[l];
              return (
                <td key={l} style={{ ...cellStyle, color: "var(--gold)" }}>
                  {metric === "aum" ? `${c.aum.toFixed(1)}%` : c.count}
                </td>
              );
            })}
            <td style={{ ...cellStyle, color: "var(--gold)" }}>
              {metric === "aum"
                ? `${groups.reduce((s, g) => s + (rowTotals.get(g)?.aum ?? 0), 0).toFixed(1)}%`
                : groups.reduce((s, g) => s + (rowTotals.get(g)?.count ?? 0), 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface TighteningData {
  dates: string[];
  groups: string[];
  ddByGroup: Map<string, number[]>;
  portfolioDd: number[];
  allRows: { group: string; driverDd: number; portfolioDd: number; delta: number; latest: number; isFlagged: boolean }[];
  flagged: { group: string; driverDd: number; portfolioDd: number; delta: number; latest: number }[];
}

function CapTighteningPanel({ data }: { data: TighteningData }) {
  const { dates, groups, ddByGroup, portfolioDd, allRows, flagged } = data;
  const W = 520, H = 220, padL = 36, padR = 12, padT = 10, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allDd = [...portfolioDd, ...Array.from(ddByGroup.values()).flat()].filter((v) => isFinite(v));
  const yMax = Math.max(10, Math.ceil((Math.max(...allDd, 1) + 2) / 5) * 5);
  const xFor = (i: number) => padL + (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const yFor = (v: number) => padT + innerH - (Math.max(0, Math.min(yMax, v)) / yMax) * innerH;
  const monoSmLocal: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.1fr) minmax(280px, 1fr)", gap: 20, alignItems: "start" }}>
      <div style={{ overflowX: "auto" }}>
        <svg width={W} height={H} style={{ display: "block", maxWidth: "100%" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = yMax * f;
            return (
              <g key={f}>
                <line x1={padL} x2={W - padR} y1={yFor(v)} y2={yFor(v)} stroke="var(--rim)" strokeWidth={0.5} />
                <text x={padL - 4} y={yFor(v) + 3} textAnchor="end" fontSize={9} fill="var(--text-dim)" fontFamily="var(--font-mono)">{v.toFixed(0)}pp</text>
              </g>
            );
          })}
          {groups.map((g) => {
            const color = FACTOR_GROUP_COLORS[g] ?? "#8a8a9a";
            const series = ddByGroup.get(g)!;
            const path = series.map((v, i) => isFinite(v) ? `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}` : "").join(" ");
            return <path key={g} d={path} fill="none" stroke={color} strokeWidth={1} opacity={0.55} />;
          })}
          <path
            d={portfolioDd.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke="#c9a84c"
            strokeWidth={2.2}
          />
          {dates.length > 0 && [0, Math.floor(dates.length / 2), dates.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((idx) => (
            <text key={idx} x={xFor(idx)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--text-dim)" fontFamily="var(--font-mono)">{dates[idx].slice(5)}</text>
          ))}
        </svg>
        <div style={{ ...monoSmLocal, marginTop: 6 }}>
          Gold line = portfolio drawdown (weighted avg across drivers). Coloured lines = per-driver drawdown.
        </div>
      </div>

      <div>
        <div style={{ ...monoSmLocal, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          {flagged.length} flagged · {allRows.length} drivers
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 10 }}>
          <thead>
            <tr style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <th style={{ ...th, textAlign: "left" }}>Driver</th>
              <th style={{ ...th, textAlign: "right" }}>Driver DD</th>
              <th style={{ ...th, textAlign: "right" }}>Port. DD</th>
              <th style={{ ...th, textAlign: "right" }}>Δ</th>
              <th style={{ ...th, textAlign: "right" }}>Latest</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((r) => (
              <tr key={r.group} style={{ borderTop: "1px solid var(--rim)", color: r.isFlagged ? "#ef4444" : "var(--text-dim)" }}>
                <td style={td}>{r.isFlagged ? "🔴 " : ""}{r.group.replace(/_/g, " ")}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.driverDd.toFixed(1)}pp</td>
                <td style={{ ...td, textAlign: "right" }}>{r.portfolioDd.toFixed(1)}pp</td>
                <td style={{ ...td, textAlign: "right", color: r.isFlagged ? "#ef4444" : undefined }}>{r.delta >= 0 ? "+" : ""}{r.delta.toFixed(1)}pp</td>
                <td style={{ ...td, textAlign: "right" }}>{r.latest.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
