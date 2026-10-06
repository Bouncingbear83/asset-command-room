# Action Surface Spec v1 (Stellar Command)

**Date:** 6 Oct 2026 | **Status:** DRAFT for Lovable build | **Owner:** Bert
**Scope:** Command tab "Today's Decisions" (`src/components/ActionInbox.tsx`), Actions tab Events (`src/components/actions/useActionTracker.ts`), Capital Queue (`src/components/command/CapitalQueue.tsx`), G(m) chip (`src/components/command/GmExposureChip.tsx`), Layer Reviews.
**Rules file:** `src/config/signalRules.ts` (extend; do not fork).

---

## 1. Problem

About 120 surfaced rows; 3 to 4 are real decisions on 6 Oct live data. The surface has no lifecycle: rows are derived from sheet fields on every load, never expire, ignore dead statuses and ignore operator verdicts.

## 2. Root causes (code-verified, repo HEAD 018acae)

| # | Defect | Location | Effect on 6 Oct |
|---|---|---|---|
| D1 | Deployed build lags HEAD | Lovable publish | LHX shows "approaching stop" at 7.7%; HEAD rule R3 is 5% |
| D2 | WL trigger loop has no dead-status filter | `useActionTracker` s2 (`WL_TRIGGER`) | CTVA, ESP, DIM (archived/exited) raise REVIEW DUE |
| D3 | Any 2-word note is an "event" | `isSubstantiveNote` | Monthly `M_WL 2026-10 STALE: ...` text becomes ~20 events |
| D4 | Every non-CLEAR `ALERT_STATUS` is HIGH, due today | `useActionTracker` s3 (`HOLD_ALERT`) | WATCHING, WAIT, ADD_ZONE on hold-only names: 9 "today" items |
| D5 | Earnings: 60-day window, HIGH if held, no test | `useActionTracker` s4 | 36 blank "earnings gate" rows this month |
| D6 | Dedupe key includes account and date | `add-${ticker}-${account}`, `WL_TRIGGER:t:date` | MP shows 3 times |
| D7 | Session rows (`action_tracker`) never expire or route | table has no category/lane | Infra and doctrine tasks 60 days "late" in the investment feed |
| D8 | Operator verdict does not supersede the trigger | all builders | RHM, LYC, YAR.OL, 6920.T, 6324.T, NVDA re-surface after decision |
| D9 | Calendar cadence drives WL review, not price proximity | `CADENCE` | Names 30% to 370% above zone nag every 45 days |
| D10 | Limit orders are invisible | none | FCX trim (limit >= $72.00, spot $72.60, 242 sh) has no card |
| D11 | Capital Queue mixes armed capital with sizing gaps | `CapitalQueue` | ALB GBP35k "SIZE UP" while ops says NO ADD |
| D12 | Dry-powder posture not on the surface | none | Net DP ~6.75% < 7% posture (ops est.); not visible |

## 3. Target model

### 3.1 Lanes

| Lane | Shows | Cap | Render |
|---|---|---|---|
| **DECIDE** | Triggers firing now with no newer operator verdict | 10 (hard) | Expanded, ranked by severity |
| **PREPARE** | Held-name events in the next 14 days, each with its gate test | none | Collapsed list; ⚠️ "NO TEST" badge if test missing |
| **WATCH** | Everything live but not firing | count only | One line: "N watching, M wake within 10%" |
| **BACKLOG** | `action_tracker` rows of type INFRA, DOCTRINE, SOURCING, RESEARCH, MANUAL without ticker | separate tab | Never on Command tab |
| **MISSED** | Events/rows > 3 days past due with no verdict | count only | One line + "Close all missed" bulk action |

### 3.2 Candidate record (in-memory; no schema change for v1)

`{ticker, trigger_type, lane, severity, fired_at, source, source_ref, reasons[], gate_test, verdict_at, next_review}`

- **Dedupe key:** `ticker + trigger_type`. Accounts and multiple sources merge into one card; `reasons[]` stacks the detail.
- **Severity:** RED = stop breached or <= 5%, cap breach (hard), RECONCILE FILL. AMBER = in zone, soft-cap breach, exit-reclass with no verdict. GREY = everything else.

## 4. Rules (add to `signalRules.ts`)

