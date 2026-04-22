import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import { parseAllFlags, type ReviewFlag } from "@/components/ReviewQueue";
import { useIsMobile } from "@/hooks/use-mobile";
import { type PromptTemplateKey, type PromptContext } from "@/lib/claudePromptUrl";
import ClaudePromptButton from "@/components/ClaudePromptButton";

/**
 * Action Inbox — single ranked "Today's Decisions" list.
 *
 * Each row is collapsible: click anywhere on the summary to reveal
 * full context (triggers, notes, key fields, exact Claude prompt)
 * without leaving the dashboard. The "Deep Dive ➜" button still
 * fires the Claude flow and shows a hover preview of its prompt.
 */

type SignalKind =
  | "EXIT_ZONE"
  | "REVIEW_HIGH"
  | "REVIEW_MED"
  | "REVIEW_LOW"
  | "ADD_ZONE"
  | "EARNINGS"
  | "WATCH_IN_ZONE"
  | "WATCH_STALE";

interface DetailField {
  label: string;
  value: string;
  full?: boolean;     // span both columns when true
  mono?: boolean;     // use monospace font (default true)
}

interface InboxItem {
  key: string;
  ticker: string;
  kind: SignalKind;
  label: string;        // short signal label
  context: string;      // one-line context
  urgency: number;      // 0 = highest
  templateKey: PromptTemplateKey;
  templateContext: PromptContext;
  details: DetailField[];
  longNote?: string;    // free-form note shown at bottom of expansion
  explain: {
    trigger: string;    // what fired
    thesis: string;     // current thesis state / portfolio context
    action: string;     // recommended next step
  };
}

const KIND_STYLE: Record<SignalKind, { color: string; bg: string; label: string; emoji: string }> = {
  EXIT_ZONE:      { color: "var(--red)",   bg: "var(--red-dim)",   label: "EXIT ZONE",     emoji: "🔴" },
  REVIEW_HIGH:    { color: "var(--red)",   bg: "var(--red-dim)",   label: "REVIEW · HIGH", emoji: "🔴" },
  REVIEW_MED:    { color: "var(--amber)", bg: "var(--amber-dim)", label: "REVIEW · MED",  emoji: "🟡" },
  REVIEW_LOW:    { color: "var(--text-dim)", bg: "rgba(102,102,102,0.08)", label: "REVIEW · LOW", emoji: "🟢" },
  ADD_ZONE:       { color: "var(--green)", bg: "var(--green-dim)", label: "ADD ZONE",      emoji: "🟢" },
  EARNINGS:       { color: "var(--accent)", bg: "rgba(120,140,200,0.10)", label: "EARNINGS", emoji: "📊" },
  WATCH_IN_ZONE:  { color: "var(--green)", bg: "var(--green-dim)", label: "IN ZONE",       emoji: "🎯" },
  WATCH_STALE:    { color: "var(--amber)", bg: "var(--amber-dim)", label: "REVIEW DUE",    emoji: "⏰" },
};

const ZONE_PROXIMITY_THRESHOLD = 0.15;

function parseEntryMidpoint(entry: string): number | null {
  if (!entry) return null;
  const parts = entry.split(/\s*[-–]\s*|\s+to\s+/i);
  const nums = parts.map((p) => parseFloat(p.replace(/[^0-9.]/g, ""))).filter((n) => !isNaN(n) && n > 0);
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return nums[0] ?? null;
}

