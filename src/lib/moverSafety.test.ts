import { describe, expect, it } from "vitest";
import { toYahooSymbol } from "../../supabase/functions/live-prices/contract";
import { currenciesMatch, isSuspectMove, moverCurrencySymbol } from "./moverSafety";

describe("safe live symbol resolution", () => {
  it("resolves INR in AUD to the Australian listing", () => expect(toYahooSymbol("INR", new Map(), "AUD")).toEqual({ symbol: "INR.AX", skip: false }));
  it("skips XYZ in EUR without an alias", () => expect(toYahooSymbol("XYZ", new Map(), "EUR")).toEqual({ symbol: null, skip: true }));
  it("allows NVDA in USD", () => expect(toYahooSymbol("NVDA", new Map(), "USD")).toEqual({ symbol: "NVDA", skip: false }));
  it("uses Nasdaq ALM, never Madrid", () => expect(toYahooSymbol("ALM", new Map(), "USD").symbol).toBe("ALM"));
  it("resolves AMG to Amsterdam", () => expect(toYahooSymbol("AMG", new Map(), "EUR").symbol).toBe("AMG.AS"));
  it.each(["GAM", "WINTON"])("skips the %s fund", ticker => expect(toYahooSymbol(ticker, new Map(), "GBP").skip).toBe(true));
  it("fails closed when currency is unknown", () => expect(toYahooSymbol("XYZ", new Map()).skip).toBe(true));
});
describe("currency units", () => {
  it("rejects USD quotes for EUR prices", () => expect(currenciesMatch("USD", "EUR")).toBe(false));
  it("treats GBp and GBX as the same pence unit", () => expect(currenciesMatch("GBp", "GBX")).toBe(true));
  it("does not compare pounds with pence without conversion", () => expect(currenciesMatch("GBP", "GBX")).toBe(false));
  it.each([["USD", "$"], ["GBP", "£"], ["GBX", "p"], ["EUR", "€"], ["JPY", "¥"], ["AUD", "A$"], ["CAD", "C$"], ["NOK", "kr"], ["CHF", "CHF"]])("labels %s as %s", (currency, symbol) => expect(moverCurrencySymbol(currency)).toBe(symbol));
});
describe("suspect ranking boundaries", () => {
  it("1D excludes moves above 25%, not the boundary", () => { expect(isSuspectMove(25, "1D")).toBe(false); expect(isSuspectMove(-25.01, "1D")).toBe(true); });
  it("1W excludes moves above 40%, not the boundary", () => { expect(isSuspectMove(-40, "1W")).toBe(false); expect(isSuspectMove(40.01, "1W")).toBe(true); });
  it("1M excludes moves above 60%, not the boundary", () => { expect(isSuspectMove(60, "1M")).toBe(false); expect(isSuspectMove(-60.01, "1M")).toBe(true); });
});