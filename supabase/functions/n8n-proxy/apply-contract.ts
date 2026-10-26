// Earnings-engine apply contract. Pure (no Deno/Node imports) so both the edge function
// and the app's vitest suite use the same rules. Never trusts a client-supplied payload:
// every cell write is built from the stored staged_payload.

export const BAND_ORDER = ["CONFIRM", "AMBER", "RED", "KILL"] as const;
export type Band = typeof BAND_ORDER[number];
export const APPLY_TARGETS = ["UPDATE_ROW", "RC_QUEUE", "TRADE_TICKET", "NONE"] as const;
export type ApplyTarget = typeof APPLY_TARGETS[number];
export const UPDATE_TABS = ["HOLDINGS", "WATCHLIST"] as const;
export const FIELD_KEYS = ["trigger_review_date", "add_trigger", "exit_trigger"] as const;
export const APPEND_KEYS = ["trigger_review_note"] as const;
export const UPDATE_ROW_WEBHOOK = "stellar-update-row";
export const STALE_RE = /EXPECT_MISMATCH|TICKER_MISMATCH/;

export type Op = "accept" | "edit" | "placed" | "apply_all";
export interface EditIn { band?: string; override_reason?: string; aj_line?: string; review_date?: string; limit?: number; shares?: number }
export interface RowUpdate { row_number: number; expect_ticker: string; append?: Record<string, string>; fields?: Record<string, unknown>; expect?: Record<string, unknown> }
export interface UpdateCall { tab: string; updates: RowUpdate[] }
export interface TrackerRow { id: string; status: string; apply_target: string | null; staged_payload: any }
export interface Plan {
  id: string; target: ApplyTarget; action: "ACCEPT" | "EDIT" | "PLACED"; band: string;
  override_reason: string | null; calls: UpdateCall[]; nextStatus: "CONFIRMED" | "OPEN";
  edit?: { limit?: number; shares?: number };
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** One step only along CONFIRM ↔ AMBER ↔ RED ↔ KILL. */
export function isOneStep(from: string, to: string): boolean {
  const a = BAND_ORDER.indexOf(from as Band), b = BAND_ORDER.indexOf(to as Band);
  return a >= 0 && b >= 0 && Math.abs(a - b) === 1;
}
export function adjacentBands(band: string): Band[] {
  return BAND_ORDER.filter((b) => isOneStep(band, b));
}

function replaceAcceptDate<T>(value: T, today: string): T {
  if (typeof value === "string") return value.split("{accept_date}").join(today) as T;
  if (Array.isArray(value)) return value.map((v) => replaceAcceptDate(v, today)) as T;
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceAcceptDate(v, today)])) as T;
  return value;
}

/** Hard allowlist on the stored update_row block. */
export function validateUpdateRow(ur: unknown, appendOnly = false): UpdateCall {
  if (!isObj(ur)) throw new Error("update_row missing");
  if (!(UPDATE_TABS as readonly string[]).includes(ur.tab)) throw new Error("tab must be HOLDINGS or WATCHLIST");
  if (!Array.isArray(ur.updates) || ur.updates.length === 0 || ur.updates.length > 50) throw new Error("updates must be 1-50 rows");
  const updates = ur.updates.map((u: unknown, i: number): RowUpdate => {
    if (!isObj(u)) throw new Error(`update ${i} must be an object`);
    for (const k of Object.keys(u)) if (!["row_number", "expect_ticker", "append", "fields", "expect"].includes(k)) throw new Error(`update ${i}: key ${k} not allowed`);
    if (!Number.isInteger(u.row_number) || u.row_number < 2) throw new Error(`update ${i}: row_number invalid`);
    if (typeof u.expect_ticker !== "string" || !u.expect_ticker.trim()) throw new Error(`update ${i}: expect_ticker required`);
    const out: RowUpdate = { row_number: u.row_number, expect_ticker: u.expect_ticker };
    if (u.append !== undefined) {
      if (!isObj(u.append)) throw new Error(`update ${i}: append must be an object`);
      for (const [k, v] of Object.entries(u.append)) {
        if (!(APPEND_KEYS as readonly string[]).includes(k)) throw new Error(`update ${i}: append key ${k} not allowed`);
        if (typeof v !== "string") throw new Error(`update ${i}: append ${k} must be text`);
      }
      out.append = { ...u.append };
    }
    if (u.fields !== undefined) {
      if (!isObj(u.fields)) throw new Error(`update ${i}: fields must be an object`);
      const keys = Object.keys(u.fields);
      if (appendOnly && keys.length) throw new Error(`update ${i}: placed is append only`);
      for (const k of keys) if (!(FIELD_KEYS as readonly string[]).includes(k)) throw new Error(`update ${i}: field ${k} not allowed`);
      if (keys.length) out.fields = { ...u.fields };
    }
    if (u.expect !== undefined) {
      if (!isObj(u.expect)) throw new Error(`update ${i}: expect must be an object`);
      out.expect = { ...u.expect };
    }
    return out;
  });
  return { tab: ur.tab, updates };
}

export function finalStatus(target: ApplyTarget): "CONFIRMED" | "OPEN" {
  return target === "UPDATE_ROW" || target === "NONE" ? "CONFIRMED" : "OPEN";
}

