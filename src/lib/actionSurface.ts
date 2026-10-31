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
  APPROACHING_ADD_PCT,
  WATCH_WAKE_STATUSES,
  EXIT_RECLASS_TAG,
  AUTO_EARN_SEGMENT,
  VERDICT_BAND_ORDER,
  IRRBB_HURDLE_PCT,
  IRRBB_RED_PCT,
  IRRBB_ARTEFACT_LOW,
  IRRBB_ARTEFACT_HIGH,
  IRRBB_RED_EXIT_TOKENS,
  QUARTET_STALE_DAYS,
  QUARTET_STALE_IRR_PCT,
  SLEEVE_FLOOR_PCT,
  SLEEVES,
  CASH_RECON_SUM_TOL_GBP,
  CASH_RECON_DP_TOL_PP,
  CASH_RECON_LAYERS_TOL_GBP,
  CASH_RECON_TEXT_DP_TOL_PP,
  CASH_RECON_CHECK_COUNT,
  IRRBB_EXEMPT_PROFILES,
  TRACKER_DECIDE_TYPES,
  TRACKER_BACKLOG_UNLESS_HIGH,
  TRACKER_PREPARE_UNLESS_HIGH,
  MISSED_HIGH_PRIORITY,
  HYGIENE_EXEMPT_ON_ARCHIVE,
  DP_MIN_PCT,
  DP_MAX_PCT,
} from "@/config/signalRules";
import { normBand } from "@/lib/watchlistBands";

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
  /** Earnings engine — staged EARNINGS_VERDICT row (DECIDE / PREPARE). */
  verdict?: { id: string; apply_target: string; payload: any; band: string; state: "NEW" | "QUEUED" | "ACCEPTED_TICKET" | "PLACED" };
  /** Earnings engine — EARNINGS_BRIEF row shown as an “Open brief” link on the PREPARE earnings card. */
  brief?: { id: string; note_path: string | null; viewed: boolean; payload: any };
  /** Small label shown with the card (e.g. R24 “STALE QUARTET 129d”). */
  badge?: string;
  /** R33 overflow order — RED doctrine card (R23 RED, CASH_RECON RED, KILL_CHECK HIGH, stop breach). */
  doctrine?: boolean;
  /** R33 — the triggers stacked into a one-per-ticker card, or the verdicts in the “Apply N confirms” card. */
  members?: Candidate[];
}

// ── Minimal input shapes (structural; Live* types satisfy them) ──
export interface HoldingIn {
  ticker: string; account?: string; layer?: string; price: number; shares?: number;
  alert_status?: string; alert_fired_date?: string | null;
  trigger_price_add?: string; trigger_price_exit?: string;
  trigger_review_date?: string; trigger_review_note?: string;
  deploy_note?: string; notes?: string; action?: string; currency?: string;
  /** Market value in GBP (R29 sleeve value). */
  mv?: number;
}
export interface WatchIn {
  ticker: string; layer?: string; status: string; current: number | string | null;
  entry?: string; triggerPriceNumeric?: number | null;
  triggerReviewDate?: string; triggerReviewNote?: string;
  /** WATCHLIST col AL — single source of truth for price bands. */
  band?: string;
}
export interface ScoreIn {
  ticker: string; heldStatus?: string; irrBbSheet?: number | null; score?: number | null;
  /** SCORES AU raw cell (R23 strict parse). Falls back to irrBbSheet (sheet fraction) when absent. */
  irrBbRaw?: unknown;
  /** AK bull_base · AO BULL_BEAR_AT_DATE · AR BB_TARGET_DATE · AT LIVE_PRICE — card text / R24 age only. */
  bullBase?: number | null; bullBearAtDate?: string | null; bbTargetDate?: string | null; livePrice?: number | null;
  /** SCORES RETURN_PROFILE — HEDGE / VEHICLE are exempt from R23. */
  returnProfile?: string;
}
export interface EarningsIn { ticker: string; nextEarningsDate?: string | null; fiscalPeriod?: string; confirmed?: boolean }
export interface TxnIn { ticker: string; account?: string; date: string; action: string }
export interface TrackerRowIn {
  id: string; ticker: string | null; action_type: string; due_date: string; summary: string;
  status: string; priority?: string; layer?: string | null; source?: string | null; dedupe_key?: string | null;
  apply_target?: string | null; staged_payload?: any;
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
    // ARCHIVE + BAND ZONE is a reset candidate, not dead.
    const archiveZone = up(w.status).startsWith("ARCHIVE") && normBand(w.band) === "ZONE";
    if (!held.has(t) && isDeadStatus(w.status) && !archiveZone) dead.add(t);
  }
  for (const s of scores) {
    const t = up(s.ticker);
    if (!held.has(t) && !onWl.has(t) && isDeadStatus(s.heldStatus)) dead.add(t);
  }
  return dead;
}

// ── R13: automation notes ──
/** Removes [AUTO_EARN ...]…[/AUTO_EARN] automation segments. */
export function stripAutoEarn(note: string | null | undefined): string {
  return String(note ?? "").replace(AUTO_EARN_SEGMENT, " ").replace(/\s{2,}/g, " ").trim();
}
export function isAutomationNote(note: string | null | undefined): boolean {
  const s = stripAutoEarn(note);
  if (!s) return true; // empty = nothing
  const u = s.toUpperCase();
  if ((AUTOMATION_PREFIXES as readonly string[]).some((p) => u.startsWith(p))) return true;
  if (/^OK:\s*$/i.test(s)) return true;
  return false;
}

// ── R12: operator supersession ──
/** Returns the verdict date (or "OPERATOR") if the note carries an operator verdict, else null. */
export function findVerdict(note: string | null | undefined): string | null {
  const s = stripAutoEarn(note);
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
  for (const raw of [h.deploy_note, h.trigger_review_note, h.notes]) {
    const text = stripAutoEarn(raw);
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
    // F2 — the Weekly ALERT_STATUS is not trusted on its own: spot must be within the add band.
    if (!(h.price > 0) || h.price > add * (1 + APPROACHING_ADD_PCT / 100)) return null;
  }
  const due = isoDate(h.alert_fired_date);
  return { status: st, severity: st === "STOP_BREACH" ? "RED" : "AMBER", due: due || "" };
}

// ── Entry zone parsing (display only) ──
/** F3 — only a purely numeric range (or single numeric value) is a zone; text conditions are not. */
export function parseZone(entry: string | undefined): { low: number; high: number } | null {
  const s = String(entry ?? "").trim();
  if (!s) return null;
  const P = "[$£€¥]?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:p|c|USD|GBP|EUR|JPY)?";
  const range = s.match(new RegExp(`^${P}\\s*(?:-|–|—|to)\\s*${P}$`, "i"));
  const single = s.match(new RegExp(`^[<>≤≥]?=?\\s*${P}$`, "i"));
  const toN = (x: string) => parseFloat(x.replace(/,/g, ""));
  if (range) {
    const a = toN(range[1]), b = toN(range[2]);
    if (!(a > 0 && b > 0)) return null;
    return { low: Math.min(a, b), high: Math.max(a, b) };
  }
  if (single) {
    const n = toN(single[1]);
    if (!(n > 0)) return null;
    return s.startsWith("<") || s.startsWith("≤") ? { low: 0, high: n } : { low: n, high: n };
  }
  return null;
}

// ── R23: IRRBB_LOW_HELD ──
/**
 * SCORES AU cell → percent. Strips % and commas; blank, #N/A or text → null (not evaluated).
 * Text with “%” is already percent; a bare number is the canonical sheet fraction (0.15 = 15%).
 */
