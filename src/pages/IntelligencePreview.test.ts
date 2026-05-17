import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  withSafeV213Defaults,
  EMPTY_FRAMING,
  EMPTY_PRICE_ANCHORS,
} from "./IntelligencePreview";

describe("withSafeV213Defaults", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("fills both framing and price_anchors when missing", () => {
    const out = withSafeV213Defaults({ ticker: "AAA" });
    expect(out.framing).toEqual(EMPTY_FRAMING);
    expect(out.price_anchors).toEqual(EMPTY_PRICE_ANCHORS);
  });

  it("preserves existing framing and price_anchors", () => {
    const framing = {
      bull_case: "bull",
      bear_case: "bear",
      asymmetry: { raw: "3:1", pairs: [], max: 3, spot: 3 },
      stage2_subclass: "X",
      china_exposure_flag: "LOW" as const,
    };
    const price_anchors = {
      first_add: { price: 10, date: "2025-01-01", source: "scores" as const },
      last_score: { price: 12, date: null, source: "scores" as const },
      pct_from_first_add: 20,
      pct_from_last_score: 0,
      raw: { scores: { first_add_price: 10, first_add_date: "2025-01-01", last_score_price: 12 } },
    };
    const out = withSafeV213Defaults({ ticker: "BBB", framing, price_anchors });
    expect(out.framing).toBe(framing);
    expect(out.price_anchors).toBe(price_anchors);
  });

  it("fills only price_anchors when framing is present", () => {
    const framing = { ...EMPTY_FRAMING, bull_case: "x" };
    const out = withSafeV213Defaults({ ticker: "CCC", framing });
    expect(out.framing).toBe(framing);
    expect(out.price_anchors).toEqual(EMPTY_PRICE_ANCHORS);
  });

  it("warns once per ticker:field when missing (dedupe)", () => {
    const warn = vi.spyOn(console, "warn");
    withSafeV213Defaults({ ticker: "DEDUPE_TICKER" });
    withSafeV213Defaults({ ticker: "DEDUPE_TICKER" });
    const messages = warn.mock.calls.map((c) => String(c[0]));
    const framingWarns = messages.filter((m) => m.includes("DEDUPE_TICKER") && m.includes("framing"));
    const anchorWarns = messages.filter((m) => m.includes("DEDUPE_TICKER") && m.includes("price_anchors"));
    expect(framingWarns).toHaveLength(1);
    expect(anchorWarns).toHaveLength(1);
  });

  it("handles missing ticker without crashing", () => {
    const out = withSafeV213Defaults({});
    expect(out.framing).toEqual(EMPTY_FRAMING);
    expect(out.price_anchors).toEqual(EMPTY_PRICE_ANCHORS);
  });
});
