import { useEffect, useMemo, useState } from "react";
import { TickerLabel, NamedText } from "@/components/shared/TickerLabel";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import type { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem, LiveScore } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import TickerButton from "@/components/factsheet/TickerButton";
import { useActionTracker } from "@/components/actions/useActionTracker";
import { computeGmStats } from "@/components/command/GmExposureChip";
import { buildSurface, type Candidate, type Severity, type Surface } from "@/lib/actionSurface";
import { DECIDE_CAP, WATCH_WAKE_PCT } from "@/config/signalRules";
import EarningsVerdictCard from "@/components/EarningsVerdictCard";
import { supabase } from "@/integrations/supabase/client";
import { proxyWebhook } from "@/lib/ownerFunction";
import { openVaultNote } from "@/lib/navigate";

/**
 * Action Surface (spec v1) — Command tab.
 * DECIDE (max 10, expanded) · PREPARE (collapsed) · WATCH + MISSED as one-line counters.
 * BACKLOG lives on the Actions tab only.
 */

const SEV: Record<Severity, { color: string; bg: string; emoji: string }> = {
  RED: { color: "var(--red)", bg: "var(--red-dim)", emoji: "🔴" },
  AMBER: { color: "var(--amber)", bg: "var(--amber-dim)", emoji: "🟡" },
  GREY: { color: "var(--text-dim)", bg: "rgba(102,102,102,0.08)", emoji: "⚪" },
};

/** Mark-done rows written to action_tracker for derived (non-tracker) cards. */
const SURFACE_PREFIX = "SURFACE:";
const BASELINE_KEY = "stellar.actionSurface.sharesBaseline.v1";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function load<T>(k: string, fb: T): T {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
}

const mono = (size: number, color = "var(--text-mid)"): React.CSSProperties => ({ fontFamily: "var(--font-mono)", fontSize: size, color });

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  earnings: LiveEarningsCalendarItem[];
  scores?: LiveScore[];
  transactions?: { ticker: string; account?: string; date: string; action: string }[];
  /** R29 — HOLDINGS E62:E64; null = cash block failed (not evaluated). */
  cashBySleeve?: { SIPP: number | null; ISA: number | null; Bordier: number | null } | null;
  /** R30 — HOLDINGS E65 vs CASH ledger; null = a source failed (not evaluated). */
  cashRecon?: { e65: number | null; ledgerTotal: number | null } | null;
  /** Lets the Command tab feed the Doctrine strip from the same surface. */
  onSurface?: (s: Surface) => void;
}

