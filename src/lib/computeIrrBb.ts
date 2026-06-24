/**
 * IRR-BB computation — mirrors the sheet formula in SCORES col AU.
 *
 * Formula: (BULL_BASE / LIVE_PRICE) ^ (1 / max(YEARS, 0.5)) - 1 + DIV_YIELD
 * Where YEARS = (BB_TARGET_DATE - TODAY) / 365.25, floored at 0.5.
 *
 * OB v3.12 §3.4.8 is authoritative.
 */

export type IrrBbBand = "DEPLOY" | "ACTIONABLE" | "HOLD_ONLY" | "DORMANT" | null;

export interface IrrBbResult {
  /** Annualised implied return as decimal (0.25 = 25%). Null if inputs missing. */
  irrBb: number | null;
  /** Years from today to BB target date, floored at 0.5. */
  yearsRemaining: number | null;
  /** ISO date string for the target. */
  bbTargetDate: string | null;
  /** Dividend yield as decimal (0.025 = 2.5%). */
  divYield: number;
  /** Live price used in the computation. */
  livePrice: number | null;
  /** Bull base target from the quartet. */
  bullBase: number | null;
  /** Doctrine band: >20% DEPLOY, 15-20% ACTIONABLE, <15% HOLD_ONLY/DORMANT. */
  band: IrrBbBand;
  /** True when |livePrice/priceAtLastScore - 1| > 0.2. */
  priceDevFlag: boolean;
  /** True when yearsRemaining < 1 (near-term). */
  nearTerm: boolean;
  /** True when livePrice > bullBase (negative IRR: overvalued vs thesis). */
  aboveBull: boolean;
}

const EMPTY: IrrBbResult = {
  irrBb: null, yearsRemaining: null, bbTargetDate: null, divYield: 0,
  livePrice: null, bullBase: null, band: null, priceDevFlag: false,
  nearTerm: false, aboveBull: false,
};

function yearsUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diff = (d.getTime() - Date.now()) / (365.25 * 86400000);
  return diff;
}

function toBand(irr: number, isHeld: boolean): IrrBbBand {
  if (irr > 0.20) return "DEPLOY";
  if (irr >= 0.15) return "ACTIONABLE";
  return isHeld ? "HOLD_ONLY" : "DORMANT";
}

export function computeIrrBb(
  bullBase: number | null,
  livePrice: number | null,
  bbTargetDate: string | null,
  divYield: number | null,
  priceAtLastScore: number | null,
  isHeld: boolean = false,
): IrrBbResult {
  const dy = divYield ?? 0;

  if (bullBase === null || bullBase <= 0 || livePrice === null || livePrice <= 0 || !bbTargetDate) {
    return { ...EMPTY, livePrice, bullBase, bbTargetDate, divYield: dy };
  }

  const rawYears = yearsUntil(bbTargetDate);
  if (rawYears === null) {
    return { ...EMPTY, livePrice, bullBase, bbTargetDate, divYield: dy };
  }

  const years = Math.max(rawYears, 0.5);
  const ratio = bullBase / livePrice;

  // IRR = ratio^(1/years) - 1 + divYield
  let irr: number;
  if (ratio <= 0) {
    irr = -1 + dy; // total loss scenario
  } else {
    irr = Math.pow(ratio, 1 / years) - 1 + dy;
  }

  // Cap at 99.9% for display sanity
  irr = Math.min(irr, 0.999);

  const priceDevFlag = priceAtLastScore !== null && priceAtLastScore > 0
    ? Math.abs(livePrice / priceAtLastScore - 1) > 0.2
    : false;

  return {
    irrBb: irr,
    yearsRemaining: Math.max(rawYears, 0),
    bbTargetDate,
    divYield: dy,
    livePrice,
    bullBase,
    band: toBand(irr, isHeld),
    priceDevFlag,
    nearTerm: rawYears < 1,
    aboveBull: livePrice > bullBase,
  };
}

/** Format IRR for display: "24.5%" or "---" */
export function formatIrr(irr: number | null): string {
  if (irr === null) return "---";
  return `${(irr * 100).toFixed(1)}%`;
}

/** Format years: "2.1" or "---" */
export function formatYears(years: number | null): string {
  if (years === null) return "---";
  if (years <= 0) return "exp";
  return years.toFixed(1);
}
