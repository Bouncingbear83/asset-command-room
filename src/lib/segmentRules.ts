/**
 * WATCHLIST segment rules (RESET / DATA / PARKED), mirroring the daily-run digest.
 * Pure, read-only. Version is shown in the Watchlist footer for parity checks.
 */
import { normBand, normStatusToken } from "@/lib/watchlistBands";

export const RULES_VERSION = "C29.1";
export const DATA_FIX_TICKERS = ["3363.TWO", "6187.TWO", "6223.TWO", "255A.T", "KODT.ZA", "4022.T"];
export const S2_AB_TOKENS = /\b(SUB_WEAK|SUB_FAIL|TYPE_FLOOR|THESIS_KILL|INTAKE_FAIL)\b/i;
export const S2_TEXT = /(event[-_ ]only|re-?entry only on|price route closed|no price-only re-entry)/i;
export const OOZ_DISMISSAL = /\bout of zone\b/i;
export const HANDLED_TYPES = ["CATALYST_WATCH", "THESIS_CHECK", "RESEARCH", "SOURCING", "KILL_CHECK"];
export const LEVEL_TOL = 0.005; // 0.5%
export const NUMERIC_TRIGGER = /(<=|≤|below|under|at or below)\s*[A-Z$€£¥]*\s?\d/i;

export interface SegRow {
  ticker: string; status: string; band: string; current: number | null; trigger: string;
  triggerPrice: number | null; reviewNote: string; currency: string; archiveReason: string;
}
export interface SegTracker {
  ticker: string | null; dedupe_key: string | null; status: string | null; resolution_note: string | null;
  resolved_at: string | null; created_at: string | null; summary: string | null; action_type: string | null; due_date: string | null;
}
export type ResetState = "S1" | "S2" | "S3" | "HANDLED" | "NEW";
export type Segment = "RESET" | "DATA" | "PARKED" | null;
export interface SegResult {
  ticker: string; segment: Segment; state: ResetState | "HYGIENE" | null; test: string; reason: string;
  trackerKey: string | null; tracker?: SegTracker; suppressed: boolean; belowPct: number | null;
}

