import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLE_CONFIG = [
  { key: "dailyPrices", table: "daily_prices", conflict: "ticker,snapshot_date" },
  { key: "fxRates", table: "fx_rates", conflict: "pair,snapshot_date" },
  { key: "holdingsSnapshot", table: "holdings_snapshot", conflict: "ticker,account,snapshot_date" },
  { key: "jisaSnapshot", table: "jisa_snapshot", conflict: "child,ticker,snapshot_date" },
  { key: "layerWeights", table: "layer_weights_snapshot", conflict: "layer,snapshot_date" },
  { key: "scoresSnapshot", table: "scores_snapshot", conflict: "ticker,snapshot_date" },
  { key: "disruptionSnapshot", table: "disruption_snapshot", conflict: "ticker,snapshot_date" },
  { key: "macroSnapshot", table: "macro_snapshot", conflict: "snapshot_date" },
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth check
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const ingestSecret = Deno.env.get("INGEST_SECRET");

  if (!ingestSecret || token !== ingestSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse body
  let body: Record<string, unknown[]>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create service role client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Record<string, { rows: number; status: string; error?: string }> = {};

  for (const { key, table, conflict } of TABLE_CONFIG) {
    const rows = body[key];
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      results[key] = { rows: 0, status: "skipped" };
      continue;
    }

    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: conflict, ignoreDuplicates: false });

    if (error) {
      console.error(`${table} error:`, JSON.stringify(error));
      results[key] = { rows: rows.length, status: "error", error: error.message };
    } else {
      results[key] = { rows: rows.length, status: "ok" };
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
