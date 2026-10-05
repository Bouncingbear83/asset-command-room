import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import { parseAllFlags, type ReviewFlag } from "@/components/ReviewQueue";
import { useIsMobile } from "@/hooks/use-mobile";
import { type PromptTemplateKey, type PromptContext } from "@/lib/claudePromptUrl";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import type { LiveScore } from "@/hooks/usePortfolioData";
import { normaliseTicker } from "@/lib/tickerAlias";
import {
  DEAD_STATUSES,
  APPROACHING_STOP_PCT, APPROACHING_ADD_PCT, STOP_BREACH_IMPLAUSIBLE_PCT,
  IRR_BB_MIN, STALE_TRIGGER_PCT, MISSING_SCORE_TOKENS,
  STALE_NOTE_DAYS, STALE_NOTE_PREFIXES, OPERATOR_TOKEN,
  EARNINGS_WINDOW_DAYS, WATCH_STALE_DAYS, FLAG_STALE_DAYS,
  SWEEP_NEEDS_RESET_TOKEN, SWEEP_DATE_ROLL_PREFIX, INBOX_TOP_N,
} from "@/config/signalRules";

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
  | "WATCH_STALE"
  | "VERIFY_STOP"
  | "TRIGGER_STALE"
  | "WATCH_SWEEP"
  | "STALE_NOTE";

interface DetailField {
  label: string;
  value: string;
  full?: boolean;     // span both columns when true
  mono?: boolean;     // use monospace font (default true)
}

interface InboxItem {
  key: string;
  ticker: string;
  account?: string;     // R1 — part of dedupe key
  kind: SignalKind;
  label: string;        // short signal label
  context: string;      // one-line context
  urgency: number;      // 0 = highest
  templateKey: PromptTemplateKey;
  templateContext: PromptContext;
  details: DetailField[];
  longNote?: string;    // free-form note shown at bottom of expansion
  children?: InboxItem[]; // WATCH_SWEEP only
  sweepGroup?: "RESET" | "ROLL" | "OTHER";
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
  VERIFY_STOP:    { color: "var(--amber)", bg: "var(--amber-dim)", label: "VERIFY STOP FIELD", emoji: "🟡" },
  TRIGGER_STALE:  { color: "var(--text-dim)", bg: "rgba(102,102,102,0.08)", label: "LOW · TRIGGER STALE", emoji: "⚪" },
  STALE_NOTE:     { color: "var(--text-dim)", bg: "rgba(102,102,102,0.08)", label: "LOW · STALE NOTE", emoji: "⚪" },
  WATCH_SWEEP:    { color: "var(--amber)", bg: "var(--amber-dim)", label: "WATCHLIST SWEEP", emoji: "🧹" },
};

/** R8 — a card is "urgent" iff it renders red. */
const isRed = (k: SignalKind) => KIND_STYLE[k].color === "var(--red)";

