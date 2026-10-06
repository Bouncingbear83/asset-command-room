/**
 * Action Surface engine (docs/action-surface-spec-v1.md).
 *
 * Pure functions: sheet rows + action_tracker rows → Candidates routed to lanes.
 * Display/routing only — never feeds score, IRR-BB or composite maths.
 * IRR-BB is read as-is from SCORES (col AU); nothing here computes it.
 */
import {
  DEAD_STATUSES,
  APPROACHING_STOP_PCT,
  STOP_BREACH_IMPLAUSIBLE_PCT,
  IRR_BB_MIN,
  OPERATOR_TOKEN,
  HOLD_ALERT_STATUSES,
  VERDICT_TOKENS,
  AUTOMATION_PREFIXES,
  EARNINGS_PREPARE_DAYS,
  THESIS_CHECK_BUSINESS_DAYS,
  WATCH_WAKE_PCT,
  LIMIT_ORDER_REGEX,
  FILLED_TOKEN,
  BACKLOG_ACTION_TYPES,
  MISSED_AFTER_DAYS,
  DECIDE_CAP,
  PREPARE_HORIZON_DAYS,
  GM_MAX_AGGREGATE_PCT,
  GM_MAX_POSITIONS,
  GM_SOFT_CAP_ACK,
} from "@/config/signalRules";

export type Lane = "DECIDE" | "PREPARE" | "WATCH" | "BACKLOG" | "MISSED";
export type Severity = "RED" | "AMBER" | "GREY";

export interface Candidate {
  key: string; // ticker + trigger_type
  ticker: string;
  trigger_type: string;
  title: string;
  lane: Lane;
  severity: Severity;
  fired_at: string | null;
  source: string;
  source_ref: string | null;
  reasons: string[];
  accounts: string[];
  gate_test: string | null;
  verdict_at: string | null;
  next_review: string | null;
  layer?: string;
}

// ── Minimal input shapes (structural; Live* types satisfy them) ──
export interface HoldingIn {
  ticker: string; account?: string; layer?: string; price: number; shares?: number;
  alert_status?: string; alert_fired_date?: string | null;
  trigger_price_add?: string; trigger_price_exit?: string;
  trigger_review_date?: string; trigger_review_note?: string;
  deploy_note?: string; notes?: string; action?: string; currency?: string;
}
export interface WatchIn {
  ticker: string; layer?: string; status: string; current: number | string | null;
  entry?: string; triggerPriceNumeric?: number | null;
  triggerReviewDate?: string; triggerReviewNote?: string;
}
export interface ScoreIn { ticker: string; heldStatus?: string; irrBbSheet?: number | null; score?: number | null }
export interface EarningsIn { ticker: string; nextEarningsDate?: string | null; fiscalPeriod?: string; confirmed?: boolean }
export interface TrackerRowIn {
  id: string; ticker: string | null; action_type: string; due_date: string; summary: string;
  status: string; priority?: string; layer?: string | null; source?: string | null;
}