| ID | Rule |
|---|---|
| R10 | Dead filter applies to every builder (inbox, s1 to s4, capital queue) via `DEAD_STATUSES` and `LIVENESS_PRECEDENCE`. |
| R11 | `HOLD_ALERT` only for `ALERT_STATUS` in {EXIT_ZONE, STOP_BREACH, ADD_ZONE, THESIS_BREAK}. ADD_ZONE also needs `TRIGGER_PRICE_ADD` > 0 and IRR-BB >= 15. WATCHING, WAIT*, CLEAR, OK produce nothing. `due_date` = `ALERT_FIRED_DATE`, not today. |
| R12 | **Operator supersession.** If the review note (HOLDINGS AJ / WL M) contains `OPERATOR` or a dated verdict token (`YYYY-MM-DD` + one of HOLD, NO ADD, COMMITTED, CLOSED, ARCHIVED, EXITED, FILLED, DONE) **and** `TRIGGER_REVIEW_DATE` is in the future, the candidate goes to WATCH until that date. Price triggers still override (stop <= 5% always surfaces). |
| R13 | Automation prefixes (`M_`, `W_`, `Q_REVIEW`, `M_WL`) are never events. They only annotate WATCH. Notes starting `OK:` with no body are ignored. |
| R14 | Earnings: held names only, 14-day window, lane PREPARE. `gate_test` = first of: HOLDINGS AJ / WL M text mentioning the print, EARNINGS_CALENDAR F:G operator columns. Past date: hide; for held names emit `THESIS_CHECK` at print + 5 business days (closes ops process gap #1). Unheld names: never shown. |
| R15 | WATCH wake: WL `WAIT_PRICE` within 10% of zone edge (`TRIGGER_PRICE_NUMERIC`, else parsed `ENTRY TARGET`) moves to DECIDE "approaching zone". Below buy_low on `WAIT_PRICE` moves to DECIDE "below zone: thesis check". `WAIT_EVENT` never wakes on price. Calendar cadence (D9) is replaced by one weekly "batch review: N names" card. |
| R16 | **RECONCILE FILL.** Parse notes and DEPLOY_NOTE for `(BUY|TRIM|SELL|T\d+).*limit\s*(<=|>=)\s*[$£€p]?([\d,.]+)`. If spot has crossed the limit and the note has no FILLED token, raise RED "Reconcile fill: check broker, log contract note". Clears when SHARES changes or FILLED is written. |
| R17 | `action_tracker` routing by `action_type`: INFRA, DOCTRINE, SOURCING, RESEARCH, MANUAL (no ticker) go to BACKLOG. Rows > 3 days past due go to MISSED. |
| R18 | DECIDE cap 10. Overflow drops lowest severity to WATCH with a count. |
| R19 | Capital Queue splits **Armed** (trigger met, not NO ADD / HOLD-ONLY / DORMANT, DP gate passes) and **Gaps** (target minus actual, informational, collapsed). Hide rows < GBP1k. |
| R20 | G(m) chip: aggregate > 2.5% shows RED "BREACH" unless a soft-cap acknowledgement is active, then AMBER "SOFT CAP · staged FROZEN". Max-concurrent 4 reached: staged rows render FROZEN. v1 source: `GM_SOFT_CAP_ACK = {since: "2026-10-06", expires: "2027-01-04"}`; reverts to RED on expiry (Quarterly re-decides). |
| R21 | DP chip in header: gross cash % from HOLDINGS cash block (r58/r60). AMBER outside 7 to 8%. Note: USD earmark lives in ops state only (schema debt); chip shows gross with "net est. in ops" tooltip. |
| R22 | Layer Reviews: overdue rows with a later `scheduled_reviews` session covering them (P6 30 Nov) render "rolled to P6", not OVERDUE. |

## 5. Acceptance test (6 Oct live data, Sheet Reader 10498, Ops READ 10497)

Expected **DECIDE** (3):

| Card | Severity | Why |
|---|---|---|
| FCX: Reconcile fill (trim 241 sh SIPP >= $72.00; spot $72.60; 242 sh held) | RED | R16 |
| G(m): soft cap 3.8% vs 2.5%, 4/4, staged FROZEN | AMBER | R20 |
| ASML: exit reclass, trim-or-recommit (no operator verdict; Q3 14 Oct) | AMBER | R11/R12 |

Expected **PREPARE** (top): VLN.TO 7 Oct (test = r42 AJ CONFIRM/AMBER/RED + Birch Hill kill), ASML 14 Oct, YAR.OL 22 Oct, FCX 27 Oct, LYC 28 Oct, LHX 29 Oct (T2 decision), INR K1a ~30 Oct, TLG.AX 31 Oct.

Expected **not shown:** LHX (7.7% to stop), YAR.OL (14.8%), MP (T1 filled, T2 event-gated), RHM, LYC, TLG.AX, NVDA, 6920.T, 6324.T (operator verdicts), CTVA, ESP, DIM, DRS (dead), ERII and EUZ.DE (WAIT_EVENT), every `M_WL ... STALE` row, every unheld earnings date, all INFRA/DOCTRINE rows.

Kill criteria: DECIDE > 10 on a normal day, or any card requires reading an operator note to know it is live. Fix the rule, not the filter.

## 6. Data fixes (sheet side, separate from code)

| Row | Fix |
|---|---|
| HOLDINGS r27, r28 MP | AJ: "T1 FILLED 210 sh SIPP. T2 at Q3 5 Nov (earned by print; zone 45-65)." AE: blank (T2 is event-gated; matches ALB/LYC precedent) |
| HOLDINGS r23 FCX | After operator confirms broker: Trade Log on contract note, then AJ "T10 FILLED ..." |
| WATCHLIST r5 4042.T | Reconcile WL WAIT_PRICE vs SCORES REJECTED 67 (paste 61) |
| layer_review_schedule | Re-date 7 layers to P6 30 Nov or mark rolled |

## 7. Lovable prompt (paste)

> Implement docs/action-surface-spec-v1.md. Extend src/config/signalRules.ts with R10 to R22. Refactor ActionInbox and useActionTracker to emit candidates with dedupe key ticker+trigger_type and route them to lanes DECIDE / PREPARE / WATCH / BACKLOG / MISSED. Command tab shows DECIDE (max 10) and a collapsed PREPARE list; WATCH and MISSED as one-line counters; BACKLOG moves to the Actions tab as its own filter. Add RECONCILE FILL (R16), G(m) soft-cap acknowledgement (R20) and a DP chip (R21). Split Capital Queue into Armed and Gaps (R19). Keep all display logic out of score and IRR-BB maths. Add unit tests for R11, R12, R13, R16 using the section 5 fixtures. Then publish the build.
