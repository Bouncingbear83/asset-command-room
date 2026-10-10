import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Chip, ChipGroup } from "@/components/shared/filters";
import { WatchlistCard, type DerivedRow } from "./WatchlistCard";
import { BAND_CHIPS, matchesChip, normBand, normStatusToken, distToTriggerPct, defaultChip, type BandChip } from "@/lib/watchlistBands";

interface GateRow { ticker: string; action_type: string; due_date: string; summary: string }

/** Earliest OPEN CATALYST_WATCH / EARNINGS_GATE row per ticker. */
function useGateRows() {
  const [rows, setRows] = useState<GateRow[]>([]);
  useEffect(() => {
    (supabase as any).from("action_tracker").select("ticker,action_type,due_date,summary")
      .eq("status", "OPEN").in("action_type", ["CATALYST_WATCH", "EARNINGS_GATE"]).order("due_date", { ascending: true })
      .then(({ data }: { data: GateRow[] | null }) => setRows(data ?? []));
  }, []);
  return useMemo(() => {
    const m = new Map<string, GateRow>();
    for (const r of rows) { const t = (r.ticker || "").toUpperCase(); if (t && !m.has(t)) m.set(t, r); }
    return m;
  }, [rows]);
}

const BAND_COLOR: Record<string, string> = {
  ZONE: "var(--green)", NEAR: "var(--gold)", BENCH: "var(--text-mid)", STALE: "var(--amber)",
  NO_LEVEL: "var(--text-dim)", UNIT_CHECK: "var(--amber)", ERROR: "var(--red)", "": "var(--text-dim)",
};
const mono = (size: number, color: string) => ({ fontFamily: "var(--font-mono)", fontSize: size, color, letterSpacing: "0.1em" });

interface Props {
  rows: DerivedRow[];
  chip: BandChip | null;
  onChip: (c: BandChip) => void;
  actionCounts: Record<string, number>;
  onActionClick: (t: string) => void;
}

export default function BandChipView({ rows, chip, onChip, actionCounts, onActionClick }: Props) {
  const gates = useGateRows();
  const counts = useMemo(() => {
    const c = Object.fromEntries(BAND_CHIPS.map((b) => [b.key, 0])) as Record<BandChip, number>;
    for (const r of rows) for (const b of BAND_CHIPS) if (matchesChip(b.key, r.item.status, (r.item as any).band)) c[b.key]++;
    return c;
  }, [rows]);
  const active = chip ?? defaultChip(counts);

  const list = useMemo(() => {
    if (active === "ALL") return [];
    return rows
      .filter((r) => matchesChip(active, r.item.status, (r.item as any).band))
      .map((r) => ({ r, dist: distToTriggerPct(r.currentPrice ?? r.item.current, r.item.triggerPriceNumeric) }))
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
  }, [rows, active]);

  return (
    <div style={{ marginBottom: 14 }}>
      <ChipGroup ariaLabel="Band filter">
        {BAND_CHIPS.map((b) => (
          <Chip key={b.key} label={b.label} count={counts[b.key]} active={active === b.key} onClick={() => onChip(b.key)} />
        ))}
      </ChipGroup>
      {active !== "ALL" && (
        <div style={{ marginTop: 10, border: "1px solid var(--rim)", background: "var(--panel)" }}>
          {list.length === 0 && <div style={{ ...mono(10, "var(--text-dim)"), padding: "12px 14px" }}>No names in this band</div>}
          {list.map(({ r, dist }) => {
            const t = (r.item.ticker || "").toUpperCase();
            const band = normBand((r.item as any).band);
            const isEvent = normStatusToken(r.item.status).startsWith("WAIT_EVENT");
            const gate = gates.get(t);
            return (
              <div key={`band-${t}`}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 14px 0", flexWrap: "wrap" }}>
                  <span style={{ ...mono(8, BAND_COLOR[band]), border: `1px solid ${BAND_COLOR[band]}`, padding: "1px 6px", borderRadius: 2 }}>{band || "—"}</span>
                  <span style={mono(9, dist == null ? "var(--text-dim)" : dist <= 0 ? "var(--green)" : "var(--text-mid)")}>
                    {dist == null ? "no trigger" : `${dist > 0 ? "+" : ""}${dist.toFixed(1)}% vs trigger`}
                  </span>
                  {isEvent && (gate
                    ? <span style={mono(9, "var(--text-mid)")}>{gate.action_type.replace("_", " ")} · due {gate.due_date}</span>
                    : <span style={mono(9, "var(--amber)")}>No dated event</span>)}
                </div>
                <WatchlistCard row={r} variant="compact" actionCount={actionCounts[t] || 0} onActionClick={onActionClick} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
