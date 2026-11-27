import { describe, it, expect } from "vitest";
import { readUrlParams, isSegmentsDebug } from "./urlParams";

describe("readUrlParams", () => {
  it("plain ?debug=segments", () => expect(isSegmentsDebug("?debug=segments", "")).toBe(true));
  it("malformed second ?", () => {
    const p = readUrlParams("?tab=watchlist?debug=segments", "");
    expect(p.get("tab")).toBe("watchlist");
    expect(p.get("debug")).toBe("segments");
  });
  it("& form", () => expect(isSegmentsDebug("?tab=watchlist&debug=segments", "")).toBe(true));
  it("hash form", () => expect(isSegmentsDebug("", "#debug=segments")).toBe(true));
  it("absent", () => expect(isSegmentsDebug("?tab=watchlist", "")).toBe(false));
});
