import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  try {
    // Auth: verify Bearer token matches INGEST_SECRET
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const ingestSecret = Deno.env.get("INGEST_SECRET");

    if (!ingestSecret) {
      return new Response(
        JSON.stringify({ error: "INGEST_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!token || token !== ingestSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse body
    const body = await req.json();
    const scoreRows = body.score_rationales || [];
    const disruptionRows = body.disruption_rationales || [];

    if (scoreRows.length === 0 && disruptionRows.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", message: "No rationale rows to write" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Supabase client (service role — bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: Record<string, unknown> = {};

    // Write score_rationales
    if (scoreRows.length > 0) {
      const { error } = await supabase
        .from("score_rationales")
        .upsert(scoreRows, { onConflict: "ticker,scored_at" });

      if (error) {
        console.error("score_rationales upsert error:", JSON.stringify(error));
        results.score_rationales = { error: error.message };
      } else {
        results.score_rationales = { rows_written: scoreRows.length };
      }
    }

    // Write disruption_rationales
    if (disruptionRows.length > 0) {
      const { error } = await supabase
        .from("disruption_rationales")
        .upsert(disruptionRows, { onConflict: "ticker,scored_at" });

      if (error) {
        console.error("disruption_rationales upsert error:", JSON.stringify(error));
        results.disruption_rationales = { error: error.message };
      } else {
        results.disruption_rationales = { rows_written: disruptionRows.length };
      }
    }

    const hasErrors = Object.values(results).some(
      (r: any) => r && r.error,
    );

    return new Response(
      JSON.stringify({
        status: hasErrors ? "partial_failure" : "ok",
        results,
        ticker: scoreRows[0]?.ticker || disruptionRows[0]?.ticker || "unknown",
        timestamp: new Date().toISOString(),
      }),
      {
        status: hasErrors ? 207 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("ingest-rationales error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
