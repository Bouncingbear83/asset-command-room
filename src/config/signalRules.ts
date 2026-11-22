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
/** R13 — text between [AUTO_EARN ...] and [/AUTO_EARN] (HOLDINGS AJ / WATCHLIST M) is automation: never an event, never an R12 verdict. */
export const AUTO_EARN_SEGMENT = /\[AUTO_EARN\b[^\]]*\][\s\S]*?\[\/AUTO_EARN\]/gi;

/** Earnings engine — staged verdict rows render in DECIDE in this band order (counted in DECIDE_CAP). */
export const VERDICT_BAND_ORDER = ["KILL", "RED", "AMBER", "CONFIRM"] as const;
/**
 * R33 — KILL / RED verdicts: individual DECIDE cards ranked above every AMBER card, and the only
 * bands that reach DECIDE on a name that is not held. AMBER = individual card; CONFIRM verdicts
 * collapse into one “Apply N confirms” card. NO DATA / not graded verdicts go to PREPARE.
 * DECIDE overflow order: RED doctrine → KILL/RED verdicts → other RED → AMBER → GREY.
 */
export const VERDICT_RED_BANDS = ["KILL", "RED"] as const;

/** R14 — earnings: held names only, this many days ahead, lane PREPARE. */
export const EARNINGS_PREPARE_DAYS = 14;
/** R14 — post-print thesis check, business days after the print. */
export const THESIS_CHECK_BUSINESS_DAYS = 5;

/** @deprecated R15 — fallback only, used when the WATCHLIST BAND column (AL) errors. BAND is the source of truth. */
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

// ═══════════════════════════════════════════════════════════════════
// Oversight P1 — R23, R24, R29–R32 (docs/action-surface-spec-v1.md §9, §10)
// Display/routing only. Never changes any score, band or IRR-BB value.
// ═══════════════════════════════════════════════════════════════════

/** R23 — IRR-BB hurdle (percent) for HELD names; below it fires IRRBB_LOW_HELD. */
export const IRRBB_HURDLE_PCT = 15;
/** R23 — below this (percent) the card is RED; between RED and HURDLE it is AMBER. */
export const IRRBB_RED_PCT = 5;
/** R23 — artefact guard: AU outside [LOW, HIGH] emits IRRBB_DATA_CHECK (GREY) instead. */
export const IRRBB_ARTEFACT_LOW = -50;
export const IRRBB_ARTEFACT_HIGH = 150;
/** R23 — a RED card leaves DECIDE only when the HOLDINGS AJ verdict contains one of these. */
export const IRRBB_RED_EXIT_TOKENS = ["TRIM", "SELL", "EXIT TEST", "EXIT", "HOLD-ONLY"] as const;

/** R24 — quartet (SCORES AO) older than this many days … */
export const QUARTET_STALE_DAYS = 120;
/** R24 — … with IRR-BB above this percent is STALE_HIGH: no wake cards, never Armed, WATCH. */
export const QUARTET_STALE_IRR_PCT = 25;

/** R29 — sleeve cash / sleeve value (holdings MV + cash) below this percent → AMBER, blocks Armed in that sleeve. */
export const SLEEVE_FLOOR_PCT = 3;
/** R29 — sleeves checked; HOLDINGS account → cash-block label. */
export const SLEEVES = ["SIPP", "ISA", "BORDIER"] as const;

/**
 * R30 — cash integrity. E62:E64 are XLOOKUPs of the CASH ledger, so comparing them with the
 * ledger proves nothing. Four internal checks instead; any failure → RED:
 *   SUM     E65 = E62 + E63 + E64            (± CASH_RECON_SUM_TOL_GBP)
 *   DP      F58 = E58 / E60                  (± CASH_RECON_DP_TOL_PP percentage points)
 *   LAYERS  LAYERS "Cash" MV = E65           (± CASH_RECON_LAYERS_TOL_GBP)
 *   TEXT    every DP % in NARRATIVE / MACRO_STATE within CASH_RECON_TEXT_DP_TOL_PP of F58
 *           — stamp-aware: the stamp is MACRO_STATE col F for that row, NARRATIVE B2. Only a quote
 *           stamped today can fail (RED). A quote stamped before today (or undated) that is off by
 *           more than the tolerance is AMBER "Stale DP quote" — chip only, never a DECIDE card.
 * Fewer than CASH_RECON_CHECK_COUNT checks run (missing inputs) → GREY "Cash recon n/4 run"; never green.
 */
export const CASH_RECON_CHECK_COUNT = 4;
export const CASH_RECON_SUM_TOL_GBP = 1;
export const CASH_RECON_DP_TOL_PP = 0.05;
export const CASH_RECON_LAYERS_TOL_GBP = 100;
export const CASH_RECON_TEXT_DP_TOL_PP = 0.5;

/** R23 — SCORES RETURN_PROFILE values excluded from IRR-BB hurdle cards (OB §3.4.0). */
export const IRRBB_EXEMPT_PROFILES = ["HEDGE", "VEHICLE"] as const;

