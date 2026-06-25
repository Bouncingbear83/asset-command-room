import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

// ============================================================
// Whitelists — exactly the writable columns per table.
// id + created_at excluded (Postgres handles them).
// Any keys not in the whitelist are dropped and reported in
// columns_dropped_unknown for echo verification.
// ============================================================

const SCORE_RATIONALES_WHITELIST = new Set<string>([
  "action",
  "asymmetry_ratio",
  "bear_case",
  "bull_case",
  "change_note",
  "china_exposure_flag",
  "demand_rationale",
  "demand_score",
  "disruption_rationale",
  "disruption_score",
  "factor_group",
  "factor_primary",
  "first_add_date",
  "mgmt_rationale",
  "mgmt_score",
  "moat_rationale",
  "moat_score",
  "mv_gbp_at_scoring",
  "pre_reclass_modifier",
  "price_at_first_add",
  "price_at_last_score",
  "price_at_scoring",
  "scored_at",
  "scored_by",
  "s3_transition_modifier",
  "stack_layer",
  "stage2_subclass",
  "substrate_level",
  "substrate_rationale",
  "substrate_score",
  "thesis_summary",
  "ticker",
  "tier",
  "total_score",
  "mos_rationale",
  "mos_score",
]); // 34 cols

const DISRUPTION_RATIONALES_WHITELIST = new Set<string>([
  "ticker",
  "scored_at",
  "scored_by",
  "disruption_score",
  "status",
  "sub_avail_score",
  "sub_avail_rationale",
  "economics_score",
  "economics_rationale",
  "govt_support_score",
  "govt_support_rationale",
  "demand_vuln_score",
  "demand_vuln_rationale",
  "time_viability_score",
  "time_viability_rationale",
  "amber_trigger",
  "red_trigger",
  "evidence",
  "change_note",
]); // 18 cols

type AnyRow = Record<string, unknown>;

function partitionRow(row: AnyRow, whitelist: Set<string>) {
  const written: AnyRow = {};
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (whitelist.has(k)) {
      written[k] = v;
      kept.push(k);
    } else {
      dropped.push(k);
    }
  }
  return { written, kept, dropped };
}

function unionSorted(sets: Iterable<string[]>): string[] {
  const u = new Set<string>();
  for (const arr of sets) for (const k of arr) u.add(k);
  return [...u].sort();
}

async function processTable(
  supabase: ReturnType<typeof createClient>,
  table: "score_rationales" | "disruption_rationales",
  rows: AnyRow[],
  whitelist: Set<string>,
) {
  const tickers: string[] = [];
  const allKept: string[][] = [];
  const allDropped: string[][] = [];
  const writableRows: AnyRow[] = [];

  for (const raw of rows) {
    const { written, kept, dropped } = partitionRow(raw, whitelist);
    writableRows.push(written);
    allKept.push(kept);
    allDropped.push(dropped);
    if (typeof written.ticker === "string") tickers.push(written.ticker);
  }

  // Pre-flight existence check for unique_violation_resolved echo.
  // Cheap: one query with composite OR on (ticker, scored_at) pairs.
  let updatedCount = 0;
  const pairs = writableRows
    .map((r) => ({ ticker: r.ticker, scored_at: r.scored_at }))
    .filter((p) => p.ticker && p.scored_at);

  if (pairs.length > 0) {
    const orFilter = pairs
      .map((p) => `and(ticker.eq.${p.ticker},scored_at.eq.${new Date(p.scored_at as string).toISOString()})`)
      .join(",");
    const { data: existing, error: selErr } = await supabase.from(table).select("ticker, scored_at").or(orFilter);
    if (selErr) {
      console.error(`${table} pre-check error:`, selErr.message);
    } else if (existing) {
      updatedCount = existing.length;
    }
  }

  const { error } = await supabase.from(table).upsert(writableRows, { onConflict: "ticker,scored_at" });

  if (error) {
    console.error(`${table} upsert error:`, JSON.stringify(error));
    return {
      table,
      error: error.message,
      tickers,
      columns_written: unionSorted(allKept),
      columns_dropped_unknown: unionSorted(allDropped),
    };
  }

  const columns_written = unionSorted(allKept);
  const columns_dropped_unknown = unionSorted(allDropped);
  const bytes_written = new TextEncoder().encode(JSON.stringify(writableRows)).length;

  return {
    rows_written: writableRows.length,
    tickers,
    columns_written,
    columns_dropped_unknown,
    bytes_written,
    unique_violation_resolved: updatedCount > 0,
    rows_updated: updatedCount,
    rows_inserted: writableRows.length - updatedCount,
  };
}

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

  // Request correlation id — from header or body, echoed unmodified.
  const headerReqId = req.headers.get("x-request-id");
  let request_id: string | null = headerReqId;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const ingestSecret = Deno.env.get("INGEST_SECRET");

    if (!ingestSecret) {
      return new Response(JSON.stringify({ error: "INGEST_SECRET not configured", request_id }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!token || token !== ingestSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized", request_id }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!request_id && typeof body.request_id === "string") {
      request_id = body.request_id;
    }

    const scoreRows: AnyRow[] = Array.isArray(body.score_rationales) ? body.score_rationales : [];
    const disruptionRows: AnyRow[] = Array.isArray(body.disruption_rationales) ? body.disruption_rationales : [];

    if (scoreRows.length === 0 && disruptionRows.length === 0) {
      return new Response(
        JSON.stringify({
          status: "ok",
          request_id,
          message: "No rationale rows to write",
          results: {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: Record<string, unknown> = {};

    if (scoreRows.length > 0) {
      results.score_rationales = await processTable(
        supabase,
        "score_rationales",
        scoreRows,
        SCORE_RATIONALES_WHITELIST,
      );
    }

    if (disruptionRows.length > 0) {
      results.disruption_rationales = await processTable(
        supabase,
        "disruption_rationales",
        disruptionRows,
        DISRUPTION_RATIONALES_WHITELIST,
      );
    }

    const hasErrors = Object.values(results).some((r: any) => r && r.error);

    return new Response(
      JSON.stringify({
        status: hasErrors ? "partial_failure" : "ok",
        request_id,
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        status: hasErrors ? 207 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("ingest-rationales error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message, request_id }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
