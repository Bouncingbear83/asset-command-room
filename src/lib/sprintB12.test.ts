import { describe, it, expect } from "vitest";
import { buildSurface, findVerdict, type BuildArgs, type HoldingIn } from "@/lib/actionSurface";

const today = "2026-11-22";
const base = (o: Partial<BuildArgs> = {}): BuildArgs => ({ holdings: [], watchlist: [], scores: [], earnings: [], today, ...o });
const FCX_AJ = "2026-10-27 BMO Q3 print: HOLD 242 sh hold-only | 2026-11-09 (session 2026-11-09-2): gate reviewed, rescore done 28 Oct (79 Satellite); HOLD, hold-only";

describe("B1.2 (1) findVerdict = most recent dated verdict", () => {
  it("FCX note → 2026-11-09, not 2026-10-27", () => { expect(findVerdict(FCX_AJ)).toBe("2026-11-09"); });
  it("UK-format date later than an ISO one wins", () => { expect(findVerdict("2026-10-01 HOLD | 14 Nov 2026 NOT EARNED")).toBe("2026-11-14"); });
  it("FCX SCORE_LOG crossing 2026-10-28 with verdict 2026-11-09 → no R27 card", () => {
    const s = buildSurface(base({
      holdings: [{ ticker: "FCX", account: "ISA", price: 40, trigger_review_note: FCX_AJ } as HoldingIn],
      scores: [{ ticker: "FCX", heldStatus: "HELD" }],
      scoreLog: [{ ticker: "FCX", date: "2026-09-01", score: 81 }, { ticker: "FCX", date: "2026-10-28", score: 79 }, { ticker: "FCX", date: "2026-11-18", score: 79 }],
    }));
    expect(s.tierDrops).toEqual([]);
  });
});

describe("B1.2 (2) R25 honours R12", () => {
  const AUM = 1_000_000;
  const azt = (note?: string): HoldingIn => ({ ticker: "AZT.OL", account: "ISA", price: 1, mv: 11_500, trigger_review_date: "2027-01-04",
    trigger_review_note: note } as HoldingIn);
  const scores = [{ ticker: "AZT.OL", tier: "Satellite", framework: "G(m)" }];
  it("verdict + AI 2027-01-04, 1.15% vs 1.0% → WATCH with verdict, chip still counts", () => {
    const s = buildSurface(base({ holdings: [azt("2026-11-22 ceiling review. Verdict: NO TRIM, HOLD, NO ADD until Q4")], scores, aumGbp: AUM }));
    expect(s.decide.some((c) => c.trigger_type === "POSITION_OVER_CEILING")).toBe(false);
    const w = s.watch.find((c) => c.trigger_type === "POSITION_OVER_CEILING")!;
    expect(w.verdict_at).toBe("2026-11-22");
    expect(s.ceilings!.map((c) => c.ticker)).toContain("AZT.OL");
  });
  it("same with no verdict → DECIDE AMBER", () => {
    const s = buildSurface(base({ holdings: [azt("")], scores, aumGbp: AUM }));
    const c = s.decide.find((x) => x.trigger_type === "POSITION_OVER_CEILING")!;
    expect(c.severity).toBe("AMBER");
  });
});
