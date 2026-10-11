import { describe, expect, it } from "vitest";
import { BAND_CHIPS, matchesChip } from "./watchlistBands";

describe("Watchlist chip exclusions", () => {
  it("LIN with RESEARCH status and NEAR band appears only under Near (and All)", () => {
    const lin = { ticker: "LIN", status: "RESEARCH", band: "NEAR" };
    const matches = BAND_CHIPS.filter((c) => c.key !== "ALL" && matchesChip(c.key, lin.status, lin.band)).map((c) => c.key);
    expect(matches).toEqual(["NEAR"]);
    expect(matchesChip("ALL", lin.status, lin.band)).toBe(true);
  });
  it("Parked still includes research names outside ZONE and NEAR", () => {
    expect(matchesChip("PARKED", "RESEARCH", "BENCH")).toBe(true);
    expect(matchesChip("PARKED", "RESEARCH", "ZONE")).toBe(false);
  });
});