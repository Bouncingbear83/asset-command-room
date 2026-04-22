import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import { parseAllFlags, type ReviewFlag } from "@/components/ReviewQueue";
import { useIsMobile } from "@/hooks/use-mobile";
import { openClaudeWithPrompt, type PromptTemplateKey, type PromptContext } from "@/lib/claudePromptUrl";
import { toast } from "sonner";

/**
 * Action Inbox — single ranked "Today's Decisions" list.
 *
 * Merges:
 *  - Zone breaches (cap/floor) from HOLDINGS  (EXIT_ZONE / ADD_ZONE)
 *  - Review flags (W_EXIT / Q_REVIEW / etc.)  via parseAllFlags
 *  - Earnings reporting in next 5 days
 *  - Watchlist names with current ≤ entry midpoint (in entry zone)
 *  - Stale watchlist reviews (overdue: TRIGGER_REVIEW_DATE > 14 days old)
 *
 * Each row: ticker · signal type · context · "Deep Dive" → Claude.
 * Sorted by urgency (lower number = more urgent).
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

interface InboxItem {
  key: string;
  ticker: string;
  kind: SignalKind;
  label: string;        // short signal label
  context: string;      // one-line context
  urgency: number;      // 0 = highest
  templateKey: PromptTemplateKey;
  templateContext: PromptContext;
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
      });
    }
  });

  // 2. Review flags
  const flags: ReviewFlag[] = parseAllFlags(holdings);
  flags.forEach((f) => {
    if (f.isStale) return;
    const kind: SignalKind = f.priority === "HIGH" ? "REVIEW_HIGH" : f.priority === "MEDIUM" ? "REVIEW_MED" : "REVIEW_LOW";
    const urgency = f.priority === "HIGH" ? 1 : f.priority === "MEDIUM" ? 4 : 6;
    items.push({
      key: `flag-${f.ticker}-${f.prefix}`,
      ticker: f.ticker,
      kind,
      label: f.flagType.replace(/_/g, " "),
      context: f.reason ? f.reason.slice(0, 110) : f.prefix.replace(/_/g, " "),
      urgency,
      templateKey: "holdings_deep_dive",
      templateContext: {
        ticker: f.ticker, mv: "—", aum_pct: "—", gl_pct: "—",
        add_trigger: f.flagType, exit_trigger: f.reason || "—",
      },
    });
  });

  // 3. Earnings within 5 days
  earnings.forEach((e) => {
    const d = daysUntil(e.nextEarningsDate);
    if (d < 0 || d > 5) return;
    const urgency = d <= 1 ? 1 : d <= 2 ? 2 : 3;
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
            return (
              <div key={item.key} style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "auto auto 1fr auto",
                gap: isMobile ? 6 : 14,
                alignItems: "center",
                background: style.bg,
                border: "1px solid var(--rim)",
                borderLeft: `3px solid ${style.color}`,
                padding: "10px 14px",
                borderRadius: 2,
              }}>
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
                <button
                  onClick={async () => {
                    await openClaudeWithPrompt(item.templateKey, item.templateContext, (m) => toast(m));
                  }}
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
                    background: "none", border: "1px solid var(--accent)", color: "var(--accent)",
                    cursor: "pointer", padding: "4px 12px", borderRadius: 2, whiteSpace: "nowrap",
                    justifySelf: isMobile ? "stretch" : "end",
                  }}
                >
                  Deep Dive ➜
                </button>
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
