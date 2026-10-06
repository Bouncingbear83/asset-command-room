import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import type { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem, LiveScore } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import TickerButton from "@/components/factsheet/TickerButton";
import { useActionTracker } from "@/components/actions/useActionTracker";
import { computeGmStats } from "@/components/command/GmExposureChip";
import { buildSurface, type Candidate, type Severity } from "@/lib/actionSurface";
import { DECIDE_CAP, WATCH_WAKE_PCT } from "@/config/signalRules";

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

const DONE_KEY = "stellar.actionSurface.done.v1";
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
}

export default function ActionInbox({ holdings, watchlist, earnings, scores = [] }: Props) {
  const isMobile = useIsMobile();
  const today = todayISO();
  const tracker = useActionTracker({ watchlist, holdings, earnings, scores });
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [prepOpen, setPrepOpen] = useState(false);
  const [done, setDone] = useState<Record<string, string>>(() => {
    const m = load<Record<string, string>>(DONE_KEY, {});
    return Object.fromEntries(Object.entries(m).filter(([, v]) => v === todayISO()));
  });
  useEffect(() => { try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch { /* ignore */ } }, [done]);

  // R16 — remember SHARES when a limit order is first seen, so a change clears the card.
  const [baseline, setBaseline] = useState<Record<string, number>>(() => load(BASELINE_KEY, {}));

  const gm = useMemo(() => {
    const s = computeGmStats(scores, holdings, watchlist);
    return s.total > 0 ? { aggregatePct: s.aggregatePct, deployed: s.deployed.length, staged: s.staged.length } : null;
  }, [scores, holdings, watchlist]);

  const trackerRows = useMemo(
    () => tracker.items.filter((i) => i.persisted).map((i) => ({
      id: i.id, ticker: i.ticker, action_type: i.action_type, due_date: i.due_date, summary: i.summary,
      status: i.status, priority: i.priority, layer: i.layer, source: i.source,
    })),
    [tracker.items],
  );

  const surface = useMemo(
    () => buildSurface({ holdings, watchlist, scores, earnings, tracker: trackerRows, today, gm, sharesBaseline: baseline }),
    [holdings, watchlist, scores, earnings, trackerRows, today, gm, baseline],
  );

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

  const isDone = (k: string) => done[k] === today;
  const decide = surface.decide.filter((c) => !isDone(c.key));
  const missed = surface.missed.filter((c) => !isDone(c.key));
  const markDone = (k: string) => setDone((m) => ({ ...m, [k]: today }));

  const closeAllMissed = async () => {
    for (const c of missed) {
      const item = tracker.items.find((i) => i.id === c.source_ref);
      if (item) await tracker.resolve(item, "DISMISSED", "Closed as missed");
    }
    setDone((m) => ({ ...m, ...Object.fromEntries(missed.map((c) => [c.key, today])) }));
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
              <TickerButton ticker={c.ticker} style={{ ...mono(12, "var(--gold)"), fontWeight: 700 }}>{c.ticker}</TickerButton>
            ) : (
              <span style={{ ...mono(12, "var(--gold)"), fontWeight: 700 }}>{c.ticker || "—"}</span>
            )}
            {c.accounts.length > 0 && <span style={{ ...mono(8, "var(--text-dim)"), letterSpacing: "0.1em" }}>{c.accounts.join(" · ")}</span>}
          </div>
          <span style={{ ...mono(8, s.color), letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`, borderRadius: 2, whiteSpace: "nowrap", justifySelf: "start" }}>
            {c.title}
          </span>
          <span style={{ ...mono(10), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{c.reasons[0]}</span>
          {c.ticker && c.ticker !== "G(m)" ? (
            <div onClick={(e) => e.stopPropagation()}>
              <ClaudePromptButton templateKey="holdings_deep_dive" context={{ ticker: c.ticker }} stopPropagation />
            </div>
          ) : <span />}
        </div>
        {isOpen && (
          <div style={{ borderTop: "1px solid var(--rim)", padding: "12px 16px", display: "grid", gap: 6 }}>
            {c.reasons.map((r, i) => <div key={i} style={mono(11)}>• {r}</div>)}
            <div style={mono(9, "var(--text-dim)")}>
              Source {c.source}{c.fired_at ? ` · fired ${c.fired_at}` : ""}{c.verdict_at ? ` · verdict ${c.verdict_at}` : ""}{c.next_review ? ` · next ${c.next_review}` : ""}
            </div>
            <button onClick={() => markDone(c.key)} style={{ justifySelf: "end", display: "inline-flex", gap: 6, alignItems: "center", background: "transparent", border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)", color: "var(--green)", ...mono(9, "var(--green)"), letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 2, cursor: "pointer" }}>
              <Check size={11} /> Mark done
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderLeft: `3px solid ${decide.length ? "var(--gold)" : "var(--green)"}`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mp, borderBottom: "1px solid var(--rim)", flexWrap: "wrap", gap: 8 }}>
        <span style={{ ...mono(10, decide.length ? "var(--gold)" : "var(--green)"), fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          {decide.length ? "⚡ Decide" : "✅ Nothing to decide"}
        </span>
        <span style={{ ...mono(9, "var(--text-dim)"), letterSpacing: "0.1em" }}>
          {decide.length}/{DECIDE_CAP}
          {urgent > 0 && <span style={{ color: "var(--red)", marginLeft: 6 }}>· {urgent} urgent</span>}
          {surface.overflow > 0 && <span style={{ marginLeft: 6 }}>· {surface.overflow} overflow → watch</span>}
        </span>
      </div>

      <div style={{ padding: mp, display: "grid", gap: 6 }}>
        {decide.map(renderCard)}

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
                    <span style={{ ...mono(11, "var(--gold)"), fontWeight: 700 }}>{c.ticker || "—"}</span>
                    <span style={mono(10)}>
                      {c.title}
                      {needsTest && (c.gate_test
                        ? <span style={{ color: "var(--text-dim)" }}> · test: {c.gate_test.slice(0, 120)}</span>
                        : <span style={{ marginLeft: 8, color: "var(--amber)", fontSize: 8, letterSpacing: "0.1em", border: "1px solid var(--amber)", padding: "0 4px", borderRadius: 2 }}>⚠️ NO TEST</span>)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* WATCH + MISSED counters */}
        <div style={{ ...mono(9, "var(--text-dim)"), letterSpacing: "0.1em", padding: "4px 2px" }}>
          👁 {surface.watch.length} watching, {surface.wakeWithin10} wake within {WATCH_WAKE_PCT}%
        </div>
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
