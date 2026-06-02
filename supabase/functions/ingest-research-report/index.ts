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

  const { data, error } = await supabase
    .from("research_reports")
    .upsert(
      {
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
      },
      { onConflict: "ticker,report_date" },
    )
    .select("id, ticker, report_date")
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
