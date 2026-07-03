/**
 * ingest-narrative-watch — Supabase Edge Function (write-only)
 *
 * Accepts pre-parsed narrative watch items from n8n,
 * deactivates all existing active rows, inserts fresh ones.
 * No vault reads; those happen in n8n via Vault Search.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = body?.items;
  if (!Array.isArray(items)) {
    return new Response(
      JSON.stringify({ error: "Body must contain 'items' array" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: deactivateErr } = await sb
    .from("narrative_watch")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("active", true);

  if (deactivateErr) {
    return new Response(
      JSON.stringify({ error: "deactivate failed", detail: deactivateErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let inserted = 0;
  if (items.length > 0) {
    const rows = items.map((item: any) => ({
      ticker: item.ticker ?? null,
      layer: item.layer ?? null,
      category: item.category ?? "OTHER",
      content: String(item.content ?? ""),
      source_path: String(item.source_path ?? ""),
      active: true,
      updated_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await sb
      .from("narrative_watch")
      .insert(rows);

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: "insert failed", detail: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    inserted = rows.length;
  }

  return new Response(
    JSON.stringify({ success: true, deactivated: true, inserted, syncedAt: new Date().toISOString() }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