export default function ActionInbox({ holdings, watchlist, earnings, scores = [], transactions = [], cashBySleeve = null, cashRecon = null, onSurface }: Props) {
  const isMobile = useIsMobile();
  const today = todayISO();
  const tracker = useActionTracker({ watchlist, holdings, earnings, scores });
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [prepOpen, setPrepOpen] = useState(false);
  // Done state lives in action_tracker (status CONFIRMED). Optimistic set covers the refetch gap.
  const [pendingDone, setPendingDone] = useState<Record<string, true>>({});

  // R16 — remember SHARES when a limit order is first seen, so a change clears the card.
  const [baseline, setBaseline] = useState<Record<string, number>>(() => load(BASELINE_KEY, {}));

  const gm = useMemo(() => {
    const s = computeGmStats(scores, holdings, watchlist);
    return s.total > 0 ? { aggregatePct: s.aggregatePct, deployed: s.deployed.length, staged: s.staged.length } : null;
  }, [scores, holdings, watchlist]);

  const trackerRows = useMemo(
    () => tracker.items.filter((i) => i.persisted).map((i) => ({
      id: i.id, ticker: i.ticker, action_type: i.action_type, due_date: i.due_date, summary: i.summary,
      status: i.status, priority: i.priority, layer: i.layer, source: i.source, dedupe_key: i.dedupe_key, apply_target: i.apply_target, staged_payload: i.staged_payload,
    })),
    [tracker.items],
  );

  const surface = useMemo(
    () => buildSurface({ holdings, watchlist, scores, earnings, tracker: trackerRows, today, gm, sharesBaseline: baseline, transactions, cashBySleeve, cashRecon }),
    [holdings, watchlist, scores, earnings, trackerRows, today, gm, baseline, transactions, cashBySleeve, cashRecon],
  );
  useEffect(() => { onSurface?.(surface); }, [surface, onSurface]);

  useEffect(() => {
    const next = { ...baseline };
    let changed = false;
    for (const c of surface.decide) {
      if (c.trigger_type !== "RECONCILE_FILL" || c.ticker in next) continue;
      const shares = holdings.filter((h) => h.ticker.toUpperCase() === c.ticker).reduce((s, h) => s + (h.shares || 0), 0);
      next[c.ticker] = shares; changed = true;
    }
    if (changed) { setBaseline(next); try { localStorage.setItem(BASELINE_KEY, JSON.stringify(next)); } catch { /* ignore */ } }
  }, [surface.decide, holdings, baseline]);

  // Earnings engine — briefs superseded by a verdict for the same ticker + print date.
  useEffect(() => {
    for (const id of surface.supersededBriefs) {
      void (supabase as any).from("action_tracker").update({ status: "CONFIRMED", resolution_note: "superseded by verdict", resolved_at: new Date().toISOString() })
        .eq("id", id).eq("status", "OPEN").then(() => tracker.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface.supersededBriefs.join(",")]);

  const openBrief = async (b: NonNullable<Candidate["brief"]>) => {
    if (!b.viewed) await (supabase as any).from("action_tracker").update({ staged_payload: { ...b.payload, viewed_at: new Date().toISOString() } }).eq("id", b.id);
    if (b.note_path) openVaultNote(b.note_path);
    void tracker.refresh();
  };

  const [applyAllMsg, setApplyAllMsg] = useState<string | null>(null);
  const applyAllIds = () => surface.decide.filter((c) => c.verdict && c.verdict.apply_target === "UPDATE_ROW" && c.verdict.state === "NEW").map((c) => c.verdict!.id);
  const applyAll = async () => {
    const ids = applyAllIds();
    if (!ids.length || !window.confirm(`Apply ${ids.length} staged verdicts to the sheet?`)) return;
    const res = await proxyWebhook("apply-tracker", { op: "apply_all", ids });
    const j = await res.json().catch(() => ({}));
    setApplyAllMsg(j.stale ? "Sheet changed since staging: rebuild in session" : j.error ? String(j.error) : null);
    void tracker.refresh();
  };
  const heldShares = (t: string) => holdings.filter((h) => h.ticker.toUpperCase() === t).reduce((s, h) => s + (h.shares || 0), 0);

  const surfaceKey = (c: Candidate) => `${SURFACE_PREFIX}${c.key}:${today}`;
  const doneKeys = useMemo(() => {
    const set = new Set<string>();
    for (const i of tracker.items) {
      if (i.persisted && i.status !== "OPEN" && i.dedupe_key?.startsWith(SURFACE_PREFIX)) set.add(i.dedupe_key);
    }
    return set;
  }, [tracker.items]);
  const isDone = (c: Candidate) => !!pendingDone[c.key] || doneKeys.has(surfaceKey(c));
  const decide = surface.decide.filter((c) => !isDone(c));
  const missed = surface.missed.filter((c) => !isDone(c));

  /** Resolve the card in action_tracker via the existing update path. */
  const resolveCard = async (c: Candidate, status: "CONFIRMED" | "DISMISSED", note: string) => {
    setPendingDone((m) => ({ ...m, [c.key]: true }));
    const existing = c.source_ref ? tracker.items.find((i) => i.id === c.source_ref) : undefined;
    if (existing) return tracker.resolve(existing, status, note);
    await tracker.resolve({
      id: surfaceKey(c), ticker: c.ticker && c.ticker !== "G(m)" ? c.ticker : null, name: null, layer: c.layer ?? null,
      action_type: "MANUAL", due_date: today, summary: `${c.title}${c.reasons[0] ? ` — ${c.reasons[0]}` : ""}`.slice(0, 500),
      context: c.reasons.join(" | ").slice(0, 2000), source: "MANUAL", source_ref: null, status: "OPEN",
      resolution_note: null, resolved_at: null, priority: c.severity === "RED" ? "HIGH" : c.severity === "AMBER" ? "MEDIUM" : "LOW",
      dedupe_key: surfaceKey(c), persisted: false, is_routine: false,
    } as any, status, note);
  };
  const markDone = (c: Candidate) => resolveCard(c, "CONFIRMED", `Marked done from Command · ${c.title}`);

  const closeAllMissed = async () => {
    for (const c of missed) await resolveCard(c, "DISMISSED", "Closed as missed");
  };

  /** Full holding context for the Claude deep-dive prompt. */
  const deepDiveContext = (ticker: string) => {
    const rows = holdings.filter((h) => h.ticker.toUpperCase() === ticker.toUpperCase());
    const mv = rows.reduce((s, h) => s + (h.mv || 0), 0);
    const aum = rows.reduce((s, h) => s + (h.aum_pct || 0), 0);
    const cost = rows.reduce((s, h) => s + (h.costGbp || 0), 0);
    const gl = rows.length === 1 ? rows[0].gl : cost > 0 ? ((mv - cost) / cost) * 100 : null;
    const first = rows[0];
    return {
      ticker,
      mv: rows.length ? Math.round(mv).toLocaleString("en-GB") : "n/a (not held)",
      aum_pct: rows.length ? aum.toFixed(2) : "0",
      gl_pct: gl == null || !Number.isFinite(gl) ? "n/a" : gl.toFixed(1),
      add_trigger: first?.add_trigger || "none",
      exit_trigger: first?.exit_trigger || "none",
    };
  };

  const mp = isMobile ? "10px 12px" : "14px 20px";
  const urgent = decide.filter((c) => c.severity === "RED").length;

  const renderCard = (c: Candidate) => {
    const s = SEV[c.severity];
    const isOpen = !!open[c.key];
    return (
      <div key={c.key} style={{ background: s.bg, border: "1px solid var(--rim)", borderLeft: `3px solid ${s.color}`, borderRadius: 2 }}>
        <div
          onClick={() => setOpen((o) => ({ ...o, [c.key]: !o[c.key] }))}
          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "auto auto auto 1fr auto", gap: isMobile ? 6 : 14, alignItems: "center", padding: "10px 14px", cursor: "pointer" }}
        >
          {!isMobile && <span style={{ color: "var(--text-dim)" }}>{isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: isMobile ? 0 : 90 }}>
            <span style={{ fontSize: 12 }}>{s.emoji}</span>
            {c.ticker && c.ticker !== "G(m)" ? (
              <TickerButton ticker={c.ticker} style={{ ...mono(12, "var(--gold)"), fontWeight: 700 }}><TickerLabel ticker={c.ticker} plain /></TickerButton>
            ) : (
              <span style={{ ...mono(12, "var(--gold)"), fontWeight: 700 }}>{c.ticker ? <TickerLabel ticker={c.ticker} plain /> : "—"}</span>
            )}
            {c.accounts.length > 0 && <span style={{ ...mono(8, "var(--text-dim)"), letterSpacing: "0.1em" }}>{c.accounts.join(" · ")}</span>}
          </div>
          <span style={{ ...mono(8, s.color), letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`, borderRadius: 2, whiteSpace: "nowrap", justifySelf: "start" }}>
            <NamedText text={c.title} />
          </span>
          <span style={{ ...mono(10), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}><NamedText text={c.reasons[0]} /></span>
          {c.ticker && c.ticker !== "G(m)" ? (
            <div onClick={(e) => e.stopPropagation()}>
              <ClaudePromptButton templateKey="holdings_deep_dive" context={deepDiveContext(c.ticker)} stopPropagation />
            </div>
          ) : <span />}
        </div>
        {isOpen && (
          <div style={{ borderTop: "1px solid var(--rim)", padding: "12px 16px", display: "grid", gap: 6 }}>
            {c.reasons.map((r, i) => <div key={i} style={mono(11)}>• <NamedText text={r} /></div>)}
            <div style={mono(9, "var(--text-dim)")}>
              Source {c.source}{c.fired_at ? ` · fired ${c.fired_at}` : ""}{c.verdict_at ? ` · verdict ${c.verdict_at}` : ""}{c.next_review ? ` · next ${c.next_review}` : ""}
            </div>
            <button onClick={() => { void markDone(c); }} style={{ justifySelf: "end", display: "inline-flex", gap: 6, alignItems: "center", background: "transparent", border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)", color: "var(--green)", ...mono(9, "var(--green)"), letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 2, cursor: "pointer" }}>
              <Check size={11} /> Mark done
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="action-inbox" style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderLeft: `3px solid ${decide.length ? "var(--gold)" : "var(--green)"}`, marginBottom: 16, scrollMarginTop: 80 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mp, borderBottom: "1px solid var(--rim)", flexWrap: "wrap", gap: 8 }}>
        <span style={{ ...mono(10, decide.length ? "var(--gold)" : "var(--green)"), fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          {decide.length ? "⚡ Decide" : "✅ Nothing to decide"}
        </span>
        <span style={{ ...mono(9, "var(--text-dim)"), letterSpacing: "0.1em" }}>
          {applyAllIds().length > 0 && (
            <button onClick={() => void applyAll()} style={{ marginRight: 10, background: "none", border: "1px solid color-mix(in srgb, var(--green) 40%, transparent)", color: "var(--green)", ...mono(8, "var(--green)"), letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", cursor: "pointer", borderRadius: 2 }}>
              Apply {applyAllIds().length} accepted
            </button>
          )}
          {decide.length}/{DECIDE_CAP}
          {urgent > 0 && <span style={{ color: "var(--red)", marginLeft: 6 }}>· {urgent} urgent</span>}
          {surface.overflow > 0 && <span style={{ marginLeft: 6 }}>· {surface.overflow} overflow → watch</span>}
        </span>
      </div>

      <div style={{ padding: mp, display: "grid", gap: 6 }}>
        {applyAllMsg && <div style={mono(10, "var(--amber)")}>{applyAllMsg}</div>}
        {decide.map((c) => c.verdict
          ? <EarningsVerdictCard key={c.key} c={c} heldShares={heldShares(c.ticker)} onChanged={() => void tracker.refresh()} />
          : renderCard(c))}

        {/* PREPARE — collapsed */}
        <div style={{ marginTop: decide.length ? 8 : 0, border: "1px solid var(--rim)", borderRadius: 2 }}>
          <button onClick={() => setPrepOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: "8px 12px", cursor: "pointer", ...mono(9, "var(--text-mid)"), letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {prepOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Prepare · {surface.prepare.length}
          </button>
          {prepOpen && (
            <div style={{ borderTop: "1px solid var(--rim)", padding: "6px 12px", display: "grid", gap: 4 }}>
              {surface.prepare.length === 0 && <span style={mono(10, "var(--text-dim)")}>Nothing in the next 14 days</span>}
              {surface.prepare.map((c) => {
                const needsTest = c.trigger_type === "EARNINGS" || c.trigger_type === "THESIS_CHECK";
                return (
                  <div key={c.key} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "80px 70px 1fr", gap: 10, padding: "4px 0", borderBottom: "1px solid rgba(28,28,48,0.4)", alignItems: "baseline" }}>
                    <span style={mono(10, "var(--text-dim)")}>{c.next_review ?? "—"}</span>
                    <span style={{ ...mono(11, "var(--gold)"), fontWeight: 700 }}>{c.ticker ? <TickerLabel ticker={c.ticker} plain /> : "—"}</span>
                    <span style={mono(10)}>
                      <NamedText text={c.title} />
                      {needsTest && (c.gate_test
                        ? <span style={{ color: "var(--text-dim)" }}> · test: {c.gate_test.slice(0, 120)}</span>
                        : <span style={{ marginLeft: 8, color: "var(--amber)", fontSize: 8, letterSpacing: "0.1em", border: "1px solid var(--amber)", padding: "0 4px", borderRadius: 2 }}>⚠️ NO TEST</span>)}
                      {c.brief && (
                        <button onClick={() => void openBrief(c.brief!)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", padding: 0, ...mono(9, "var(--gold)") }}>
                          Open brief{c.brief.viewed ? " ✓" : ""}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* WATCH + MISSED counters */}
        <div style={{ ...mono(9, "var(--text-dim)"), letterSpacing: "0.1em", padding: "4px 2px" }}>
          👁 {surface.watchCount} watching, {surface.wakeWithin10} wake within {WATCH_WAKE_PCT}%
        </div>
        {surface.hygiene.length > 0 && (
          <a href="?tab=actions&view=hygiene" onClick={(e) => { e.preventDefault(); const p = new URLSearchParams(window.location.search); p.set("tab", "actions"); p.set("view", "hygiene"); window.history.pushState({}, "", `${window.location.pathname}?${p}`); window.dispatchEvent(new PopStateEvent("popstate")); }}
            style={{ ...mono(9, "var(--amber)"), letterSpacing: "0.1em", padding: "2px", textDecoration: "none" }}>
            🧹 {surface.hygiene.length} tracker row{surface.hygiene.length === 1 ? "" : "s"} on dead names → Actions · Hygiene
          </a>
        )}
        {missed.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, ...mono(9, "var(--amber)"), letterSpacing: "0.1em", padding: "2px" }}>
            ⏱ {missed.length} missed (&gt;3 days past due, no verdict)
            <button onClick={closeAllMissed} style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)", ...mono(8, "var(--text-dim)"), letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", cursor: "pointer", borderRadius: 2 }}>
              Close all missed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
