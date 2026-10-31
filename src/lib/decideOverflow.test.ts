import { describe, it, expect } from "vitest";
import { buildSurface, type HoldingIn, type TrackerRowIn } from "./actionSurface";

const TODAY = "2026-10-31";
const held = (ticker: string, o: Partial<HoldingIn> = {}): HoldingIn => ({ ticker, account: "ISA", price: 100, alert_status: "CLEAR", ...o });
const verdict = (id: string, ticker: string, band: string | null, o: Record<string, any> = {}): TrackerRowIn => ({
  id, ticker, action_type: "EARNINGS_GATE", due_date: "2026-11-04", summary: "verdict", status: "OPEN", apply_target: "UPDATE_ROW",
  staged_payload: { v: 1, kind: "EARNINGS_VERDICT", ticker, print_date: "2026-10-28", decision: null,
    ...(band ? { grader: { band } } : {}), band_action: `${band}: action`, apply: { update_row: { tab: "HOLDINGS", updates: [] } }, ...o },
});
const run = (holdings: HoldingIn[], tracker: TrackerRowIn[], scores: any[] = [], watchlist: any[] = []) =>
  buildSurface({ holdings, watchlist, scores, earnings: [], today: TODAY, tracker });

describe("R33 DECIDE overflow", () => {
  it("ILMN with IRR-BB RED, an EARNINGS_GATE row and a staged verdict gives one card with 3 reasons", () => {
    const gate: TrackerRowIn = { id: "g1", ticker: "ILMN", action_type: "EARNINGS_GATE", due_date: TODAY, summary: "ILMN Q3 gate", status: "OPEN", priority: "MEDIUM" };
    const s = run([held("ILMN")], [gate, verdict("v1", "ILMN", "AMBER")], [{ ticker: "ILMN", heldStatus: "HELD", irrBbRaw: "3.2%" }]);
    const ilmn = s.decide.filter((c) => c.ticker === "ILMN");
    expect(ilmn).toHaveLength(1);
    expect(ilmn[0].reasons).toHaveLength(3);
    expect(ilmn[0].severity).toBe("RED");
    expect(ilmn[0].verdict?.id).toBe("v1");
  });

  it("five CONFIRM verdicts give one “Apply 5 confirms” card", () => {
    const names = ["AAA", "BBB", "CCC", "DDD", "EEE"];
    const s = run(names.map((t) => held(t)), names.map((t, i) => verdict(`c${i}`, t, "CONFIRM")));
    expect(s.decide).toHaveLength(1);
    expect(s.decide[0].title).toBe("Apply 5 confirms");
    expect(s.decide[0].members).toHaveLength(5);
  });

  it("a 4368.T NO DATA verdict goes to PREPARE", () => {
    const s = run([held("4368.T")], [verdict("n1", "4368.T", "NO DATA")]);
    expect(s.decide.some((c) => c.ticker === "4368.T")).toBe(false);
    expect(s.prepare.find((c) => c.key === "verdict:n1")).toBeDefined();
  });

  it("an ungraded verdict goes to PREPARE", () => {
    const s = run([held("4368.T")], [verdict("n2", "4368.T", null)]);
    expect(s.prepare.find((c) => c.key === "verdict:n2")).toBeDefined();
  });

  it("a KLAC AMBER verdict on a watchlist name goes to PREPARE; a RED one stays in DECIDE", () => {
    const scores = [{ ticker: "KLAC", heldStatus: "WATCHLIST" }];
    const wl = [{ ticker: "KLAC", status: "WAIT_PRICE", current: 1200 }];
    expect(run([], [verdict("k1", "KLAC", "AMBER")], scores, wl).prepare.find((c) => c.key === "verdict:k1")).toBeDefined();
    expect(run([], [verdict("k2", "KLAC", "RED")], scores, wl).decide[0]?.key).toBe("verdict:k2");
  });

  it("overflow order: RED doctrine, then KILL/RED verdicts, then AMBER", () => {
    const amber = Array.from({ length: 9 }, (_, i) => held(`A${i}`, { alert_status: "EXIT_ZONE" }));
    const s = run([...amber, held("KV"), held("STP", { price: 90, trigger_price_exit: "100" })], [verdict("kv", "KV", "KILL")]);
    expect(s.decide[0].ticker).toBe("STP");
    expect(s.decide[1].key).toBe("verdict:kv");
    expect(s.decide).toHaveLength(10);
    expect(s.overflow).toBe(1);
  });
});
