import { describe, it, expect } from "vitest";
import { segmentRow, resetChipLabel, fmtCcy, archiveGapPct, closesFrozen, RULES_VERSION, type SegRow, type SegTracker } from "./segmentRules";

const row = (o: Partial<SegRow>): SegRow => ({ ticker: "TER", status: "ARCHIVE", band: "ZONE", current: 90, trigger: "", triggerPrice: 100, reviewNote: "", currency: "USD", archiveReason: "VALUATION", ...o });
const tr = (o: Partial<SegTracker>): SegTracker => ({ ticker: "TER", dedupe_key: "AUTO:TER:RESET:2026-11-01", status: "DISMISSED", resolution_note: "level not credible", resolved_at: "2026-11-02T10:00:00Z", created_at: "2026-11-01T10:00:00Z", summary: "level=100; ab=VALUATION", action_type: "DATA_FIX", due_date: null, ...o });

describe("segment rules C29.1", () => {
  it("version", () => expect(RULES_VERSION).toBe("C29.1"));
  it("NEW when no tracker", () => expect(segmentRow(row({}), []).state).toBe("NEW"));
  it("S1 dismissed at same level", () => expect(segmentRow(row({}), [tr({})]).state).toBe("S1"));
  it("out-of-zone dismissal is not S1", () => expect(segmentRow(row({}), [tr({ resolution_note: "out of zone" })]).state).toBe("NEW"));
  it("level moved >0.5% is not S1", () => expect(segmentRow(row({ triggerPrice: 101 }), [tr({})]).state).toBe("NEW"));
  it("level within 0.5% is S1", () => expect(segmentRow(row({ triggerPrice: 100.4 }), [tr({})]).state).toBe("S1"));
  it("AB first word changed is not S1", () => expect(segmentRow(row({ archiveReason: "THESIS_KILL x" }), [tr({})]).state).toBe("S2"));
  it("no level token + later R1 marker is not S1", () =>
    expect(segmentRow(row({ reviewNote: "[R1 2026-11-10] moved" }), [tr({ summary: "ab=VALUATION" })]).state).toBe("NEW"));
  it("latest RESET row by created_at decides", () =>
    expect(segmentRow(row({}), [tr({}), tr({ dedupe_key: "AUTO:TER:RESET:2026-11-20", status: "OPEN", created_at: "2026-11-20T00:00:00Z" })]).state).toBe("NEW"));
  it("S2 from AB token", () => expect(segmentRow(row({ archiveReason: "SUB_WEAK" }), []).state).toBe("S2"));
  it("S2 from F text", () => expect(segmentRow(row({ trigger: "Re-entry only on Q3 print" }), []).state).toBe("S2"));
  it("S3 DATA_FIX ticker goes to DATA", () => { const s = segmentRow(row({ ticker: "3363.TWO" }), []); expect([s.state, s.segment]).toEqual(["S3", "DATA"]); });
  it("S3 blank price", () => expect(segmentRow(row({ current: null }), []).state).toBe("S3"));
  it("S3 frozen 5 weekday closes", () => {
    const c = ["2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"].map((date) => ({ date, close: 5 }));
    expect(closesFrozen(c)).toBe(true);
    expect(segmentRow(row({}), [], c).state).toBe("S3");
  });
  it("HANDLED by open CATALYST_WATCH", () =>
    expect(segmentRow(row({}), [tr({ dedupe_key: "TER|CATALYST_WATCH|2026-12-01", status: "OPEN", action_type: "CATALYST_WATCH" })]).state).toBe("HANDLED"));
  it("HANDLED by re-engage summary", () =>
    expect(segmentRow(row({}), [tr({ dedupe_key: "X", status: "OPEN", action_type: "MANUAL", summary: "Re-engage review" })]).state).toBe("HANDLED"));
  it("chip label counts handled + new", () =>
    expect(resetChipLabel([{ state: "NEW" }, { state: "HANDLED" }, { state: "S1" }] as any)).toBe("RESET 2 · 1 new"));
  it("PARKED hygiene: level missing", () =>
    expect(segmentRow(row({ ticker: "CHG.L", band: "BENCH", triggerPrice: null, trigger: "below £2.10" }), []).segment).toBe("DATA"));
  it("PARKED hygiene: no re-engage route", () =>
    expect(segmentRow(row({ ticker: "ACLS", band: "", triggerPrice: null, trigger: "" }), []).segment).toBe("DATA"));
  it("PARKED excludes NEAR, keeps BENCH", () => {
    expect(segmentRow(row({ band: "NEAR" }), []).segment).toBe(null);
    expect(segmentRow(row({ band: "BENCH" }), []).segment).toBe("PARKED");
  });
  it("archive target uses WL P currency and E/I gap", () => {
    expect(fmtCcy(2.5, "TWD")).toMatch(/^NT\$2\.50/);
    expect(fmtCcy(120, "GBp")).toBe("120.00p");
    expect(archiveGapPct(90, 100)).toBeCloseTo(-10);
  });
});
