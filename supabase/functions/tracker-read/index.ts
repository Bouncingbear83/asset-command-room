import { createTrackerHandler, json, responseBody, serviceHeaders } from "../_shared/tracker-http.ts";
import { buildReadRequest } from "./contract.ts";

export const handler = createTrackerHandler(async (body, root, key) => {
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