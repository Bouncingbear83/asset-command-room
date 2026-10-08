import { describe, expect, it } from "vitest";
import { reviewCycleFor } from "./reviewCycle";

describe("reviewCycleFor", () => {
  it("maps months to quarters", () => {
    expect(reviewCycleFor(new Date("2026-01-01T00:00:00Z"))).toBe("Q1-2026");
    expect(reviewCycleFor(new Date("2026-03-31T23:59:59Z"))).toBe("Q1-2026");
    expect(reviewCycleFor(new Date("2026-07-06T00:00:00Z"))).toBe("Q3-2026");
    expect(reviewCycleFor(new Date("2026-10-08T00:00:00Z"))).toBe("Q4-2026");
    expect(reviewCycleFor(new Date("2026-12-31T12:00:00Z"))).toBe("Q4-2026");
  });
});
