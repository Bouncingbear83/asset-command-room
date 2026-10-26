/**
 * Earnings engine — display helpers for staged EARNINGS_VERDICT rows.
 * The app only reads staged_payload; cell writes are built server-side (n8n-proxy apply-tracker).
 */
import { BAND_ORDER, adjacentBands, isOneStep } from "../../supabase/functions/n8n-proxy/apply-contract";
export { BAND_ORDER, adjacentBands, isOneStep };

export type VerdictBand = "CONFIRM" | "AMBER" | "RED" | "KILL" | "NOT GRADED";
export const VERDICT_BAND_RANK: Record<string, number> = { KILL: 0, RED: 1, AMBER: 2, CONFIRM: 3 };
export const DISMISS_BANDS = ["CONFIRM", "AMBER", "RED", "KILL", "NO VERDICT"] as const;

export interface StagedRow { id: string; apply_target?: string | null; staged_payload?: any; status?: string }

export const kindOf = (sp: any): string | null => (sp && typeof sp === "object" ? sp.kind ?? null : null);
export const bandOf = (sp: any): string => String(sp?.grader?.band ?? "NOT GRADED").toUpperCase();

/** Fails first; each limb flagged when listed in limbs_at_risk. */
export function orderedLimbs(sp: any): { id: string; type?: string; result?: string; class?: string; actual?: unknown; failed: boolean; atRisk: boolean }[] {
  const atRisk = new Set<string>((sp?.grader?.limbs_at_risk ?? []).map(String));
  const limbs: any[] = Array.isArray(sp?.grader?.limbs) ? sp.grader.limbs : [];
  return limbs
    .map((l) => ({ ...l, id: String(l.id), failed: /FAIL/i.test(String(l.result ?? "")), atRisk: atRisk.has(String(l.id)) }))
    .sort((a, b) => Number(b.failed) - Number(a.failed));
}

/** “What Accept does” preview text. */
export function acceptPreview(row: StagedRow): string {
  const sp = row.staged_payload ?? {};
  const apply = sp.apply ?? {};
  switch (row.apply_target) {
    case "UPDATE_ROW": {
      const u = apply.update_row?.updates?.[0];
      const oldD = u?.expect?.trigger_review_date ?? "—";
      const newD = u?.fields?.trigger_review_date ?? oldD;
      return `AJ +1 line; review date ${oldD} -> ${newD}`;
    }
    case "RC_QUEUE": {
      const rc = apply.rc_queue ?? {};
      return `AJ line now; ${rc.rc_type ?? "UPDATE_SCORE"} queued for next session, due ${rc.due ?? "—"}`;
    }
    case "TRADE_TICKET": {
      const t = apply.trade_ticket ?? {};
      return `${t.side} ${t.shares} sh ${t.account} (row ${t.row_number}) · shares: ${t.shares_rule ?? "—"} · limit: ${t.limit_rule ?? "—"} · ref close ${t.ref_close ?? "—"} · deadline ${t.deadline ?? sp.deadline ?? "—"}`;
    }
    case "NONE":
      return "close";
    default:
      return "";
  }
}

/** Accept carries the id only — the server loads and builds everything else. */
export function buildAcceptRequest(trackerId: string): { tracker_id: string } {
  return { tracker_id: trackerId };
}

export interface ApplyUiState { stale: boolean; acceptDisabled: boolean; message: string | null }
export const STALE_MESSAGE = "Sheet changed since staging: rebuild in session";
export function applyResultState(body: any): ApplyUiState {
  if (body?.stale) return { stale: true, acceptDisabled: true, message: STALE_MESSAGE };
  if (body?.error) return { stale: false, acceptDisabled: false, message: String(body.error) };
  return { stale: false, acceptDisabled: false, message: null };
}

/** Edit sheet validation (mirrors the server; server remains authoritative). */
export function validateEdit(staged: string, edit: { band?: string; override_reason?: string }): string | null {
  if (!edit.band || edit.band === staged) return null;
  if (!isOneStep(staged, edit.band)) return "Band may move one step only";
  if (!String(edit.override_reason ?? "").trim()) return "Reason required to change band";
  return null;
}
export function editBody(trackerId: string, sp: any, edit: { band?: string; override_reason?: string; aj_line?: string; review_date?: string; limit?: number; shares?: number }, dryRun = false) {
  const staged = bandOf(sp);
  const e: Record<string, unknown> = {};
  if (edit.band && edit.band !== staged) { e.band = edit.band; e.override_reason = edit.override_reason; }
  for (const k of ["aj_line", "review_date", "limit", "shares"] as const) if (edit[k] !== undefined && edit[k] !== "") e[k] = edit[k];
  return { tracker_id: trackerId, op: "edit" as const, edit: e, ...(dryRun ? { dry_run: true } : {}) };
}
/** Which staged block the edit applies: alternates[band] when the band moves. */
export function updateRowFor(sp: any, band?: string) {
  if (band && band !== bandOf(sp)) return sp?.alternates?.[band]?.apply?.update_row ?? null;
  return sp?.apply?.update_row ?? null;
}

export type VerdictState = "NEW" | "QUEUED" | "ACCEPTED_TICKET" | "PLACED";
export function verdictState(row: StagedRow): VerdictState {
  const d = row.staged_payload?.decision;
  if (!d) return "NEW";
  if (d.action === "PLACED") return "PLACED";
  if (row.apply_target === "RC_QUEUE") return "QUEUED";
  if (row.apply_target === "TRADE_TICKET") return "ACCEPTED_TICKET";
  return "NEW";
}
