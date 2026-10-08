/**
 * Layer review cycle label for a date, e.g. 2026-10-08 -> "Q4-2026".
 * layer_review_schedule rows are keyed by this label; the calendar shows the
 * current quarter's cycle instead of a hardcoded one.
 */
export function reviewCycleFor(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${q}-${date.getUTCFullYear()}`;
}

export function currentReviewCycle(): string {
  return reviewCycleFor(new Date());
}