/**
 * D2 — tracker rows due today or within the MISSED window reach DECIDE only when priority is HIGH
 * or the action type is one of these. Otherwise MANUAL / DATA_FIX → BACKLOG, CATALYST_WATCH → PREPARE.
 */
export const TRACKER_DECIDE_TYPES = ["EARNINGS_GATE", "KILL_CHECK", "DEPLOY"] as const;
export const TRACKER_BACKLOG_UNLESS_HIGH = ["MANUAL", "DATA_FIX"] as const;
export const TRACKER_PREPARE_UNLESS_HIGH = ["CATALYST_WATCH"] as const;

/** R31 — OPEN action_tracker rows with this priority more than MISSED_AFTER_DAYS past due → DECIDE RED, not MISSED. */
export const MISSED_HIGH_PRIORITY = "HIGH";

/**
 * R32 — OPEN tracker rows on dead tickers (R10 dead set: REJECTED / EXITED / ARCHIVED …)
 * are shown in the Actions "Hygiene" filter and counted on Command, never hidden.
 * Exception: these action types on ARCHIVE watchlist names route normally.
 */
export const HYGIENE_EXEMPT_ON_ARCHIVE = ["CATALYST_WATCH"] as const;

// ═══════════════════════════════════════════════════════════════════
// Sprint A — A1 drawdown regime (OB v3.20.2 §3.4.9a; Weekly v1.5 C10). Display only.
// Operator-set constants: a new peak or a new stress episode is a code change. The app flags
// a new peak but never ratchets these at runtime.
// ═══════════════════════════════════════════════════════════════════
/** OB §3.4.9a — book peak AUM (GBP, cash included; same basis as HOLDINGS E60). */
export const REGIME_PEAK_AUM_GBP = 1640021;
/** OB §3.4.9a — date of the book peak. */
export const REGIME_PEAK_DATE = "2026-10-05";
/** OB §3.4.9a — drawdown (percent) at which the book enters STRESS. */
export const REGIME_STRESS_PCT = 8;
/** OB §3.4.9a — drawdown (percent) at which the book is in HALT (H-A): no new money. */
export const REGIME_HALT_PCT = 25;
/** OB §3.4.9a — stress bands and the share of STRESS_BUDGET_GBP each releases. */
export const STRESS_BANDS = [
  { id: "S1", from: 8, to: 15, release: 0.25 },
  { id: "S2", from: 15, to: 20, release: 0.5 },
  { id: "S3", from: 20, to: 25, release: 0.75 },
] as const;
/** OB §3.4.9a — stress deployment budget (GBP). */
export const STRESS_BUDGET_GBP = 103824;
/** OB §3.4.9a — operator ruling 12 Nov 2026: release is a high-water mark per episode. */
export const STRESS_EPISODE_HWM_BAND = "S3";
/** OB §3.4.9a H-R — Nasdaq Composite record close and its date. */
export const NASDAQ_RECORD_CLOSE = 27477.31;
export const NASDAQ_RECORD_DATE = "2026-10-05";
/** OB §3.4.9a / Weekly C10 — H-R gap (book DD minus Nasdaq DD, points): RED above trigger + … */
export const HR_TRIGGER_PTS = 10;
/** … AMBER above release. (RED test in C10 is gap > 9: one point inside the trigger.) */
export const HR_RELEASE_PTS = 7;
/** Weekly C10 — H-R gap above this many points is RED. */
export const HR_RED_PTS = 9;
/** Weekly C10 — H-A margin below this percent of AUM is RED. */
export const HALT_MARGIN_RED_PCT = 2;
/** Every value derived from a live quote carries this label. */
export const INTRADAY_LABEL = "intraday, indicative: doctrine tests at the close";

// ═══════════════════════════════════════════════════════════════════
// Sprint A — A2 BB basis (OB §3.4.5i; same tests as Daily Run C30).
// ═══════════════════════════════════════════════════════════════════
/** Max vault reads per page load for T4 (non-score change notes); beyond the cap → UNKNOWN. */
export const BB_BASIS_VAULT_CAP = 12;
/** Price-driven trigger types demoted DECIDE → WATCH on PINNED-V1 / LEGACY rows. */
export const BB_BASIS_PRICE_TRIGGERS = ["IN_ZONE", "APPROACHING_ZONE", "IRRBB_LOW_HELD", "QUARTET_STALE", "HOLD_ALERT_TRIM"] as const;

// ═══════════════════════════════════════════════════════════════════
// Sprint A — A3 Rule 13 on deploy rows (Rule 13, P3b, P5). Caps live in src/lib/driverCaps.ts.
// ═══════════════════════════════════════════════════════════════════
/**
 * Display proxy, not doctrine: a group within this many points of its soft (WARN) cap shows
 * "RULE 13: P5 peak-mark test required (session)". The app cannot run P5 itself (it needs the
 * 5 Oct peak marks); the session does.
 */
export const RULE13_P5_BUFFER_PP = 5;
