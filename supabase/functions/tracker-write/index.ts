import { createTrackerHandler, json, responseBody, serviceHeaders } from "../_shared/tracker-http.ts";
import { buildWriteRequests } from "./contract.ts";
import { buildVaultRows, buildPositionArgs } from './v2-contract.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

export const handler = createTrackerHandler(async (body, root, key) => {
  const newMode = String(body?.mode || '').toUpperCase();
  if (newMode === 'VAULT_META_UPSERT' || newMode === 'POSITION_REF') {
    let payload;
    try { payload = newMode === 'VAULT_META_UPSERT' ? buildVaultRows(body) : buildPositionArgs(body); }
    catch (error) { return json({ status: 'error', error: error instanceof Error ? error.message : String(error) }, 400); }
    if (Array.isArray(payload) && payload.length === 0) return json({ status: 'success', mode: newMode, requested: 0, affected: 0, rows: [] });
    const client = createClient(root, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (newMode === 'VAULT_META_UPSERT' && Array.isArray(payload)) {
      const { data, error } = await client.from('vault_notes_meta').upsert(payload, { onConflict: 'path' }).select('path,type,identifier');
      if (error) return json({ status: 'error', mode: newMode, postgrest: error }, 502);
      const rows = data ?? [];
      return json({ status: 'success', mode: newMode, requested: payload.length, affected: rows.length, rows });
    }
    if (!Array.isArray(payload)) {
      const { data, error } = await client.rpc('upsert_position_reference', payload);
      if (error) return json({ status: 'error', mode: newMode, postgrest: error }, 502);
      const rows = data == null ? [{ ticker: payload.p_ticker, action: payload.p_action }] : Array.isArray(data) ? data : [data];
      return json({ status: 'success', mode: newMode, requested: 1, affected: 1, rows });
    }
  }
  let requests;
  // Validate the whole batch before any write (matching Build Requests).
  try { requests = buildWriteRequests(body); }
  catch (error) { return json({ status: "error", error: error instanceof Error ? error.message : String(error) }, 400); }
  const rows: Record<string, unknown>[] = [];
  for (const { json: request } of requests) {
    const response = await fetch(`${root}${request.url}`, {
      method: request.method,
      headers: { ...serviceHeaders(key), Prefer: request.prefer },
      body: JSON.stringify(request.body),
      redirect: "error",
    });
    const result = await responseBody(response);
    if (!response.ok) return json({ status: "error", postgrest: result }, 502);
    if (Array.isArray(result)) rows.push(...result.filter((row) => row && row.id));
  }
  const mode = requests[0]?.json.mode;
  const affected = rows.map((r) => mode === "REVIEW_UPDATE"
    ? { id: r.id, layer: r.layer, cycle: r.cycle, status: r.status, scheduled_date: r.scheduled_date, completed_date: r.completed_date }
    : { id: r.id, ticker: r.ticker, dedupe_key: r.dedupe_key, status: r.status, due_date: r.due_date });
  return json({
    status: "success", mode,
    requested: requests.reduce((total, request) => total + request.json.requested, 0),
    affected: affected.length, rows: affected,
    note: mode === "INSERT_IGNORE"
      ? "affected < requested means duplicates ignored (dedupe_key already exists)"
      : "affected < requested means no row matched",
  });
});

if (import.meta.main) Deno.serve(handler);