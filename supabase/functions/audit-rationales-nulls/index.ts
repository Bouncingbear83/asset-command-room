import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CRITICAL_COLS = [
  "factor_group",
  "factor_primary",
  "stack_layer",
  "substrate_level",
  "stage2_subclass",
  "china_exposure_flag",
  "bull_case",
  "bear_case",
  "asymmetry_ratio",
  "price_at_first_add",
  "price_at_last_score",
] as const;

const HARD_ALERT_COLS = [
  "factor_group",
  "stack_layer",
  "substrate_level",
  "bull_case",
  "bear_case",
  "asymmetry_ratio",
  "price_at_last_score",
] as const;

const V214_DEPLOY_DATE = "2026-05-17";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ingestSecret = Deno.env.get("INGEST_SECRET");
  if (!ingestSecret) {
    return new Response(
      JSON.stringify({ error: "INGEST_SECRET not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token !== ingestSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const selectCols = ["ticker", "scored_at", ...CRITICAL_COLS].join(",");

    // Paginate through all rows (Supabase caps at 1000/req)
    const pageSize = 1000;
    let from = 0;
    const rows: Record<string, unknown>[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("score_rationales")
        .select(selectCols)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...(data as Record<string, unknown>[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const null_counts: Record<string, number> = {};
    for (const c of CRITICAL_COLS) null_counts[c] = 0;

    const alerts: Array<{ ticker: unknown; scored_at: unknown; null_columns: string[] }> = [];
    const cutoff = new Date(V214_DEPLOY_DATE + "T00:00:00.000Z").getTime();

    for (const row of rows) {
      for (const c of CRITICAL_COLS) {
        if (row[c] === null || row[c] === undefined) null_counts[c]++;
      }
      const scoredAt = row.scored_at ? new Date(row.scored_at as string).getTime() : NaN;
      if (!Number.isNaN(scoredAt) && scoredAt >= cutoff) {
        const missing = HARD_ALERT_COLS.filter(
          (c) => row[c] === null || row[c] === undefined,
        );
        if (missing.length > 0) {
          alerts.push({
            ticker: row.ticker,
            scored_at: row.scored_at,
            null_columns: missing,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        total_rows: rows.length,
        null_counts,
        alerts,
        alert_count: alerts.length,
        v214_deploy_date: V214_DEPLOY_DATE,
        checked_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("audit-rationales-nulls error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
