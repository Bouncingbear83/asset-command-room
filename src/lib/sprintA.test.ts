import { describe, it, expect } from "vitest";
import { regimeState } from "@/lib/regime";
import { bbBasis } from "@/lib/bbBasis";
import { rule13Status, p3bGroups } from "@/lib/rule13";
import { buildSurface, capReviewLines, doctrineChecks, type WatchIn } from "@/lib/actionSurface";

const TODAY = "2026-11-22";
const base = { holdings: [], watchlist: [], scores: [], earnings: [], tracker: [], today: TODAY };

describe("A1 regime (OB §3.4.9a)", () => {
  it("1,285,078 / 22,613.8 → STRESS S3, DD 21.64%, margin £55,062 (4.28%), H-R 3.9pt, released £77,868, AMBER", () => {
    const r = regimeState({ aumGbp: 1285078, nasdaqLast: 22613.8 });
    expect(r.state).toBe("STRESS"); expect(r.band).toBe("S3");
    expect(r.ddPct).toBeCloseTo(21.64, 2);
    expect(Math.round(r.haltMarginGbp)).toBe(55062);
    expect(r.haltMarginPctAum.toFixed(2)).toBe("4.28");
    expect(r.hrGapPts!.toFixed(1)).toBe("3.9");
    expect(r.releasedGbp).toBe(77868);
    expect(r.rag).toBe("AMBER");
    expect(r.label).toBe("STRESS S3 · DD 21.6% · HALT £55k (4.3%) · H-R 3.9pt");
  });
  it("1,230,016 → HALT RED; HALT card leads DECIDE", () => {
    const r = regimeState({ aumGbp: 1230016, nasdaqLast: 22613.8 });
    expect(r.state).toBe("HALT"); expect(r.rag).toBe("RED");
    const s = buildSurface({ ...base, regime: r, holdings: [{ ticker: "A", price: 10, trigger_price_exit: "10" }] });
    expect(s.decide[0].trigger_type).toBe("REGIME_HALT");
    expect(s.decide[0].title).toBe("HALT: no new money (OB §3.4.9a)");
    expect(s.decide[0].severity).toBe("RED");
  });
  it("S1 boundary: £1,508,819 (DD 8.00002%) → S1, released stays £77,868 (HWM S3)", () => {
    const r = regimeState({ aumGbp: 1508819, nasdaqLast: 27000 });
    expect(r.state).toBe("STRESS"); expect(r.band).toBe("S1");
    expect(r.releasedGbp).toBe(77868); expect(r.rag).toBe("AMBER");
  });
  it("£1,508,821 → NORMAL", () => expect(regimeState({ aumGbp: 1508821, nasdaqLast: 27000 }).state).toBe("NORMAL"));
  it("£1,230,017 → STRESS S3", () => {
    const r = regimeState({ aumGbp: 1230017, nasdaqLast: 22613.8 });
    expect(r.state).toBe("STRESS"); expect(r.band).toBe("S3");
  });
  it("cap review lists every DECIDE and overflow card with rule ID and basis", () => {
    const wl: WatchIn[] = Array.from({ length: 12 }, (_, i) => ({ ticker: `T${i}`, status: "WAIT_PRICE", current: 1, band: "ZONE" }));
    const s = buildSurface({ ...base, watchlist: wl });
    const lines = capReviewLines(s, { T0: "V3A" });
    expect(lines).toHaveLength(12);
    expect(lines.find((x) => x.includes("T0 ·"))).toContain("R15 · basis V3A");
    expect(lines.filter((x) => x.includes("[over cap]"))).toHaveLength(2);
  });
  it("1,250,000 → STRESS S3, margin 1.6% AUM → RED", () => {
    const r = regimeState({ aumGbp: 1250000, nasdaqLast: 22613.8 });
    expect(r.band).toBe("S3"); expect(r.haltMarginPctAum.toFixed(1)).toBe("1.6"); expect(r.rag).toBe("RED");
  });
  it("no ^IXIC quote → H-R NOT MEASURED, AMBER", () => {
    const r = regimeState({ aumGbp: 1285078, nasdaqLast: null });
    expect(r.hrGapPts).toBeNull(); expect(r.label).toContain("H-R NOT MEASURED"); expect(r.rag).toBe("AMBER");
  });
  it("1,650,000 / 27,600 → NORMAL, DD 0, NEW PEAK data chip", () => {
    const r = regimeState({ aumGbp: 1650000, nasdaqLast: 27600 });
    expect(r.state).toBe("NORMAL"); expect(r.ddPct).toBe(0); expect(r.newPeak).toBe(true);
    const chips = doctrineChecks({ gm: null, dpPct: null, surface: null, driverCaps: null, regime: r });
    expect(chips[0].id).toBe("regime");
    expect(chips.find((c) => c.id === "regime-peak")?.label).toBe("NEW PEAK: update REGIME_PEAK_AUM_GBP");
  });
});

