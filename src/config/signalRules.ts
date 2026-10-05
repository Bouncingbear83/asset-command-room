/**
 * Display rules for the "Today's Decisions" queue (Command tab).
 * Filtering / ranking / presentation only — never feeds score, IRR-BB or composite maths.
 */

/** R2 — statuses that mean the row is dead and must never surface. */
/** Matched against WATCHLIST status (col H) and SCORES Held_Status (col A). Held rows are never dead. */
export const DEAD_STATUSES = ["ARCHIVE", "ARCHIVED", "EXITED", "REJECTED", "REMOVED"] as const;

/** R3 — a stop is "approaching" only when price is within this % ABOVE the stop. */
export const APPROACHING_STOP_PCT = 5;
/** R3 — same band for add triggers. */
export const APPROACHING_ADD_PCT = 5;

/** R4 — price more than this % BELOW the stop is implausible → amber VERIFY, not red EXIT. */
export const STOP_BREACH_IMPLAUSIBLE_PCT = 10;

/** R5b — add-zone cards are suppressed when IRR-BB (percent) is below this (hold-only). */
export const IRR_BB_MIN = 15;
/** R5 — add trigger further than this % from spot → LOW "TRIGGER STALE: reset". */
export const STALE_TRIGGER_PCT = 20;
/** R5a — score values treated as missing. */
export const MISSING_SCORE_TOKENS = ["", "?"] as const;

/** Earnings window (days ahead) that surfaces an EARNINGS card. */
export const EARNINGS_WINDOW_DAYS = 5;
/** Watchlist trigger review older than this many days → REVIEW DUE (collapsed into sweep, R7). */
export const WATCH_STALE_DAYS = 14;
/** Review flags older than this many days are ignored. */
export const FLAG_STALE_DAYS = 14;

/** R7 — sweep sub-group matchers on the trigger review note. */
export const SWEEP_NEEDS_RESET_TOKEN = "STALE";
export const SWEEP_DATE_ROLL_PREFIX = "OK";

/** R9 — review notes (these prefixes) older than this with no operator text → LOW "STALE NOTE". */
export const STALE_NOTE_DAYS = 60;
export const STALE_NOTE_PREFIXES = ["Q_REVIEW", "W_", "M_"] as const;
export const OPERATOR_TOKEN = "OPERATOR";

/** Number of cards shown before "Show all". */
export const INBOX_TOP_N = 8;
