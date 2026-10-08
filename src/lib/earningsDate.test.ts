import { describe, expect, it } from "vitest";
import { effectiveEarningsDate } from "./earningsDate";

const today = "2026-10-08";

describe("effectiveEarningsDate", () => {
  it("uses the sheet date when nothing is verified", () => {
    const r = effectiveEarningsDate({ sheetDate: "2026-10-22", sheetConfirmed: false }, today);
    expect(r).toEqual({ date: "2026-10-22", confirmed: false, source: "SHEET", verifiedClass: null });
  });

  it("prefers a future class A verified date and marks it confirmed", () => {
    const r = effectiveEarningsDate(
      { sheetDate: "2026-10-22", sheetConfirmed: false, verifiedDate: "2026-10-23", verifiedClass: "A" },
      today,
    );
    expect(r.date).toBe("2026-10-23");
    expect(r.confirmed).toBe(true);
    expect(r.source).toBe("VERIFIED");
  });

  it("accepts class B, rejects class C", () => {
    expect(
      effectiveEarningsDate({ sheetDate: "2026-10-22", sheetConfirmed: true, verifiedDate: "2026-10-23", verifiedClass: "B" }, today).source,
    ).toBe("VERIFIED");
    expect(
      effectiveEarningsDate({ sheetDate: "2026-10-22", sheetConfirmed: true, verifiedDate: "2026-10-23", verifiedClass: "C" }, today).source,
    ).toBe("SHEET");
  });

  it("falls back to the sheet once the verified print has happened", () => {
    const printed = effectiveEarningsDate(
      { sheetDate: "2027-01-14", sheetConfirmed: false, verifiedDate: "2026-10-07", verifiedClass: "A", verifyNote: "PRINTED 7 Oct" },
      today,
    );
    expect(printed.source).toBe("SHEET");
    expect(printed.date).toBe("2027-01-14");
    const past = effectiveEarningsDate(
      { sheetDate: "2026-10-07", sheetConfirmed: true, verifiedDate: "2026-10-07", verifiedClass: "A" },
      today,
    );
    expect(past.source).toBe("SHEET");
  });

  it("treats today as still upcoming", () => {
    expect(
      effectiveEarningsDate({ sheetDate: "2026-10-09", sheetConfirmed: true, verifiedDate: today, verifiedClass: "A" }, today).date,
    ).toBe(today);
  });

  it("ignores malformed verified dates", () => {
    expect(
      effectiveEarningsDate({ sheetDate: "2026-10-22", sheetConfirmed: true, verifiedDate: "22/10/2026", verifiedClass: "A" }, today).source,
    ).toBe("SHEET");
  });
});
