/**
 * Sprint B1 — R25 POSITION_OVER_CEILING, R27 TIER_CROSS_DOWN, R4 deployment drought.
 * Pure, display/routing only: never feeds score, IRR-BB, asymmetry, band or regime maths.
 */
import {
  CEILING_CORE_PCT, CEILING_SAT_PCT, CEILING_GM_PCT, CEILING_PREPROD_PCT, CEILING_RED_MARGIN_PP, CEILING_EXEMPT_PROFILES,
  TIER_THRESHOLDS, TIER_CROSS_MAX_AGE_DAYS, STRESS_RELEASE_DATE, R4_DAYS, R4_NET_DP_PCT, USD_EARMARK_GBP, R4_CLOSE_UTC_HOUR, R4_TRACKER_TOKEN,
} from "@/config/signalRules";

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();
const MON: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const pad = (n: number | string) => String(n).padStart(2, "0");

/** ISO, gviz Date(y,m,d), dd/mm/yyyy (UK) or "14 Nov 2026" → YYYY-MM-DD; else "". */
export function anyDate(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2] + 1)}-${pad(m[3])}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MON[m[2].toUpperCase()]) return `${m[3]}-${pad(MON[m[2].toUpperCase()])}-${pad(m[1])}`;
  return "";
}
const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

// ── R25 ──
export interface CeilingHolding { ticker: string; account?: string; mv?: number; tier?: string }
export interface CeilingScore { ticker: string; tier?: string; framework?: string; returnProfile?: string }
export interface CeilingRow { ticker: string; weightPct: number; ceilingPct: number; overGbp: number; accounts: string[]; basis: string; severity: "AMBER" | "RED" }

/** Ceiling for one name (first match wins) or null when exempt. */
export function ceilingFor(score: CeilingScore | undefined, holdingTier?: string): { pct: number; basis: string } | null {
  const rp = up(score?.returnProfile);
  if ((CEILING_EXEMPT_PROFILES as readonly string[]).includes(rp)) return null;
  if (up(score?.framework).replace(/\s/g, "").includes("G(M)")) return { pct: CEILING_GM_PCT, basis: "G(m)" };
  if (rp.replace(/[\s-]/g, "_") === "PRE_PRODUCTION") return { pct: CEILING_PREPROD_PCT, basis: "PRE_PRODUCTION" };
  const tier = up(score?.tier || holdingTier);
  if (tier.startsWith("CORE")) return { pct: CEILING_CORE_PCT, basis: "Core" };
  if (tier.startsWith("SAT")) return { pct: CEILING_SAT_PCT, basis: "Satellite" };
  return null;
}

/** R25 — aggregate weight across SIPP / ISA / Bordier_GIA (JISA excluded) vs the single-name ceiling. */
export function positionCeilings(holdings: CeilingHolding[], scores: CeilingScore[], aumGbp: number | null | undefined): CeilingRow[] | null {
  if (!aumGbp || !(aumGbp > 0)) return null;
  const scoreBy = new Map<string, CeilingScore>();
  for (const s of scores) if (!scoreBy.has(up(s.ticker))) scoreBy.set(up(s.ticker), s);
  const agg = new Map<string, { mv: number; accounts: Set<string>; tier?: string }>();
  for (const h of holdings) {
    const t = up(h.ticker);
    if (!t || t === "CASH" || up(h.account).startsWith("JISA")) continue;
    const mv = Number(h.mv) || 0;
    const e = agg.get(t) ?? { mv: 0, accounts: new Set<string>(), tier: h.tier };
    e.mv += mv;
    if (h.account && mv) e.accounts.add(h.account);
    agg.set(t, e);
  }
  const out: CeilingRow[] = [];
  for (const [t, e] of agg) {
    const c = ceilingFor(scoreBy.get(t), e.tier);
    if (!c) continue;
    const weightPct = (e.mv / aumGbp) * 100;
    if (!(weightPct > c.pct)) continue;
    out.push({ ticker: t, weightPct, ceilingPct: c.pct, basis: c.basis, overGbp: e.mv - (c.pct / 100) * aumGbp,
      accounts: [...e.accounts].sort(), severity: weightPct > c.pct + CEILING_RED_MARGIN_PP ? "RED" : "AMBER" });
  }
  return out.sort((a, b) => b.weightPct - b.ceilingPct - (a.weightPct - a.ceilingPct));
}

// ── R27 ──
export interface ScoreLogIn { ticker: string; date: unknown; score: number | null; changeNote?: string }
export interface TierDrop { ticker: string; prev: number; next: number; threshold: number; tier: string; date: string; note: string; severity: "AMBER" | "RED" }
export const tierOf = (s: number) => (s >= 80 ? "Core" : s >= 60 ? "Satellite" : s >= 40 ? "Spec" : "below 40");