/** R6 — parse Google Viz "Date(y,m,d)" (0-indexed month) or any ISO-ish string → yyyy-mm-dd. */
function toIsoDate(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const m = s.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToDate(value: string): Date | null {
  const iso = toIsoDate(value);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

/** R2 — dead = status token in DEAD_STATUSES. Notes are never consulted. */
function isDeadStatus(status: string | undefined): boolean {
  const st = (status || "").trim().toUpperCase();
  return (DEAD_STATUSES as readonly string[]).some((d) => st === d || st.startsWith(d + " "));
}

function parseEntryMidpoint(entry: string): number | null {
  if (!entry) return null;
  const parts = entry.split(/\s*[-–]\s*|\s+to\s+/i);
  const nums = parts.map((p) => parseFloat(p.replace(/[^0-9.]/g, ""))).filter((n) => !isNaN(n) && n > 0);
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return nums[0] ?? null;
}

function daysUntil(value: string): number {
  const d = isoToDate(value);
  if (!d) return Number.POSITIVE_INFINITY;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function daysSince(value: string): number {
  const d = isoToDate(value);
  if (!d) return -1;
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
  scores: LiveScore[] = [],
): InboxItem[] {
  const items: InboxItem[] = [];
  // R5 — score + live IRR-BB (SCORES col AU) keyed by ticker. Never parsed from notes.
  const scoreByTicker = new Map<string, LiveScore>();
  for (const sc of scores) {
    const t = normaliseTicker(sc.ticker) || sc.ticker.toUpperCase();
    if (t && !scoreByTicker.has(t)) scoreByTicker.set(t, sc);
  }

  // 1. Zone breaches
  holdings.forEach((h) => {
    const price = h.price;
    if (!price || price <= 0) return;
    const triggerAdd = parseFloat(String(h.trigger_price_add ?? ""));
    const triggerExit = parseFloat(String(h.trigger_price_exit ?? ""));

    // stopDist > 0 = price above stop
    const stopDist = !isNaN(triggerExit) && triggerExit > 0 ? ((price - triggerExit) / triggerExit) * 100 : null;
    const sc = scoreByTicker.get(normaliseTicker(h.ticker) || h.ticker.toUpperCase());
    const rawScore = sc?.score;
    const scoreMissing = rawScore == null || (MISSING_SCORE_TOKENS as readonly string[]).includes(String(rawScore).trim());
    const auRaw = (sc as { irrBbSheet?: number | null } | undefined)?.irrBbSheet ?? null;
    const irrPct = auRaw == null ? null : Math.abs(auRaw) <= 2 ? auRaw * 100 : auRaw; // fraction or percent
    const holdOnly = irrPct != null && irrPct < IRR_BB_MIN;

    if (stopDist != null && stopDist < -STOP_BREACH_IMPLAUSIBLE_PCT) {
      // R4 — implausible breach: level is probably a trim/upside trigger in the stop field
      items.push({
        key: `verify-${h.ticker}-${h.account}`,
        ticker: h.ticker,
        account: h.account,
        kind: "VERIFY_STOP",
        label: "Check level",
        context: `Px ${price.toFixed(2)} vs stop ${triggerExit.toFixed(2)} (${stopDist.toFixed(1)}%) — likely a trim/upside trigger in the stop field`,
        urgency: 4,
        templateKey: "holdings_deep_dive",
        templateContext: {
          ticker: h.ticker, mv: Math.round(h.mv), aum_pct: h.aum_pct?.toFixed(1) ?? "—",
          gl_pct: h.gl?.toFixed(1) ?? "—", add_trigger: h.add_trigger || "—", exit_trigger: h.exit_trigger || "—",
        },
        details: [
          { label: "Price", value: `${price.toFixed(2)} ${fmt(h.currency, "")}`.trim() },
          { label: "Stop field", value: triggerExit.toFixed(2) },
          { label: "Gap", value: fmtPct(stopDist) },
          { label: "Exit trigger", value: fmt(h.exit_trigger), full: true },
        ],
        longNote: h.notes,
        explain: {
          trigger: `Price is ${Math.abs(stopDist).toFixed(1)}% below the stop — more than the ${STOP_BREACH_IMPLAUSIBLE_PCT}% plausibility guard.`,
          thesis: `${fmt(h.layer, "Unknown layer")} · MV ${formatGBP(h.mv)} (${fmtPct(h.aum_pct, 1)} AUM).`,
          action: `Verify the trigger_price_exit value in the sheet before acting — it is probably a trim or upside level.`,
        },
      });
    } else if (stopDist != null && stopDist <= APPROACHING_STOP_PCT) {
      const pct = -stopDist;
      const breached = pct >= 0;
      items.push({
        key: `exit-${h.ticker}-${h.account}`,
        ticker: h.ticker,
        account: h.account,
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
    } else if (!isNaN(triggerAdd) && triggerAdd > 0 && !scoreMissing && !holdOnly && Math.abs(triggerAdd - price) / price * 100 > STALE_TRIGGER_PCT) {
      // R5 — add trigger too far from spot
      items.push({
        key: `tstale-${h.ticker}-${h.account}`,
        ticker: h.ticker,
        account: h.account,
        kind: "TRIGGER_STALE",
        label: "reset",
        context: `Add trigger ${triggerAdd.toFixed(2)} vs spot ${price.toFixed(2)} (${(((triggerAdd - price) / price) * 100).toFixed(1)}%)`,
        urgency: 6,
        templateKey: "holdings_deep_dive",
        templateContext: {
          ticker: h.ticker, mv: Math.round(h.mv), aum_pct: h.aum_pct?.toFixed(1) ?? "—",
          gl_pct: h.gl?.toFixed(1) ?? "—", add_trigger: h.add_trigger || "—", exit_trigger: h.exit_trigger || "—",
        },
        details: [
          { label: "Price", value: price.toFixed(2) },
          { label: "Add trigger", value: triggerAdd.toFixed(2) },
          { label: "Add condition", value: fmt(h.add_trigger), full: true },
        ],
        longNote: h.notes,
        explain: {
          trigger: `Add trigger sits more than ${STALE_TRIGGER_PCT}% from spot.`,
          thesis: `${fmt(h.layer, "Unknown layer")} · MV ${formatGBP(h.mv)}.`,
          action: `Reset the add trigger to a level that reflects the current thesis.`,
        },
      });
    } else if (!isNaN(triggerAdd) && triggerAdd > 0 && !scoreMissing && !holdOnly && price <= triggerAdd * (1 + APPROACHING_ADD_PCT / 100)) {
      const pct = ((triggerAdd - price) / triggerAdd * 100);
      const inside = pct >= 0;
      items.push({
        key: `add-${h.ticker}-${h.account}`,
        ticker: h.ticker,
        account: h.account,
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
        explain: {
          trigger: inside
            ? `Price ${price.toFixed(2)} has reached the add trigger at ${triggerAdd.toFixed(2)} (${Math.abs(pct).toFixed(1)}% inside the buy zone).`
            : `Price ${price.toFixed(2)} is ${Math.abs(pct).toFixed(1)}% above the add trigger at ${triggerAdd.toFixed(2)} — within proximity buffer.`,
          thesis: `${fmt(h.layer, "Unknown layer")} · ${fmt(h.account, "—")} · MV ${formatGBP(h.mv)} (${fmtPct(h.aum_pct, 1)} AUM) · open P&L ${fmtPct(h.gl)}.${h.deploy_target_gbp ? ` Deploy target: ${formatGBP(h.deploy_target_gbp)}.` : ""}${h.add_trigger ? ` Add rule: ${h.add_trigger}.` : ""}`,
          action: inside
            ? `Add tranche is eligible — confirm cash, layer headroom and concentration cap, then size per doctrine. Open the deep dive to validate before firing.`
            : `Stage the order — pre-decide tranche size and account so you can execute fast if it ticks into the zone.`,
        },
      });
    }
  });

  // 2. Review flags
  const flags: ReviewFlag[] = parseAllFlags(holdings);
  flags.forEach((f) => {
    const dueIso = toIsoDate(f.date);
    const age = dueIso ? daysSince(dueIso) : -1;
    // R9 — old review notes without operator follow-up are LOW "STALE NOTE", never MED/HIGH
    const isReviewNote = (STALE_NOTE_PREFIXES as readonly string[]).some((p) => f.prefix.startsWith(p));
    const hasOperator = (f.reason || "").toUpperCase().includes(OPERATOR_TOKEN);
    const staleNote = isReviewNote && age > STALE_NOTE_DAYS && !hasOperator;
    if (!staleNote && age > FLAG_STALE_DAYS && !isReviewNote) return;
    const kind: SignalKind = staleNote ? "STALE_NOTE" : f.priority === "HIGH" ? "REVIEW_HIGH" : f.priority === "MEDIUM" ? "REVIEW_MED" : "REVIEW_LOW";
    const urgency = staleNote ? 6 : f.priority === "HIGH" ? 1 : f.priority === "MEDIUM" ? 4 : 6;
    const h = holdings.find((x) => x.ticker.toUpperCase() === f.ticker.toUpperCase());
    items.push({
      key: `flag-${f.ticker}-${f.prefix}`,
      ticker: f.ticker,
      account: h?.account,
      kind,
      label: staleNote ? `${age}d old` : f.flagType.replace(/_/g, " "),
      context: `${dueIso ? `Due ${dueIso} · ` : ""}${f.reason ? f.reason.slice(0, 110) : f.prefix.replace(/_/g, " ")}`,
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
        { label: "Due", value: fmt(dueIso) },
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
      explain: {
        trigger: `${f.flagType.replace(/_/g, " ")} due ${fmt(dueIso, "on an unknown date")} via ${f.prefix.replace(/_/g, " ")} (priority ${f.priority}).`,
        thesis: h
          ? `${fmt(h.layer)} · ${fmt(h.account)} · MV ${formatGBP(h.mv)} (${fmtPct(h.aum_pct, 1)} AUM) · open P&L ${fmtPct(h.gl)}.`
          : `Position context not currently in HOLDINGS — likely a watchlist or recently-exited name.`,
        action:
          f.priority === "HIGH"
            ? `Treat as a doctrine review now — write the verdict (hold / size up / size down / exit) before market open. Open the deep dive to test thesis vs the flag.`
            : f.priority === "MEDIUM"
              ? `Schedule a focused review this week — confirm whether the flag changes 6D scoring or the kill condition.`
              : `Log the flag — no immediate action required, revisit during the next portfolio sweep.`,
      },
    });
  });

  // 3. Earnings within 5 days
  earnings.forEach((e) => {
    const d = daysUntil(e.nextEarningsDate);
    if (d < 0 || d > EARNINGS_WINDOW_DAYS) return;
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
        { label: "Reports", value: fmt(toIsoDate(e.nextEarningsDate)) },
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
      explain: {
        trigger: `Earnings ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`} (${fmt(e.fiscalPeriod, "period TBC")}, ${e.confirmed ? "confirmed" : "estimated"}).`,
        thesis: h
          ? `Held in ${fmt(h.layer)} · MV ${formatGBP(h.mv)} (${fmtPct(h.aum_pct, 1)} AUM) · open P&L ${fmtPct(h.gl)}.`
          : `Not currently a holding — earnings only matters if it informs a watchlist trigger.`,
        action: h
          ? `Pre-earnings: write down what would change the 6D thesis (substrate, demand, moat, margin of safety). Post-earnings: produce a research commit if scores change.`
          : `Optional read — only worth time if a related watchlist name keys off this print.`,
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
      explain: {
        trigger: `${w.ticker} is trading ${pct.toFixed(1)}% vs the entry midpoint of ${w.entry || "—"} — inside your buy zone.`,
        thesis: `${fmt(w.layer)} watchlist · status ${fmt(w.status)}.${w.trigger ? ` Trigger condition: ${w.trigger}.` : ""}${w.deploy_amount_gbp > 0 ? ` Pre-sized deploy: ${formatGBP(w.deploy_amount_gbp)}.` : ""}`,
        action: `Confirm cash + layer headroom + concentration cap, then deploy ${w.deploy_amount_gbp > 0 ? formatGBP(w.deploy_amount_gbp) : "the planned tranche"} per the entry sequencing in the deep dive.`,
      },
    });
  });

  // 5. Stale watchlist reviews (>14d overdue)
  watchlist.forEach((w) => {
    const since = daysSince(w.triggerReviewDate);
    if (since <= WATCH_STALE_DAYS) return;
    const rn = (w.triggerReviewNote || "").trim().toUpperCase();
    const sweepGroup: InboxItem["sweepGroup"] = rn.includes(SWEEP_NEEDS_RESET_TOKEN) ? "RESET" : rn.startsWith(SWEEP_DATE_ROLL_PREFIX) ? "ROLL" : "OTHER";
    items.push({
      key: `wstale-${w.ticker}`,
      ticker: w.ticker,
      kind: "WATCH_STALE",
      sweepGroup,
      label: `${since}d stale`,
      context: w.triggerReviewNote ? w.triggerReviewNote.slice(0, 110) : `Due ${toIsoDate(w.triggerReviewDate) || "—"}`,
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
        { label: "Due", value: fmt(toIsoDate(w.triggerReviewDate)) },
        { label: "Days stale", value: String(since) },
        { label: "Entry target", value: fmt(w.entry) },
        { label: "Current", value: w.current != null ? w.current.toFixed(2) : "—" },
        { label: "Trigger condition", value: fmt(w.trigger), full: true },
      ],
      longNote: w.triggerReviewNote || w.rationale,
      explain: {
        trigger: `Trigger review for ${w.ticker} is ${since} day${since === 1 ? "" : "s"} stale (due ${fmt(toIsoDate(w.triggerReviewDate), "—")}).`,
        thesis: `${fmt(w.layer)} watchlist · status ${fmt(w.status)}.${w.trigger ? ` Stated trigger: ${w.trigger}.` : ""}`,
        action: since > 30
          ? `Decide now: refresh trigger / upgrade to active / demote to research / reject. Don't let stale theses clutter the queue.`
          : `Refresh the trigger this week — confirm it still maps to a real entry condition or retire the row.`,
      },
    });
  });

  // R2 — drop dead tickers (any source)
  const dead = new Set<string>();
  // Sources: WATCHLIST status (col H) + SCORES Held_Status (col A). HOLDINGS rows are never dead.
  watchlist.forEach((w) => { if (isDeadStatus(w.status)) dead.add(w.ticker.toUpperCase()); });
  scores.forEach((sc) => { if (isDeadStatus((sc as { heldStatus?: string }).heldStatus)) dead.add(sc.ticker.toUpperCase()); });
  holdings.forEach((h) => dead.delete(h.ticker.toUpperCase()));
  const alive = items.filter((i) => !dead.has(i.ticker.toUpperCase()));

  // R1 — de-duplicate on ticker + signal_type + subtype; keep highest priority
  const byKey = new Map<string, InboxItem>();
  for (const it of alive) {
    const k = `${it.ticker.toUpperCase()}|${(it.account || "").toUpperCase()}|${it.kind}|${it.label.toUpperCase()}`;
    const prev = byKey.get(k);
    if (!prev || it.urgency < prev.urgency) byKey.set(k, it);
  }
  const deduped = Array.from(byKey.values());

  // R7 — collapse stale watchlist cohort into one sweep card
  const stale = deduped.filter((i) => i.kind === "WATCH_STALE");
  const others = deduped.filter((i) => i.kind !== "WATCH_STALE");
  if (stale.length > 0) {
    others.push({
      key: "watchlist-sweep",
      ticker: "WATCHLIST",
      kind: "WATCH_SWEEP",
      label: `Watchlist sweep (${stale.length} rows)`,
      context: `${stale.filter((s) => s.sweepGroup === "RESET").length} need trigger reset · ${stale.filter((s) => s.sweepGroup === "ROLL").length} date roll only`,
      urgency: 5,
      templateKey: stale[0].templateKey,
      templateContext: stale[0].templateContext,
      details: [],
      children: stale.sort((a, b) => a.ticker.localeCompare(b.ticker)),
      explain: { trigger: "", thesis: "", action: "" },
    });
  }

  return others.sort((a, b) => a.urgency - b.urgency);
}

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  earnings: LiveEarningsCalendarItem[];
  scores?: LiveScore[];
}

const OPEN_ROWS_STORAGE_KEY = "stellar.actionInbox.openRows.v1";
const DONE_STORAGE_KEY = "stellar.actionInbox.done.v1";

/** Today's local-date string — used to namespace "done" so items auto-return on next snapshot. */
function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ExplainRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(86px, auto) 1fr", gap: 12, alignItems: "baseline" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          lineHeight: 1.5,
          color: accent ? "var(--gold)" : "var(--text-mid)",
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function ActionInbox({ holdings, watchlist, earnings, scores = [] }: Props) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(OPEN_ROWS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(([, v]) => v === true),
        ) as Record<string, boolean>;
      }
      return {};
    } catch {
      return {};
    }
  });

  // "Done" map: { [itemKey]: snapshotStamp }. An item is considered done only
  // while its stored stamp matches today's stamp — next snapshot it returns.
  const [doneMap, setDoneMap] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(DONE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const today = todayStamp();
      // Drop any entries from previous days at load time.
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string" && v === today),
      ) as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [showDone, setShowDone] = useState(false);

  const items = useMemo(() => buildInbox(holdings, watchlist, earnings, scores), [holdings, watchlist, earnings, scores]);

  // Persist expanded-row state across reloads/sessions.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const onlyTrue = Object.fromEntries(
        Object.entries(openRows).filter(([, v]) => v === true),
      );
      window.localStorage.setItem(OPEN_ROWS_STORAGE_KEY, JSON.stringify(onlyTrue));
    } catch {
      // ignore quota / privacy-mode failures
    }
  }, [openRows]);

  // Persist "done" map.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify(doneMap));
    } catch {
      // ignore
    }
  }, [doneMap]);

  const today = todayStamp();
  const isDone = useCallback((key: string) => doneMap[key] === today, [doneMap, today]);

  const markDone = useCallback((key: string) => {
    setDoneMap((m) => ({ ...m, [key]: todayStamp() }));
    // Collapse the row when marking done so it disappears cleanly.
    setOpenRows((s) => {
      if (!s[key]) return s;
      const next = { ...s };
      delete next[key];
      return next;
    });
  }, []);

  const restore = useCallback((key: string) => {
    setDoneMap((m) => {
      if (!(key in m)) return m;
      const next = { ...m };
      delete next[key];
      return next;
    });
  }, []);

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

  const activeItems = items.filter((i) => !isDone(i.key));
  const doneItems = items.filter((i) => isDone(i.key));
  const highCount = activeItems.filter((i) => isRed(i.kind)).length;
  const visible = showAll ? activeItems : activeItems.slice(0, INBOX_TOP_N);
  const mp = isMobile ? "10px 12px" : "14px 20px";
  const allCleared = activeItems.length === 0;

  const renderRow = (item: InboxItem) => {
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
                    {item.account && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                        {item.account}
                      </span>
                    )}
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
                        background: "color-mix(in srgb, var(--gold) 6%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--gold) 22%, transparent)",
                        borderLeft: "2px solid var(--gold)",
                        borderRadius: 2,
                        padding: isMobile ? "10px 12px" : "12px 14px",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 8,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "var(--gold)",
                        }}
                      >
                        💡 Explain this signal
                      </div>
                      <ExplainRow label="Trigger" value={item.explain.trigger} />
                      <ExplainRow label="Thesis state" value={item.explain.thesis} />
                      <ExplainRow label="Recommended" value={item.explain.action} accent />
                    </div>
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

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        borderTop: "1px dashed var(--rim)",
                        paddingTop: 10,
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markDone(item.key);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "color-mix(in srgb, var(--green) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)",
                          color: "var(--green)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          padding: "6px 12px",
                          borderRadius: 2,
                          cursor: "pointer",
                        }}
                        title="Hide until next snapshot"
                      >
                        <Check size={11} /> Mark done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
  };

  const renderSweep = (item: InboxItem) => {
    const style = KIND_STYLE[item.kind];
    const isOpen = !!openRows[item.key];
    const kids = item.children ?? [];
    const groups: { label: string; rows: InboxItem[] }[] = [
      { label: "Needs trigger reset", rows: kids.filter((k) => k.sweepGroup === "RESET") },
      { label: "Date roll only", rows: kids.filter((k) => k.sweepGroup === "ROLL") },
      { label: "Other", rows: kids.filter((k) => k.sweepGroup === "OTHER") },
    ].filter((g) => g.rows.length > 0);
    return (
      <div key={item.key} style={{ background: style.bg, border: "1px solid var(--rim)", borderLeft: `3px solid ${style.color}`, borderRadius: 2 }}>
        <div
          onClick={() => setOpenRows((s) => ({ ...s, [item.key]: !s[item.key] }))}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", flexWrap: "wrap" }}
        >
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span style={{ fontSize: 12 }}>{style.emoji}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{item.label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)" }}>{item.context}</span>
        </div>
        {isOpen && (
          <div style={{ borderTop: "1px solid var(--rim)", padding: "10px 14px", display: "grid", gap: 10 }}>
            {groups.map((g) => (
              <div key={g.label} style={{ display: "grid", gap: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-dim)" }}>
                  {g.label} · {g.rows.length}
                </span>
                {g.rows.map((r) => renderRow(r))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      background: "var(--panel)", border: "1px solid var(--rim)",
      borderLeft: `3px solid ${allCleared ? "var(--green)" : "var(--gold)"}`, marginBottom: 16,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: mp, borderBottom: expanded ? "1px solid var(--rim)" : "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: allCleared ? "var(--green)" : "var(--gold)" }}>
            {allCleared ? "✅ All cleared for today" : "⚡ Today's Decisions"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
            {activeItems.length} open
            {highCount > 0 && <span style={{ color: "var(--red)", marginLeft: 6 }}>· {highCount} urgent</span>}
            {doneItems.length > 0 && <span style={{ marginLeft: 6 }}>· {doneItems.length} done</span>}
          </span>
        </div>
        <div style={{ color: "var(--text-dim)" }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
      </div>

      {expanded && (
        <div style={{ padding: mp, display: "grid", gap: 6 }}>
          {visible.map((item) => (item.kind === "WATCH_SWEEP" ? renderSweep(item) : renderRow(item)))}

          {activeItems.length > INBOX_TOP_N && (
            <button
              onClick={() => setShowAll((s) => !s)}
              style={{
                marginTop: 4, background: "none", border: "1px solid var(--rim)",
                color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px",
                cursor: "pointer", borderRadius: 2, justifySelf: "start",
              }}
            >
              {showAll ? `Show top ${INBOX_TOP_N}` : `Show all ${activeItems.length}`}
            </button>
          )}

          {doneItems.length > 0 && (
            <div style={{ marginTop: 10, borderTop: "1px solid var(--rim)", paddingTop: 10, display: "grid", gap: 6 }}>
              <button
                onClick={() => setShowDone((s) => !s)}
                style={{
                  background: "none", border: "none", color: "var(--text-dim)",
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
                  textTransform: "uppercase", padding: 0, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6, justifySelf: "start",
                }}
              >
                {showDone ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                ✓ Done today · {doneItems.length}
              </button>

              {showDone && (
                <div style={{ display: "grid", gap: 4 }}>
                  {doneItems.map((item) => {
                    const style = KIND_STYLE[item.kind];
                    return (
                      <div
                        key={`done-${item.key}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr auto" : "auto auto 1fr auto",
                          gap: isMobile ? 8 : 14,
                          alignItems: "center",
                          padding: "6px 12px",
                          border: "1px solid var(--rim)",
                          borderLeft: `3px solid color-mix(in srgb, ${style.color} 50%, transparent)`,
                          borderRadius: 2,
                          opacity: 0.55,
                          background: "transparent",
                        }}
                      >
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                          color: "var(--text-mid)", textDecoration: "line-through",
                        }}>
                          {item.ticker}
                        </span>
                        {!isMobile && (
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em",
                            textTransform: "uppercase", color: "var(--text-dim)", whiteSpace: "nowrap",
                          }}>
                            {style.label}
                          </span>
                        )}
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.label} · {item.context}
                        </span>
                        <button
                          onClick={() => restore(item.key)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            background: "none", border: "1px solid var(--rim)",
                            color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 8,
                            letterSpacing: "0.12em", textTransform: "uppercase",
                            padding: "4px 8px", cursor: "pointer", borderRadius: 2,
                          }}
                          title="Restore to active"
                        >
                          <RotateCcw size={10} /> Restore
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