export function parseIrrBbCell(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw * 100 : null;
  const s = String(raw).trim();
  if (!s) return null;
  const clean = s.replace(/[%,\s]/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const n = parseFloat(clean);
  return s.includes("%") ? n : n * 100;
}
/** IRR-BB percent for a SCORES row (read as-is; never computed here). */
export function scoreIrrPct(s: ScoreIn): number | null {
  if (s.irrBbRaw !== undefined) return parseIrrBbCell(s.irrBbRaw);
  return s.irrBbSheet == null || !Number.isFinite(s.irrBbSheet) ? null : s.irrBbSheet * 100;
}
const fmtNum = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : String(+n.toFixed(4)));
export interface IrrBbLow { ticker: string; kind: "LOW" | "DATA_CHECK"; severity: Severity; irr: number; text: string }
/** R23 — SCORES only: HELD rows whose AU parses below the hurdle (artefacts → DATA_CHECK). One per ticker. */
export function irrbbLowHeld(scores: ScoreIn[]): IrrBbLow[] {
  const out: IrrBbLow[] = [];
  const seen = new Set<string>();
  for (const s of scores) {
    const t = up(s.ticker);
    if (!t || seen.has(t) || up(s.heldStatus) !== "HELD") continue;
    if ((IRRBB_EXEMPT_PROFILES as readonly string[]).includes(up(s.returnProfile))) continue; // OB §3.4.0
    const irr = scoreIrrPct(s);
    if (irr == null) continue;
    if (irr < IRRBB_ARTEFACT_LOW || irr > IRRBB_ARTEFACT_HIGH) {
      seen.add(t);
      out.push({ ticker: t, kind: "DATA_CHECK", severity: "GREY", irr,
        text: `IRR-BB ${irr.toFixed(1)}% outside ${IRRBB_ARTEFACT_LOW}…${IRRBB_ARTEFACT_HIGH}%: check SCORES AU` });
      continue;
    }
    if (irr >= IRRBB_HURDLE_PCT) continue;
    seen.add(t);
    out.push({ ticker: t, kind: "LOW", severity: irr < IRRBB_RED_PCT ? "RED" : "AMBER", irr,
      text: `IRR-BB ${irr.toFixed(1)}% < ${IRRBB_HURDLE_PCT}% hurdle · spot ${fmtNum(s.livePrice)} vs BB ${fmtNum(s.bullBase)} @ ${isoDate(s.bbTargetDate) || "—"} · quartet ${isoDate(s.bullBearAtDate) || "—"}` });
  }
  return out;
}
/** R23 — a RED card leaves DECIDE only once the HOLDINGS AJ verdict contains TRIM / SELL / EXIT / HOLD-ONLY / EXIT TEST. */
export function hasRedExitVerdict(note: string | null | undefined): boolean {
  const s = stripAutoEarn(note);
  if (isAutomationNote(s)) return false;
  const alts = [...IRRBB_RED_EXIT_TOKENS].sort((a, b) => b.length - a.length).map((t) => t.replace(/[-\s]/g, "[-\\s]?")).join("|");
  return new RegExp(`(^|[^A-Z_])(${alts})(?![A-Z_])`, "i").test(s);
}

// ── R24: QUARTET_STALE_HIGH ──
/**
 * age = today − AO (blank AO → not evaluated). STALE_HIGH when age > QUARTET_STALE_DAYS and IRR-BB > QUARTET_STALE_IRR_PCT.
 * D4 — rows tripping the R23 artefact guard are excluded; `eligible` (when given) limits to HELD / live WATCHLIST names.
 */
export function staleQuartets(scores: ScoreIn[], today: string, eligible?: (t: string, s: ScoreIn) => boolean): Map<string, { age: number; irr: number; ao: string }> {
  const out = new Map<string, { age: number; irr: number; ao: string }>();
  for (const s of scores) {
    const t = up(s.ticker);
    const ao = isoDate(s.bullBearAtDate);
    if (!t || !ao || out.has(t)) continue;
    if (eligible && !eligible(t, s)) continue;
    const irr = scoreIrrPct(s);
    if (irr == null || irr < IRRBB_ARTEFACT_LOW || irr > IRRBB_ARTEFACT_HIGH) continue;
    const age = daysFrom(ao, today);
    if (age > QUARTET_STALE_DAYS && irr > QUARTET_STALE_IRR_PCT) out.set(t, { age, irr, ao });
  }
  return out;
}

// ── R29: SLEEVE_FLOOR ──
export type Sleeve = (typeof SLEEVES)[number];
export interface SleeveFloor { sleeve: Sleeve; cash: number; value: number; pct: number; below: boolean }
export function sleeveOf(account: string | null | undefined): Sleeve | null {
  const a = up(account).replace(/[^A-Z]/g, "");
  if (a.startsWith("BORDIER")) return "BORDIER";
  return (SLEEVES as readonly string[]).includes(a) ? (a as Sleeve) : null;
}
/** Sleeve value = holdings MV in that account + sleeve cash. Sleeves with no cash cell are not evaluated. */
export function sleeveFloors(holdings: HoldingIn[], cashBySleeve: { SIPP: number | null; ISA: number | null; Bordier: number | null }): SleeveFloor[] {
  const cashFor: Record<Sleeve, number | null> = { SIPP: cashBySleeve.SIPP, ISA: cashBySleeve.ISA, BORDIER: cashBySleeve.Bordier };
  const out: SleeveFloor[] = [];
  for (const sleeve of SLEEVES) {
    const cash = cashFor[sleeve];
    if (cash == null || !Number.isFinite(cash)) continue;
    const mv = holdings.filter((h) => sleeveOf(h.account) === sleeve).reduce((sum, h) => sum + (Number.isFinite(h.mv) ? (h.mv as number) : 0), 0);
    const value = mv + cash;
    if (!(value > 0)) continue;
    const pct = (cash / value) * 100;
    out.push({ sleeve, cash, value, pct, below: pct < SLEEVE_FLOOR_PCT });
  }
  return out;
}

// ── R30: CASH_RECON (four internal checks; any failure → RED) ──
/** stamp = ISO date the figure was stamped (MACRO_STATE col F / NARRATIVE B2); null = undated. */
export interface DpMention { source: string; pct: number; stamp?: string | null }
export interface CashReconIn {
  /** HOLDINGS cash block; null = source failed. */
  block: { cashHead: number | null; aum: number | null; cashTotal: number | null; grossDp: number | null;
    cashBySleeve: { SIPP: number | null; ISA: number | null; Bordier: number | null } } | null;
  /** LAYERS "Cash" row MV; null = not available. */
  layersCash: number | null;
  /** DP % figures quoted in NARRATIVE / MACRO_STATE; null = sources failed. */
  dpMentions: DpMention[] | null;
}
export type CashCheckId = "SUM" | "DP" | "LAYERS" | "TEXT";
export interface CashCheck { id: CashCheckId; label: string; ok: boolean; detail: string }
export interface StaleDpQuote { source: string; pct: number; stamp: string | null; f58: number; label: string }
export interface CashRecon {
  checks: CashCheck[]; failed: CashCheck[]; red: boolean;
  /** Checks that could not run (inputs missing) — labels. */
  skipped: string[];
  /** Quotes stamped before today that differ from F58 — AMBER chip only. */
  stale: StaleDpQuote[];
  rag: "RED" | "GREY" | "AMBER" | "GREEN";
}

const fin = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const stampIso = (s: string | null | undefined): string | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s ?? "").trim());
  return m ? m[1] : null;
};

/** DP % figures in free text: “DP 11.4%”, “dry powder at 11.39%”. Ranges such as “DP 7–8%” are ignored. */
export function extractDpMentions(
  narrative: Record<string, string> | null,
  macroRows: { key: string; currentValue: string; note?: string; lastUpdated?: string }[] | null,
  /** NARRATIVE B2 — stamp for every NARRATIVE quote. */
  narrativeStamp?: string | null,
): DpMention[] {
  const out: DpMention[] = [];
  const re = /\b(?:gross\s+)?(?:DP|dry[\s_-]*powder)\b([^\d%\n]{0,20}?)(\d{1,2}(?:\.\d+)?)\s*%/gi;
  // Conditions and thresholds (“DP net >= 7%”, “DP floor 3%”) are not quoted figures.
  const condition = /[<>=≥≤]|&[lg]t;|\b(floor|target|min|max|minimum|maximum|threshold|posture|above|below|under|over)\b/i;
  const scan = (source: string, text: string, stamp: string | null) => {
    for (const m of String(text ?? "").matchAll(re)) if (!condition.test(m[1])) out.push({ source, pct: parseFloat(m[2]), stamp });
  };
  const nStamp = stampIso(narrativeStamp);
  for (const [k, v] of Object.entries(narrative ?? {})) if (k !== "last_updated") scan(`NARRATIVE ${k}`, v, nStamp);
  for (const r of macroRows ?? []) {
    const key = up(r.key);
    const stamp = stampIso(r.lastUpdated);
    if (/(^|_)(DP|DRY_?POWDER)(_|$)/.test(key.replace(/[\s%]+/g, "_"))) {
      const raw = String(r.currentValue ?? "").trim();
      const n = parseFloat(raw.replace(/[%,\s£]/g, ""));
      if (Number.isFinite(n) && !/[£]/.test(raw)) out.push({ source: `MACRO_STATE ${r.key}`, pct: raw.includes("%") || Math.abs(n) > 1.5 ? n : n * 100, stamp });
    } else scan(`MACRO_STATE ${r.key}`, `${r.currentValue ?? ""}`, stamp);
    if (r.note) scan(`MACRO_STATE ${r.key} note`, r.note, stamp);
  }
  return out;
}

