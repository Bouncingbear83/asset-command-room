import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPlan, mergeByTab, isStaleResponse, decisionFor, resolutionNoteFor, londonToday, UPDATE_ROW_WEBHOOK, type Plan, type UpdateCall } from "./apply-contract.ts";

type Result = { status: number; body: unknown };

/** Owner-verified caller: reads and writes go through the caller's own session so RLS stays the boundary. */
export async function applyTracker(req: Request, input: any, secret: string): Promise<Result> {
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { status: 500, body: { error: "Server configuration missing" } };
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const ids: string[] = input.op === "apply_all" ? input.ids : [input.tracker_id];
  const { data: rows, error } = await db.from("action_tracker").select("id,status,apply_target,staged_payload").in("id", ids);
  if (error) return { status: 502, body: { error: "Could not load tracker rows" } };
  if (!rows || rows.length !== ids.length) return { status: 404, body: { error: "Tracker row not found" } };

  const today = londonToday();
  let plans: Plan[]; let calls: UpdateCall[];
  try {
    if (input.op === "apply_all") {
      plans = rows.map((r) => buildPlan(r, "accept", undefined, today));
      calls = mergeByTab(plans);
    } else {
      plans = [buildPlan(rows[0], input.op, input.edit, today)];
      calls = plans[0].calls;
    }
  } catch (e) { return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } }; }

  const execIds: string[] = []; const upstream: unknown[] = [];
  for (const call of calls) {
    const res = await fetch(`https://bertbroad83.app.n8n.cloud/webhook/${UPDATE_ROW_WEBHOOK}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ tab: call.tab, ...(input.dry_run ? { dry_run: true } : {}), updates: call.updates }),
      signal: AbortSignal.timeout(25000), redirect: "error",
    });
    const text = await res.text();
    if (text.includes(secret)) return { status: 502, body: { error: "Unsafe upstream response withheld" } };
    if (isStaleResponse(text)) return { status: 409, body: { stale: true, error: "Sheet changed since staging: rebuild in session" } };
    let j: any = null; try { j = JSON.parse(text); } catch { /* text body */ }
    if (!res.ok) return { status: 502, body: { error: "Update row failed", upstream_status: res.status, upstream: j ?? text.slice(0, 300) } };
    if (Array.isArray(j?.rejected) && j.rejected.length) return { status: 409, body: { error: "Rows rejected", rejected: j.rejected } };
    upstream.push(j ?? text.slice(0, 300));
    if (j?.executionId != null) execIds.push(String(j.executionId));
  }
  if (input.dry_run) return { status: 200, body: { dry_run: true, planned: calls, upstream } };

  const execId = execIds.join(",") || null;
  const now = new Date().toISOString();
  const updated: unknown[] = [];
  for (const plan of plans) {
    const row = rows.find((r) => r.id === plan.id)!;
    const patch: Record<string, unknown> = {
      staged_payload: { ...row.staged_payload, decision: decisionFor(plan, execId, now) },
      status: plan.nextStatus, resolution_note: resolutionNoteFor(plan, execId),
      ...(plan.nextStatus === "CONFIRMED" ? { resolved_at: now } : {}),
    };
    const { data, error: werr } = await db.from("action_tracker").update(patch).eq("id", plan.id).eq("status", "OPEN").select("id,status,resolution_note");
    if (werr) return { status: 502, body: { error: "Sheet updated but tracker write failed", exec_id: execId } };
    updated.push(...(data ?? []));
  }
  return { status: 200, body: { status: "success", exec_id: execId, rows: updated, upstream } };
}
