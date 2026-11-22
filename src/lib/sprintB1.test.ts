import { describe, it, expect } from "vitest";
import { buildSurface, findVerdict, isSuperseded, doctrineChecks, type BuildArgs } from "@/lib/actionSurface";
import { positionCeilings, tierCrossDowns, r4Drought } from "@/lib/sprintB1";

const base = (o: Partial<BuildArgs> = {}): BuildArgs => ({ holdings: [], watchlist: [], scores: [], earnings: [], today: "2026-11-22", ...o });

describe("B1-1 R12 verdict tokens", () => {
  const today = "2026-11-22";
  it("NOT EARNED dated + future review → superseded", () => {
    expect(isSuperseded("14 Nov 2026 session: T21 reserve NOT EARNED, re-test Q4", "2027-02-15", today)).toBe(true);
  });
  it("DISARMED dated → superseded", () => {
    expect(isSuperseded("2026-11-14 T2 DISARMED, re-arm <= $26.1", "2027-01-10", today)).toBe(true);
  });
  it("BLOCKED dated → superseded", () => {
    expect(isSuperseded("2026-11-14 add BLOCKED to EPS restatement", "2027-01-10", today)).toBe(true);
  });
  it("NOT EARNED without a date → not superseded", () => {
    expect(findVerdict("T21 reserve NOT EARNED")).toBeNull();
    expect(isSuperseded("T21 reserve NOT EARNED", "2027-02-15", today)).toBe(false);
  });
});

describe("B1-2 R25 single-name ceiling", () => {
  const AUM = 1_000_000;
  const core = { ticker: "AAA", tier: "Core" };
  const w = (pcts: number[], ticker = "AAA", accs = ["SIPP", "ISA"]) => pcts.map((p, i) => ({ ticker, account: accs[i] ?? "SIPP", mv: (p / 100) * AUM, price: 1 }));
  it("Core 6.9% (4.0 + 2.9) → none", () => { expect(positionCeilings(w([4.0, 2.9]), [core], AUM)).toEqual([]); });
  it("Core 7.4% → AMBER", () => { expect(positionCeilings(w([4.0, 3.4]), [core], AUM)![0].severity).toBe("AMBER"); });
  it("Core 9.1% → RED", () => { expect(positionCeilings(w([5.0, 4.1]), [core], AUM)![0].severity).toBe("RED"); });
  it("G(m) 1.2% → AMBER", () => {
    expect(positionCeilings(w([1.2], "GMX"), [{ ticker: "GMX", tier: "Satellite", framework: "G(m)" }], AUM)![0]).toMatchObject({ severity: "AMBER", ceilingPct: 1 });
  });
  it("SGLD HEDGE 8% → exempt", () => {
    expect(positionCeilings(w([8], "SGLD"), [{ ticker: "SGLD", tier: "Core", returnProfile: "HEDGE" }], AUM)).toEqual([]);
  });
  it("JISA rows ignored", () => {
    expect(positionCeilings(w([4.0, 2.9, 3.0], "AAA", ["SIPP", "ISA", "JISA_A"]), [core], AUM)).toEqual([]);
  });
  it("card shows weight, ceiling, £ above and accounts; chip RED", () => {
    const s = buildSurface(base({ holdings: w([5.0, 4.1]), scores: [core], aumGbp: AUM }));
    const c = s.decide.find((x) => x.trigger_type === "POSITION_OVER_CEILING")!;
    expect(c.title).toBe("Over ceiling: trim review (OB §3.4)");
    expect(c.reasons[0]).toContain("9.1%");
    expect(c.reasons[0]).toContain("£21,000");
    expect(c.accounts).toEqual(["ISA", "SIPP"]);
    const chip = doctrineChecks({ gm: null, dpPct: null, surface: s, driverCaps: null }).find((x) => x.id === "concentration")!;
    expect(chip.rag).toBe("RED");
  });
});

