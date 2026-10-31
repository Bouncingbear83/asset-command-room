import { describe, it, expect } from "vitest";
import { acceptPreview, buildAcceptRequest, applyResultState, validateEdit, editBody, updateRowFor, STALE_MESSAGE } from "./earningsVerdict";
import { buildPlan } from "../../supabase/functions/n8n-proxy/apply-contract";
import { buildSurface, findVerdict } from "./actionSurface";

const ID = "11111111-1111-4111-8111-111111111111";
const ur = (note: string, date: string) => ({ tab: "HOLDINGS", updates: [{ row_number: 14, expect_ticker: "YAR.OL", append: { trigger_review_note: note }, fields: { trigger_review_date: date }, expect: { trigger_review_date: "2026-10-24" } }] });
const YAR = {
  id: ID, status: "OPEN", apply_target: "RC_QUEUE",
  staged_payload: {
    v: 1, kind: "EARNINGS_VERDICT", ticker: "YAR.OL", print_date: "2026-10-23", fiscal_period: "Q3", note_path: "Tickers/YAR.OL.md",
    grader: { band: "AMBER", fails: { core: 1, hard: 0, kill: 0 }, limbs: [{ id: "L1", result: "PASS", class: "A" }, { id: "L2", result: "FAIL", class: "B" }], limbs_at_risk: ["L2"] },
    band_action: "Hold; re-score margin limb next session",
    apply: { update_row: ur("{accept_date} AMBER: margin limb failed", "2027-01-22"), rc_queue: { rc_type: "UPDATE_SCORE", due: "2026-11-02", reason: "margin" } },
    alternates: { CONFIRM: { band_action: "Hold", apply: { update_row: ur("{accept_date} CONFIRM: all limbs pass", "2027-01-22") } } },
    decision: null,
  },
};

describe("Earnings engine DECIDE cards", () => {
  it("(a) YAR.OL AMBER RC_QUEUE renders its preview text", () => {
    expect(acceptPreview(YAR)).toBe("AJ line now; UPDATE_SCORE queued for next session, due 2026-11-02");
  });

  it("(b) Accept sends only tracker_id", () => {
    expect(buildAcceptRequest(ID)).toEqual({ tracker_id: ID });
  });

  it("(c) Edit AMBER -> CONFIRM requires a reason and uses alternates.CONFIRM", () => {
    expect(validateEdit("AMBER", { band: "CONFIRM" })).toBe("Reason required to change band");
    expect(() => buildPlan(YAR, "edit", { band: "CONFIRM" }, "2026-10-26")).toThrow("override_reason required");
    expect(updateRowFor(YAR.staged_payload, "CONFIRM")).toBe(YAR.staged_payload.alternates.CONFIRM.apply.update_row);
    const body = editBody(ID, YAR.staged_payload, { band: "CONFIRM", override_reason: "guide raised" });
    const plan = buildPlan(YAR, "edit", body.edit, "2026-10-26");
    expect(plan.band).toBe("CONFIRM");
    expect(plan.calls[0].updates[0].append?.trigger_review_note).toBe("OVERRIDE: guide raised. 2026-10-26 CONFIRM: all limbs pass");
  });

  it("(d) a stale response disables Accept", () => {
    expect(applyResultState({ stale: true })).toEqual({ stale: true, acceptDisabled: true, message: STALE_MESSAGE });
    expect(applyResultState({ status: "success" }).acceptDisabled).toBe(false);
  });

  it("(e) an AUTO_EARN segment produces no event", () => {
    const note = "[AUTO_EARN 2026-10-23] 2026-10-23 HOLD print Q3 [EXIT_RECLASS] OPERATOR [/AUTO_EARN]";
    expect(findVerdict(note)).toBeNull();
    const s = buildSurface({
      holdings: [{ ticker: "YAR.OL", account: "ISA", price: 400, shares: 10, alert_status: "CLEAR", trigger_review_note: note }],
      watchlist: [], scores: [], earnings: [{ ticker: "YAR.OL", nextEarningsDate: "2026-11-01" }], today: "2026-10-26",
    });
    expect(s.decide).toHaveLength(0);
    expect(s.prepare.find((c) => c.trigger_type === "EARNINGS")?.gate_test).toBeNull();
  });

  it("verdict rows render in DECIDE ordered KILL, RED, AMBER, CONFIRM; briefs never render as cards", () => {
    const mk = (id: string, t: string, band: string) => ({ id, ticker: t, action_type: "EARNINGS_GATE", due_date: "2026-10-26", summary: "v", status: "OPEN", apply_target: "UPDATE_ROW",
      staged_payload: { ...YAR.staged_payload, ticker: t, grader: { band } } });
    const brief = { id: "b1", ticker: "AAA", action_type: "EARNINGS_GATE", due_date: "2026-10-26", summary: "b", status: "OPEN", apply_target: "NONE", dedupe_key: "AUTO:AAA:BRIEF:2026-10-23",
      staged_payload: { v: 1, kind: "EARNINGS_BRIEF", ticker: "AAA", print_date: "2026-10-23" } };
    const held = ["AAA", "BBB", "CCC", "DDD"].map((ticker) => ({ ticker, price: 10, alert_status: "CLEAR" }));
    const s = buildSurface({ holdings: held, watchlist: [], scores: [], earnings: [], today: "2026-10-26",
      tracker: [mk("1", "AAA", "CONFIRM"), mk("2", "BBB", "RED"), mk("3", "CCC", "KILL"), mk("4", "DDD", "AMBER"), brief] });
    expect(s.decide.map((c) => c.verdict?.band ?? c.trigger_type)).toEqual(["KILL", "RED", "AMBER", "CONFIRM_VERDICTS"]);
    expect(s.supersededBriefs).toEqual(["b1"]);
    expect([...s.decide, ...s.prepare, ...s.watch].some((c) => c.source_ref === "b1")).toBe(false);
  });
});
