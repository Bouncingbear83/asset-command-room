// List recent OAuth 2.1 clients registered against this project (via DCR),
// so users can copy a client_id into Claude/ChatGPT's "OAuth Client ID" field
// when a connector's cached registration goes stale.
//
// Auth: requires a valid Supabase user JWT (Authorization: Bearer <token>).
// Never returns client secrets.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is a real signed-in user.
    const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "unauthorized" }, 401);

    // Read auth.oauth_clients with the service role.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Uses a raw RPC-less query via PostgREST is blocked on the `auth` schema,
    // so we go through the admin API endpoint that the OAuth 2.1 server exposes.
    const listResp = await fetch(`${supabaseUrl}/auth/v1/admin/oauth/clients`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!listResp.ok) {
      const text = await listResp.text();
      return json({ error: `admin fetch failed: ${listResp.status} ${text}` }, 502);
    }
    const raw = await listResp.json();
    // Response shape: { clients: [...] } or [...] depending on API version.
    const clientsRaw: any[] = Array.isArray(raw) ? raw : raw?.clients ?? [];

    // Sanitize — never leak secrets.
    const clients = clientsRaw
      .map((c) => ({
        client_id: String(c.client_id ?? c.id ?? ""),
        client_name: c.client_name ?? c.name ?? null,
        redirect_uris: Array.isArray(c.redirect_uris) ? c.redirect_uris : [],
        created_at: c.created_at ?? c.inserted_at ?? null,
      }))
      .filter((c) => c.client_id)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 20);

    return json({ clients });
  } catch (e) {
    return json({ error: (e as Error).message ?? "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
