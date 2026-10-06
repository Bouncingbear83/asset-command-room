/**
 * Display rules for the "Today's Decisions" queue (Command tab).
 * Filtering / ranking / presentation only — never feeds score, IRR-BB or composite maths.
 */

/** R2 — statuses that mean the row is dead and must never surface. */
/** Matched against WATCHLIST status (col H) and SCORES Held_Status (col A). Held rows are never dead. */
export const DEAD_STATUSES = ["ARCHIVE", "ARCHIVED", "EXITED", "REJECTED", "REMOVED"] as const;

/**
 * R2 — liveness precedence, first match wins:
 * 1. Ticker in HOLDINGS → LIVE (always; a held row is a live position).
 * 2. Ticker on WATCHLIST → use WATCHLIST STATUS (col H) only; dead if in
 *    DEAD_STATUSES, else LIVE. SCORES Held_Status is ignored for these tickers.
 * 3. Ticker in SCORES only → dead if Held_Status (col A) is in DEAD_STATUSES.
 */
export const LIVENESS_PRECEDENCE = ["HOLDINGS", "WATCHLIST", "SCORES"] as const;

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

// ═══════════════════════════════════════════════════════════════════
// Action Surface Spec v1 (docs/action-surface-spec-v1.md) — R10 to R22
// Display/routing only. Never feeds score, IRR-BB or composite maths.
// ═══════════════════════════════════════════════════════════════════

/** Lanes a candidate can be routed to. */
export const LANES = ["DECIDE", "PREPARE", "WATCH", "BACKLOG", "MISSED"] as const;

/** R10 — dead filter (DEAD_STATUSES + LIVENESS_PRECEDENCE) applies to EVERY builder. */
export const DEAD_FILTER_EVERYWHERE = true;

/** R11 — the only HOLDINGS ALERT_STATUS values that create a HOLD_ALERT. Others produce nothing. */
export const HOLD_ALERT_STATUSES = ["EXIT_ZONE", "STOP_BREACH", "ADD_ZONE", "THESIS_BREAK"] as const;

/** R12 — dated verdict tokens; paired with a YYYY-MM-DD date in the review note. */
export const VERDICT_TOKENS = ["HOLD", "NO ADD", "COMMITTED", "CLOSED", "ARCHIVED", "EXITED", "FILLED", "DONE"] as const;

/** R13 — automation prefixes: never events, only annotate WATCH. */
export const AUTOMATION_PREFIXES = ["M_WL", "M_", "W_", "Q_REVIEW"] as const;

/** R14 — earnings: held names only, this many days ahead, lane PREPARE. */
export const EARNINGS_PREPARE_DAYS = 14;
/** R14 — post-print thesis check, business days after the print. */
export const THESIS_CHECK_BUSINESS_DAYS = 5;

/** R15 — WAIT_PRICE wakes when spot is within this % of the zone edge. */
export const WATCH_WAKE_PCT = 10;

/** R16 — limit-order pattern in notes / DEPLOY_NOTE. Group 1 side, 2 operator, 3 price. */
export const LIMIT_ORDER_REGEX = /(BUY|TRIM|SELL|T\d+).*?limit\s*(<=|>=|≤|≥)\s*[$£€p]?\s*([\d,.]+)/i;
export const FILLED_TOKEN = "FILLED";

/** R17 — action_tracker types that always route to BACKLOG (MANUAL only when no ticker). */
export const BACKLOG_ACTION_TYPES = ["INFRA", "DOCTRINE", "SOURCING", "RESEARCH"] as const;
/** R17 — rows/events this many days past due with no verdict go to MISSED. */
export const MISSED_AFTER_DAYS = 3;

/** R18 — hard cap on DECIDE; overflow drops lowest severity to WATCH. */
export const DECIDE_CAP = 10;
/** PREPARE horizon for held-name events. */
export const PREPARE_HORIZON_DAYS = 14;

/** R19 — Capital Queue: actions that block Armed, and the minimum row size. */
export const QUEUE_BLOCK_ACTIONS = ["NO ADD", "HOLD-ONLY", "HOLD ONLY", "DORMANT"] as const;
export const QUEUE_MIN_GBP = 1000;

/** R20 — G(m) caps and the v1 soft-cap acknowledgement (reverts to RED on expiry). */
export const GM_MAX_AGGREGATE_PCT = 2.5;
export const GM_MAX_POSITIONS = 4;
export const GM_MAX_SINGLE_PCT = 1.0;
export const GM_SOFT_CAP_ACK = { since: "2026-10-06", expires: "2027-01-04" } as const;

/** R21 — dry-powder posture band (gross cash % of AUM). AMBER outside. Also the Armed DP gate floor. */
export const DP_MIN_PCT = 7;
export const DP_MAX_PCT = 8;

/** R22 — overdue layer reviews covered by a later scheduled_reviews session render "rolled to …". */
export const LAYER_ROLL_MATCH = /layer|P\d/i;

// ═══════════════════════════════════════════════════════════════════
// v1.1 fixes
// ═══════════════════════════════════════════════════════════════════

/** F3 — only these WATCHLIST statuses wake on price (R15). */
export const WATCH_WAKE_STATUSES = ["WAIT_PRICE", "DEPLOY"] as const;
/** F5 — AJ tag that makes an automation note a DECIDE item (unless an operator verdict exists). */
export const EXIT_RECLASS_TAG = "[EXIT_RECLASS]";
/** F6 — the only action types shown as Events on the Actions tab (plus SESSION rows). */
export const EVENT_ACTION_TYPES = ["EARNINGS_GATE", "CATALYST_WATCH", "DEPLOY", "KILL_CHECK"] as const;
