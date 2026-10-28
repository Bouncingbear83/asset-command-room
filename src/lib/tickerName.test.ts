import { describe, it, expect, vi } from "vitest";
import { NUMERIC_TICKER, withNames } from "./tickerName";

const names = new Map([["6951.T", "JEOL Ltd"], ["2802.T", "Ajinomoto Co Inc"], ["4368.T", "Fuso Chemical"]]);

describe("NUMERIC_TICKER", () => {
  it.each(["6951.T", "105840.KS", "237690.KQ", "3037.TW", "3680.TWO", "0700.HK", "600519.SS"])("matches %s", (t) => {
    expect(NUMERIC_TICKER.test(t)).toBe(true);
  });
  it.each(["FCX", "BRK.B", "RSW.L", "WAF.DE", "SIFG.AS", "VLN.TO"])("does not match %s", (t) => {
    expect(NUMERIC_TICKER.test(t)).toBe(false);
  });
});

describe("withNames", () => {
  it("names a bare code", () => {
    expect(withNames("GATE LINT 4368.T H1 print", names)).toBe("GATE LINT Fuso Chemical (4368.T) H1 print");
  });
  it("does not double an already named code", () => {
    expect(withNames("Ajinomoto (2802.T) review", names)).toBe("Ajinomoto (2802.T) review");
  });
  it("leaves file paths and URLs alone", () => {
    expect(withNames("see tickers/4368-t.md", names)).toBe("see tickers/4368-t.md");
    expect(withNames("https://example.com/q/6951.T", names)).toBe("https://example.com/q/6951.T");
  });
  it("keeps an unknown code and reports it", () => {
    const miss = vi.fn();
    expect(withNames("watch 9999.T", names, miss)).toBe("watch 9999.T");
    expect(miss).toHaveBeenCalledWith("9999.T");
  });
});
