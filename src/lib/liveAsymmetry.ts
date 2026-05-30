/**
 * Live Asymmetry Ratio — computed from the quartet + current price.
 *
 * The quartet (set at scoring time) defines four price targets:
 *   BULL_BASE     — base-case upside target
 *   BULL_STRETCH  — stretch upside target
 *   BEAR_THESIS_WEAK    — downside if thesis weakens
 *   BEAR_SUBSTRATE_FAIL — downside if substrate fails
 *
 * The live ratio uses BULL_BASE (the realistic upside) vs BEAR_THESIS_WEAK
 * (the realistic downside), measured from current price:
 *
 *   upside   = bullBase - currentPrice
 *   downside = currentPrice - bearThesisWeak
 *   ratio    = upside / downside
 *
 * The stretch ratio uses BULL_STRETCH / BEAR_SUBSTRATE_FAIL for the
 * full right-tail / left-tail view.
 */

export interface AsymmetryQuartet {
  bullBase: number | null;
  bullStretch: number | null;
  bearThesisWeak: number | null;
  bearSubstrateFail: number | null;
  bullBearAtDate: string | null;
}

export interface LiveAsymmetryResult {
  baseRatio: number | null;
  stretchRatio: number | null;
  price: number | null;
  band: "FULL" | "HIGH" | "PARTIAL" | "NO_DEPLOY" | null;
  belowBear: boolean;
  aboveBull: boolean;
  quartet: AsymmetryQuartet;
  quartetAgeDays: number | null;
}

const EMPTY: LiveAsymmetryResult = {
  baseRatio: null,
  stretchRatio: null,
  price: null,
  band: null,
  belowBear: false,
  aboveBull: false,
  quartet: { bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null },
  quartetAgeDays: null,
};

function toBand(ratio: number): LiveAsymmetryResult["band"] {
  if (ratio >= 4) return "FULL";
  if (ratio >= 3) return "HIGH";
  if (ratio >= 2) return "PARTIAL";
  return "NO_DEPLOY";
}

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function computeLiveAsymmetry(
  quartet: AsymmetryQuartet,
  currentPrice: number | null,
): LiveAsymmetryResult {
  if (currentPrice === null || currentPrice <= 0) return { ...EMPTY, quartet };

  const { bullBase, bullStretch, bearThesisWeak, bearSubstrateFail, bullBearAtDate } = quartet;

  let baseRatio: number | null = null;
  let stretchRatio: number | null = null;
  let band: LiveAsymmetryResult["band"] = null;
  const belowBear = bearThesisWeak !== null && currentPrice < bearThesisWeak;
  const aboveBull = bullBase !== null && currentPrice > bullBase;

  if (bullBase !== null && bearThesisWeak !== null) {
    const upside = bullBase - currentPrice;
    const downside = currentPrice - bearThesisWeak;
    if (downside > 0 && upside > 0) {
      baseRatio = Math.round((upside / downside) * 10) / 10;
      band = toBand(baseRatio);
    } else if (downside <= 0 && upside > 0) {
      baseRatio = 99;
      band = "FULL";
    } else if (upside <= 0) {
      baseRatio = 0;
      band = "NO_DEPLOY";
    }
  }

  if (bullStretch !== null && bearSubstrateFail !== null) {
    const upside = bullStretch - currentPrice;
    const downside = currentPrice - bearSubstrateFail;
    if (downside > 0 && upside > 0) {
      stretchRatio = Math.round((upside / downside) * 10) / 10;
    }
  }

  return {
    baseRatio,
    stretchRatio,
    price: currentPrice,
    band,
    belowBear,
    aboveBull,
    quartet,
    quartetAgeDays: daysBetween(bullBearAtDate),
  };
}

/** Format ratio for display: "3.5:1" or "—" */
export function formatRatio(ratio: number | null): string {
  if (ratio === null) return "—";
  if (ratio >= 99) return "∞:1";
  if (ratio <= 0) return "0:1";
  return `${ratio.toFixed(1)}:1`;
}