describe("B1-3 R27 tier cross-down", () => {
  const today = "2026-11-22";
  const held = new Set(["AAA"]);
  const log = (prev: number, next: number, date = "2026-11-17") => [
    { ticker: "AAA", date: "2026-10-01", score: prev }, { ticker: "AAA", date, score: next, changeNote: "moat cut" }];
  it("82 → 79 held, 5 days old, no verdict → AMBER", () => {
    expect(tierCrossDowns(log(82, 79), held, today, () => null)[0].severity).toBe("AMBER");
  });
  it("61 → 58 → RED", () => { expect(tierCrossDowns(log(61, 58), held, today, () => null)[0].severity).toBe("RED"); });
  it("AJ verdict same day → none", () => { expect(tierCrossDowns(log(82, 79), held, today, () => "2026-11-17")).toEqual([]); });
  it("45 days old → none", () => { expect(tierCrossDowns(log(82, 79, "2026-10-08"), held, today, () => null)).toEqual([]); });
  it("WATCHLIST name → none", () => {
    const s = buildSurface(base({ watchlist: [{ ticker: "AAA", status: "WAIT_PRICE", current: 10 }], scores: [{ ticker: "AAA", heldStatus: "WATCHLIST" }], scoreLog: log(82, 79) }));
    expect([...s.decide, ...s.watch].some((c) => c.trigger_type === "TIER_CROSS_DOWN")).toBe(false);
  });
  it("buildSurface card text", () => {
    const s = buildSurface(base({ holdings: [{ ticker: "AAA", price: 10, account: "SIPP" }], scoreLog: log(82, 79) }));
    const c = s.decide.find((x) => x.trigger_type === "TIER_CROSS_DOWN")!;
    expect(c.title).toBe("Tier drop: 82 -> 79 (Satellite)");
    expect(c.reasons[0]).toContain("2026-11-17");
  });
});

describe("B1-4 R4 deployment drought", () => {
  const stress = { regimeState: "STRESS", grossCashGbp: 200_000, aumGbp: 1_300_000 };
  it("no BUY since 6 Nov: 16 Nov → day 6; 20 Nov → day 10", () => {
    expect(r4Drought({ ...stress, asOf: "2026-11-16" }).day).toBe(6);
    expect(r4Drought({ ...stress, asOf: "2026-11-20" }).day).toBe(10);
  });
  it("27 Nov after the close → day 15, card shows", () => {
    const r = r4Drought({ ...stress, asOf: "2026-11-27" });
    expect(r.day).toBe(15);
    expect(r.fire).toBe(true);
    const s = buildSurface(base({ today: "2026-11-27", r4AsOf: "2026-11-27", aumGbp: stress.aumGbp, grossCashGbp: stress.grossCashGbp,
      regime: { state: "STRESS" } as any }));
    expect(s.decide.some((c) => c.trigger_type === "R4_DROUGHT")).toBe(true);
  });
  it("BUY on 18 Nov → 20 Nov is day 2", () => {
    expect(r4Drought({ ...stress, asOf: "2026-11-20", transactions: [{ date: "2026-11-18", action: "BUY" }] }).day).toBe(2);
  });
  it("NORMAL regime → no card", () => { expect(r4Drought({ ...stress, regimeState: "NORMAL", asOf: "2026-11-27" }).fire).toBe(false); });
  it("net DP 11% → no card", () => {
    expect(r4Drought({ ...stress, grossCashGbp: 0.11 * 1_300_000 + 17123, asOf: "2026-11-27" }).fire).toBe(false);
  });
  it("OPEN tracker row owns the card; CONFIRMED row restarts the counter", () => {
    const row = { id: "r4row", summary: "R4 deployment-drought review", status: "OPEN" };
    expect(r4Drought({ ...stress, asOf: "2026-11-27", tracker: [row] }).trackerId).toBe("r4row");
    expect(r4Drought({ ...stress, asOf: "2026-11-27", tracker: [{ ...row, status: "CONFIRMED", resolved_at: "2026-11-25T10:00:00Z" }] }).day).toBe(2);
  });
});