/** Build the n8n call(s) for one row from its stored payload. */
export function buildPlan(row: TrackerRow, op: Exclude<Op, "apply_all">, edit: EditIn | undefined, today: string): Plan {
  if (String(row.status).toUpperCase() !== "OPEN") throw new Error("row is not OPEN");
  const target = row.apply_target as ApplyTarget;
  if (!(APPLY_TARGETS as readonly string[]).includes(target)) throw new Error("row has no apply_target");
  const sp = row.staged_payload;
  if (!isObj(sp) || sp.v !== 1) throw new Error("staged_payload v1 required");
  const grader = isObj(sp.grader) ? sp.grader : {};
  const stagedBand = String(grader.band ?? "NOT GRADED");
  let band = stagedBand;
  let override: string | null = null;
  let apply = isObj(sp.apply) ? sp.apply : {};

  if (op === "placed") {
    if (target !== "TRADE_TICKET") throw new Error("placed needs a TRADE_TICKET row");
    const ticket = apply.trade_ticket;
    if (!isObj(ticket) || ticket.side !== "SELL") throw new Error("sell ticket required");
    const call = validateUpdateRow(ticket.placed_update_row, true);
    return { id: row.id, target, action: "PLACED", band, override_reason: null, calls: [replaceAcceptDate(call, today)], nextStatus: "OPEN" };
  }

  if (op === "edit" && edit?.band && edit.band !== stagedBand) {
    if (!isOneStep(stagedBand, edit.band)) throw new Error("band may move one step only");
    const reason = String(edit.override_reason ?? "").trim();
    if (!reason) throw new Error("override_reason required to change band");
    const alt = isObj(sp.alternates) ? sp.alternates[edit.band] : undefined;
    if (!isObj(alt) || !isObj(alt.apply)) throw new Error(`no staged alternate for ${edit.band}`);
    apply = alt.apply;
    band = edit.band;
    override = reason;
  }

  const calls: UpdateCall[] = [];
  if (apply.update_row !== undefined && apply.update_row !== null) {
    const call = validateUpdateRow(apply.update_row);
    if (op === "edit") {
      for (const u of call.updates) {
        if (edit?.aj_line !== undefined) {
          if (typeof edit.aj_line !== "string" || edit.aj_line.length > 1000) throw new Error("aj_line must be text up to 1000 chars");
          u.append = { ...(u.append ?? {}), trigger_review_note: edit.aj_line };
        }
        if (edit?.review_date !== undefined) {
          if (!ISO.test(String(edit.review_date))) throw new Error("review_date must be yyyy-mm-dd");
          u.fields = { ...(u.fields ?? {}), trigger_review_date: edit.review_date };
        }
      }
    }
    if (override) {
      for (const u of call.updates) {
        const line = u.append?.trigger_review_note ?? "";
        u.append = { ...(u.append ?? {}), trigger_review_note: `OVERRIDE: ${override}. ${line}`.trim() };
      }
    }
    calls.push(replaceAcceptDate(call, today));
  } else if (target === "UPDATE_ROW") {
    throw new Error("UPDATE_ROW row has no update_row");
  }

  let editOut: Plan["edit"];
  if (op === "edit" && (edit?.limit !== undefined || edit?.shares !== undefined)) {
    if (target !== "TRADE_TICKET") throw new Error("limit/shares only apply to tickets");
    const held = Number(apply.trade_ticket?.shares ?? sp.apply?.trade_ticket?.shares);
    if (edit.shares !== undefined && !(Number.isFinite(edit.shares) && edit.shares > 0 && (!Number.isFinite(held) || edit.shares <= held))) throw new Error("shares must be positive and within the ticket");
    if (edit.limit !== undefined && !(Number.isFinite(edit.limit) && edit.limit > 0)) throw new Error("limit must be positive");
    editOut = { limit: edit.limit, shares: edit.shares };
  }

  return { id: row.id, target, action: op === "edit" ? "EDIT" : "ACCEPT", band, override_reason: override, calls, nextStatus: finalStatus(target), edit: editOut };
}

/** apply_all — UPDATE_ROW rows only, merged by tab into one call per tab. */
export function mergeByTab(plans: Plan[]): UpdateCall[] {
  const byTab = new Map<string, RowUpdate[]>();
  for (const p of plans) {
    if (p.target !== "UPDATE_ROW") throw new Error(`apply_all: ${p.id} is not UPDATE_ROW`);
    for (const c of p.calls) byTab.set(c.tab, [...(byTab.get(c.tab) ?? []), ...c.updates]);
  }
  return [...byTab].map(([tab, updates]) => ({ tab, updates }));
}

export function isStaleResponse(text: string): boolean {
  return STALE_RE.test(text);
}

export function decisionFor(plan: Plan, execId: string | null, now: string) {
  return {
    action: plan.action, final_band: plan.band, override_reason: plan.override_reason,
    decided_at: now, exec_id: execId, by: "APP" as const, ...(plan.edit ? { edit: plan.edit } : {}),
  };
}

export function resolutionNoteFor(plan: Plan, execId: string | null): string {
  return `${plan.action} ${plan.band}; UR exec ${execId ?? "none"}`;
}
