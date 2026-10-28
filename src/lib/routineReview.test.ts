import { describe, it, expect } from "vitest";
import { evaluateRoutine } from "./routineReview";

const T = "2026-10-28";
const base = { today: T, cadence: 30, lastAcceptedVerdict: null as string | null };

describe("evaluateRoutine (R15b)", () => {
  it("NO_PRINT when the ticker has no calendar row (SGLD-type)", () => {
    expect(evaluateRoutine({ ...base, scoreDate: "2026-03-15", printDates: [], hasCalendarRow: false }).outcome).toBe("NO_PRINT");
  });

  it("BACKSTOP beats COVERED when score age > 180d (LEU 196d, print 4 Nov)", () => {
    expect(evaluateRoutine({ ...base, scoreDate: "2026-04-15", printDates: ["2026-11-04"], hasCalendarRow: true }).outcome).toBe("BACKSTOP");
  });

  it("COVERED when the next print is within 45d (RKLB 172d, print 9 Nov)", () => {
    expect(evaluateRoutine({ ...base, scoreDate: "2026-05-09", printDates: ["2026-11-09"], hasCalendarRow: true }).outcome).toBe("COVERED");
  });

  it("COVERED for 7d after a print (RGEN printed 27 Oct)", () => {
    expect(evaluateRoutine({ ...base, scoreDate: "2026-07-28", printDates: ["2026-10-27"], hasCalendarRow: true }).outcome).toBe("COVERED");
  });

  it("DUE when the print passed >7d ago with no accepted verdict", () => {
    expect(evaluateRoutine({ ...base, scoreDate: "2026-07-28", printDates: ["2026-10-15"], hasCalendarRow: true }).outcome).toBe("DUE");
  });

  it("FRESH when an accepted verdict resets the clock", () => {
    const r = evaluateRoutine({ ...base, scoreDate: "2026-07-28", printDates: ["2026-10-15"], hasCalendarRow: true, lastAcceptedVerdict: "2026-10-17" });
    expect(r.outcome).toBe("FRESH");
    expect(r.lastReview).toBe("2026-10-17");
  });

  it("an accepted verdict never clears the backstop (score age is the test)", () => {
    expect(evaluateRoutine({ ...base, scoreDate: "2026-04-01", printDates: ["2026-10-15"], hasCalendarRow: true, lastAcceptedVerdict: "2026-10-17" }).outcome).toBe("BACKSTOP");
  });

  it("DUE when the next print is >45d out (CRPR-type on 2026-10-10)", () => {
    expect(evaluateRoutine({ ...base, today: "2026-10-10", scoreDate: "2026-07-17", printDates: ["2026-12-01"], hasCalendarRow: true }).outcome).toBe("DUE");
  });

  it("replays the 28 Oct overdue list: 21 rows -> 3 backstops", () => {
    // [ticker, score_date, calendar dates] from SCORES (Sheet Reader 12416) and EARNINGS_CALENDAR, 28 Oct
    const live: [string, string, string[]][] = [
      ["SGLD", "2026-03-15", []], ["SLVP", "2026-03-15", []], ["WINTON", "2026-03-15", []],
      ["LEU", "2026-04-15", ["2026-11-04"]], ["LYC", "2026-04-16", ["2026-10-28"]], ["CCJ", "2026-04-27", ["2026-10-30"]],
      ["RKLB", "2026-05-09", ["2026-11-09"]], ["6951.T", "2026-05-27", ["2026-11-13"]], ["2802.T", "2026-05-28", ["2026-11-09"]],
      ["7741.T", "2026-05-30", ["2026-10-30"]], ["TLG.AX", "2026-06-14", ["2026-10-30"]], ["DNR.MI", "2026-06-25", ["2026-11-04"]],
      ["AZT.OL", "2026-07-02", ["2026-11-05"]], ["ALB", "2026-07-07", ["2026-11-04"]], ["NOVT", "2026-07-07", ["2026-11-04"]],
      ["CRPR", "2026-07-17", ["2026-12-01"]], ["RGEN", "2026-07-28", ["2026-10-27"]], ["CDXS", "2026-08-12", ["2026-11-05"]],
      ["RHM", "2026-08-15", ["2026-11-05"]], ["ETN", "2026-08-20", ["2026-10-30"]], ["INR", "2026-09-18", ["2026-10-30"]],
    ];
    const shown = live
      .map(([t, sd, pd]) => [t, evaluateRoutine({ ...base, scoreDate: sd, printDates: pd, hasCalendarRow: pd.length > 0 }).outcome] as const)
      .filter(([, o]) => o === "DUE" || o === "BACKSTOP")
      .map(([t]) => t);
    expect(shown).toEqual(["LEU", "LYC", "CCJ"]);
  });
});