const up = (s: unknown) => String(s ?? "").trim().toUpperCase();
const firstWord = (s: string) => up(s).split(/[\s;:,(]+/)[0] ?? "";

/** Currency display from WL P. GBp is a suffix. */
export function currencyAffix(ccy: string): { pre: string; post: string; code: string } {
  const c = String(ccy ?? "").trim();
  if (c === "GBp" || ["GBX", "GBP_PENCE", "GBP-PENCE"].includes(c.toUpperCase())) return { pre: "", post: "p", code: "GBp" };
  const U = c.toUpperCase();
  const map: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", KRW: "₩", TWD: "NT$", CHF: "CHF ", SEK: "kr ", DKK: "kr ", NOK: "kr " };
  return { pre: map[U] ?? (U ? U + " " : ""), post: "", code: U };
}
export function fmtCcy(v: number | null | undefined, ccy: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = currencyAffix(ccy);
  const dp = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 3;
  return `${a.pre}${v.toLocaleString("en-GB", { maximumFractionDigits: dp, minimumFractionDigits: Math.min(dp, 2) })}${a.post}`;
}
export function archiveGapPct(current: number | null | undefined, level: number | null | undefined): number | null {
  if (current == null || level == null || !(level > 0) || !Number.isFinite(current)) return null;
  return (current / level - 1) * 100;
}

/** Last 5 weekday closes identical (needs ≥5). closes in any order. */
export function closesFrozen(closes: { date: string; close: number }[] | undefined): boolean {
  if (!closes) return false;
  const wk = closes.filter((c) => { const d = new Date(c.date + "T12:00:00Z").getUTCDay(); return d !== 0 && d !== 6; })
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
  return wk.length === 5 && wk.every((c) => Number(c.close) === Number(wk[0].close));
}

function s1Match(row: SegRow, trackers: SegTracker[]): { hit: boolean; key: string | null; reason: string; latest?: SegTracker } {
  const prefix = `AUTO:${up(row.ticker)}:RESET:`;
  const latest = trackers.filter((t) => up(t.dedupe_key).startsWith(prefix))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  if (!latest) return { hit: false, key: null, reason: "" };
  const key = latest.dedupe_key;
  if (up(latest.status) !== "DISMISSED") return { hit: false, key, reason: "", latest };
  const note = String(latest.resolution_note ?? "");
  if (OOZ_DISMISSAL.test(note)) return { hit: false, key, reason: "", latest };
  const summary = String(latest.summary ?? "");
  const lm = summary.match(/level=([\d.,]+)/i);
  let levelSame: boolean;
  if (lm) {
    const lvl = Number(lm[1].replace(/,/g, ""));
    levelSame = row.triggerPrice == null || !(lvl > 0) ? true : Math.abs(row.triggerPrice / lvl - 1) <= LEVEL_TOL;
  } else {
    const resolved = String(latest.resolved_at ?? "").slice(0, 10);
    const marks = [...String(row.reviewNote ?? "").matchAll(/\[R[12]\s+(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
    levelSame = !marks.some((d) => !resolved || d > resolved);
  }
  if (!levelSame) return { hit: false, key, reason: "", latest };
  const am = summary.match(/ab=([^;]+)/i);
  const abSame = !am || firstWord(am[1]) === firstWord(row.archiveReason);
  if (!abSame) return { hit: false, key, reason: "", latest };
  return { hit: true, key, reason: note || "dismissed at this level", latest };
}

export function segmentRow(row: SegRow, trackers: SegTracker[], closes?: { date: string; close: number }[]): SegResult {
  const t = up(row.ticker);
  const st = normStatusToken(row.status);
  const band = normBand(row.band);
  const isArchive = st.startsWith("ARCHIVE");
  const base: SegResult = { ticker: row.ticker, segment: null, state: null, test: "", reason: "", trackerKey: null, suppressed: false, belowPct: archiveGapPct(row.current, row.triggerPrice) };

  if (isArchive && band === "ZONE") {
    const s1 = s1Match(row, trackers);
    if (s1.hit) return { ...base, segment: "RESET", state: "S1", test: "S1 dismissed at this level", reason: s1.reason, trackerKey: s1.key, suppressed: true };
    const ab = String(row.archiveReason ?? "").match(S2_AB_TOKENS);
    const txt = String(row.trigger ?? "").match(S2_TEXT) ?? String(row.reviewNote ?? "").match(S2_TEXT);
    if (ab || txt) return { ...base, segment: "RESET", state: "S2", test: "S2 price cannot re-open", reason: (ab ?? txt)![0], trackerKey: s1.key, suppressed: true };
    const s3Why = DATA_FIX_TICKERS.includes(t) ? "DATA_FIX ticker" : row.current == null ? "price blank" : closesFrozen(closes) ? "last 5 weekday closes identical" : "";
    if (s3Why) return { ...base, segment: "DATA", state: "S3", test: "S3 price not live", reason: `S3 price not live (${s3Why})`, trackerKey: s1.key };
    const open = trackers.find((r) => up(r.ticker) === t && up(r.status) === "OPEN" &&
      (HANDLED_TYPES.includes(up(r.action_type)) || /re-?engage/i.test(String(r.summary ?? ""))));
    if (open) return { ...base, segment: "RESET", state: "HANDLED", test: "HANDLED open follow-up", reason: String(open.summary ?? "").slice(0, 120), trackerKey: open.dedupe_key, tracker: open };
    return { ...base, segment: "RESET", state: "NEW", test: "NEW", reason: "R5: nominate only", trackerKey: s1.key };
  }

  if (["ARCHIVE", "PRE_IPO", "RESEARCH"].some((p) => st.startsWith(p)) && (band === "BENCH" || band === "")) {
    const noI = row.triggerPrice == null;
    if (noI && NUMERIC_TRIGGER.test(String(row.trigger ?? ""))) return { ...base, segment: "DATA", state: "HYGIENE", test: "level missing", reason: "level missing: numeric trigger but no trigger price" };
    if (isArchive && noI && !String(row.trigger ?? "").trim()) return { ...base, segment: "DATA", state: "HYGIENE", test: "no re-engage route", reason: "no re-engage route: no trigger, no trigger price" };
    return { ...base, segment: "PARKED", test: "PARKED" };
  }
  if (band === "NO_LEVEL" || band === "UNIT_CHECK") return { ...base, segment: "DATA", test: `band ${band}`, reason: band };
  return base;
}

export function resetChipLabel(results: SegResult[]): string {
  const h = results.filter((r) => r.state === "HANDLED").length;
  const n = results.filter((r) => r.state === "NEW").length;
  return `RESET ${h + n} · ${n} new`;
}