const CHECK_LABELS: Record<CashCheckId, string> = {
  SUM: "E65 = E62+E63+E64", DP: "F58 = E58/E60", LAYERS: "LAYERS Cash = E65", TEXT: "Quoted DP = F58",
};

/** R30. `today` (ISO) decides whether a quoted DP figure is current (can fail) or stale (AMBER only). */
export function cashRecon(i: CashReconIn | null | undefined, today: string = new Date().toISOString().slice(0, 10)): CashRecon | null {
  if (!i) return null;
  const checks: CashCheck[] = [];
  const stale: StaleDpQuote[] = [];
  const b = i.block;
  const { SIPP, ISA, Bordier } = b?.cashBySleeve ?? { SIPP: null, ISA: null, Bordier: null };
  if (b && fin(b.cashTotal) && fin(SIPP) && fin(ISA) && fin(Bordier)) {
    const sum = SIPP + ISA + Bordier, d = b.cashTotal - sum;
    checks.push({ id: "SUM", label: CHECK_LABELS.SUM, ok: Math.abs(d) <= CASH_RECON_SUM_TOL_GBP,
      detail: `E65 ${gbp(b.cashTotal)} vs E62+E63+E64 ${gbp(sum)} (Δ ${gbp(d)}, tol £${CASH_RECON_SUM_TOL_GBP})` });
  }
  if (b && fin(b.grossDp) && fin(b.cashHead) && fin(b.aum) && b.aum > 0) {
    const f58 = b.grossDp * 100, calc = (b.cashHead / b.aum) * 100;
    checks.push({ id: "DP", label: CHECK_LABELS.DP, ok: Math.abs(f58 - calc) <= CASH_RECON_DP_TOL_PP + 1e-9,
      detail: `F58 ${f58.toFixed(2)}% vs E58/E60 ${calc.toFixed(2)}% (tol ${CASH_RECON_DP_TOL_PP}pp)` });
  }
  if (b && fin(b.cashTotal) && fin(i.layersCash)) {
    const d = i.layersCash - b.cashTotal;
    checks.push({ id: "LAYERS", label: CHECK_LABELS.LAYERS, ok: Math.abs(d) <= CASH_RECON_LAYERS_TOL_GBP,
      detail: `LAYERS Cash ${gbp(i.layersCash)} vs E65 ${gbp(b.cashTotal)} (Δ ${gbp(d)}, tol £${CASH_RECON_LAYERS_TOL_GBP})` });
  }
  if (b && fin(b.grossDp) && i.dpMentions && i.dpMentions.length) {
    const f58 = b.grossDp * 100;
    const offAll = i.dpMentions.filter((m) => Math.abs(m.pct - f58) > CASH_RECON_TEXT_DP_TOL_PP + 1e-9);
    // Only a figure stamped today can fail; older (or undated) quotes are stale, not wrong.
    const off = offAll.filter((m) => stampIso(m.stamp) === today);
    for (const m of offAll) {
      if (stampIso(m.stamp) === today) continue;
      const stamp = stampIso(m.stamp);
      stale.push({ source: m.source, pct: m.pct, stamp, f58,
        label: `Stale DP quote: ${m.source} ${m.pct}% stamped ${stamp ?? "undated"}; live F58 ${f58.toFixed(2)}%` });
    }
    checks.push({ id: "TEXT", label: CHECK_LABELS.TEXT, ok: off.length === 0,
      detail: off.length
        ? `${off.map((m) => `${m.source} ${m.pct}% stamped ${today}`).join(", ")} vs F58 ${f58.toFixed(2)}% (tol ${CASH_RECON_TEXT_DP_TOL_PP}pp)`
        : `${i.dpMentions.length - stale.length} current quoted DP figure${i.dpMentions.length - stale.length === 1 ? "" : "s"} within ${CASH_RECON_TEXT_DP_TOL_PP}pp of F58${stale.length ? `; ${stale.length} stale` : ""}` });
  }
  const ran = new Set(checks.map((c) => c.id));
  const skipped = (Object.keys(CHECK_LABELS) as CashCheckId[]).filter((id) => !ran.has(id)).map((id) => CHECK_LABELS[id]);
  const failed = checks.filter((c) => !c.ok);
  const red = failed.length > 0;
  const rag = red ? "RED" : checks.length < CASH_RECON_CHECK_COUNT ? "GREY" : stale.length ? "AMBER" : "GREEN";
  return { checks, failed, red, skipped, stale, rag };
}

// ── R31 / R32: tracker ──
/** R31 — OPEN, priority HIGH, more than MISSED_AFTER_DAYS past due. */
export function isMissedHigh(r: Pick<TrackerRowIn, "status" | "priority" | "due_date">, today: string): boolean {
  const due = isoDate(r.due_date);
  return up(r.status) === "OPEN" && up(r.priority) === MISSED_HIGH_PRIORITY && !!due && daysFrom(today, due) < -MISSED_AFTER_DAYS;
}
/** R32 — OPEN row on a dead ticker, except CATALYST_WATCH on an ARCHIVE watchlist name. */
export function isTrackerHygiene(r: Pick<TrackerRowIn, "status" | "ticker" | "action_type">, dead: Set<string>, watchStatus: Map<string, string>): boolean {
  const t = up(r.ticker);
  if (up(r.status) !== "OPEN" || !t || !dead.has(t)) return false;
  return !isHygieneExempt(r, watchStatus);
}
function isHygieneExempt(r: Pick<TrackerRowIn, "ticker" | "action_type">, watchStatus: Map<string, string>): boolean {
  return (HYGIENE_EXEMPT_ON_ARCHIVE as readonly string[]).includes(up(r.action_type)) && up(watchStatus.get(up(r.ticker))).startsWith("ARCHIVE");
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
  /** F4 v2 — TRANSACTIONS rows; a same-side row on/after the order date clears R16. */
  transactions?: TxnIn[];
  /** R29 — HOLDINGS cash block E62:E64; null/absent = not evaluated. */
  cashBySleeve?: { SIPP: number | null; ISA: number | null; Bordier: number | null } | null;
  /** R30 — inputs for the four cash checks; absent = not evaluated. */
  cashRecon?: CashReconIn | null;
}

export interface Surface {
  decide: Candidate[];
  prepare: Candidate[];
  watch: Candidate[];
  missed: Candidate[];
  backlog: Candidate[];
  overflow: number;
  wakeWithin10: number;
  /** F8 — live names with nothing firing (held + live watchlist). */
  watchCount: number;
  /** Brief rows whose verdict (same ticker + print date) exists → set CONFIRMED “superseded by verdict”. */
  supersededBriefs: string[];
  /** R32 — OPEN tracker rows on dead tickers (Actions “Hygiene” filter). */
  hygiene: Candidate[];
  /** R24 — STALE_HIGH names → quartet age in days (HELD + live WATCHLIST only, artefacts excluded). */
  staleQuartets: Record<string, number>;
  /** R24 — the HELD subset of staleQuartets. */
  staleQuartetsHeld: string[];
  /** R23 — every LOW row (pre-cap), with whether R12 / a RED exit verdict superseded it. */
  irrbbLow: { ticker: string; severity: Severity; superseded: boolean }[];
  /** R29 — per-sleeve floor check; null when the cash block was not supplied. */
  sleeveFloors: SleeveFloor[] | null;
  /** R30 — cash reconciliation; null when either side is missing. */
  cashRecon: CashRecon | null;
}

const SEV_RANK: Record<Severity, number> = { RED: 0, AMBER: 1, GREY: 2 };

/**
 * F7 — `known` = tickers in HOLDINGS / WATCHLIST / SCORES. A ticker outside it (e.g. "INFRA")
 * counts as no ticker. MANUAL rows on dead tickers go to BACKLOG.
 */
