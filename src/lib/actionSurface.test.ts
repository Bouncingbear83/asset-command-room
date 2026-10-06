import { describe, it, expect } from "vitest";
import {
  holdAlert, isSuperseded, findVerdict, isAutomationNote, parseLimitOrder, reconcileFill, buildSurface,
  type HoldingIn,
} from "./actionSurface";

const TODAY = "2026-10-06";

// ── Section 5 fixtures (6 Oct live data, simplified) ──
const FCX: HoldingIn = {
  ticker: "FCX", account: "SIPP", price: 72.6, shares: 242, alert_status: "CLEAR",
  deploy_note: "T10 TRIM 241 sh SIPP limit >= $72.00",
};
const ASML: HoldingIn = {
  ticker: "ASML", account: "ISA", price: 640, shares: 10, alert_status: "EXIT_ZONE", alert_fired_date: "2026-10-02",
  trigger_review_date: "2026-10-14", trigger_review_note: "Exit reclass: trim or recommit at Q3 14 Oct",
};
const RHM: HoldingIn = {
  ticker: "RHM", account: "ISA", price: 1700, alert_status: "EXIT_ZONE", alert_fired_date: "2026-09-20",
  trigger_review_date: "2026-11-05", trigger_review_note: "2026-09-22 HOLD through Q3 print",
};
const LYC: HoldingIn = {
  ticker: "LYC", account: "SIPP", price: 9.5, alert_status: "ADD_ZONE", trigger_price_add: "10",
  trigger_review_date: "2026-10-28", trigger_review_note: "OPERATOR: NO ADD until print",
};
const LHX: HoldingIn = { ticker: "LHX", account: "ISA", price: 280, trigger_price_exit: "260", alert_status: "WATCHING" };
const YAR: HoldingIn = { ticker: "YAR.OL", account: "ISA", price: 390, alert_status: "WAIT_PRICE", trigger_price_exit: "339.7" };

describe("R11 hold alerts", () => {
  it("ignores WATCHING / WAIT / CLEAR / OK", () => {
    for (const s of ["WATCHING", "WAIT_PRICE", "WAIT", "CLEAR", "OK"]) {
      expect(holdAlert({ ...LHX, alert_status: s }, 0.3)).toBeNull();
    }
  });
  it("EXIT_ZONE fires with due = ALERT_FIRED_DATE, not today", () => {
    const a = holdAlert(ASML, null);
    expect(a?.status).toBe("EXIT_ZONE");
    expect(a?.due).toBe("2026-10-02");
    expect(a?.severity).toBe("AMBER");
  });
  it("STOP_BREACH is RED", () => {
    expect(holdAlert({ ...LHX, alert_status: "STOP_BREACH" }, null)?.severity).toBe("RED");
  });
  it("ADD_ZONE needs trigger_price_add > 0 and IRR-BB >= 15", () => {
    expect(holdAlert({ ...LYC, trigger_price_add: "0" }, 0.283)).toBeNull();
    expect(holdAlert(LYC, 0.1)).toBeNull();
    expect(holdAlert(LYC, null)).toBeNull();
    expect(holdAlert(LYC, 0.283)?.status).toBe("ADD_ZONE");
    expect(holdAlert(LYC, 28.3)?.status).toBe("ADD_ZONE");
  });
});

describe("R12 operator supersession", () => {
  it("detects dated verdict tokens and OPERATOR", () => {
    expect(findVerdict("2026-09-22 HOLD through Q3 print")).toBe("2026-09-22");
    expect(findVerdict("2026-09-30 NO ADD")).toBe("2026-09-30");
    expect(findVerdict("OPERATOR: NO ADD until print")).toBe("OPERATOR");
    expect(findVerdict("Exit reclass: trim or recommit")).toBeNull();
  });
  it("supersedes only while review date is in the future", () => {
    expect(isSuperseded(RHM.trigger_review_note, RHM.trigger_review_date, TODAY)).toBe(true);
    expect(isSuperseded(RHM.trigger_review_note, "2026-10-01", TODAY)).toBe(false);
    expect(isSuperseded(ASML.trigger_review_note, ASML.trigger_review_date, TODAY)).toBe(false);
  });
  it("RHM and LYC go to WATCH; ASML stays in DECIDE", () => {
    const s = buildSurface({ holdings: [RHM, LYC, ASML], watchlist: [], scores: [{ ticker: "LYC", irrBbSheet: 0.283 }], earnings: [], today: TODAY });
    const decide = s.decide.map((c) => c.ticker);
    expect(decide).toContain("ASML");
    expect(decide).not.toContain("RHM");
    expect(decide).not.toContain("LYC");
    expect(s.watch.map((c) => c.ticker)).toEqual(expect.arrayContaining(["RHM", "LYC"]));
  });
  it("stop within 5% still surfaces despite a verdict", () => {
    const h: HoldingIn = { ...RHM, trigger_price_exit: "1650", alert_status: "CLEAR" };
    const s = buildSurface({ holdings: [h], watchlist: [], scores: [], earnings: [], today: TODAY });
    expect(s.decide[0]?.trigger_type).toBe("STOP");
    expect(s.decide[0]?.severity).toBe("RED");
  });
  it("LHX (7.7% to stop) and YAR.OL (14.8%) are not shown", () => {
    const s = buildSurface({ holdings: [LHX, YAR], watchlist: [], scores: [], earnings: [], today: TODAY });
    expect(s.decide).toHaveLength(0);
  });
});

