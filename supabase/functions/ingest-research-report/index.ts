import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_SECRET = Deno.env.get("INGEST_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (auth !== INGEST_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    ticker, name, layer, score, tier, reclass_status,
    report_date, report_html, summary,
    prob_weighted_ev, spot_at_report, quartet,
  } = body;

  if (!ticker || !report_date || !report_html) {
    return new Response(
      JSON.stringify({ error: "ticker, report_date, report_html required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Mark all existing rows for this ticker as not latest
  const { error: updateErr } = await supabase
    .from("research_reports")
    .update({ is_latest: false })
    .eq("ticker", ticker);

  if (updateErr) {
    return new Response(JSON.stringify({ error: `update failed: ${updateErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Find current max version for this ticker
  const { data: maxRow, error: maxErr } = await supabase
    .from("research_reports")
    .select("version")
    .eq("ticker", ticker)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    return new Response(JSON.stringify({ error: `max lookup failed: ${maxErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nextVersion = (maxRow?.version ?? 0) + 1;

  // 3. Insert new version as latest
  const { data, error } = await supabase
    .from("research_reports")
    .insert({
      ticker,
      name: name ?? null,
      layer: layer ?? null,
      score: score ?? null,
      tier: tier ?? null,
      reclass_status: reclass_status ?? null,
      report_date,
      report_html,
      summary: summary ?? null,
      prob_weighted_ev: prob_weighted_ev ?? null,
      spot_at_report: spot_at_report ?? null,
      quartet_json: quartet ?? null,
      version: nextVersion,
      is_latest: true,
    })
    .select("id, ticker, report_date, version")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
