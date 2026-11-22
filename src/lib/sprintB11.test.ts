import { describe, it, expect } from "vitest";
import { buildSurface, type BuildArgs, type HoldingIn, type TrackerRowIn } from "@/lib/actionSurface";
import { tierCrossDowns } from "@/lib/sprintB1";

const today = "2026-11-22";
const base = (o: Partial<BuildArgs> = {}): BuildArgs => ({ holdings: [], watchlist: [], scores: [], earnings: [], today, ...o });
const h = (ticker: string, extra: Partial<HoldingIn> = {}): HoldingIn => ({ ticker, account: "ISA", price: 10, ...extra } as HoldingIn);
const row = (o: Partial<TrackerRowIn>): TrackerRowIn => ({ id: o.id ?? Math.random().toString(36), ticker: null, action_type: "", due_date: "", summary: "s", status: "OPEN", ...o });
const thesis = (s: ReturnType<typeof buildSurface>, t: string) =>
  [...s.decide, ...s.prepare, ...s.watch].flatMap((c) => c.members?.length ? c.members : [c]).filter((c) => c.ticker === t && c.trigger_type === "THESIS_CHECK");

describe("B1.1 Gap 1 — R14 done-test", () => {
  const run = (t: string, print: string, scoreDate: string, tracker: TrackerRowIn[] = []) => buildSurface(base({
    holdings: [h(t)], scores: [{ ticker: t, scoreDate }], earnings: [{ ticker: t, nextEarningsDate: print }], tracker }));
  it("6268.T print 14 Nov, score_date 18 Nov → no card", () => { expect(thesis(run("6268.T", "2026-11-14", "2026-11-18"), "6268.T")).toHaveLength(0); });
  it("PPTA score_date 16 Nov → no card", () => { expect(thesis(run("PPTA", "2026-11-14", "2026-11-16"), "PPTA")).toHaveLength(0); });
  it("6951.T score_date 16 Nov vs print 13 Nov → no R14", () => { expect(thesis(run("6951.T", "2026-11-13", "2026-11-16"), "6951.T")).toHaveLength(0); });
  it("CDXS score_date 12 Aug vs print 12 Nov → card stays", () => { expect(thesis(run("CDXS", "2026-11-12", "2026-08-12"), "CDXS")).toHaveLength(1); });
  it("CONFIRMED EARNINGS_GATE resolved after the print clears it", () => {
    const tr = [row({ ticker: "CDXS", action_type: "EARNINGS_GATE", status: "CONFIRMED", resolved_at: "2026-11-15T10:00:00Z", due_date: "2026-11-12" })];
    expect(thesis(run("CDXS", "2026-11-12", "2026-08-12", tr), "CDXS")).toHaveLength(0);
  });
});

describe("B1.1 Gap 2 — scheduled decision", () => {
  const r23 = (t: string) => ({ ticker: t, heldStatus: "HELD", irrBbRaw: "0.4%" });
  const names = ["LEU", "TWST", "6324.T", "CDXS", "6951.T"];
  const holdings = [...names.map((t) => h(t)), h("ALM", { alert_status: "STOP_BREACH", alert_fired_date: "2026-11-20" }),
    h("ETN", { price: 295, alert_status: "ADD_ZONE", trigger_price_add: "300", alert_fired_date: "2026-11-20" })];
  const scores = [...names.map(r23), { ticker: "ALM", heldStatus: "HELD" }, { ticker: "ETN", heldStatus: "HELD", irrBbSheet: 0.28 }];
  const tracker = [
    row({ ticker: "LEU", action_type: "THESIS_CHECK", due_date: "2026-12-04", dedupe_key: "LEU|THESIS_CHECK|2026-12-04" }),
    row({ ticker: "TWST", action_type: "THESIS_CHECK", due_date: "2026-12-04", dedupe_key: "TWST|THESIS_CHECK|2026-12-04" }),
    row({ ticker: "6324.T", action_type: "MANUAL", due_date: "2026-12-07", dedupe_key: "6324.T|F5_INDEPENDENT|2026-12-07" }),
    row({ ticker: "ALM", action_type: "THESIS_CHECK", due_date: "2026-11-27", dedupe_key: "AUTO:WEEKLY:D1:2026-W47" }),
    row({ ticker: "CDXS", action_type: "REVIEW_DUE", due_date: "2026-11-30", dedupe_key: "CDXS|REVIEW_DUE|2026-11-30" }),
    row({ ticker: "ETN", action_type: "DEPLOY_READY", due_date: "2026-11-30", dedupe_key: "ETN|DEPLOY_READY" }),
    row({ ticker: "6951.T", action_type: "EARNINGS_GATE", due_date: "2026-12-01", dedupe_key: "6951.T|EARNINGS_GATE" }),
  ];
  const s = buildSurface(base({ holdings, scores, tracker }));
  const decide = s.decide.map((c) => c.ticker);
  it.each(["LEU", "TWST", "6324.T", "ALM", "CDXS"])("%s → WATCH with scheduled badge", (t) => {
    expect(decide).not.toContain(t);
    expect(s.watch.some((c) => c.ticker === t && /scheduled: /.test(c.badge ?? ""))).toBe(true);
  });
  it("ALM badge names the dedupe key and due date", () => {
    expect(s.watch.find((c) => c.ticker === "ALM" && c.badge)?.badge).toContain("scheduled: AUTO:WEEKLY:D1:2026-W47 2026-11-27");
  });
  it("ETN ADD ZONE with an OPEN DEPLOY_READY row stays in DECIDE", () => { expect(decide).toContain("ETN"); });
  it("6951.T R23 with only an EARNINGS_GATE row stays", () => { expect(decide).toContain("6951.T"); });
  it("the card comes back once the scheduling row's due date passes", () => {
    const s2 = buildSurface(base({ holdings, scores, tracker, today: "2026-12-05" }));
    expect(s2.decide.map((c) => c.ticker)).toContain("LEU");
  });
  it("Doctrine counts unchanged: R23 still lists the parked names", () => {
    expect(s.irrbbLow.map((x) => x.ticker)).toEqual(expect.arrayContaining(["LEU", "TWST", "6324.T", "CDXS"]));
  });
});

describe("B1.1 Gap 3 — R27", () => {
  const held = new Set(["SPUT", "AAA"]);
  it("SPUT (VEHICLE) → none", () => {
    const s = buildSurface(base({ holdings: [h("SPUT")], scores: [{ ticker: "SPUT", heldStatus: "HELD", returnProfile: "VEHICLE" }],
      scoreLog: [{ ticker: "SPUT", date: "2026-10-30", score: 80 }, { ticker: "SPUT", date: "2026-11-18", score: 76 }] }));
    expect(s.tierDrops).toEqual([]);
  });
  it("Core crossing 46 days old with a later restamp → none", () => {
    const log = [{ ticker: "AAA", date: "2026-09-01", score: 82 }, { ticker: "AAA", date: "2026-10-07", score: 78 }, { ticker: "AAA", date: "2026-11-18", score: 78 }];
    expect(tierCrossDowns(log, held, today, () => null)).toEqual([]);
  });
  it("crossing inside 30 days dates the card to the crossing row", () => {
    const log = [{ ticker: "AAA", date: "2026-09-01", score: 82 }, { ticker: "AAA", date: "2026-11-01", score: 78 }, { ticker: "AAA", date: "2026-11-18", score: 77 }];
    expect(tierCrossDowns(log, held, today, () => null)[0]).toMatchObject({ date: "2026-11-01", prev: 82, threshold: 80 });
  });
});
