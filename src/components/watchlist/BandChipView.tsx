import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Chip, ChipGroup } from "@/components/shared/filters";
import { TickerLabel } from "@/components/shared/TickerLabel";
import { WatchlistCard, type DerivedRow } from "./WatchlistCard";
import { segmentRow, type SegResult, type SegTracker } from "@/lib/segmentRules";
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

/** AUTO RESET tracker rows (any status) + every OPEN row, for segment tests. */
function useSegTrackers() {
  const [rows, setRows] = useState<SegTracker[]>([]);
  useEffect(() => {
    (supabase as any).from("action_tracker")
      .select("ticker,dedupe_key,status,resolution_note,resolved_at,created_at,summary,action_type,due_date")
      .or("status.eq.OPEN,dedupe_key.ilike.AUTO:%:RESET:%").limit(5000)
      .then(({ data, error }: { data: SegTracker[] | null; error: unknown }) => {
        if (error) console.warn("[segments] action_tracker read failed", error);
        setRows(data ?? []);
      });
  }, []);
  return rows;
}

/** Recent closes for ARCHIVE+ZONE names (S3 frozen-price test). Failure → warn, skip. */
function useRecentCloses(tickers: string[]) {
  const [m, setM] = useState<Record<string, { date: string; close: number }[]>>({});
  const key = tickers.join(",");
  useEffect(() => {
    if (!tickers.length) return;
    let off = false;
    Promise.all(tickers.map((t) => supabase.rpc("get_price_series", { p_ticker: t, p_days: 14, p_max_points: 500 })
      .then(({ data, error }) => { if (error) throw error; return [t, (data ?? []) as { date: string; close: number }[]] as const; })))
      .then((pairs) => { if (!off) setM(Object.fromEntries(pairs)); })
      .catch((e) => console.warn("[segments] price history unavailable; S3 stale-price test skipped", e));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return m;
}

const SEG_CHIPS: BandChip[] = ["RESET", "DATA", "PARKED"];
const PILL: Record<string, string> = { NEW: "var(--gold)", HANDLED: "var(--green)", S1: "var(--text-dim)", S2: "var(--text-dim)", S3: "var(--amber)", HYGIENE: "var(--amber)" };

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
  const trackers = useSegTrackers();
  const [showSuppressed, setShowSuppressed] = useState(false);
  const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "segments";
  const resetTickers = useMemo(() => rows
    .filter((r) => normStatusToken(r.item.status).startsWith("ARCHIVE") && normBand((r.item as any).band) === "ZONE")
    .map((r) => r.item.ticker).filter(Boolean).sort(), [rows]);
  const closes = useRecentCloses(resetTickers);
  const segs = useMemo(() => {
    const m = new Map<DerivedRow, SegResult>();
    for (const r of rows) {
      const it = r.item as any;
      m.set(r, segmentRow({
        ticker: it.ticker, status: it.status, band: it.band, current: it.current ?? null, trigger: it.trigger ?? "",
        triggerPrice: it.triggerPriceNumeric ?? null, reviewNote: it.triggerReviewNote ?? "", currency: it.currency ?? "",
        archiveReason: it.archiveReason ?? "",
      }, trackers, closes[it.ticker]));
    }
    return m;
  }, [rows, trackers, closes]);
  const inChip = (c: BandChip, r: DerivedRow, includeSuppressed = false) => {
    if (!SEG_CHIPS.includes(c)) return matchesChip(c, r.item.status, (r.item as any).band);
    const s = segs.get(r)!;
    return s.segment === c && (includeSuppressed || !s.suppressed);
  };
  const counts = useMemo(() => {
    const c = Object.fromEntries(BAND_CHIPS.map((b) => [b.key, 0])) as Record<BandChip, number>;
    for (const r of rows) for (const b of BAND_CHIPS) if (inChip(b.key, r)) c[b.key]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, segs]);
  const segVals = [...segs.values()];
  const newCount = segVals.filter((s) => s.state === "NEW").length;
  const suppressedCount = segVals.filter((s) => s.suppressed).length;
  const active = chip ?? defaultChip(counts);

  const list = useMemo(() => {
    if (active === "ALL") return [];
    const rank = (r: DerivedRow) => { const st = segs.get(r)?.state; return st === "NEW" ? 0 : st === "HANDLED" ? 1 : 2; };
    return rows
      .filter((r) => inChip(active, r, active === "RESET" && showSuppressed))
      .map((r) => ({ r, dist: active === "RESET" ? segs.get(r)!.belowPct : distToTriggerPct(r.currentPrice ?? r.item.current, r.item.triggerPriceNumeric) }))
      .sort((a, b) => (active === "RESET" ? rank(a.r) - rank(b.r) : 0) || (a.dist ?? Infinity) - (b.dist ?? Infinity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, active, segs, showSuppressed]);

  return (
    <div style={{ marginBottom: 14 }}>
      <ChipGroup ariaLabel="Band filter">
        {BAND_CHIPS.map((b) => (
          <Chip key={b.key} label={b.key === "RESET" ? `Reset · ${newCount} new` : b.label} count={counts[b.key]} active={active === b.key} onClick={() => onChip(b.key)} />
        ))}
      </ChipGroup>
      {active === "RESET" && suppressedCount > 0 && (
        <button onClick={() => setShowSuppressed((v) => !v)} style={{ ...mono(9, "var(--text-mid)"), marginTop: 8, background: "none", border: "1px solid var(--rim)", padding: "3px 8px", cursor: "pointer" }}>
          {showSuppressed ? "Hide" : "Show"} suppressed ({suppressedCount})
        </button>
      )}
      {active !== "ALL" && (
        <div style={{ marginTop: 10, border: "1px solid var(--rim)", background: "var(--panel)" }}>
          {list.length === 0 && <div style={{ ...mono(10, "var(--text-dim)"), padding: "12px 14px" }}>No names in this band</div>}
          {list.map(({ r, dist }) => {
            const t = (r.item.ticker || "").toUpperCase();
            const band = normBand((r.item as any).band);
            const isEvent = normStatusToken(r.item.status).startsWith("WAIT_EVENT");
            const gate = gates.get(t);
            const seg = segs.get(r)!;
            const segPill = SEG_CHIPS.includes(active) && seg.state ? (
              <span style={{ ...mono(8, PILL[seg.state]), border: `1px solid ${PILL[seg.state]}`, padding: "1px 6px", borderRadius: 2 }}>
                {seg.state === "NEW" ? "RE-RUN RCIS" : seg.state === "HYGIENE" ? "DATA" : seg.state}
              </span>) : null;
            return (
              <div key={`band-${t}`}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 14px 0", flexWrap: "wrap" }}>
                  <span style={{ ...mono(8, BAND_COLOR[band]), border: `1px solid ${BAND_COLOR[band]}`, padding: "1px 6px", borderRadius: 2 }}>{band || "—"}</span>
                  <span style={mono(9, dist == null ? "var(--text-dim)" : dist <= 0 ? "var(--green)" : "var(--text-mid)")}>
                    {dist == null ? "no trigger" : `${dist > 0 ? "+" : ""}${dist.toFixed(1)}% vs trigger`}
                  </span>
                  {segPill}
                  {seg.state === "NEW" && <span style={mono(9, "var(--text-mid)")}>R5: nominate only</span>}
                  {(seg.state === "S1" || seg.state === "S2" || seg.state === "S3" || seg.state === "HYGIENE") && <span style={mono(9, "var(--text-dim)")}>{seg.reason}</span>}
                  {seg.state === "HANDLED" && seg.tracker && (
                    <span style={mono(9, "var(--text-mid)")}>due {seg.tracker.due_date ?? "—"} · {seg.tracker.dedupe_key} · {String(seg.tracker.summary ?? "").slice(0, 120)}</span>
                  )}
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
      {debug && (
        <div style={{ marginTop: 12, overflowX: "auto", border: "1px solid var(--rim)" }}>
          <table style={{ ...mono(9, "var(--text-mid)"), borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>{["ticker", "H", "AL", "state", "test matched", "reason text", "tracker key used"].map((h) => <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--rim)" }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => { const s = segs.get(r)!; return (
              <tr key={`dbg-${i}`}>{[<TickerLabel key="t" ticker={r.item.ticker} plain />, r.item.status, (r.item as any).band, s.state ?? s.segment ?? "—", s.test || "—", s.reason || "—", s.trackerKey ?? "—"].map((v, j) => <td key={j} style={{ padding: "3px 8px", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>{v}</td>)}</tr>); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
