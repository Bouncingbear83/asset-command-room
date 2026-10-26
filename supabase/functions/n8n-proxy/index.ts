import { appCorsHeaders, verifiedOwner, jsonResponse } from "../_shared/browser-owner.ts";
import { RequestSchema } from "./contract.ts";
import { applyTracker } from "./apply.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: appCorsHeaders(req) });
  if (!await verifiedOwner(req)) return jsonResponse(req, { error: "Unauthorized" }, 401);
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  let body: unknown;
  try { body = await req.json(); } catch { return jsonResponse(req, { error: "Invalid JSON" }, 400); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return jsonResponse(req, { error: "Invalid endpoint or body" }, 400);
  const secret = Deno.env.get("INGEST_SECRET");
  if (!secret) return jsonResponse(req, { error: "Proxy not configured" }, 500);
  if (parsed.data.endpoint === "apply-tracker") {
    try { const r = await applyTracker(req, parsed.data.body, secret); return jsonResponse(req, r.body, r.status); }
    catch { return jsonResponse(req, { error: "Webhook unavailable or timed out" }, 502); }
  }
  try {
    const response = await fetch(`https://bertbroad83.app.n8n.cloud/webhook/${parsed.data.endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify(parsed.data.body), signal: AbortSignal.timeout(25000), redirect: "error" });
    const text = await response.text();
    if (text.includes(secret)) return jsonResponse(req, { error: "Unsafe upstream response withheld" }, 502);
    return new Response([204, 205, 304].includes(response.status) ? null : text, { status: response.status, headers: { ...appCorsHeaders(req), "Content-Type": response.headers.get("Content-Type") ?? "text/plain", "Cache-Control": "no-store" } });
  } catch { return jsonResponse(req, { error: "Webhook unavailable or timed out" }, 502); }
});
