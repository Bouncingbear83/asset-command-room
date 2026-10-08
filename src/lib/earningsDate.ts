/**
 * Effective earnings date for an EARNINGS_CALENDAR row.
 *
 * Columns A:E are written monthly by Earnings Calendar Refresh (Yahoo, class C).
 * Columns I:L are written by the daily run / live sessions after verifying the
 * date at source (class A/B). A verified, not-yet-printed date wins over the
 * Yahoo date; once printed (or stale), the row falls back to column B, which
 * the next refresh rolls forward to the following print.
 */
export interface EarningsDateInput {
  sheetDate: string; // col B, yyyy-mm-dd
  sheetConfirmed: boolean; // col D
  verifiedDate?: string; // col I, yyyy-mm-dd
  verifiedClass?: string; // col J, A | B | C
  verifyNote?: string; // col L
}

export interface EarningsDateResult {
  date: string;
  confirmed: boolean;
  source: "VERIFIED" | "SHEET";
  verifiedClass: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function effectiveEarningsDate(input: EarningsDateInput, todayISO: string): EarningsDateResult {
  const v = (input.verifiedDate ?? "").trim();
  const cls = (input.verifiedClass ?? "").trim().toUpperCase();
  const printed = /^\s*PRINTED/i.test(input.verifyNote ?? "");
  const usable = ISO.test(v) && !printed && v >= todayISO && (cls === "A" || cls === "B");
  if (usable) {
    return { date: v, confirmed: true, source: "VERIFIED", verifiedClass: cls };
  }
  return {
    date: input.sheetDate,
    confirmed: input.sheetConfirmed,
    source: "SHEET",
    verifiedClass: ISO.test(v) ? cls || null : null,
  };
}
