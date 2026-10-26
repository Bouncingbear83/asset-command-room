import { appCorsHeaders, verifiedOwner, jsonResponse } from "../_shared/browser-owner.ts";
import { RequestSchema, SuccessSchema, cacheKey, upstreamFailure } from "./contract.ts";
const cache = new Map<string, { expires: number; data: unknown }>();
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: appCorsHeaders(req) });
  if (!await verifiedOwner(req)) return jsonResponse(req, { error: "Unauthorized" }, 401);
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  let body: unknown;
  try { body = await req.json(); } catch { return jsonResponse(req, { error: "Invalid JSON" }, 400); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return jsonResponse(req, { error: "Invalid keys: send 1–20 allowlisted keys only" }, 400);
  const keys = [...new Set(parsed.data.keys)];
  const key = cacheKey(keys);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return jsonResponse(req, hit.data);
  const url = Deno.env.get("SHEET_READ_URL");
  const secret = Deno.env.get("SHEET_READ_SECRET");
  if (!url || !secret) return jsonResponse(req, { error: "SHEET_READ_MISCONFIGURED" }, 500);
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ secret, keys }), redirect: "follow", signal: AbortSignal.timeout(25000) });
    if (!response.ok) return jsonResponse(req, { error: "Sheet upstream HTTP failure", status: response.status }, 502);
    const j = await response.json();
    if (j.status !== "success") {
      const status = upstreamFailure(j.code);
      if (status === 500) { console.error("SHEET_READ_MISCONFIGURED"); return jsonResponse(req, { error: "SHEET_READ_MISCONFIGURED" }, 500); }
      // Never propagate a credential echoed by an upstream error.
      const safe = (v: unknown) => typeof v === "string" ? v.split(secret).join("[redacted]").split(url).join("[redacted]").slice(0, 1000) : "UPSTREAM_ERROR";
      return jsonResponse(req, { error: "Sheet upstream failed", code: safe(j.code), message: safe(j.message) }, 502);
    }
    const valid = SuccessSchema.safeParse(j);
    if (!valid.success) return jsonResponse(req, { error: "Invalid sheet response" }, 502);
    const data = { ...valid.data, ranges: Object.fromEntries(keys.filter(k => valid.data.ranges[k]).map(k => [k, valid.data.ranges[k]])), errors: Object.fromEntries(keys.filter(k => valid.data.errors[k] || !valid.data.ranges[k]).map(k => [k, valid.data.errors[k] ?? "Missing range"])) };
    for (const [k, entry] of cache) if (entry.expires <= Date.now()) cache.delete(k);
    cache.set(key, { expires: Date.now() + 60000, data });
    return jsonResponse(req, data);
  } catch { return jsonResponse(req, { error: "Sheet upstream unavailable or timed out" }, 502); }
});