function daysUntil(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function daysSince(value: string): number {
  if (!value) return -1;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return -1;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function formatGBP(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
}

function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function fmt(value: unknown, fallback = "—"): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s === "" ? fallback : s;
}

function buildInbox(
  holdings: LiveHolding[],
  watchlist: LiveWatchItem[],
  earnings: LiveEarningsCalendarItem[],
): InboxItem[] {
  const items: InboxItem[] = [];

  // 1. Zone breaches
  holdings.forEach((h) => {
    const price = h.price;
    if (!price || price <= 0) return;
    const triggerAdd = parseFloat(String(h.trigger_price_add ?? ""));
    const triggerExit = parseFloat(String(h.trigger_price_exit ?? ""));

    if (!isNaN(triggerExit) && triggerExit > 0 && price <= triggerExit * (1 + ZONE_PROXIMITY_THRESHOLD)) {
      const pct = ((triggerExit - price) / triggerExit * 100);
      const breached = pct >= 0;
      items.push({
        key: `exit-${h.ticker}`,
        ticker: h.ticker,
        kind: "EXIT_ZONE",
        label: breached ? "Stop breached" : "Approaching stop",
        context: `Px ${price.toFixed(2)} · stop ${triggerExit.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
        urgency: breached ? 0 : 1,
        templateKey: "holdings_deep_dive",
        templateContext: {
          ticker: h.ticker, mv: Math.round(h.mv), aum_pct: h.aum_pct?.toFixed(1) ?? "—",
          gl_pct: h.gl?.toFixed(1) ?? "—", add_trigger: h.add_trigger || "—", exit_trigger: h.exit_trigger || "—",
        },
        details: [
          { label: "Name", value: fmt(h.name) },
          { label: "Layer / Acct", value: `${fmt(h.layer)} · ${fmt(h.account)}` },
          { label: "Price", value: `${price.toFixed(2)} ${fmt(h.currency, "")}`.trim() },
          { label: "Stop", value: `${triggerExit.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% to breach)` },
          { label: "MV", value: formatGBP(h.mv) },
          { label: "AUM %", value: fmtPct(h.aum_pct) },
          { label: "G/L %", value: fmtPct(h.gl) },
          { label: "Day %", value: fmtPct(h.day) },
          { label: "Exit trigger", value: fmt(h.exit_trigger), full: true },
          { label: "Add trigger", value: fmt(h.add_trigger), full: true },
        ],
        longNote: h.notes,
        explain: {
          trigger: breached
            ? `Price ${price.toFixed(2)} has crossed the exit stop at ${triggerExit.toFixed(2)} (${Math.abs(pct).toFixed(1)}% past the line).`
            : `Price ${price.toFixed(2)} is ${Math.abs(pct).toFixed(1)}% above the exit stop at ${triggerExit.toFixed(2)} — inside the proximity buffer.`,
          thesis: `${fmt(h.layer, "Unknown layer")} · ${fmt(h.account, "—")} · MV ${formatGBP(h.mv)} (${fmtPct(h.aum_pct, 1)} AUM) · open P&L ${fmtPct(h.gl)}.${h.exit_trigger ? ` Stop rule: ${h.exit_trigger}.` : ""}`,
          action: breached
            ? `Stop rule has fired — execute the exit per doctrine unless thesis has visibly changed in your favour. Open the deep dive to confirm before trimming/exiting.`
            : `No action yet — monitor closely; tighten attention on next session and pre-decide trim vs. exit if the stop fires.`,
        },
      });
    } else if (!isNaN(triggerAdd) && triggerAdd > 0 && price <= triggerAdd * (1 + ZONE_PROXIMITY_THRESHOLD)) {
      const pct = ((triggerAdd - price) / triggerAdd * 100);
      const inside = pct >= 0;
      items.push({
        key: `add-${h.ticker}`,
        ticker: h.ticker,
        kind: "ADD_ZONE",
        label: inside ? "In add zone" : "Approaching add",
        context: `Px ${price.toFixed(2)} · trigger ${triggerAdd.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
        urgency: inside ? 3 : 4,
        templateKey: "holdings_deep_dive",
        templateContext: {
          ticker: h.ticker, mv: Math.round(h.mv), aum_pct: h.aum_pct?.toFixed(1) ?? "—",
          gl_pct: h.gl?.toFixed(1) ?? "—", add_trigger: h.add_trigger || "—", exit_trigger: h.exit_trigger || "—",
        },
        details: [
          { label: "Name", value: fmt(h.name) },
          { label: "Layer / Acct", value: `${fmt(h.layer)} · ${fmt(h.account)}` },
          { label: "Price", value: `${price.toFixed(2)} ${fmt(h.currency, "")}`.trim() },
          { label: "Add trigger", value: `${triggerAdd.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% to fire)` },
          { label: "Deploy target", value: h.deploy_target_gbp ? formatGBP(h.deploy_target_gbp) : "—" },
          { label: "AUM %", value: fmtPct(h.aum_pct) },
          { label: "MV", value: formatGBP(h.mv) },
          { label: "G/L %", value: fmtPct(h.gl) },
          { label: "Add condition", value: fmt(h.add_trigger), full: true },
          { label: "Deploy note", value: fmt(h.deploy_note), full: true },
        ],
        longNote: h.notes,
      });
    }
  });

  // 2. Review flags
  const flags: ReviewFlag[] = parseAllFlags(holdings);
  flags.forEach((f) => {
    if (f.isStale) return;
    const kind: SignalKind = f.priority === "HIGH" ? "REVIEW_HIGH" : f.priority === "MEDIUM" ? "REVIEW_MED" : "REVIEW_LOW";
    const urgency = f.priority === "HIGH" ? 1 : f.priority === "MEDIUM" ? 4 : 6;
    const h = holdings.find((x) => x.ticker.toUpperCase() === f.ticker.toUpperCase());
    items.push({
      key: `flag-${f.ticker}-${f.prefix}`,
      ticker: f.ticker,
      kind,
      label: f.flagType.replace(/_/g, " "),
      context: f.reason ? f.reason.slice(0, 110) : f.prefix.replace(/_/g, " "),
      urgency,
      templateKey: "holdings_deep_dive",
      templateContext: {
        ticker: f.ticker, mv: h ? Math.round(h.mv) : "—", aum_pct: h?.aum_pct?.toFixed(1) ?? "—",
        gl_pct: h?.gl?.toFixed(1) ?? "—",
        add_trigger: f.flagType, exit_trigger: f.reason || "—",
      },
      details: [
        { label: "Flag type", value: f.flagType },
        { label: "Prefix", value: f.prefix },
        { label: "Priority", value: f.priority },
        { label: "Flagged", value: fmt(f.date) },
        ...(h
          ? [
              { label: "Layer / Acct", value: `${fmt(h.layer)} · ${fmt(h.account)}` },
              { label: "MV", value: formatGBP(h.mv) },
              { label: "AUM %", value: fmtPct(h.aum_pct) },
              { label: "G/L %", value: fmtPct(h.gl) },
            ]
          : []),
      ],
      longNote: f.reason,
    });
  });

  // 3. Earnings within 5 days
  earnings.forEach((e) => {
    const d = daysUntil(e.nextEarningsDate);
    if (d < 0 || d > 5) return;
    const urgency = d <= 1 ? 1 : d <= 2 ? 2 : 3;
    const h = holdings.find((x) => x.ticker.toUpperCase() === e.ticker.toUpperCase());
    items.push({
      key: `earn-${e.ticker}-${e.nextEarningsDate}`,
      ticker: e.ticker,
      kind: "EARNINGS",
      label: d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`,
      context: `${e.fiscalPeriod || "Earnings"} · ${e.confirmed ? "confirmed" : "estimated"}`,
      urgency,
      templateKey: "earnings_post",
      templateContext: {
        ticker: e.ticker, fiscal_period: e.fiscalPeriod || "—", earnings_date: e.nextEarningsDate,
      },
      details: [
        { label: "Reports", value: fmt(e.nextEarningsDate) },
        { label: "Period", value: fmt(e.fiscalPeriod) },
        { label: "Confirmed", value: e.confirmed ? "Yes" : "Estimated" },
        { label: "Last updated", value: fmt(e.lastUpdated) },
        ...(h
          ? [
              { label: "Position MV", value: formatGBP(h.mv) },
              { label: "AUM %", value: fmtPct(h.aum_pct) },
              { label: "G/L %", value: fmtPct(h.gl) },
              { label: "Layer", value: fmt(h.layer) },
            ]
          : [{ label: "Position", value: "Not held" }]),
      ],
    });
  });

  // 4. Watchlist in entry zone (current ≤ midpoint)
  watchlist.forEach((w) => {
    if (!w.status.toUpperCase().startsWith("BUY")) return;
    const current = typeof w.current === "number" ? w.current : null;
    const mid = parseEntryMidpoint(w.entry);
    if (current == null || mid == null || current > mid) return;
    const pct = ((current - mid) / mid * 100);
    const deploy = w.deploy_amount_gbp > 0 ? ` · deploy ${formatGBP(w.deploy_amount_gbp)}` : "";
    items.push({
      key: `wzone-${w.ticker}`,
      ticker: w.ticker,
      kind: "WATCH_IN_ZONE",
      label: w.status.toUpperCase(),
      context: `${pct.toFixed(1)}% vs ${w.entry}${deploy}`,
      urgency: 2,
      templateKey: "watchlist_deep_dive",
      templateContext: {
        ticker: w.ticker, name: w.name, layer: w.layer, status: w.status,
        entry_target: w.entry, thesis: w.rationale || "—",
      },
      details: [
        { label: "Name", value: fmt(w.name) },
        { label: "Layer", value: fmt(w.layer) },
        { label: "Status", value: fmt(w.status) },
        { label: "Current", value: `${current.toFixed(2)} ${fmt(w.currency, "")}`.trim() },
        { label: "Entry target", value: fmt(w.entry) },
        { label: "vs midpoint", value: fmtPct(pct) },
        { label: "Deploy size", value: w.deploy_amount_gbp > 0 ? formatGBP(w.deploy_amount_gbp) : "—" },
        { label: "Last checked", value: fmt(w.lastChecked) },
        { label: "Trigger condition", value: fmt(w.trigger), full: true },
      ],
      longNote: w.rationale,
    });
  });

  // 5. Stale watchlist reviews (>14d overdue)
  watchlist.forEach((w) => {
    const since = daysSince(w.triggerReviewDate);
    if (since <= 14) return;
    items.push({
      key: `wstale-${w.ticker}`,
      ticker: w.ticker,
      kind: "WATCH_STALE",
      label: `${since}d stale`,
      context: w.triggerReviewNote ? w.triggerReviewNote.slice(0, 110) : `Last reviewed ${w.triggerReviewDate || "—"}`,
      urgency: since > 30 ? 4 : 5,
      templateKey: "watchlist_review",
      templateContext: {
        ticker: w.ticker, name: w.name, layer: w.layer, status: w.status,
        trigger_condition: w.trigger || "—", entry_target: w.entry,
      },
      details: [
        { label: "Name", value: fmt(w.name) },
        { label: "Layer", value: fmt(w.layer) },
        { label: "Status", value: fmt(w.status) },
        { label: "Last reviewed", value: fmt(w.triggerReviewDate) },
        { label: "Days stale", value: String(since) },
        { label: "Entry target", value: fmt(w.entry) },
        { label: "Current", value: w.current != null ? w.current.toFixed(2) : "—" },
        { label: "Trigger condition", value: fmt(w.trigger), full: true },
      ],
      longNote: w.triggerReviewNote || w.rationale,
    });
  });

  return items.sort((a, b) => a.urgency - b.urgency);
}

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  earnings: LiveEarningsCalendarItem[];
}

export default function ActionInbox({ holdings, watchlist, earnings }: Props) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const items = useMemo(() => buildInbox(holdings, watchlist, earnings), [holdings, watchlist, earnings]);

  if (items.length === 0) {
    return (
      <div style={{
        background: "var(--panel)", border: "1px solid var(--rim)",
        borderLeft: "3px solid var(--green)", marginBottom: 16,
        padding: isMobile ? "14px 12px" : "16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)", letterSpacing: "0.08em" }}>
            Nothing to decide today. Inbox is clear.
          </span>
        </div>
      </div>
    );
  }

  const highCount = items.filter((i) => i.urgency <= 1).length;
  const visible = showAll ? items : items.slice(0, 8);
  const mp = isMobile ? "10px 12px" : "14px 20px";

  return (
    <div style={{
      background: "var(--panel)", border: "1px solid var(--rim)",
      borderLeft: "3px solid var(--gold)", marginBottom: 16,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: mp, borderBottom: expanded ? "1px solid var(--rim)" : "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold)" }}>
            ⚡ Today's Decisions
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
            {items.length} item{items.length !== 1 ? "s" : ""}
            {highCount > 0 && <span style={{ color: "var(--red)", marginLeft: 6 }}>· {highCount} urgent</span>}
          </span>
        </div>
        <div style={{ color: "var(--text-dim)" }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
      </div>

      {expanded && (
        <div style={{ padding: mp, display: "grid", gap: 6 }}>
          {visible.map((item) => {
            const style = KIND_STYLE[item.kind];
            const isOpen = !!openRows[item.key];
            return (
              <div
                key={item.key}
                style={{
                  background: style.bg,
                  border: "1px solid var(--rim)",
                  borderLeft: `3px solid ${style.color}`,
                  borderRadius: 2,
                }}
              >
                <div
                  onClick={() => setOpenRows((s) => ({ ...s, [item.key]: !s[item.key] }))}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "auto auto auto 1fr auto",
                    gap: isMobile ? 6 : 14,
                    alignItems: "center",
                    padding: "10px 14px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ color: "var(--text-dim)", display: isMobile ? "none" : "flex", alignItems: "center" }}>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: isMobile ? 0 : 90 }}>
                    <span style={{ fontSize: 12 }}>{style.emoji}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>
                      {item.ticker}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: style.color, whiteSpace: "nowrap",
                    padding: "2px 8px", borderRadius: 2,
                    border: `1px solid color-mix(in srgb, ${style.color} 30%, transparent)`,
                    justifySelf: "start",
                  }}>
                    {style.label} · {item.label}
                  </span>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)",
                    lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: isMobile ? "normal" : "nowrap",
                  }}>
                    {item.context}
                  </div>
                  <div onClick={(e) => e.stopPropagation()} style={{ justifySelf: isMobile ? "stretch" : "end" }}>
                    <ClaudePromptButton
                      templateKey={item.templateKey}
                      context={item.templateContext}
                      stopPropagation
                      style={{ width: isMobile ? "100%" : undefined }}
                    />
                  </div>
                </div>

                {isOpen && (
                  <div
                    style={{
                      borderTop: "1px solid var(--rim)",
                      padding: isMobile ? "12px 14px" : "14px 18px 16px 18px",
                      display: "grid",
                      gap: 12,
                      background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
                        gap: "8px 16px",
                      }}
                    >
                      {item.details.map((d, i) => (
                        <div
                          key={`${item.key}-d-${i}`}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            gridColumn: d.full ? "1 / -1" : undefined,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 8,
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                              color: "var(--text-dim)",
                            }}
                          >
                            {d.label}
                          </span>
                          <span
                            style={{
                              fontFamily: d.mono === false ? "var(--font-ui)" : "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--text-mid)",
                              wordBreak: "break-word",
                              whiteSpace: d.full ? "normal" : "nowrap",
                              overflow: d.full ? "visible" : "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {item.longNote && item.longNote.trim() !== "" && (
                      <div style={{ display: "grid", gap: 4 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 8,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--text-dim)",
                          }}
                        >
                          Notes
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--text-mid)",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.longNote}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {items.length > 8 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              style={{
                marginTop: 4, background: "none", border: "1px solid var(--rim)",
                color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px",
                cursor: "pointer", borderRadius: 2, justifySelf: "start",
              }}
            >
              {showAll ? `Show top 8` : `Show all ${items.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