describe("A2 BB basis (Daily Run C30)", () => {
  it.each([
    ["4063.T", "BB_ENGINE: v3a file=specs/x.md", "V3A", "T1"],
    ["ENR.DE", "BB_ENGINE: v3a1 file=specs/x.md", "V3A", "T1"],
    ["DHR", "BB_ENGINE: v3a quartet", "V3A", "T1"],
    ["SPUT", "NAV_ENGINE: nav.py file=specs/v3a-nav-pinned-2026.md", "V3A-NAV", "T2"],
    ["ETN", "post-Q3 UPDATE_SCORE: guidance raised; V3A pin 20 Nov", "LEGACY", "T5"],
    ["SYN1", "BB_ENGINE: v3 file=specs/y.md", "PINNED-V1", "T3"],
    ["SYN2", "specs/v3a-pinned-x.md", "LEGACY", "T5"],
  ])("%s → %s (%s)", (_t, note, cls, test) => {
    const r = bbBasis(note);
    expect(r.cls).toBe(cls); expect(r.test).toBe(test);
  });
  it("T4: cosmetic note goes to the vault; token → V3A, none → UNKNOWN", () => {
    expect(bbBasis("20 Nov 2026 cosmetic tidy, V3A RC 15280").needsVault).toBe(true);
    expect(bbBasis("20 Nov 2026 cosmetic tidy", "body … V3A RC 15280 …").cls).toBe("V3A");
    expect(bbBasis("stub fill. Cosmetic", "BB_ENGINE: v3a").source).toBe("VAULT");
    expect(bbBasis("cosmetic", "nothing here").cls).toBe("UNKNOWN");
    expect(bbBasis("cosmetic", null).cls).toBe("UNKNOWN");
  });
  it("IN_ZONE on a LEGACY row moves DECIDE → WATCH with the basis lint badge; RESET_ZONE untouched", () => {
    const wl: WatchIn[] = [
      { ticker: "ETN", status: "WAIT_PRICE", current: 100, band: "ZONE" },
      { ticker: "OLD", status: "ARCHIVE", current: 5, band: "ZONE" },
    ];
    const s = buildSurface({ ...base, watchlist: wl, basis: { ETN: "LEGACY", OLD: "LEGACY" } });
    const etn = s.watch.find((c) => c.ticker === "ETN" && c.trigger_type === "IN_ZONE")!;
    expect(etn.badge).toBe("BASIS LINT: LEGACY: information only (OB §3.4.5i)");
    expect(s.decide.some((c) => c.trigger_type === "RESET_ZONE")).toBe(true);
  });
  it("BB basis chip counts HELD V3A", () => {
    const s = buildSurface({ ...base, holdings: [{ ticker: "CASH", price: 1 }], scores: [{ ticker: "DHR", heldStatus: "HELD" }, { ticker: "ETN", heldStatus: "HELD" }], basis: { DHR: "V3A", ETN: "LEGACY" } });
    const chip = doctrineChecks({ gm: null, dpPct: null, surface: s, driverCaps: null, basisHeld: s.basisHeld }).find((c) => c.id === "basis")!;
    expect(chip.label).toBe("BB basis HELD V3A 1 / 2"); expect(chip.rag).toBe("AMBER"); expect(chip.detail).toContain("ETN");
  });
});

describe("A3 Rule 13", () => {
  it("AI_INFRA 26.5% → P5 badge; 31% → OVERRIDE NEEDED; 36% → BREACH, not Armed", () => {
    expect(rule13Status("AI_INFRA", 26.5).badge).toBe("RULE 13: P5 peak-mark test required (session)");
    expect(rule13Status("AI_INFRA", 31).badge).toBe("RULE 13 OVERRIDE NEEDED");
    const b = rule13Status("AI_INFRA", 36);
    expect(b.badge).toBe("RULE 13 BREACH: no add"); expect(b.blocksArmed).toBe(true);
  });
  it("BREACH: one DECIDE RED card per group, name cards leave DECIDE", () => {
    const wl: WatchIn[] = [{ ticker: "ETN", status: "WAIT_PRICE", current: 1, band: "ZONE" }, { ticker: "VRT", status: "WAIT_PRICE", current: 1, band: "ZONE" }];
    const s = buildSurface({ ...base, watchlist: wl, rule13: { meta: { ETN: { group: "AI_INFRA", primary: "POWER" }, VRT: { group: "AI_INFRA", primary: "POWER" } }, groupPct: { AI_INFRA: 36 } } });
    const cards = s.decide.filter((c) => c.trigger_type.startsWith("RULE13_BREACH"));
    expect(cards).toHaveLength(1);
    expect(cards[0].severity).toBe("RED");
    expect(s.decide.some((c) => c.trigger_type === "IN_ZONE")).toBe(false);
  });
  it("two Armed rows sharing SEMI_CAPEX → one P3b group", () => {
    const g = p3bGroups([{ t: "A", factorPrimary: "SEMI_CAPEX" }, { t: "B", factorPrimary: "SEMI_CAPEX" }, { t: "C", factorPrimary: "POWER" }]);
    expect(g.filter((x) => x.primary === "SEMI_CAPEX")).toHaveLength(1);
    expect(g.find((x) => x.primary === "SEMI_CAPEX")!.rows).toHaveLength(2);
  });
});