export function routeTrackerRow(r: TrackerRowIn, today: string, known?: Set<string>, dead?: Set<string>): Lane {
  const t = up(r.action_type);
  const tk = up(r.ticker);
  const hasTicker = !!tk && (!known || known.size === 0 || known.has(tk));
  if ((BACKLOG_ACTION_TYPES as readonly string[]).includes(t)) return "BACKLOG";
  if (t === "MANUAL" && (!hasTicker || dead?.has(tk))) return "BACKLOG";
  if (tk && !hasTicker) return "BACKLOG"; // unknown ticker (e.g. INFRA) = not a position event
  const high = up(r.priority) === MISSED_HIGH_PRIORITY;
  if (!high && (TRACKER_BACKLOG_UNLESS_HIGH as readonly string[]).includes(t)) return "BACKLOG"; // D2
  const due = isoDate(r.due_date);
  if (!due) return "WATCH";
  const d = daysFrom(today, due);
  if (d < -MISSED_AFTER_DAYS) return high ? "DECIDE" : "MISSED"; // R31
  if (d <= 0) {
    // D2 — due today / inside the missed window: DECIDE only for HIGH or a decision-type row.
    if (high || (TRACKER_DECIDE_TYPES as readonly string[]).includes(t)) return "DECIDE";
    return "PREPARE";
  }
  if (!high && (TRACKER_PREPARE_UNLESS_HIGH as readonly string[]).includes(t)) return d <= PREPARE_HORIZON_DAYS ? "PREPARE" : "WATCH";
  if (d <= PREPARE_HORIZON_DAYS) return "PREPARE";
  return "WATCH";
}

/** Dev-only diagnostic: names the rule that dropped/evicted a candidate. */
function dropLog(rule: string, c: { ticker?: string; trigger_type: string; key?: string }) {
  if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") console.debug(`[actionSurface] dropped by ${rule}: ${c.ticker || "—"} ${c.trigger_type}${c.key ? ` (${c.key})` : ""}`);
}

/** Engine verdict state. PREPARE only on ACCEPT→RC_QUEUE or PLACED; apply.rc_queue alone means nothing. */
export function verdictState(d: any, rowTarget?: string | null): "NEW" | "QUEUED" | "ACCEPTED_TICKET" | "PLACED" {
  if (!d) return "NEW";
  const action = up(d.action);
  const target = up(d.apply_target ?? rowTarget);
  if (action === "PLACED") return "PLACED";
  if (action === "ACCEPT" && target === "RC_QUEUE") return "QUEUED";
  if (action === "ACCEPT" && target === "TRADE_TICKET") return "ACCEPTED_TICKET";
  return "NEW";
}

/** R33 — a verdict whose brief is NO DATA (or which has no grade yet) is not a decision. */
export function verdictNoData(sp: any): boolean {
  const vals = [sp?.grader?.band, sp?.brief_status, sp?.brief?.status, sp?.data_status, sp?.grader?.status].map((x) => up(x).replace(/_/g, " "));
  return vals.includes("NO DATA");
}

/**
 * R33 verdict lanes. Queued / placed / NO DATA / not graded → PREPARE.
 * A verdict on a name that is not held → PREPARE unless the band is KILL or RED.
 */
export function verdictLane(sp: any, band: string, state: ReturnType<typeof verdictState>, held: boolean): Lane {
  if (state === "QUEUED" || state === "PLACED") return "PREPARE";
  if (verdictNoData(sp) || !band || band === "NOT GRADED") return "PREPARE";
  if (!held && !(VERDICT_RED_BANDS as readonly string[]).includes(band)) return "PREPARE";
  return "DECIDE";
}

const isTickerCard = (c: Candidate) => !!c.ticker && c.ticker !== "G(M)";
const isRedVerdict = (c: Candidate) => !!c.verdict && (VERDICT_RED_BANDS as readonly string[]).includes(c.verdict.band);
const bandRank = (c: Candidate) => c.verdict ? (VERDICT_BAND_ORDER as readonly string[]).indexOf(c.verdict.band) >>> 0 : 99;

/** R33 overflow order: 0 RED doctrine · 1 KILL/RED verdict · 2 other RED · 3 AMBER · 4 GREY. */
export function decideTier(c: Candidate): number {
  const one = (m: Candidate) => m.doctrine && m.severity === "RED" ? 0 : isRedVerdict(m) ? 1 : m.severity === "RED" ? 2 : m.severity === "AMBER" ? 3 : 4;
  return Math.min(...(c.members?.length ? c.members : [c]).map(one));
}

const earliestOf = (dates: (string | null | undefined)[]) => dates.filter((d): d is string => !!d).sort()[0] ?? null;
const memberLine = (m: Candidate) => {
  const r = m.reasons.filter(Boolean).join("; ");
  return r ? `${m.title}: ${r}` : m.title;
};

/**
 * R33 — one DECIDE card per ticker (highest severity; every trigger stacked in reasons[]).
 * Ticker-less cards (cash, sleeve floor, G(m), grouped watchlist cards) keep their own keys.
 * Lone CONFIRM verdicts collapse into one “Apply N confirms” card.
 */
export function mergeDecide(cards: Candidate[]): Candidate[] {
  const out: Candidate[] = [];
  const byTicker = new Map<string, Candidate[]>();
  for (const c of cards) {
    if (!isTickerCard(c)) { out.push(c); continue; }
    const list = byTicker.get(c.ticker) ?? [];
    list.push(c);
    byTicker.set(c.ticker, list);
  }
  const confirms: Candidate[] = [];
  for (const [ticker, list] of byTicker) {
    if (list.length === 1) {
      const c = list[0];
      if (c.verdict && c.verdict.band === "CONFIRM" && c.verdict.state === "NEW") confirms.push(c);
      else out.push(c);
      continue;
    }
    const ranked = [...list].sort((x, y) => decideTier(x) - decideTier(y) || SEV_RANK[x.severity] - SEV_RANK[y.severity] || bandRank(x) - bandRank(y));
    const primary = ranked[0];
    const verdictCard = ranked.find((m) => m.verdict);
    out.push({
      ...primary,
      key: `${ticker}:MERGED`,
      severity: ranked.map((m) => m.severity).sort((x, y) => SEV_RANK[x] - SEV_RANK[y])[0],
      reasons: ranked.map(memberLine),
      accounts: [...new Set(ranked.flatMap((m) => m.accounts))],
      doctrine: ranked.some((m) => m.doctrine),
      verdict: verdictCard?.verdict,
      source_ref: verdictCard?.source_ref ?? primary.source_ref,
      next_review: earliestOf(ranked.map((m) => m.next_review)),
      fired_at: earliestOf(ranked.map((m) => m.fired_at)),
      gate_test: ranked.map((m) => m.gate_test).find(Boolean) ?? null,
      verdict_at: ranked.map((m) => m.verdict_at).find(Boolean) ?? null,
      members: ranked,
    });
  }
  if (confirms.length) {
    confirms.sort((x, y) => x.ticker.localeCompare(y.ticker));
    out.push({
      key: ":CONFIRM_VERDICTS", ticker: "", trigger_type: "CONFIRM_VERDICTS",
      title: `Apply ${confirms.length} confirm${confirms.length === 1 ? "" : "s"}`,
      lane: "DECIDE", severity: "GREY", source: "EARNINGS_ENGINE", source_ref: null, accounts: [], gate_test: null, verdict_at: null,
      fired_at: earliestOf(confirms.map((c) => c.fired_at)), next_review: earliestOf(confirms.map((c) => c.next_review)),
      reasons: confirms.map((c) => `${c.ticker}: ${c.reasons.filter(Boolean).join("; ") || "CONFIRM"}`),
      members: confirms,
    });
  }
  return out;
}

/** R33 — DECIDE order: tier (overflow order), severity, verdict band, next review, fired, key. */
export function sortDecide(cards: Candidate[]): Candidate[] {
  return [...cards].sort((x, y) =>
    decideTier(x) - decideTier(y) || SEV_RANK[x.severity] - SEV_RANK[y.severity] || bandRank(x) - bandRank(y)
    || String(x.next_review ?? "9").localeCompare(String(y.next_review ?? "9"))
    || String(x.fired_at ?? "9").localeCompare(String(y.fired_at ?? "9"))
    || x.key.localeCompare(y.key));
}

/** R18 + R33 — verdicts count toward the cap; the first DECIDE_CAP cards in R33 order stay, the rest overflow to WATCH. */
export function applyDecideCap(sorted: Candidate[]): { decide: Candidate[]; evicted: Candidate[] } {
  return { decide: sorted.slice(0, DECIDE_CAP), evicted: sorted.slice(DECIDE_CAP) };
}

/** Every trigger behind the DECIDE cards (merged / confirm members flattened). */
export function decideMembers(cards: Candidate[]): Candidate[] {
  return cards.flatMap((c) => c.members?.length ? c.members : [c]);
}

