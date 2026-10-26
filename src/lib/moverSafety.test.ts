import { describe, expect, it } from "vitest";
import { toYahooSymbol } from "../../supabase/functions/live-prices/contract";
import { currenciesMatch, isSuspectMove, moverCurrencySymbol, holdingSheetQuote } from "./moverSafety";

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
describe("held prices stay aligned with the sheet", () => {
  it("INR uses A$0.10 and +11.11% from the 0.09 sheet close", () => { const q = holdingSheetQuote(0.1, 0.09, 11.11); expect(q.price).toBe(0.1); expect(q.change).toBeCloseTo(11.111111); });
  it("AMG uses EUR22.74 and a zero day move", () => expect(holdingSheetQuote(22.74, 22.74, 0)).toEqual({ price: 22.74, change: 0 }));
  it("GAM uses GBP22.30 and a zero day move", () => expect(holdingSheetQuote(22.3, 22.3, 0)).toEqual({ price: 22.3, change: 0 }));
  it("ALM uses USD8.86 and +1.257% from the 8.75 sheet close", () => { const q = holdingSheetQuote(8.86, 8.75, 1.257); expect(q.price).toBe(8.86); expect(q.change).toBeCloseTo(1.257142); });
});