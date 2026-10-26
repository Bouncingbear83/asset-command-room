import { describe, it, expect } from "vitest";
import { hasStalePrice, unpricedPositionCount, parseHoldingsCashBlock } from "./canonical";

// HOLDINGS r56:r65, cols A–F, as the sheet stood on 25 Oct 2026.
const HOLDINGS_R56_R65_2026_10_25: unknown[][] = [
  ["", "", "", "", "", ""],                                   // r56
  ["", "", "", "", "", ""],                                   // r57
  ["CASH", "", "", "", 166677.05, 0.11393764231253767],       // r58
  ["", "", "", "", "", ""],                                   // r59
  ["", "", "", "", 1462879.5770830067, 0.9999999999999997],   // r60
  ["", "", "", "", "", ""],                                   // r61
  ["CASH", "", "SIPP", "", 92299.83, ""],                     // r62
  ["", "", "ISA", "", 48300.22, ""],                          // r63
  ["", "", "Bordier", "", 26077.0, ""],                       // r64
  ["", "", "Total", "", 166677.05, ""],                       // r65
];

describe("unpriced holdings", () => {
  it("positive SHARES with MV = 0 is stale even with a price", () => {
    expect(hasStalePrice({ shares: 10, mv: 0, price: 100 })).toBe(true);
    expect(hasStalePrice({ shares: 10, mv: 1000, price: 100 })).toBe(false);
  });
  it("positive SHARES with a blank price is stale even with MV", () => {
    for (const price of [null, undefined, "", "  "]) expect(hasStalePrice({ shares: 10, mv: 1000, price })).toBe(true);
  });
  it("zero-share rows are not unpriced positions", () => {
    expect(hasStalePrice({ shares: 0, mv: 0, price: null })).toBe(false);
    expect(hasStalePrice({ shares: -1, mv: 0, price: null })).toBe(false);
  });
  it("counts account positions, not tickers, without changing sheet headlines", () => {
    const positions = [{ shares: 10, mv: 0, price: 100 }, { shares: 5, mv: 100, price: null }, { shares: 0, mv: 0, price: null }];
    expect(unpricedPositionCount(positions)).toBe(2);
    expect(parseHoldingsCashBlock(HOLDINGS_R56_R65_2026_10_25).aum).toBe(1462879.5770830067);
  });
});

describe("canonical HOLDINGS cash block (25 Oct 2026)", () => {
  const block = parseHoldingsCashBlock(HOLDINGS_R56_R65_2026_10_25);

  it("header AUM = £1,462,880 (E60, includes Bordier)", () => {
    expect(Math.round(block.aum!)).toBe(1462880);
  });

  it("gross DP = 11.39% (F58)", () => {
    expect((block.grossDp! * 100).toFixed(2)).toBe("11.39");
  });

  it("cash by sleeve and total come from E62:E65", () => {
    expect(block.cashBySleeve).toEqual({ SIPP: 92299.83, ISA: 48300.22, Bordier: 26077.0 });
    expect(block.cashTotal).toBe(166677.05);
  });

  it("same result when blank rows are dropped (Google Viz behaviour)", () => {
    const compact = parseHoldingsCashBlock(HOLDINGS_R56_R65_2026_10_25.filter((r) => r.some((c) => c !== "")));
    expect(Math.round(compact.aum!)).toBe(1462880);
    expect((compact.grossDp! * 100).toFixed(2)).toBe("11.39");
  });

  it("formatted strings parse the same", () => {
    const b = parseHoldingsCashBlock([["CASH", "", "", "", "£166,677.1", "11.39%"], ["", "", "", "", "£1,462,880", "100.00%"]]);
    expect(b.aum).toBe(1462880);
    expect(b.grossDp).toBeCloseTo(0.1139, 6);
  });
});
