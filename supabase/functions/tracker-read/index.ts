import { createTrackerHandler, json, responseBody, serviceHeaders } from "../_shared/tracker-http.ts";
import { buildReadRequest, buildRpcRead } from "./contract.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

export const handler = createTrackerHandler(async (body, root, key) => {
  if (body && typeof body === 'object' && Object.hasOwn(body, 'rpc')) {
    let request;
    try { request = buildRpcRead(body); }
    catch (error) { return json({ status: 'error', error: error instanceof Error ? error.message : String(error) }, 400); }
    const client = createClient(root, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.rpc(request.rpc, request.args);
    if (error) return json({ status: 'error', rpc: request.rpc, postgrest: error }, 502);
    const rows = Array.isArray(data) ? data : data == null ? [] : [data];
    return json({ status: 'success', rpc: request.rpc, count: rows.length, rows });
  }
  let request;
  try { request = buildReadRequest(body); }
  catch (error) { return json({ status: "error", error: error instanceof Error ? error.message : String(error) }, 400); }
  const response = await fetch(`${root}${request.url}`, {
    method: "GET", headers: serviceHeaders(key), redirect: "error",
  });
  const rows = await responseBody(response);
  if (!response.ok) return json({ status: "error", table: request.table, postgrest: rows }, 502);
  return json({ status: "success", table: request.table, url: request.url, count: Array.isArray(rows) ? rows.length : 0, rows });
});

if (import.meta.main) Deno.serve(handler);