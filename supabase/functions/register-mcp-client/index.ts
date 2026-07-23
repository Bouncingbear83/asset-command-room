// Manually pre-register an OAuth 2.1 client against this project's Supabase
// auth server, so users can paste Client ID + Secret into Claude/ChatGPT's
// "Advanced Settings" when DCR fails on the client side.
//
// Auth: requires a valid Supabase user JWT.
// The client_secret is only returned by this response — Supabase does not
// re-reveal it later.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AuthMethod = "client_secret_basic" | "none";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller.
    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const client_name = String(body?.client_name ?? "").trim();
    const redirect_uris: string[] = Array.isArray(body?.redirect_uris)
      ? body.redirect_uris.map((u: unknown) => String(u).trim()).filter(Boolean)
      : [];
    const token_endpoint_auth_method: AuthMethod =
      body?.token_endpoint_auth_method === "none" ? "none" : "client_secret_basic";

    if (!client_name) return json({ error: "client_name required" }, 400);
    if (redirect_uris.length === 0) return json({ error: "redirect_uris required" }, 400);
    for (const u of redirect_uris) {
      if (!/^https:\/\//.test(u)) return json({ error: `redirect_uri must be https: ${u}` }, 400);
    }

    const payload = {
      client_name,
      redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method,
      registration_type: "manual",
    };

    const resp = await fetch(`${supabaseUrl}/auth/v1/admin/oauth/clients`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    if (!resp.ok) {
      return json({ error: `admin_register_failed: ${resp.status} ${text}` }, 502);
    }
    const created = JSON.parse(text);

    return json({
      client_id: created.client_id ?? created.id ?? null,
      client_secret: created.client_secret ?? null,
      client_name: created.client_name ?? client_name,
      redirect_uris: created.redirect_uris ?? redirect_uris,
      token_endpoint_auth_method:
        created.token_endpoint_auth_method ?? token_endpoint_auth_method,
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? "unknown_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