/**
 * R27 — HELD names only (HEDGE / VEHICLE exempt): the composite crossed 80 / 60 / 40 downward and is still below.
 * The 30-day window applies to the SCORE_LOG row where it first fell below (later restamps don't refresh it),
 * and no dated operator verdict (verdictDate) on/after that crossing date.
 */
export function tierCrossDowns(log: ScoreLogIn[], held: Set<string>, today: string, verdictDate: (ticker: string) => string | null, exempt?: Set<string>): TierDrop[] {
  const by = new Map<string, { date: string; score: number; note: string }[]>();
  for (const r of log) {
    const t = up(r.ticker), d = anyDate(r.date);
    if (!t || !d || r.score == null || !Number.isFinite(r.score) || !held.has(t) || exempt?.has(t)) continue;
    by.set(t, [...(by.get(t) ?? []), { date: d, score: r.score, note: String(r.changeNote ?? "").trim() }]);
  }
  const out: TierDrop[] = [];
  for (const [t, rows] of by) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const latest = rows[rows.length - 1];
    let best: TierDrop | null = null;
    for (const th of TIER_THRESHOLDS) {
      if (latest.score >= th) continue;
      // Walk back over the run of rows below th; the crossing row is the first of that run.
      let i = rows.length - 1;
      while (i > 0 && rows[i - 1].score < th) i--;
      if (i === 0) continue; // never above th in the log
      const cross = rows[i], prev = rows[i - 1];
      const age = days(cross.date, today);
      if (age < 0 || age > TIER_CROSS_MAX_AGE_DAYS) continue;
      if (!best || th < best.threshold) best = { ticker: t, prev: prev.score, next: cross.score, threshold: th, tier: tierOf(latest.score), date: cross.date, note: cross.note, severity: th <= 60 ? "RED" : "AMBER" };
    }
    if (!best) continue;
    const v = verdictDate(t);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= best.date) continue;
    out.push(best);
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// ── R4 ──
const isWeekday = (iso: string) => { const d = new Date(iso + "T00:00:00Z").getUTCDay(); return d !== 0 && d !== 6; };
/** Last completed weekday: today once past the close, else the previous weekday. */
export function lastCompletedWeekday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!(isWeekday(d.toISOString().slice(0, 10)) && now.getUTCHours() >= R4_CLOSE_UTC_HOUR)) {
    do d.setUTCDate(d.getUTCDate() - 1); while (!isWeekday(d.toISOString().slice(0, 10)));
  }
  return d.toISOString().slice(0, 10);
}
/** Weekdays in (from, to]. */
export function weekdaysBetween(from: string, to: string): number {
  let n = 0;
  const d = new Date(from + "T00:00:00Z");
  while (d.toISOString().slice(0, 10) < to) { d.setUTCDate(d.getUTCDate() + 1); if (isWeekday(d.toISOString().slice(0, 10))) n++; }
  return n;
}
export interface R4In {
  asOf: string;
  regimeState: string | null | undefined;
  grossCashGbp: number | null | undefined;
  aumGbp: number | null | undefined;
  transactions?: { date: string; action: string }[];
  tracker?: { id: string; summary: string; status: string; resolved_at?: string | null }[];
}
export interface R4State { day: number; from: string; netDpPct: number | null; fire: boolean; trackerId: string | null; reason: string }
export const isR4Row = (summary: string) => summary.toLowerCase().includes(R4_TRACKER_TOKEN.toLowerCase());

export function r4Drought(i: R4In): R4State {
  let from = STRESS_RELEASE_DATE;
  for (const t of i.transactions ?? []) {
    const d = anyDate(t.date);
    if (d > STRESS_RELEASE_DATE && d <= i.asOf && /\bBUY\b/.test(up(t.action)) && d > from) from = d;
  }
  let trackerId: string | null = null;
  for (const r of i.tracker ?? []) {
    if (!isR4Row(r.summary)) continue;
    if (up(r.status) === "OPEN") trackerId = r.id;
    else if (up(r.status) === "CONFIRMED") { const d = anyDate(r.resolved_at); if (d && d > from && d <= i.asOf) from = d; }
  }
  const day = weekdaysBetween(from, i.asOf);
  const netDpPct = i.grossCashGbp != null && i.aumGbp && i.aumGbp > 0 ? ((i.grossCashGbp - USD_EARMARK_GBP) / i.aumGbp) * 100 : null;
  const stress = up(i.regimeState) === "STRESS";
  const fire = stress && netDpPct != null && netDpPct > R4_NET_DP_PCT && day >= R4_DAYS;
  const reason = `Day ${day} of ${R4_DAYS} since ${from} (no BUY) · net DP est ${netDpPct == null ? "n/a" : netDpPct.toFixed(1) + "%"} (gross cash − £${USD_EARMARK_GBP.toLocaleString("en-GB")} USD earmark) > ${R4_NET_DP_PCT}%`;
  return { day, from, netDpPct, fire, trackerId, reason };
}
