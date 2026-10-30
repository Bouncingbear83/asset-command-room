import { describe, it, expect } from "vitest";
import {
  buildSurface, irrbbLowHeld, parseIrrBbCell, staleQuartets, sleeveFloors, cashRecon, isTrackerHygiene,
  doctrineChecks, routeTrackerRow, type ScoreIn, type HoldingIn, type TrackerRowIn, type WatchIn,
} from "./actionSurface";
import { parseCashLedger } from "./cashLedger";

const TODAY = "2026-10-30";
const daysAgo = (n: number) => new Date(Date.parse(TODAY + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10);
const base = { holdings: [] as HoldingIn[], watchlist: [] as WatchIn[], earnings: [], today: TODAY };

// ── §9 fixture: R23 AU values ──
const held = (ticker: string, au: unknown, extra: Partial<ScoreIn> = {}): ScoreIn => ({ ticker, heldStatus: "HELD", irrBbRaw: au, ...extra });
const R23_SCORES: ScoreIn[] = [
  held("RGEN", "0.4%", { livePrice: 5.2, bullBase: 12, bbTargetDate: "2028-06-30", bullBearAtDate: "2026-07-01" }),
  held("TWST", "0.6%"), held("ILMN", "1.0%"), held("ONT", "1.1%"),
  held("TEM", "6.2%"), held("4047.T", "6.7%"), held("CRPR", "7.5%"), held("RSW", "7.9%"),
  held("6268.T", "10.0%"), held("FCX", "11.0%"), held("6920.T", "11.7%"), held("VEEV", "11.9%"),
  held("BLANK1", ""), held("BLANK2", "#N/A"), held("BLANK3", "TBC"),
  { ticker: "WLNAME", heldStatus: "WATCHLIST", irrBbRaw: "-11.5%" },
];

describe("R23 IRRBB_LOW_HELD", () => {
  it("parses AU: strips % and commas; blank, #N/A and text are not evaluated", () => {
    expect(parseIrrBbCell("0.4%")).toBeCloseTo(0.4);
    expect(parseIrrBbCell("1,234.5%")).toBeCloseTo(1234.5);
    expect(parseIrrBbCell(0.004)).toBeCloseTo(0.4); // sheet fraction
    expect(parseIrrBbCell("")).toBeNull();
    expect(parseIrrBbCell("#N/A")).toBeNull();
    expect(parseIrrBbCell("TBC")).toBeNull();
  });

  it("§9 fixture: four RED, eight AMBER, no card for blank AU or the WATCHLIST name", () => {
    const r = irrbbLowHeld(R23_SCORES);
    expect(r.filter((x) => x.severity === "RED").map((x) => x.ticker).sort()).toEqual(["ILMN", "ONT", "RGEN", "TWST"]);
    expect(r.filter((x) => x.severity === "AMBER").map((x) => x.ticker).sort())
      .toEqual(["4047.T", "6268.T", "6920.T", "CRPR", "FCX", "RSW", "TEM", "VEEV"]);
    expect(r).toHaveLength(12);
    expect(r.some((x) => ["BLANK1", "BLANK2", "BLANK3", "WLNAME"].includes(x.ticker))).toBe(false);
  });

  it("card text and DECIDE ordering: the RED four rank above AMBER", () => {
    const s = buildSurface({ ...base, scores: R23_SCORES });
    const irr = s.decide.filter((c) => c.trigger_type === "IRRBB_LOW_HELD");
    expect(irr.slice(0, 4).map((c) => c.severity)).toEqual(["RED", "RED", "RED", "RED"]);
    expect(irr.slice(4).every((c) => c.severity === "AMBER")).toBe(true);
    const rgen = irr.find((c) => c.ticker === "RGEN")!;
    expect(rgen.key).toBe("RGEN:IRRBB_LOW_HELD");
    expect(rgen.reasons[0]).toBe("IRR-BB 0.4% < 15% hurdle · spot 5.2 vs BB 12 @ 2028-06-30 · quartet 2026-07-01");
  });

  it("artefact guard: AU < -50 or > 150 emits IRRBB_DATA_CHECK (GREY) instead", () => {
    const r = irrbbLowHeld([held("ART1", "180%"), held("ART2", "-60%")]);
    expect(r.map((x) => [x.ticker, x.kind, x.severity])).toEqual([["ART1", "DATA_CHECK", "GREY"], ["ART2", "DATA_CHECK", "GREY"]]);
  });

  it("accounts merge into one card per ticker", () => {
    const holdings: HoldingIn[] = [{ ticker: "FCX", account: "SIPP", price: 40 }, { ticker: "FCX", account: "ISA", price: 40 }];
    const s = buildSurface({ ...base, holdings, scores: [held("FCX", "11.0%")] });
    const cards = s.decide.filter((c) => c.ticker === "FCX" && c.trigger_type === "IRRBB_LOW_HELD");
    expect(cards).toHaveLength(1);
    expect(cards[0].accounts.sort()).toEqual(["ISA", "SIPP"]);
  });

  it("R12 supersedes AMBER; RED stays in DECIDE until AJ has TRIM/SELL/EXIT/HOLD-ONLY/EXIT TEST", () => {
    const holdings: HoldingIn[] = [
      { ticker: "FCX", account: "SIPP", price: 40, trigger_review_date: "2026-11-20", trigger_review_note: "2026-10-20 HOLD through Q3" },
      { ticker: "RGEN", account: "ISA", price: 5, trigger_review_date: "2026-11-20", trigger_review_note: "2026-10-20 HOLD through Q3" },
      { ticker: "ONT", account: "ISA", price: 1, trigger_review_note: "2026-10-29 TRIM half at open" },
      { ticker: "TWST", account: "ISA", price: 1, trigger_review_note: "ALERT EXIT_ZONE fired" },
    ];
    const s = buildSurface({ ...base, holdings, scores: [held("FCX", "11%"), held("RGEN", "0.4%"), held("ONT", "1.1%"), held("TWST", "0.6%")] });
    const lane = (t: string) => [...s.decide, ...s.watch].find((c) => c.ticker === t && c.trigger_type === "IRRBB_LOW_HELD")?.lane;
    expect(lane("FCX")).toBe("WATCH");
    expect(lane("RGEN")).toBe("DECIDE");
    expect(lane("ONT")).toBe("WATCH");
    expect(lane("TWST")).toBe("DECIDE");
  });
});

// ── §10 fixture: R24 quartet age + IRR-BB ──
describe("R24 QUARTET_STALE_HIGH", () => {
  const scores: ScoreIn[] = [
    { ticker: "AMG", heldStatus: "HELD", irrBbRaw: "53.1%", bullBearAtDate: daysAgo(129) },
    { ticker: "ALB", heldStatus: "HELD", irrBbRaw: "30.3%", bullBearAtDate: daysAgo(122) },
    { ticker: "4109.T", heldStatus: "HELD", irrBbRaw: "52.9%", bullBearAtDate: daysAgo(112) },
    { ticker: "NOAO", heldStatus: "HELD", irrBbRaw: "80%", bullBearAtDate: "" },
  ];
  it("AMG (129d, 53.1%) and ALB (122d, 30.3%) are stale; 4109.T (112d) and blank AO are not", () => {
    const m = staleQuartets(scores, TODAY);
    expect([...m.keys()].sort()).toEqual(["ALB", "AMG"]);
    expect(m.get("AMG")?.age).toBe(129);
    expect(m.get("ALB")?.age).toBe(122);
  });
  it("suppresses wake cards and sends the name to WATCH with the badge", () => {
    const watchlist: WatchIn[] = [{ ticker: "AMG", status: "WAIT_PRICE", current: 20, band: "ZONE" }];
    const s = buildSurface({ ...base, watchlist, scores });
    expect(s.decide.some((c) => c.ticker === "AMG")).toBe(false);
    const w = s.watch.find((c) => c.ticker === "AMG" && c.trigger_type === "QUARTET_STALE");
    expect(w?.badge).toBe("STALE QUARTET 129d");
    expect(s.staleQuartets).toEqual({ AMG: 129, ALB: 122 });
  });
});

describe("R29 SLEEVE_FLOOR", () => {
  const holdings: HoldingIn[] = [
    { ticker: "AAA", account: "SIPP", price: 1, mv: 100_000 },
    { ticker: "BBB", account: "ISA", price: 1, mv: 50_000 },
  ];
  it("sleeve cash / sleeve value < 3% is AMBER in DECIDE", () => {
    const f = sleeveFloors(holdings, { SIPP: 2_000, ISA: 5_000, Bordier: null });
    expect(f.filter((x) => x.below).map((x) => x.sleeve)).toEqual(["SIPP"]);
    const s = buildSurface({ ...base, holdings, scores: [], cashBySleeve: { SIPP: 2_000, ISA: 5_000, Bordier: null } });
    const card = s.decide.find((c) => c.trigger_type === "SLEEVE_FLOOR_SIPP");
    expect(card?.severity).toBe("AMBER");
    expect(s.decide.some((c) => c.trigger_type === "SLEEVE_FLOOR_ISA")).toBe(false);
  });
  it("3.0% exactly is not below the floor", () => {
    const f = sleeveFloors([{ ticker: "A", account: "ISA", price: 1, mv: 97 }], { SIPP: null, ISA: 3, Bordier: null });
    expect(f[0].below).toBe(false);
  });
});

describe("R30 CASH_RECON", () => {
  // Latest row per account: SIPP 82,410.55 + ISA 41,203.40 + BORDIER_GIA 15,300.25 = 138,914.20 (JISA excluded).
  const grid = [
    ["DATE", "ACCOUNT", "BALANCE"],
    ["2026-10-01", "SIPP", "90,000.00"],
    ["2026-10-28", "SIPP", "82,410.55"],
    ["2026-10-27", "ISA", "41,203.40"],
    ["2026-10-29", "Bordier GIA", "15,300.25"],
    ["2026-10-29", "JISA_BEAR", "5,000.00"],
  ];
  it("ledger fixture sums the latest row per account to 138,914.20", () => {
    expect(parseCashLedger(grid).total).toBeCloseTo(138_914.2, 2);
  });
  it("RED only when |E65 − ledger| > £100", () => {
    const ledger = parseCashLedger(grid).total;
    expect(cashRecon(138_914.2, ledger)?.red).toBe(false);
    expect(cashRecon(139_014.2, ledger)?.red).toBe(false); // exactly £100
    expect(cashRecon(139_100, ledger)?.red).toBe(true);
    const s = buildSurface({ ...base, scores: [], cashRecon: { e65: 139_100, ledgerTotal: ledger } });
    expect(s.decide.find((c) => c.trigger_type === "CASH_RECON")?.severity).toBe("RED");
  });
});

describe("R31 MISSED_HIGH and R32 TRACKER_ON_DEAD", () => {
  const holdings: HoldingIn[] = [{ ticker: "LHX", account: "ISA", price: 280 }];
  const row = (p: Partial<TrackerRowIn>): TrackerRowIn => ({ id: "r", ticker: "LHX", action_type: "KILL_CHECK", due_date: daysAgo(5), summary: "Kill check", status: "OPEN", ...p });

  it("HIGH, OPEN, > 3 days past due → DECIDE RED; MEDIUM stays MISSED", () => {
    const s = buildSurface({ ...base, holdings, scores: [], tracker: [row({ id: "h", priority: "HIGH" }), row({ id: "m", ticker: "LHX", action_type: "DEPLOY", priority: "MEDIUM" })] });
    const hi = s.decide.find((c) => c.source_ref === "h");
    expect(hi?.severity).toBe("RED");
    expect(s.missed.some((c) => c.source_ref === "m")).toBe(true);
    expect(routeTrackerRow(row({ priority: "HIGH", due_date: daysAgo(3) }), TODAY)).toBe("DECIDE");
  });

  it("OPEN rows on dead tickers go to Hygiene; CATALYST_WATCH on ARCHIVE names routes normally", () => {
    const watchlist: WatchIn[] = [
      { ticker: "REJ", status: "REJECTED", current: 1 },
      { ticker: "ARC", status: "ARCHIVE", current: 1 },
    ];
    const tracker = [
      row({ id: "d1", ticker: "REJ", action_type: "KILL_CHECK" }),
      row({ id: "d2", ticker: "ARC", action_type: "CATALYST_WATCH", due_date: "2026-11-04" }),
      row({ id: "d3", ticker: "ARC", action_type: "MANUAL" }),
    ];
    const s = buildSurface({ ...base, watchlist, scores: [], tracker });
    expect(s.hygiene.map((c) => c.source_ref).sort()).toEqual(["d1", "d3"]);
    expect(s.prepare.some((c) => c.source_ref === "d2")).toBe(true);
    const ws = new Map([["ARC", "ARCHIVE"], ["REJ", "REJECTED"]]);
    expect(isTrackerHygiene({ ticker: "REJ", action_type: "KILL_CHECK", status: "CLOSED" }, new Set(["REJ"]), ws)).toBe(false);
  });
});

describe("Doctrine strip", () => {
  it("one chip per check; all green when nothing fires", () => {
    const s = buildSurface({ ...base, holdings: [{ ticker: "A", account: "SIPP", price: 1, mv: 100 }], scores: [],
      cashBySleeve: { SIPP: 10, ISA: null, Bordier: null }, cashRecon: { e65: 100, ledgerTotal: 100 } });
    const chips = doctrineChecks({ gm: { level: "OK", label: "", frozen: false, ackActive: false }, dpPct: 7.5, surface: s, driverCaps: { breach: 0, warn: 0, ok: 5 } });
    expect(chips.map((c) => c.id)).toEqual(["gm", "dp", "irrbb", "quartets", "sleeves", "cash", "hygiene", "drivers"]);
    expect(chips.every((c) => c.rag === "GREEN")).toBe(true);
  });
  it("RED four make the IRR-BB chip RED; hygiene chip deep-links to the Actions Hygiene filter", () => {
    const s = buildSurface({ ...base, scores: R23_SCORES });
    const chips = doctrineChecks({ gm: null, dpPct: null, surface: s, driverCaps: null });
    expect(chips.find((c) => c.id === "irrbb")?.rag).toBe("RED");
    expect(chips.find((c) => c.id === "gm")?.rag).toBe("GREY");
    expect(chips.find((c) => c.id === "hygiene")?.link).toEqual({ tab: "actions", params: { view: "hygiene" } });
  });
});
