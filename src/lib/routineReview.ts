/**
 * Routine review rule (R15b, session 2026-10-28).
 *
 * A held name's routine review is a staleness clock. The earnings engine
 * already owns the review at each print, so the clock only fires when no
 * print covers it. Pure function: no React, no Supabase.
 *
 * Order (first match wins):
 *  1. NO_PRINT   no EARNINGS_CALENDAR row for the ticker (ETC / ETF / fund).
 *                Suppressed: the quarterly layer review owns these names.
 *                A printing name missing its calendar row is caught by the
 *                daily run (NO_CAL_ROW).
 *  2. BACKSTOP   score_date older than BACKSTOP_DAYS. Always shown, HIGH:
 *                the score predates two prints; a full rescore is owed.
 *  3. COVERED    next print within COVER_AHEAD_DAYS, or a print in the last
 *                COVER_BEHIND_DAYS (T+1 grade and verdict pending).
 *                Suppressed: the EARNINGS_GATE / VERDICT rows carry it.
 *  4. FRESH      max(score_date, last accepted earnings verdict) within cadence.
 *  5. DUE        otherwise.
 */

export const BACKSTOP_DAYS = 180;
export const COVER_AHEAD_DAYS = 45;
export const COVER_BEHIND_DAYS = 7;

export type RoutineOutcome = "NO_PRINT" | "BACKSTOP" | "COVERED" | "FRESH" | "DUE";

export interface RoutineInput {
  today: string; // YYYY-MM-DD
  cadence: number;
  scoreDate: string | null; // YYYY-MM-DD
  /** Every calendar date known for the ticker (past or future), YYYY-MM-DD. */
  printDates: string[];
  /** True when the ticker has at least one EARNINGS_CALENDAR row. */
  hasCalendarRow: boolean;
  /** Latest resolved_at (YYYY-MM-DD) of a CONFIRMED AUTO:{T}:VERDICT:* tracker row. */
  lastAcceptedVerdict: string | null;
}

export interface RoutineResult {
  outcome: RoutineOutcome;
  lastReview: string | null;
  scoreAge: number | null;
  daysSinceReview: number | null;
}

function days(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function evaluateRoutine(i: RoutineInput): RoutineResult {
  const scoreAge = i.scoreDate ? days(i.scoreDate, i.today) : null;
  const lastReview =
    [i.scoreDate, i.lastAcceptedVerdict].filter((d): d is string => !!d).sort().pop() ?? null;
  const daysSinceReview = lastReview ? days(lastReview, i.today) : null;
  const base = { lastReview, scoreAge, daysSinceReview };

  if (!i.hasCalendarRow) return { outcome: "NO_PRINT", ...base };
  if (scoreAge !== null && scoreAge > BACKSTOP_DAYS) return { outcome: "BACKSTOP", ...base };

  const covered = i.printDates.some((d) => {
    const delta = days(i.today, d); // >0 future, <0 past
    return (delta >= 0 && delta <= COVER_AHEAD_DAYS) || (delta < 0 && -delta <= COVER_BEHIND_DAYS);
  });
  if (covered) return { outcome: "COVERED", ...base };

  if (daysSinceReview === null || daysSinceReview < i.cadence) return { outcome: "FRESH", ...base };
  return { outcome: "DUE", ...base };
}
