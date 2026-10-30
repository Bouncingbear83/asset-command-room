/**
 * Canonical reads — the sheet is the source of truth for every headline number.
 * The app does not recompute these; it reads them.
 *
 *   aum          = HOLDINGS E60   (includes Bordier)
 *   cashTotal    = HOLDINGS E65
 *   cashBySleeve = HOLDINGS E62:E64 (SIPP, ISA, Bordier)
 *   grossDp      = HOLDINGS F58   (cash / AUM, gross)
 *   irrBb        = SCORES AU (IRR_BB)
 *   asym         = SCORES AV (ASYM)
 *   band         = WATCHLIST AL (BAND)
 *   tier         = SCORES Q (tier)
 *
 * computeIrrBb is kept only as a dev-mode cross-check against the sheet.
 */
import { computeIrrBb, type IrrBbResult, type IrrBbBand } from "@/lib/computeIrrBb";
import type { AsymmetryQuartet, LiveAsymmetryResult } from "@/lib/liveAsymmetry";

export interface CashBlock {
  /** HOLDINGS E58 — cash on the CASH header row (numerator of F58). */
  cashHead: number | null;
  aum: number | null;
  cashTotal: number | null;
  cashBySleeve: { SIPP: number | null; ISA: number | null; Bordier: number | null };
  /** Fraction, e.g. 0.1139 = 11.39%. */
  grossDp: number | null;
}

export const EMPTY_CASH_BLOCK: CashBlock = {
  cashHead: null, aum: null, cashTotal: null, cashBySleeve: { SIPP: null, ISA: null, Bordier: null }, grossDp: null,
};

/** Range fetched for the HOLDINGS cash block. */
export const HOLDINGS_CASH_RANGE = "A56:F65";

interface HoldingPriceLike { shares?: number | null; mv?: number | null; price?: number | string | null }

/** Positive-share positions missing a sheet valuation cannot make AUM/DP complete. */
export function hasStalePrice(holding: HoldingPriceLike): boolean {
  return (holding.shares ?? 0) > 0 &&
    (holding.mv === 0 || holding.price == null || String(holding.price).trim() === "");
}

/** Count positions (account rows), not unique tickers. Does not alter sheet totals. */
export function unpricedPositionCount(holdings: readonly HoldingPriceLike[]): number {
  return holdings.filter(hasStalePrice).length;
}

function cellNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const pct = t.endsWith("%");
  const n = parseFloat(t.replace(/[£$€,%\s]/g, ""));
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}
const txt = (v: unknown) => String(v ?? "").trim().toUpperCase();

/**
 * Parse HOLDINGS rows 58–65 (cols A–F). Works whether blank rows are kept
 * (positional grid r56:r65) or dropped (Google Viz omits empty rows), by
 * matching the block's labels: A58 "CASH" (E=cash, F=gross DP), then the
 * AUM row (E60, no labels), then C62:C65 SIPP / ISA / Bordier / Total.
 */
export function parseHoldingsCashBlock(grid: unknown[][]): CashBlock {
  const out: CashBlock = { ...EMPTY_CASH_BLOCK, cashBySleeve: { ...EMPTY_CASH_BLOCK.cashBySleeve } };
  const rows = (grid || []).filter((r) => Array.isArray(r));
  const headIdx = rows.findIndex((r) => txt(r[0]) === "CASH" && !txt(r[2]) && cellNum(r[4]) !== null);
  if (headIdx < 0) return out;
  out.cashHead = cellNum(rows[headIdx][4]);
  out.grossDp = cellNum(rows[headIdx][5]);
  for (let i = headIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const label = txt(r[2]);
    const e = cellNum(r[4]);
    if (e === null) continue;
    if (!label && !txt(r[0]) && out.aum === null) out.aum = e;
    else if (label === "SIPP") out.cashBySleeve.SIPP = e;
    else if (label === "ISA") out.cashBySleeve.ISA = e;
    else if (label.startsWith("BORDIER")) out.cashBySleeve.Bordier = e;
    else if (label === "TOTAL") out.cashTotal = e;
  }
  return out;
}

// ── SCORES / WATCHLIST cell reads ───────────────────────────────────────────

interface ScoreLike { irrBbSheet?: number | null; asymSheet?: number | null; tier?: string | null }