// ── Dates ──
export function isoDate(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const m = s.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
export function daysFrom(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
export function addBusinessDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

// ── R10: liveness ──
export function isDeadStatus(status: string | undefined): boolean {
  const st = up(status);
  return (DEAD_STATUSES as readonly string[]).some((d) => st === d || st.startsWith(d + " "));
}
/** First match wins: HOLDINGS → WATCHLIST status → SCORES Held_Status. */
export function buildDeadSet(holdings: HoldingIn[], watchlist: WatchIn[], scores: ScoreIn[]): Set<string> {
  const held = new Set(holdings.map((h) => up(h.ticker)));
  const onWl = new Set(watchlist.map((w) => up(w.ticker)));
  const dead = new Set<string>();
  for (const w of watchlist) {
    const t = up(w.ticker);
    if (!held.has(t) && isDeadStatus(w.status)) dead.add(t);
  }
  for (const s of scores) {
    const t = up(s.ticker);
    if (!held.has(t) && !onWl.has(t) && isDeadStatus(s.heldStatus)) dead.add(t);
  }
  return dead;
}

// ── R13: automation notes ──
export function isAutomationNote(note: string | null | undefined): boolean {
  const s = String(note ?? "").trim();
  if (!s) return true; // empty = nothing
  const u = s.toUpperCase();
  if ((AUTOMATION_PREFIXES as readonly string[]).some((p) => u.startsWith(p))) return true;
  if (/^OK:\s*$/i.test(s)) return true;
  return false;
}

// ── R12: operator supersession ──
/** Returns the verdict date (or "OPERATOR") if the note carries an operator verdict, else null. */
export function findVerdict(note: string | null | undefined): string | null {
  const s = String(note ?? "");
  if (!s.trim()) return null;
  const tokens = (VERDICT_TOKENS as readonly string[]).map((t) => t.replace(/ /g, "\\s+")).join("|");
  const re = new RegExp(`(\\d{4}-\\d{2}-\\d{2})[^\\n]*?\\b(${tokens})\\b`, "i");
  const m = s.match(re);
  if (m) return m[1];
  if (s.toUpperCase().includes(OPERATOR_TOKEN)) return "OPERATOR";
  return null;
}
/** R12 — verdict present AND review date in the future → superseded until that date. */
export function isSuperseded(note: string | null | undefined, reviewDate: string | null | undefined, today: string): boolean {
  if (!findVerdict(note)) return false;
  const rd = isoDate(reviewDate);
  return !!rd && rd > today;
}

// ── R16: reconcile fill ──
export interface LimitOrder { side: string; op: ">=" | "<="; price: number; raw: string }
export function parseLimitOrder(text: string | null | undefined): LimitOrder | null {
  const s = String(text ?? "");
  const m = s.match(LIMIT_ORDER_REGEX);
  if (!m) return null;
  const price = num(m[3]);
  if (price == null || price <= 0) return null;
  const op = m[2] === "≥" || m[2] === ">=" ? ">=" : "<=";
  return { side: m[1].toUpperCase(), op, price, raw: m[0] };
}
/**
 * R16 — RED when spot has crossed a noted limit and no FILLED token is written.
 * `sharesBaseline` (shares when the order was first seen) clears the card once SHARES changes.
 */
export function reconcileFill(
  h: Pick<HoldingIn, "price" | "shares" | "notes" | "deploy_note" | "trigger_review_note">,
  sharesBaseline?: number | null,
): LimitOrder | null {
  for (const text of [h.deploy_note, h.trigger_review_note, h.notes]) {
    const o = parseLimitOrder(text);
    if (!o) continue;
    if (String(text).toUpperCase().includes(FILLED_TOKEN)) return null;
    if (sharesBaseline != null && h.shares != null && h.shares !== sharesBaseline) return null;
    const crossed = o.op === ">=" ? h.price >= o.price : h.price <= o.price;
    return crossed ? o : null;
  }
  return null;
}

// ── R11: hold alerts ──
export function irrPct(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return Math.abs(raw) <= 2 ? raw * 100 : raw;
}
export interface HoldAlert { status: string; severity: Severity; due: string }
export function holdAlert(h: HoldingIn, irrBbRaw: number | null | undefined): HoldAlert | null {
  const st = up(h.alert_status);
  if (!(HOLD_ALERT_STATUSES as readonly string[]).includes(st)) return null;
  if (st === "ADD_ZONE") {
    const add = num(h.trigger_price_add);
    const irr = irrPct(irrBbRaw);
    if (add == null || add <= 0) return null;
    if (irr == null || irr < IRR_BB_MIN) return null;
  }
  const due = isoDate(h.alert_fired_date);
  return { status: st, severity: st === "STOP_BREACH" ? "RED" : "AMBER", due: due || "" };
}

// ── Entry zone parsing (display only) ──
export function parseZone(entry: string | undefined): { low: number; high: number } | null {
  if (!entry) return null;
  const nums = (String(entry).match(/[\d]+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(/,/g, ""))).filter((n) => n > 0);
  if (nums.length === 0) return null;
  if (nums.length === 1) return { low: nums[0], high: nums[0] };
  return { low: Math.min(nums[0], nums[1]), high: Math.max(nums[0], nums[1]) };
}

// ── Builder ──
export interface BuildArgs {
  holdings: HoldingIn[];
  watchlist: WatchIn[];
  scores: ScoreIn[];
  earnings: EarningsIn[];
  tracker?: TrackerRowIn[];
  today: string;
  gm?: { aggregatePct: number; deployed: number; staged: number } | null;
  sharesBaseline?: Record<string, number>;
}

export interface Surface {
  decide: Candidate[];
  prepare: Candidate[];
  watch: Candidate[];
  missed: Candidate[];
  backlog: Candidate[];
  overflow: number;
  wakeWithin10: number;
}

const SEV_RANK: Record<Severity, number> = { RED: 0, AMBER: 1, GREY: 2 };

export function routeTrackerRow(r: TrackerRowIn, today: string): Lane {
  const t = up(r.action_type);
  if ((BACKLOG_ACTION_TYPES as readonly string[]).includes(t)) return "BACKLOG";
  if (t === "MANUAL" && !r.ticker) return "BACKLOG";
  const due = isoDate(r.due_date);
  if (!due) return "WATCH";
  const d = daysFrom(today, due);
  if (d < -MISSED_AFTER_DAYS) return "MISSED";
  if (d <= 0) return "DECIDE";
  if (d <= PREPARE_HORIZON_DAYS) return "PREPARE";
  return "WATCH";
}

export function buildSurface(a: BuildArgs): Surface {
  const { today } = a;
  const dead = buildDeadSet(a.holdings, a.watchlist, a.scores);
  const scoreBy = new Map<string, ScoreIn>();
  for (const s of a.scores) if (!scoreBy.has(up(s.ticker))) scoreBy.set(up(s.ticker), s);
  const heldSet = new Set(a.holdings.map((h) => up(h.ticker)));
  const byKey = new Map<string, Candidate>();
  let wakeWithin10 = 0;

  const emit = (c: Omit<Candidate, "key" | "accounts" | "reasons"> & { reason: string; account?: string }) => {
    const ticker = up(c.ticker);
    if (ticker && dead.has(ticker)) return; // R10
    const key = `${ticker}:${c.trigger_type}`;
    const prev = byKey.get(key);
    if (prev) {
      if (!prev.reasons.includes(c.reason)) prev.reasons.push(c.reason);
      if (c.account && !prev.accounts.includes(c.account)) prev.accounts.push(c.account);
      if (SEV_RANK[c.severity] < SEV_RANK[prev.severity]) prev.severity = c.severity;
      const laneRank: Record<Lane, number> = { DECIDE: 0, MISSED: 1, PREPARE: 2, WATCH: 3, BACKLOG: 4 };
      if (laneRank[c.lane] < laneRank[prev.lane]) prev.lane = c.lane;
      return;
    }
    const { reason, account, ...rest } = c;
    byKey.set(key, { ...rest, ticker, key, reasons: [reason], accounts: account ? [account] : [] });
  };

  // ── HOLDINGS ──
  for (const h of a.holdings) {
    const t = up(h.ticker);
    if (!t || !h.price) continue;
    const note = h.trigger_review_note || "";
    const superseded = isSuperseded(note, h.trigger_review_date, today);
    const verdict = findVerdict(note);
    const nextReview = isoDate(h.trigger_review_date) || null;

    // Stop proximity — price triggers always override supersession (R12).
    const stop = num(h.trigger_price_exit);
    if (stop && stop > 0) {
      const dist = ((h.price - stop) / stop) * 100;
      if (dist < -STOP_BREACH_IMPLAUSIBLE_PCT) {
        emit({ ticker: t, trigger_type: "VERIFY_STOP", title: "Verify stop field", lane: superseded ? "WATCH" : "DECIDE", severity: "AMBER",
          fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: verdict, next_review: nextReview, layer: h.layer,
          reason: `Px ${h.price} is ${dist.toFixed(1)}% below stop ${stop}: likely an upside trigger in the stop field`, account: h.account });
      } else if (dist <= APPROACHING_STOP_PCT) {
        emit({ ticker: t, trigger_type: "STOP", title: dist < 0 ? "Stop breached" : "Approaching stop", lane: "DECIDE", severity: "RED",
          fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: verdict, next_review: nextReview, layer: h.layer,
          reason: `Px ${h.price} vs stop ${stop} (${dist.toFixed(1)}%)`, account: h.account });
      }
    }

    // R16 — reconcile fill
    const fill = reconcileFill(h, a.sharesBaseline?.[t]);
    if (fill) {
      emit({ ticker: t, trigger_type: "RECONCILE_FILL", title: "Reconcile fill: check broker, log contract note", lane: "DECIDE", severity: "RED",
        fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: null, next_review: null, layer: h.layer,
        reason: `${fill.side} limit ${fill.op} ${fill.price}; spot ${h.price}; ${h.shares ?? "?"} sh held`, account: h.account });
    }

    // R11 — hold alerts (R12 supersession applies; R13 automation notes never an event)
    const alert = holdAlert(h, scoreBy.get(t)?.irrBbSheet);
    if (alert) {
      emit({ ticker: t, trigger_type: `HOLD_ALERT_${alert.status}`, title: alert.status.replace(/_/g, " "),
        lane: superseded ? "WATCH" : "DECIDE", severity: alert.severity, fired_at: alert.due || null,
        source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: verdict, next_review: nextReview, layer: h.layer,
        reason: isAutomationNote(note) ? `ALERT_STATUS ${alert.status}` : `ALERT_STATUS ${alert.status}: ${note.slice(0, 140)}`,
        account: h.account });
    }
  }

  // ── WATCHLIST (R15) ──
  let batchNames = 0;
  for (const w of a.watchlist) {
    const t = up(w.ticker);
    if (!t || dead.has(t) || heldSet.has(t)) continue;
    const st = up(w.status).replace(/\s+/g, "_");
    const note = w.triggerReviewNote || "";
    const superseded = isSuperseded(note, w.triggerReviewDate, today);
    const rd = isoDate(w.triggerReviewDate);
    if (rd && rd <= today) batchNames++;
    if (st.startsWith("WAIT_EVENT")) continue; // never wakes on price
    const px = num(w.current);
    if (px == null || px <= 0) continue;
    const zone = parseZone(w.entry);
    const edge = w.triggerPriceNumeric && w.triggerPriceNumeric > 0 ? w.triggerPriceNumeric : zone?.high ?? null;
    if (!edge) continue;
    const base = { ticker: t, source: "WATCHLIST", source_ref: null, gate_test: null, verdict_at: findVerdict(note), next_review: rd || null, layer: w.layer, fired_at: today };
    const lane: Lane = superseded ? "WATCH" : "DECIDE";
    if (zone && px < zone.low && st.startsWith("WAIT_PRICE")) {
      emit({ ...base, trigger_type: "BELOW_ZONE", title: "Below zone: thesis check", lane, severity: "AMBER", reason: `Px ${px} < buy_low ${zone.low}` });
    } else if (px <= edge) {
      emit({ ...base, trigger_type: "IN_ZONE", title: "In zone", lane, severity: "AMBER", reason: `Px ${px} ≤ edge ${edge}` });
    } else {
      const dist = ((px - edge) / edge) * 100;
      if (dist <= WATCH_WAKE_PCT) {
        wakeWithin10++;
        emit({ ...base, trigger_type: "APPROACHING_ZONE", title: "Approaching zone", lane, severity: "GREY", reason: `Px ${px} is ${dist.toFixed(1)}% above edge ${edge}` });
      }
    }
  }
  if (batchNames > 0) {
    emit({ ticker: "", trigger_type: "BATCH_REVIEW", title: `Weekly batch review: ${batchNames} names`, lane: "PREPARE", severity: "GREY",
      fired_at: today, source: "WATCHLIST", source_ref: null, gate_test: null, verdict_at: null, next_review: null, reason: "Watchlist review dates reached" });
  }

  // ── EARNINGS (R14) — held only ──
  const holdingNotes = new Map<string, string>();
  for (const h of a.holdings) {
    const t = up(h.ticker);
    holdingNotes.set(t, [holdingNotes.get(t), h.trigger_review_note, h.notes].filter(Boolean).join(" | "));
  }
  const wlNotes = new Map(a.watchlist.map((w) => [up(w.ticker), w.triggerReviewNote || ""]));
  for (const e of a.earnings) {
    const t = up(e.ticker);
    if (!heldSet.has(t)) continue;
    const d = isoDate(e.nextEarningsDate);
    if (!d) continue;
    const delta = daysFrom(today, d);
    const notes = [holdingNotes.get(t), wlNotes.get(t)].filter(Boolean).join(" | ");
    const gateMatch = notes.split("|").map((s) => s.trim()).find((s) => /print|earnings|results|\bQ[1-4]\b|report/i.test(s) && !isAutomationNote(s));
    if (delta >= 0 && delta <= EARNINGS_PREPARE_DAYS) {
      emit({ ticker: t, trigger_type: "EARNINGS", title: `Earnings ${d}${e.fiscalPeriod ? ` (${e.fiscalPeriod})` : ""}`, lane: "PREPARE", severity: "GREY",
        fired_at: d, source: "EARNINGS", source_ref: null, gate_test: gateMatch ?? null, verdict_at: null, next_review: d,
        reason: e.confirmed ? "Confirmed date" : "Date unconfirmed" });
    } else if (delta < 0) {
      const check = addBusinessDays(d, THESIS_CHECK_BUSINESS_DAYS);
      const cd = daysFrom(today, check);
      if (cd < -MISSED_AFTER_DAYS) continue;
      const lane: Lane = cd > 0 ? "PREPARE" : "DECIDE";
      emit({ ticker: t, trigger_type: "THESIS_CHECK", title: `Post-print thesis check (print ${d})`, lane, severity: "GREY",
        fired_at: check, source: "EARNINGS", source_ref: null, gate_test: gateMatch ?? null, verdict_at: null, next_review: check,
        reason: `Print ${d} + ${THESIS_CHECK_BUSINESS_DAYS} business days` });
    }
  }

  // ── G(m) (R20) ──
  if (a.gm) {
    const s = gmStatus(a.gm.aggregatePct, a.gm.deployed, today);
    if (s.level !== "OK") {
      emit({ ticker: "G(m)", trigger_type: "GM_CAP", title: s.label, lane: "DECIDE", severity: s.level === "BREACH" ? "RED" : "AMBER",
        fired_at: today, source: "SCORES", source_ref: null, gate_test: null, verdict_at: s.level === "SOFT" ? GM_SOFT_CAP_ACK.since : null,
        next_review: s.level === "SOFT" ? GM_SOFT_CAP_ACK.expires : null,
        reason: `Aggregate ${a.gm.aggregatePct.toFixed(1)}% vs ${GM_MAX_AGGREGATE_PCT}%, ${a.gm.deployed}/${GM_MAX_POSITIONS}${s.frozen ? ", staged FROZEN" : ""}` });
    }
  }

  // ── action_tracker (R17) ──
  for (const r of a.tracker ?? []) {
    if (up(r.status) !== "OPEN") continue;
    const lane = routeTrackerRow(r, today);
    const t = up(r.ticker);
    emit({ ticker: t, trigger_type: `TRACKER_${up(r.action_type)}`, title: r.summary.slice(0, 120), lane,
      severity: lane === "MISSED" ? "GREY" : up(r.priority) === "HIGH" ? "AMBER" : "GREY",
      fired_at: isoDate(r.due_date) || null, source: r.source || "TRACKER", source_ref: r.id, gate_test: null, verdict_at: null,
      next_review: isoDate(r.due_date) || null, layer: r.layer ?? undefined, reason: `Due ${isoDate(r.due_date)}` });
  }

  // ── Lanes + R18 cap ──
  const all = Array.from(byKey.values());
  const decideAll = all.filter((c) => c.lane === "DECIDE").sort((x, y) => SEV_RANK[x.severity] - SEV_RANK[y.severity]);
  const decide = decideAll.slice(0, DECIDE_CAP);
  const overflowItems = decideAll.slice(DECIDE_CAP).map((c) => ({ ...c, lane: "WATCH" as Lane }));
  const byDate = (x: Candidate, y: Candidate) => String(x.next_review ?? "9").localeCompare(String(y.next_review ?? "9"));
  return {
    decide,
    prepare: all.filter((c) => c.lane === "PREPARE").sort(byDate),
    watch: [...all.filter((c) => c.lane === "WATCH"), ...overflowItems],
    missed: all.filter((c) => c.lane === "MISSED"),
    backlog: all.filter((c) => c.lane === "BACKLOG"),
    overflow: overflowItems.length,
    wakeWithin10,
  };
}

// ── R20: G(m) status ──
export interface GmState { level: "OK" | "SOFT" | "BREACH"; label: string; frozen: boolean; ackActive: boolean }
export function gmStatus(aggregatePct: number, deployed: number, today: string): GmState {
  const ackActive = today >= GM_SOFT_CAP_ACK.since && today < GM_SOFT_CAP_ACK.expires;
  const frozen = deployed >= GM_MAX_POSITIONS;
  if (aggregatePct > GM_MAX_AGGREGATE_PCT) {
    return ackActive
      ? { level: "SOFT", label: `Soft cap ${aggregatePct.toFixed(1)}% vs ${GM_MAX_AGGREGATE_PCT}% · staged FROZEN`, frozen: true, ackActive }
      : { level: "BREACH", label: `BREACH ${aggregatePct.toFixed(1)}% vs ${GM_MAX_AGGREGATE_PCT}%`, frozen: true, ackActive };
  }
  return { level: "OK", label: "", frozen, ackActive };
}