describe("R13 automation notes", () => {
  it("prefixes are never events", () => {
    expect(isAutomationNote("M_WL 2026-10 STALE: reset trigger")).toBe(true);
    expect(isAutomationNote("W_EXIT check")).toBe(true);
    expect(isAutomationNote("Q_REVIEW due")).toBe(true);
    expect(isAutomationNote("OK:")).toBe(true);
    expect(isAutomationNote("OK:   ")).toBe(true);
    expect(isAutomationNote("Check Birch Hill kill at print")).toBe(false);
  });
  it("M_WL STALE rows on the watchlist do not create DECIDE cards", () => {
    const s = buildSurface({
      holdings: [], scores: [], earnings: [], today: TODAY,
      watchlist: [{ ticker: "ABC", status: "WAIT_PRICE", current: 200, entry: "50-60", triggerReviewDate: "2026-10-01", triggerReviewNote: "M_WL 2026-10 STALE: reset" }],
    });
    expect(s.decide).toHaveLength(0);
  });
});

describe("R16 reconcile fill", () => {
  it("parses limit orders", () => {
    expect(parseLimitOrder(FCX.deploy_note)).toMatchObject({ side: "T10", op: ">=", price: 72 });
    expect(parseLimitOrder("BUY 50 sh limit <= £4.20")).toMatchObject({ side: "BUY", op: "<=", price: 4.2 });
    expect(parseLimitOrder("Hold, no orders")).toBeNull();
  });
  it("FCX: spot 72.60 crossed >= 72.00 → RED reconcile card", () => {
    expect(reconcileFill(FCX)).not.toBeNull();
    const s = buildSurface({ holdings: [FCX], watchlist: [], scores: [], earnings: [], today: TODAY });
    const c = s.decide.find((x) => x.trigger_type === "RECONCILE_FILL");
    expect(c?.severity).toBe("RED");
    expect(c?.ticker).toBe("FCX");
  });
  it("not crossed → nothing", () => {
    expect(reconcileFill({ ...FCX, price: 71.5 })).toBeNull();
  });
  it("clears on FILLED token or SHARES change", () => {
    expect(reconcileFill({ ...FCX, deploy_note: FCX.deploy_note + " FILLED" })).toBeNull();
    expect(reconcileFill({ ...FCX, shares: 1 }, 242)).toBeNull();
    expect(reconcileFill(FCX, 242)).not.toBeNull();
  });
});

describe("dedupe ticker + trigger_type", () => {
  it("merges accounts into one card", () => {
    const s = buildSurface({
      holdings: [{ ...ASML, account: "ISA" }, { ...ASML, account: "SIPP" }], watchlist: [], scores: [], earnings: [], today: TODAY,
    });
    expect(s.decide.filter((c) => c.ticker === "ASML")).toHaveLength(1);
    expect(s.decide[0].accounts).toEqual(["ISA", "SIPP"]);
  });
});

import { parseZone as pz, holdAlert as ha, routeTrackerRow as rtr, isGateTestStale } from "./actionSurface";
import { parseCashLedger } from "./cashLedger";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("v1.1 fixes", () => {
  i2("F1 cash ledger: latest per account, JISA excluded", () => {
    const g = [["DATE","ACCOUNT","BALANCE"],["2026-10-01","SIPP","100"],["2026-10-06","SIPP","200"],["2026-10-06","ISA","50"],["2026-10-06","JISA_BEAR","999"]];
    e2(parseCashLedger(g).total).toBe(250);
  });
  i2("F2 PRY ADD_ZONE needs price within band", () => {
    e2(ha({ ticker: "PRY", price: 129.65, alert_status: "ADD_ZONE", trigger_price_add: "115" }, 0.3)).toBeNull();
    e2(ha({ ticker: "PRY", price: 118, alert_status: "ADD_ZONE", trigger_price_add: "115" }, 0.3)).not.toBeNull();
  });
  i2("F3 text conditions are not zones", () => {
    e2(pz("66p floor reclear + design-in")).toBeNull();
    e2(pz("$32-40")).toEqual({ low: 32, high: 40 });
    e2(pz("420-450p")).toEqual({ low: 420, high: 450 });
  });
  i2("F7 unknown ticker / dead MANUAL → BACKLOG", () => {
    const known = new Set(["ASML", "KTOS"]);
    e2(rtr({ id: "1", ticker: "INFRA", action_type: "SESSION", due_date: "2026-10-06", summary: "", status: "OPEN" }, "2026-10-06", known)).toBe("BACKLOG");
    e2(rtr({ id: "2", ticker: "KTOS", action_type: "MANUAL", due_date: "2026-10-06", summary: "", status: "OPEN" }, "2026-10-06", known, new Set(["KTOS"]))).toBe("BACKLOG");
  });
  i2("F10 test dated before last print is stale", () => {
    e2(isGateTestStale("15 Jun thesis check: Q2 print GM >53%", "2026-07-16")).toBe(true);
    e2(isGateTestStale("2026-10-01 Q3 print test", "2026-07-16")).toBe(false);
  });
});
