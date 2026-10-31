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

## 8. Oversight P1 additions (R29–R32, Doctrine strip)

| ID | Rule |
|---|---|
| R29 | **SLEEVE_FLOOR.** Sleeve cash (HOLDINGS E62:E64) / sleeve value (holdings MV in that account + sleeve cash) < `SLEEVE_FLOOR_PCT` 3% → AMBER DECIDE card. Capital Queue Armed rows in that sleeve go to Gaps with a "<SLEEVE> FLOOR" badge. |
| R30 | **CASH_RECON.** HOLDINGS E65 vs CASH ledger sum (latest row per account, JISA* excluded). RED DECIDE card when \|delta\| > `CASH_RECON_TOLERANCE_GBP` £100. |
| R31 | **MISSED_HIGH.** action_tracker priority HIGH, OPEN, > 3 days past due → DECIDE RED (not MISSED). |
| R32 | **TRACKER_ON_DEAD.** OPEN tracker rows on dead tickers (R10 dead set: REJECTED / EXITED / ARCHIVED …) are listed in the Actions "Hygiene" filter and counted on Command; never hidden. Exception: CATALYST_WATCH on ARCHIVE watchlist names routes normally. |

**Doctrine strip** (under CommandHeader): one RAG chip per check — G(m), DP, IRR-BB held, stale quartets, sleeve floors, cash recon, tracker hygiene, driver caps (DriversTab Rule #13 caps). Collapsed to "N/M green" when all green. GREY = not evaluated (source failed). Each chip deep-links to its source.

## 9. R23 IRRBB_LOW_HELD

**Source:** SCORES only. Columns: A Held_Status, B ticker, AU IRR_BB, AK bull_base, AO BULL_BEAR_AT_DATE, AR BB_TARGET_DATE, AT LIVE_PRICE.

**Fires** when Held_Status = HELD and AU parses to a number below `IRRBB_HURDLE_PCT` 15.

**Parsing:** strip % and commas. Blank, #N/A or text means not evaluated. (A bare numeric cell is the canonical sheet fraction, 0.15 = 15%.)

**Artefact guard:** if AU < `IRRBB_ARTEFACT_LOW` -50 or AU > `IRRBB_ARTEFACT_HIGH` 150, emit IRRBB_DATA_CHECK (GREY) instead.

**Severity:** RED if AU < `IRRBB_RED_PCT` 5; AMBER if 5 ≤ AU < 15.

**Dedupe key:** ticker + IRRBB_LOW_HELD. Accounts merge into one card.

**Supersession:** R12 applies to AMBER cards. A RED card stays in DECIDE until the HOLDINGS AJ verdict contains TRIM, SELL, EXIT, HOLD-ONLY or EXIT TEST.

**Lane:** DECIDE. RED ranks above AMBER.

**Card text:** `IRR-BB {AU} < 15% hurdle · spot {AT} vs BB {AK} @ {AR} · quartet {AO}`.

**Test fixture (AU values).** RED: RGEN 0.4, TWST 0.6, ILMN 1.0, ONT 1.1. AMBER: TEM 6.2, 4047.T 6.7, CRPR 7.5, RSW 7.9, 6268.T 10.0, FCX 11.0, 6920.T 11.7, VEEV 11.9. No card: HELD names with blank AU, and a WATCHLIST name at -11.5.

## 10. R24 QUARTET_STALE_HIGH

**Definition:** age = today minus AO. If AO is blank, do not evaluate. STALE_HIGH when age > `QUARTET_STALE_DAYS` 120 days and IRR_BB > `QUARTET_STALE_IRR_PCT` 25%.

**Effect:** suppress the name from R15 wake cards and from Capital Queue Armed. Send it to WATCH with the badge "STALE QUARTET {age}d".

Never change any score, band or IRR-BB value.

**Test fixture.** STALE_HIGH: AMG (129 days, 53.1%), ALB (122 days, 30.3%). Not stale: 4109.T (112 days, 52.9%).

**R30 test fixture:** ledger where the latest row per account (SIPP, ISA, BORDIER_GIA; JISA* excluded) sums to 138,914.20.

## §11 Oversight P1 fixes (D1–D4)

- **R30 CASH_RECON (replaces ledger compare).** E62:E64 are XLOOKUPs of the CASH ledger, so four internal checks run instead; any failure is RED and the chip names the failed check: (1) E65 = E62+E63+E64 ± £1; (2) F58 = E58/E60 ± 0.05pp; (3) LAYERS Cash = E65 ± £100; (4) every DP % quoted in NARRATIVE or MACRO_STATE within 0.5pp of F58 (ranges like “DP 7–8%” ignored). Checks whose inputs are missing are not evaluated.
- **Tracker routing.** Rows due today or inside the 3-day missed window reach DECIDE only when priority is HIGH or action_type is EARNINGS_GATE, KILL_CHECK or DEPLOY (others → PREPARE). MANUAL and DATA_FIX not HIGH → BACKLOG. CATALYST_WATCH not HIGH → PREPARE (WATCH beyond the horizon).
- **IRR-BB chip.** Counts every R23 LOW row, superseded included: “IRR-BB held N · X decide / Y superseded”. SCORES rows with RETURN_PROFILE HEDGE or VEHICLE never fire R23 (OB §3.4.0).
- **Stale-quartet chip.** Only HELD and live WATCHLIST names; rows tripping the R23 artefact guard excluded. Label “Stale quartets N held · M total”.

### §11.1 R30 cash recon — stamp-aware quotes and partial runs (31 Oct 2026)

- **Quoted DP = F58** uses the date each figure was stamped: MACRO_STATE column F for that row, NARRATIVE B2 for every narrative figure.
  - Stamped today and more than 0.5pp from F58 → check fails → RED (DECIDE card).
  - Stamped before today (or undated) and more than 0.5pp from F58 → AMBER chip "Stale DP quote: {source} {value} stamped {date}; live F58 {x}%". Chip only, never a DECIDE card.
- Fewer than 4 checks ran → GREY chip "Cash recon {n}/4 run", listing the skipped checks. Never green.
- Chip precedence: RED > GREY > AMBER > GREEN.
- Command header shows "DECIDE n/10" (red when n > 10 or cards were pushed to WATCH by the cap, with "+k over cap").

## §12 R33 DECIDE overflow (one card per ticker)

- **Merge:** DECIDE candidates sharing a ticker become one card. Severity = highest member; every trigger is stacked in `reasons[]` as `title: reason`. Ticker-less cards (cash recon, sleeve floor, G(m), grouped watchlist cards) keep their own keys.
- **Verdicts count toward the cap of 10.** KILL / RED verdicts are individual cards ranked above every AMBER card; AMBER verdicts are individual cards; CONFIRM verdicts (not merged with other triggers on the same name) collapse into one card "Apply N confirms" with Apply all.
- **Verdict → PREPARE:** brief NO DATA, no grade yet, accepted to RC queue, placed, or a not-held (watchlist) name unless the band is KILL or RED.
- **Overflow order:** RED doctrine (R23 RED, CASH_RECON RED, KILL_CHECK HIGH, stop breach) → KILL / RED verdicts → other RED → AMBER → GREY; then severity, verdict band, next review, fired date. Cards past 10 overflow to WATCH. A KILL_CHECK tracker row with priority HIGH is RED.