export function buildSurface(a: BuildArgs): Surface {
  const { today } = a;
  const dead = buildDeadSet(a.holdings, a.watchlist, a.scores);
  const scoreBy = new Map<string, ScoreIn>();
  for (const s of a.scores) if (!scoreBy.has(up(s.ticker))) scoreBy.set(up(s.ticker), s);
  const heldSet = new Set(a.holdings.map((h) => up(h.ticker)));
  const known = new Set<string>([...heldSet, ...a.watchlist.map((w) => up(w.ticker)), ...a.scores.map((s) => up(s.ticker))]);
  const byKey = new Map<string, Candidate>();
  let wakeWithin10 = 0;

  const emit = (c: Omit<Candidate, "key" | "accounts" | "reasons"> & { reason: string; account?: string; allowDead?: boolean }) => {
    const ticker = up(c.ticker);
    if (ticker && dead.has(ticker) && !c.allowDead) { dropLog("R10 dead filter", c); return; }
    const key = `${ticker}:${c.trigger_type}`;
    const prev = byKey.get(key);
    if (prev) {
      if (!prev.reasons.includes(c.reason)) prev.reasons.push(c.reason);
      if (c.account && !prev.accounts.includes(c.account)) prev.accounts.push(c.account);
      if (SEV_RANK[c.severity] < SEV_RANK[prev.severity]) prev.severity = c.severity;
      if (c.doctrine) prev.doctrine = true;
      const laneRank: Record<Lane, number> = { DECIDE: 0, MISSED: 1, PREPARE: 2, WATCH: 3, BACKLOG: 4 };
      if (laneRank[c.lane] < laneRank[prev.lane]) prev.lane = c.lane;
      return;
    }
    const { reason, account, allowDead: _allowDead, ...rest } = c;
    byKey.set(key, { ...rest, ticker, key, reasons: [reason], accounts: account ? [account] : [] });
  };

  // ── HOLDINGS ──
  for (const h of a.holdings) {
    const t = up(h.ticker);
    if (!t || !h.price) continue;
    const note = stripAutoEarn(h.trigger_review_note);
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
        emit({ ticker: t, trigger_type: "STOP", title: dist < 0 ? "Stop breached" : "Approaching stop", lane: "DECIDE", severity: "RED", doctrine: dist < 0,
          fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: verdict, next_review: nextReview, layer: h.layer,
          reason: `Px ${h.price} vs stop ${stop} (${dist.toFixed(1)}%)`, account: h.account });
      }
    }

    // R16 — reconcile fill
    let fill = reconcileFill(h, a.sharesBaseline?.[t]);
    if (fill && a.transactions?.length) {
      const f = fill;
      const orderDate = [h.deploy_note, h.trigger_review_note, h.notes].map((x) => String(x ?? "")).find((x) => x.includes(f.raw))?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const buySide = /BUY|^T\d/.test(f.side);
      if (orderDate && a.transactions.some((x) => up(x.ticker) === t && (!h.account || !x.account || up(x.account) === up(h.account))
        && isoDate(x.date) >= orderDate && (buySide ? /BUY|ADD/.test(up(x.action)) : /SELL|TRIM/.test(up(x.action))))) fill = null;
    }
    if (fill) {
      emit({ ticker: t, trigger_type: "RECONCILE_FILL", title: "Reconcile fill: check broker, log contract note", lane: "DECIDE", severity: "RED",
        fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: null, next_review: null, layer: h.layer,
        reason: `${fill.side} limit ${fill.op} ${fill.price}; spot ${h.price}; ${h.shares ?? "?"} sh held`, account: h.account });
    }

    // F5 — R13 exception: [EXIT_RECLASS] tag in AJ with no operator verdict is a decision.
    if (note.toUpperCase().includes(EXIT_RECLASS_TAG) && !verdict) {
      emit({ ticker: t, trigger_type: "EXIT_RECLASS", title: "Exit reclass: trim-or-recommit", lane: "DECIDE", severity: "AMBER",
        fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: null, next_review: nextReview, layer: h.layer,
        reason: note.slice(0, 160), account: h.account });
    }

    // R11 — hold alerts (R12 supersession applies; R13 automation notes never an event)
    const alert = holdAlert(h, scoreBy.get(t)?.irrBbSheet);
    if (alert) {
      emit({ ticker: t, trigger_type: `HOLD_ALERT_${alert.status}`, title: alert.status.replace(/_/g, " "),
        lane: superseded ? "WATCH" : "DECIDE", severity: alert.severity, fired_at: alert.due || null,
        doctrine: alert.status === "STOP_BREACH" && alert.severity === "RED",
        source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: verdict, next_review: nextReview, layer: h.layer,
        reason: isAutomationNote(note) ? `ALERT_STATUS ${alert.status}` : `ALERT_STATUS ${alert.status}: ${note.slice(0, 140)}`,
        account: h.account });
    }
  }

  // ── R23 IRRBB_LOW_HELD (SCORES only) ──
  const irrbbLow: Surface["irrbbLow"] = [];
  for (const r of irrbbLowHeld(a.scores)) {
    const rows = a.holdings.filter((h) => up(h.ticker) === r.ticker);
    let lane: Lane = "DECIDE";
    if (r.kind === "LOW" && r.severity === "AMBER"
      && rows.some((h) => isSuperseded(stripAutoEarn(h.trigger_review_note), h.trigger_review_date, today))) lane = "WATCH"; // R12
    if (r.kind === "LOW" && r.severity === "RED" && rows.some((h) => hasRedExitVerdict(h.trigger_review_note))) lane = "WATCH";
    if (r.kind === "LOW") irrbbLow.push({ ticker: r.ticker, severity: r.severity, superseded: lane !== "DECIDE" });
    const verdict = rows.map((h) => findVerdict(stripAutoEarn(h.trigger_review_note))).find(Boolean) ?? null;
    const nextReview = rows.map((h) => isoDate(h.trigger_review_date)).filter(Boolean).sort()[0] || null;
    const base = {
      ticker: r.ticker, trigger_type: r.kind === "LOW" ? "IRRBB_LOW_HELD" : "IRRBB_DATA_CHECK",
      title: r.kind === "LOW" ? "IRR-BB below hurdle" : "IRR-BB data check", lane, severity: r.severity,
      doctrine: r.kind === "LOW" && r.severity === "RED",
      fired_at: today, source: "SCORES", source_ref: null, gate_test: null, verdict_at: verdict, next_review: nextReview,
      layer: rows[0]?.layer, reason: r.text,
    };
    if (rows.length === 0) emit(base);
    for (const h of rows) emit({ ...base, account: h.account || undefined });
  }

  // ── R24 QUARTET_STALE_HIGH → WATCH with badge ──
  const liveWl = new Set(a.watchlist.map((w) => up(w.ticker)).filter((t) => t && !dead.has(t)));
  const isHeldName = (t: string, s: ScoreIn) => heldSet.has(t) || up(s.heldStatus) === "HELD";
  const stale = staleQuartets(a.scores, today, (t, s) =>
    isHeldName(t, s) || (up(s.heldStatus) === "WATCHLIST" && !dead.has(t) && (liveWl.size === 0 || liveWl.has(t))));
  const staleHeld = [...stale.keys()].filter((t) => isHeldName(t, scoreBy.get(t) ?? { ticker: t }));
  for (const [t, q] of stale) {
    emit({ ticker: t, trigger_type: "QUARTET_STALE", title: `STALE QUARTET ${q.age}d`, badge: `STALE QUARTET ${q.age}d`, lane: "WATCH", severity: "GREY",
      fired_at: today, source: "SCORES", source_ref: null, gate_test: null, verdict_at: null, next_review: null,
      reason: `Quartet ${q.ao} (${q.age}d > ${QUARTET_STALE_DAYS}d) · IRR-BB ${q.irr.toFixed(1)}% > ${QUARTET_STALE_IRR_PCT}%: re-run quartet before acting` });
  }

  // ── R29 SLEEVE_FLOOR ──
  const floors = a.cashBySleeve ? sleeveFloors(a.holdings, a.cashBySleeve) : null;
  for (const f of floors ?? []) {
    if (!f.below) continue;
    emit({ ticker: "", trigger_type: `SLEEVE_FLOOR_${f.sleeve}`, title: `Sleeve floor: ${f.sleeve} cash ${f.pct.toFixed(1)}% < ${SLEEVE_FLOOR_PCT}%`,
      lane: "DECIDE", severity: "AMBER", fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: null, next_review: null,
      reason: `Cash £${Math.round(f.cash).toLocaleString("en-GB")} of £${Math.round(f.value).toLocaleString("en-GB")} sleeve value; Capital Queue Armed rows in ${f.sleeve} blocked` });
  }

  // ── R30 CASH_RECON ──
  // Stale DP quotes are chip-only; only failed checks (red) become a DECIDE card.
  const recon = cashRecon(a.cashRecon, today);
  if (recon?.red) {
    emit({ ticker: "", trigger_type: "CASH_RECON", title: `Cash check failed: ${recon.failed.map((c) => c.label).join(" · ")}`, lane: "DECIDE", severity: "RED", doctrine: true,
      fired_at: today, source: "HOLDINGS", source_ref: null, gate_test: null, verdict_at: null, next_review: null,
      reason: recon.failed.map((c) => c.detail).join("; ") });
  }

  // ── WATCHLIST (R15) — BAND (col AL) drives IN_ZONE / APPROACHING_ZONE ──
  let batchNames = 0;
  const bandError = a.watchlist.some((w) => normBand(w.band) === "ERROR");
  const openGateTickers = new Set(
    (a.tracker ?? []).filter((r) => up(r.status) === "OPEN" && ["CATALYST_WATCH", "EARNINGS_GATE"].includes(up(r.action_type))).map((r) => up(r.ticker)),
  );
  for (const w of a.watchlist) {
    const t = up(w.ticker);
    if (!t || dead.has(t) || heldSet.has(t)) continue;
    const st = up(w.status).replace(/\s+/g, "_");
    const band = normBand(w.band);
    const note = stripAutoEarn(w.triggerReviewNote);
    const superseded = isSuperseded(note, w.triggerReviewDate, today);
    const rd = isoDate(w.triggerReviewDate);
    if (rd && rd <= today) batchNames++;
    const px = num(w.current);
    const base = { ticker: t, source: "WATCHLIST", source_ref: null, gate_test: null, verdict_at: findVerdict(note), next_review: rd || null, layer: w.layer, fired_at: today };
    const lane: Lane = superseded ? "WATCH" : "DECIDE";

    if (!bandError && band === "ZONE" && st.startsWith("ARCHIVE")) {
      emit({ ...base, trigger_type: "RESET_ZONE", title: "Archive name back in zone: re-run RCIS", lane: "DECIDE", severity: "AMBER",
        reason: `${t}: px ${px ?? "?"} vs trigger ${w.triggerPriceNumeric ?? "?"}` });
      continue;
    }
    if (!bandError && band === "ZONE" && st.startsWith("WAIT_EVENT") && !openGateTickers.has(t)) {
      emit({ ...base, trigger_type: "R3_LINT", title: "In zone, gating event undated", lane: "DECIDE", severity: "AMBER",
        reason: `${t}: px ${px ?? "?"} vs trigger ${w.triggerPriceNumeric ?? "?"}` });
      continue;
    }
    if (!(WATCH_WAKE_STATUSES as readonly string[]).some((x) => st.startsWith(x))) continue; // F3
    if (stale.has(t)) { dropLog("R24 QUARTET_STALE_HIGH (wake suppressed)", { ticker: t, trigger_type: "WAKE" }); continue; }
    if (px == null || px <= 0) continue;
    const zone = parseZone(w.entry);
    if (zone && px < zone.low && st.startsWith("WAIT_PRICE")) {
      emit({ ...base, trigger_type: "BELOW_ZONE", title: "Below zone: thesis check", lane, severity: "AMBER", reason: `Px ${px} < buy_low ${zone.low}` });
      continue;
    }
    if (!bandError) {
      if (band === "ZONE") emit({ ...base, trigger_type: "IN_ZONE", title: "In zone", lane, severity: "AMBER", reason: `BAND ZONE · Px ${px}` });
      else if (band === "NEAR") {
        wakeWithin10++;
        emit({ ...base, trigger_type: "APPROACHING_ZONE", title: "Approaching zone", lane, severity: "GREY", reason: `BAND NEAR · Px ${px}` });
      }
      continue;
    }
    // Fallback (BAND column error): old computed logic for this render only.
    const edge = w.triggerPriceNumeric && w.triggerPriceNumeric > 0 ? w.triggerPriceNumeric : zone?.high ?? null;
    if (!edge) continue;
    if (px <= edge) {
      emit({ ...base, trigger_type: "IN_ZONE", title: "In zone", lane, severity: "AMBER", reason: `Px ${px} ≤ edge ${edge}` });
    } else {
      const dist = ((px - edge) / edge) * 100;
      if (dist <= WATCH_WAKE_PCT) {
        wakeWithin10++;
        emit({ ...base, trigger_type: "APPROACHING_ZONE", title: "Approaching zone", lane, severity: "GREY", reason: `Px ${px} is ${dist.toFixed(1)}% above edge ${edge}` });
      }
    }
  }
  if (bandError) {
    emit({ ticker: "", trigger_type: "BAND_ERROR", title: "WATCHLIST BAND column error: check sheet AL2", lane: "PREPARE", severity: "AMBER",
      fired_at: today, source: "WATCHLIST", source_ref: null, gate_test: null, verdict_at: null, next_review: today, reason: "Non-standard BAND value; using computed fallback" });
  }
  if (batchNames > 0) {
    emit({ ticker: "", trigger_type: "BATCH_REVIEW", title: `Weekly batch review: ${batchNames} names`, lane: "PREPARE", severity: "GREY",
      fired_at: today, source: "WATCHLIST", source_ref: null, gate_test: null, verdict_at: null, next_review: null, reason: "Watchlist review dates reached" });
  }

  // ── EARNINGS (R14) — held only ──
  const holdingNotes = new Map<string, string>();
  for (const h of a.holdings) {
    const t = up(h.ticker);
    holdingNotes.set(t, [holdingNotes.get(t), stripAutoEarn(h.trigger_review_note), stripAutoEarn(h.notes)].filter(Boolean).join(" | "));
  }
  const wlNotes = new Map(a.watchlist.map((w) => [up(w.ticker), stripAutoEarn(w.triggerReviewNote)]));
  for (const e of a.earnings) {
    const t = up(e.ticker);
    if (!heldSet.has(t)) continue;
    const d = isoDate(e.nextEarningsDate);
    if (!d) continue;
    const delta = daysFrom(today, d);
    const notes = [holdingNotes.get(t), wlNotes.get(t)].filter(Boolean).join(" | ");
    const gateRaw = notes.split("|").map((s) => s.trim()).find((s) => /print|earnings|results|\bQ[1-4]\b|report/i.test(s) && !isAutomationNote(s));
    // F10 — a test dated before the last print is stale. Last print = this print if past, else next print − 1 quarter.
    const lastPrint = delta < 0 ? d : new Date(Date.parse(d + "T00:00:00Z") - 91 * 86400000).toISOString().slice(0, 10);
    const gateMatch = gateRaw ? (isGateTestStale(gateRaw, lastPrint) ? `STALE TEST (${gateRaw.slice(0, 80)})` : gateRaw) : undefined;
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
  const briefs: TrackerRowIn[] = [];
  const hygiene: Candidate[] = [];
  const watchStatus = new Map(a.watchlist.map((w) => [up(w.ticker), up(w.status)]));
  const verdictKeys = new Set<string>();
  for (const r of a.tracker ?? []) {
    const sp = r.staged_payload;
    if (sp?.kind === "EARNINGS_VERDICT") verdictKeys.add(`${up(sp.ticker ?? r.ticker)}|${isoDate(sp.print_date)}`);
  }
  for (const r of a.tracker ?? []) {
    if (up(r.status) !== "OPEN") continue;
    const sp = r.staged_payload;
    if (sp?.kind === "EARNINGS_BRIEF") { briefs.push(r); continue; } // never a card
    if (sp?.kind === "EARNINGS_VERDICT") {
      // Engine verdicts are never merged, superseded or dead-filtered; keyed by tracker id.
      const ticker = up(sp.ticker ?? r.ticker);
      const band = String(sp.grader?.band ?? "NOT GRADED").toUpperCase();
      const state = verdictState(sp.decision, r.apply_target);
      const printDate = isoDate(sp.print_date) || null;
      const key = `verdict:${r.id}`;
      const lane = verdictLane(sp, band, state, isHeldName(ticker, scoreBy.get(ticker) ?? { ticker }));
      byKey.set(key, {
        key, ticker, trigger_type: "EARNINGS_VERDICT",
        title: state === "QUEUED" ? "Queued for session" : state === "PLACED" ? "Placed"
          : verdictNoData(sp) ? "Earnings verdict: NO DATA" : band === "NOT GRADED" ? "Earnings verdict: not graded" : `Earnings verdict ${band}`,
        lane,
        severity: band === "KILL" || band === "RED" ? "RED" : band === "AMBER" ? "AMBER" : "GREY",
        fired_at: printDate, source: "EARNINGS_ENGINE", source_ref: r.id, accounts: [], gate_test: null,
        verdict_at: null, next_review: isoDate(sp.deadline) || isoDate(r.due_date) || null, layer: r.layer ?? undefined,
        reasons: [String(sp.band_action ?? "")],
        verdict: { id: r.id, apply_target: r.apply_target ?? "", payload: sp, band, state },
      });
      continue;
    }
    const autoType = r.dedupe_key?.match(/^AUTO:[^:]+:(R3LINT|RESET):/)?.[1];
    if (autoType) {
      const ticker = up(r.ticker);
      if (!ticker) continue;
      const trigger_type = autoType === "R3LINT" ? "R3_LINT" : "RESET_ZONE";
      const key = `${ticker}:${trigger_type}`;
      const due = isoDate(r.due_date) || null;
      const member = byKey.get(key);
      if (member) {
        if (due && (!member.next_review || due < member.next_review)) member.next_review = due;
      } else {
        const w = a.watchlist.find((row) => up(row.ticker) === ticker);
        byKey.set(key, {
          key, ticker, trigger_type, title: "", lane: "DECIDE", severity: "AMBER",
          source: "WATCHLIST", source_ref: null, accounts: [], gate_test: null, verdict_at: null,
          fired_at: today, next_review: due, layer: r.layer ?? undefined,
          reasons: [`${ticker}: px ${num(w?.current) ?? "?"} vs trigger ${w?.triggerPriceNumeric ?? "?"}`],
        });
      }
      continue; // AUTO lint/reset rows contribute to the group, never standalone tracker cards.
    }
    const t = up(r.ticker);
    if (isTrackerHygiene(r, dead, watchStatus)) { // R32 — shown in Hygiene, never hidden
      hygiene.push({ key: `hygiene:${r.id}`, ticker: t, trigger_type: `TRACKER_${up(r.action_type)}`, title: r.summary.slice(0, 120), lane: "BACKLOG",
        severity: "GREY", fired_at: isoDate(r.due_date) || null, source: r.source || "TRACKER", source_ref: r.id, reasons: [`OPEN on dead ticker (${watchStatus.get(t) || scoreBy.get(t)?.heldStatus || "dead"})`],
        accounts: [], gate_test: null, verdict_at: null, next_review: isoDate(r.due_date) || null, layer: r.layer ?? undefined });
      continue;
    }
    const exempt = dead.has(t) && isHygieneExempt(r, watchStatus);
    const lane = exempt ? routeTrackerRow(r, today, known) : routeTrackerRow(r, today, known, dead);
    const missedHigh = lane === "DECIDE" && isMissedHigh(r, today); // R31
    const killHigh = lane === "DECIDE" && up(r.action_type) === "KILL_CHECK" && up(r.priority) === MISSED_HIGH_PRIORITY; // R33 doctrine
    emit({ ticker: t, trigger_type: `TRACKER_${up(r.action_type)}`, title: `${missedHigh ? "Missed (HIGH): " : ""}${r.summary}`.slice(0, 120), lane,
      severity: missedHigh || killHigh ? "RED" : lane === "MISSED" ? "GREY" : up(r.priority) === "HIGH" ? "AMBER" : "GREY", doctrine: killHigh,
      fired_at: isoDate(r.due_date) || null, source: r.source || "TRACKER", source_ref: r.id, gate_test: null, verdict_at: null,
      next_review: isoDate(r.due_date) || null, layer: r.layer ?? undefined,
      reason: missedHigh ? `Due ${isoDate(r.due_date)} · ${-daysFrom(today, isoDate(r.due_date))} days past due` : `Due ${isoDate(r.due_date)}`, allowDead: exempt });
  }

  // ── Earnings briefs → “Open brief” on the matching PREPARE earnings card ──
  const supersededBriefs: string[] = [];
  for (const r of briefs) {
    const sp = r.staged_payload;
    const ticker = up(sp.ticker ?? r.ticker);
    if (verdictKeys.has(`${ticker}|${isoDate(sp.print_date)}`)) { supersededBriefs.push(r.id); continue; }
    const card = byKey.get(`${ticker}:EARNINGS`) ?? byKey.get(`${ticker}:THESIS_CHECK`);
    if (card) card.brief = { id: r.id, note_path: sp.note_path ?? null, viewed: !!sp.viewed_at, payload: sp };
  }

  // ── Lanes + R18 cap ──
  const candidates = Array.from(byKey.values());
  const groupedTypes = new Set(["RESET_ZONE", "R3_LINT"]);
  const all = candidates.filter((c) => c.source !== "WATCHLIST" || !groupedTypes.has(c.trigger_type));
  const earliest = (dates: (string | null)[]) => dates.filter((d): d is string => !!d).sort()[0] ?? null;
  for (const trigger_type of groupedTypes) {
    const members = candidates.filter((c) => c.source === "WATCHLIST" && c.trigger_type === trigger_type);
    const first = members[0];
    if (!first) continue;
    members.sort((x, y) => x.ticker.localeCompare(y.ticker));
    all.push({
      ...first, key: `:${trigger_type}`, ticker: "", layer: undefined,
      title: `${trigger_type === "RESET_ZONE" ? "Archive names back in zone: re-run RCIS" : "In zone, gating event undated"} (${members.length})`,
      lane: "DECIDE", severity: "AMBER", accounts: [], verdict_at: null,
      reasons: [members.flatMap((c) => c.reasons).join("; ")],
      next_review: earliest(members.map((c) => c.next_review)),
      fired_at: earliest(members.map((c) => c.fired_at)),
    });
  }
  const byDate = (x: Candidate, y: Candidate) => String(x.next_review ?? "9").localeCompare(String(y.next_review ?? "9"));
  const decideAll = sortDecide(mergeDecide(all.filter((c) => c.lane === "DECIDE")));
  const { decide, evicted } = applyDecideCap(decideAll);
  const overflowItems = evicted.map((c) => ({ ...c, lane: "WATCH" as Lane }));
  for (const c of evicted) dropLog("R18 DECIDE_CAP → WATCH", c);
  return {
    decide,
    prepare: all.filter((c) => c.lane === "PREPARE").sort(byDate),
    watch: [...all.filter((c) => c.lane === "WATCH"), ...overflowItems],
    missed: all.filter((c) => c.lane === "MISSED"),
    backlog: all.filter((c) => c.lane === "BACKLOG"),
    overflow: overflowItems.length,
    wakeWithin10,
    watchCount: countWatching(a, dead, heldSet, candidates),
    supersededBriefs,
    hygiene,
    staleQuartets: Object.fromEntries([...stale].map(([t, q]) => [t, q.age])),
    staleQuartetsHeld: staleHeld,
    irrbbLow,
    sleeveFloors: floors,
    cashRecon: recon,
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

// ── F10: gate-test staleness ──
const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
/** First date in the text (YYYY-MM-DD or "15 Jun"[ 2026]); a missing year is inferred relative to lastPrint. */
export function testDate(text: string, lastPrint: string): string | null {
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const m = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?(?:\s+(\d{4}))?/i);
  if (!m) return null;
  let y = m[3] ? +m[3] : +lastPrint.slice(0, 4);
  const mk = (yy: number) => `${yy}-${String(MONTHS[m[2].slice(0, 3).toUpperCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (!m[3] && mk(y) > lastPrint && daysFrom(lastPrint, mk(y)) > 180) y -= 1;
  return mk(y);
}
export function isGateTestStale(text: string, lastPrint: string): boolean {
  const td = testDate(text, lastPrint);
  return !!td && td < lastPrint;
}

// ── F8: watching = every live name with nothing firing ──
function countWatching(a: BuildArgs, dead: Set<string>, held: Set<string>, all: Candidate[]): number {
  const firing = new Set(all.filter((c) => c.lane === "DECIDE").map((c) => c.ticker));
  const names = new Set<string>();
  for (const t of held) if (t && !firing.has(t)) names.add(t);
  for (const w of a.watchlist) {
    const t = up(w.ticker);
    if (t && !dead.has(t) && !firing.has(t)) names.add(t);
  }
  return names.size;
}

// ── Doctrine strip (Command, under CommandHeader) ──
export type Rag = "GREEN" | "AMBER" | "RED" | "GREY";
export interface DoctrineLink { tab: string; params?: Record<string, string>; anchor?: string }
export interface DoctrineChip { id: string; label: string; rag: Rag; detail: string; link: DoctrineLink }
export interface DoctrineInput {
  gm: GmState | null;
  dpPct: number | null;
  /** null until the surface has been built (chips show GREY / no data). */
  surface: Pick<Surface, "decide" | "watch" | "hygiene" | "staleQuartets" | "staleQuartetsHeld" | "irrbbLow" | "sleeveFloors" | "cashRecon"> | null;
  /** DriversTab caps (Rule #13) counts; null = no data. */
  driverCaps: { breach: number; warn: number; ok: number } | null;
}
/** One RAG chip per doctrine check. GREY = not evaluated (counts as not green). */
export function doctrineChecks(i: DoctrineInput): DoctrineChip[] {
  const chips: DoctrineChip[] = [];
  const sf = i.surface;
  chips.push(i.gm == null
    ? { id: "gm", label: "G(m)", rag: "GREY", detail: "No data", link: { tab: "command", anchor: "gm-exposure" } }
    : { id: "gm", label: "G(m)", rag: i.gm.level === "BREACH" ? "RED" : i.gm.level === "SOFT" ? "AMBER" : "GREEN",
        detail: i.gm.level === "OK" ? "Within caps" : i.gm.label, link: { tab: "command", anchor: "gm-exposure" } });
  chips.push(i.dpPct == null
    ? { id: "dp", label: "DP", rag: "GREY", detail: "No data", link: { tab: "holdings" } }
    : { id: "dp", label: `DP ${i.dpPct.toFixed(1)}%`, rag: i.dpPct >= DP_MIN_PCT && i.dpPct <= DP_MAX_PCT ? "GREEN" : "AMBER",
        detail: `Posture ${DP_MIN_PCT}–${DP_MAX_PCT}%`, link: { tab: "holdings" } });
  if (!sf) {
    for (const [id, label, link] of [
      ["irrbb", "IRR-BB held", { tab: "command", anchor: "action-inbox" }],
      ["quartets", "Stale quartets", { tab: "intelligence" }],
      ["sleeves", "Sleeve floors", { tab: "command", anchor: "capital-queue" }],
      ["cash", "Cash recon", { tab: "holdings" }],
      ["hygiene", "Tracker hygiene", { tab: "actions", params: { view: "hygiene" } }],
    ] as [string, string, DoctrineLink][]) chips.push({ id, label, rag: "GREY", detail: "No data", link });
  } else {
    // D3 — every R23 LOW row counts, superseded ones included.
    const low = sf.irrbbLow ?? [];
    const live = low.filter((r) => !r.superseded);
    const sup = low.length - live.length;
    const red = live.filter((r) => r.severity === "RED").length, amber = live.length - red;
    const dataChecks = [...sf.decide, ...sf.watch].filter((c) => c.trigger_type === "IRRBB_DATA_CHECK").length;
    chips.push({ id: "irrbb", label: low.length ? `IRR-BB held ${low.length} · ${live.length} decide / ${sup} superseded` : "IRR-BB held",
      rag: red ? "RED" : amber || dataChecks ? "AMBER" : "GREEN",
      detail: low.length + dataChecks
        ? `${red} red · ${amber} amber · ${sup} superseded${dataChecks ? ` · ${dataChecks} data check` : ""} (< ${IRRBB_HURDLE_PCT}% hurdle; HEDGE/VEHICLE exempt)`
        : `All held ≥ ${IRRBB_HURDLE_PCT}%`,
      link: { tab: "command", anchor: "action-inbox" } });
    // D4 — HELD + live WATCHLIST only; artefact rows excluded.
    const sq = Object.entries(sf.staleQuartets);
    const sqHeld = (sf.staleQuartetsHeld ?? []).length;
    chips.push({ id: "quartets", label: sq.length ? `Stale quartets ${sqHeld} held · ${sq.length} total` : "Stale quartets", rag: sq.length ? "AMBER" : "GREEN",
      detail: sq.length ? sq.map(([t, d]) => `${t} ${d}d`).join(", ") : `None > ${QUARTET_STALE_DAYS}d with IRR-BB > ${QUARTET_STALE_IRR_PCT}%`, link: { tab: "intelligence" } });
    const below = (sf.sleeveFloors ?? []).filter((f) => f.below);
    chips.push(sf.sleeveFloors == null
      ? { id: "sleeves", label: "Sleeve floors", rag: "GREY", detail: "No data", link: { tab: "command", anchor: "capital-queue" } }
      : { id: "sleeves", label: `Sleeve floors${below.length ? ` ${below.length}` : ""}`, rag: below.length ? "AMBER" : "GREEN",
          detail: below.length ? below.map((f) => `${f.sleeve} ${f.pct.toFixed(1)}%`).join(", ") + ` < ${SLEEVE_FLOOR_PCT}%` : `All sleeves ≥ ${SLEEVE_FLOOR_PCT}% cash`,
          link: { tab: "command", anchor: "capital-queue" } });
    chips.push(cashReconChip(sf.cashRecon));
    chips.push({ id: "hygiene", label: `Tracker hygiene${sf.hygiene.length ? ` ${sf.hygiene.length}` : ""}`, rag: sf.hygiene.length ? "AMBER" : "GREEN",
      detail: sf.hygiene.length ? `${sf.hygiene.length} OPEN rows on dead names` : "No OPEN rows on dead names", link: { tab: "actions", params: { view: "hygiene" } } });
  }
  const dc = i.driverCaps;
  chips.push(dc == null
    ? { id: "drivers", label: "Driver caps", rag: "GREY", detail: "No data", link: { tab: "drivers" } }
    : { id: "drivers", label: "Driver caps", rag: dc.breach ? "RED" : dc.warn ? "AMBER" : "GREEN",
        detail: `${dc.breach} breach · ${dc.warn} warn · ${dc.ok} ok`, link: { tab: "drivers" } });
  return chips;
}

/** R30 chip. RED on any failed check; GREY when fewer than 4 ran (never green); AMBER for stale DP quotes. */
export function cashReconChip(r: CashRecon | null): DoctrineChip {
  const link: DoctrineLink = { tab: "holdings" };
  if (r == null) return { id: "cash", label: "Cash recon", rag: "GREY", detail: "No data", link };
  const n = r.checks.length, of = CASH_RECON_CHECK_COUNT;
  const staleTxt = r.stale.map((s) => s.label).join("; ");
  if (r.rag === "RED") {
    return { id: "cash", label: `Cash recon ${r.failed.length} failed`, rag: "RED", link,
      detail: [`Failed: ${r.failed.map((c) => `${c.label} (${c.detail})`).join("; ")}`, r.skipped.length ? `Skipped: ${r.skipped.join(", ")}` : "", staleTxt]
        .filter(Boolean).join(" · ") };
  }
  if (r.rag === "GREY") {
    return { id: "cash", label: `Cash recon ${n}/${of} run`, rag: "GREY", link,
      detail: [`Skipped: ${r.skipped.join(", ")}`, n ? `Passed: ${r.checks.map((c) => c.label).join(", ")}` : "", staleTxt].filter(Boolean).join(" · ") };
  }
  if (r.rag === "AMBER") {
    return { id: "cash", label: `Cash recon · ${r.stale.length} stale DP quote${r.stale.length === 1 ? "" : "s"}`, rag: "AMBER", link, detail: staleTxt };
  }
  return { id: "cash", label: "Cash recon", rag: "GREEN", link, detail: `${n}/${of} checks pass: ${r.checks.map((c) => c.label).join(", ")}` };
}

/** Command header: DECIDE card count against the R18 cap. Over = verdicts beyond the cap or cards pushed to WATCH. */
export function decideLoad(s: Pick<Surface, "decide" | "overflow"> | null): { count: number; cap: number; overflow: number; breach: boolean } | null {
  if (!s) return null;
  const count = s.decide.length;
  return { count, cap: DECIDE_CAP, overflow: s.overflow, breach: count > DECIDE_CAP || s.overflow > 0 };
}