/** SCORES AU as a decimal (0.274 = 27.4%). Accepts percent-form numbers defensively. */
export function irrBb(score: ScoreLike | null | undefined): number | null {
  const v = score?.irrBbSheet;
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.abs(v) > 1.5 ? v / 100 : v;
}
/** SCORES AV — base asymmetry ratio. */
export function asym(score: ScoreLike | null | undefined): number | null {
  const v = score?.asymSheet;
  return v === null || v === undefined || !Number.isFinite(v) ? null : v;
}
/** WATCHLIST AL. */
export function band(w: { band?: string | null } | null | undefined): string {
  return String(w?.band ?? "").trim().toUpperCase();
}
/** SCORES Q. */
export function tier(score: ScoreLike | null | undefined): string {
  return String(score?.tier ?? "").trim();
}

function irrBand(irr: number, isHeld: boolean): IrrBbBand {
  if (irr > 0.2) return "DEPLOY";
  if (irr >= 0.15) return "ACTIONABLE";
  return isHeld ? "HOLD_ONLY" : "DORMANT";
}

export interface IrrBbContext {
  isHeld: boolean;
  livePrice: number | null;
  bullBase: number | null;
  bbTargetDate: string | null;
  divYield: number | null;
  priceAtLastScore: number | null;
  ticker?: string;
}

/** IRR-BB result whose headline value is SCORES AU. Metadata (years, flags) is descriptive only. */
export function canonicalIrrBb(score: ScoreLike | null | undefined, ctx: IrrBbContext): IrrBbResult {
  const value = irrBb(score);
  const d = ctx.bbTargetDate ? new Date(ctx.bbTargetDate) : null;
  const rawYears = d && !isNaN(d.getTime()) ? (d.getTime() - Date.now()) / (365.25 * 86400000) : null;
  const res: IrrBbResult = {
    irrBb: value,
    yearsRemaining: rawYears === null ? null : Math.max(rawYears, 0),
    bbTargetDate: ctx.bbTargetDate,
    divYield: ctx.divYield ?? 0,
    livePrice: ctx.livePrice,
    bullBase: ctx.bullBase,
    band: value === null ? null : irrBand(value, ctx.isHeld),
    priceDevFlag: ctx.livePrice !== null && ctx.priceAtLastScore !== null && ctx.priceAtLastScore > 0
      ? Math.abs(ctx.livePrice / ctx.priceAtLastScore - 1) > 0.2 : false,
    nearTerm: rawYears !== null && rawYears < 1,
    aboveBull: ctx.livePrice !== null && ctx.bullBase !== null && ctx.livePrice > ctx.bullBase,
  };
  if (import.meta.env?.DEV && value !== null) {
    const check = computeIrrBb(ctx.bullBase, ctx.livePrice, ctx.bbTargetDate, ctx.divYield, ctx.priceAtLastScore, ctx.isHeld);
    if (check.irrBb !== null && Math.abs(check.irrBb - value) > 0.01) {
      console.debug(`[canonical] IRR-BB drift ${ctx.ticker ?? ""}: sheet ${(value * 100).toFixed(1)}% vs computed ${(check.irrBb * 100).toFixed(1)}%`);
    }
  }
  return res;
}

function asymBand(r: number): LiveAsymmetryResult["band"] {
  if (r >= 4) return "FULL";
  if (r >= 3) return "HIGH";
  if (r >= 2) return "PARTIAL";
  return "NO_DEPLOY";
}

/** Asymmetry result whose headline ratio and band are SCORES AV. Quartet is carried for display. */
export function canonicalAsymmetry(
  score: ScoreLike | null | undefined,
  quartet: AsymmetryQuartet,
  price: number | null,
): LiveAsymmetryResult {
  const r = asym(score);
  const at = quartet.bullBearAtDate ? new Date(quartet.bullBearAtDate) : null;
  return {
    baseRatio: r,
    stretchRatio: null,
    probWeightedRatio: null,
    divergence: null,
    price,
    band: r === null ? null : asymBand(r),
    belowBear: price !== null && quartet.bearThesisWeak !== null && price < quartet.bearThesisWeak,
    aboveBull: price !== null && quartet.bullBase !== null && price > quartet.bullBase,
    quartet,
    quartetAgeDays: at && !isNaN(at.getTime()) ? Math.floor((Date.now() - at.getTime()) / 86400000) : null,
  };
}
