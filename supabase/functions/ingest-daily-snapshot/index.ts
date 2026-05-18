import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Expected field manifests per payload key. Used purely for defensive logging —
// the upsert itself remains a pure passthrough so any additive field n8n sends
// will land automatically as long as the column exists in Postgres.
const EXPECTED_FIELDS: Record<string, readonly string[]> = {
  dailyPrices: [
    "ticker", "snapshot_date", "price_local", "currency", "price_gbp",
    "prev_close_local", "day_change_pct", "high_52w", "low_52w", "ma60", "source",
  ],
  fxRates: ["pair", "snapshot_date", "rate", "source"],
  holdingsSnapshot: [
    "ticker", "account", "snapshot_date", "layer", "shares", "price_local",
    "currency", "mv_gbp", "aum_pct", "cost_gbp", "gl_pct", "action",
    "deploy_target_gbp", "alert_status", "factor_primary", "factor_group",
    "stack_layer", "substrate_level", "source",
  ],
  jisaSnapshot: [
    "child", "ticker", "snapshot_date", "type", "layer", "shares",
    "price_local", "currency", "mv_gbp", "weight_pct", "cost_gbp", "gl_pct",
    "target_pct", "source",
  ],
  layerWeights: [
    "layer", "snapshot_date", "current_pct", "target_pct", "gap_pct",
    "priority", "mv_gbp", "source",
  ],
  factorGroupWeights: [
    "factor_group", "snapshot_date", "current_pct", "mv_gbp", "priority", "source",
  ],
  scoresSnapshot: [
    "ticker", "snapshot_date", "layer", "score", "substrate", "demand", "moat",
    "valuation", "mgmt", "disruption", "tier", "action", "buy_low", "buy_high",
    "return_profile", "compounder_subtype", "substrate_level", "stack_layer", "source",
  ],
  disruptionSnapshot: [
    "ticker", "snapshot_date", "disruption_score", "sub_avail", "economics",
    "govt_support", "demand_vuln", "time_viability", "status", "source",
  ],
  macroSnapshot: [
    "snapshot_date", "vix", "sp500_ytd_pct", "uranium_spot_usd",
    "copper_spot_usd_lb", "gold_usd", "brent_usd", "gbpusd", "pause_active", "source",
  ],
};

const TABLE_CONFIG = [
  { key: "dailyPrices", table: "daily_prices", conflict: "ticker,snapshot_date" },
  { key: "fxRates", table: "fx_rates", conflict: "pair,snapshot_date" },
  { key: "holdingsSnapshot", table: "holdings_snapshot", conflict: "ticker,account,snapshot_date" },
  { key: "jisaSnapshot", table: "jisa_snapshot", conflict: "child,ticker,snapshot_date" },
  { key: "layerWeights", table: "layer_weights_snapshot", conflict: "layer,snapshot_date" },
  { key: "factorGroupWeights", table: "factor_group_weights", conflict: "factor_group,snapshot_date" },
  { key: "scoresSnapshot", table: "scores_snapshot", conflict: "ticker,snapshot_date" },
  { key: "disruptionSnapshot", table: "disruption_snapshot", conflict: "ticker,snapshot_date" },
  { key: "macroSnapshot", table: "macro_snapshot", conflict: "snapshot_date" },
] as const;

/**
 * Inspect a batch and warn loudly when an expected field is either
 *  - completely absent from every row (key never appears), or
 *  - present but null/undefined in EVERY row of the batch.
 * Either pattern means the upstream payload regressed and the column will
 * silently be NULL in Postgres.
 */
function auditPayload(key: string, rows: Record<string, unknown>[]): void {
  const expected = EXPECTED_FIELDS[key];
  if (!expected || rows.length === 0) return;

  const missingKey: string[] = [];
  const allNull: string[] = [];

  for (const field of expected) {
    let seenKey = false;
    let seenValue = false;
    for (const row of rows) {
      if (row && typeof row === "object" && field in row) {
        seenKey = true;
        const v = (row as Record<string, unknown>)[field];
        if (v !== null && v !== undefined && v !== "") {
          seenValue = true;
          break;
        }
      }
    }
    if (!seenKey) missingKey.push(field);
    else if (!seenValue) allNull.push(field);
  }

  if (missingKey.length > 0) {
    console.warn(
      `[ingest-daily-snapshot] payload "${key}" (${rows.length} rows) is MISSING expected keys: ${missingKey.join(", ")}`,
    );
  }
  if (allNull.length > 0) {
    console.warn(
      `[ingest-daily-snapshot] payload "${key}" (${rows.length} rows) has keys present but NULL in every row: ${allNull.join(", ")}`,
    );
  }

  // Also surface any unexpected keys so additive schema drift is visible.
  const firstRow = rows[0] as Record<string, unknown> | undefined;
  if (firstRow && typeof firstRow === "object") {
    const unexpected = Object.keys(firstRow).filter((k) => !expected.includes(k));
    if (unexpected.length > 0) {
      console.log(
        `[ingest-daily-snapshot] payload "${key}" contains unexpected keys (will pass through to Postgres): ${unexpected.join(", ")}`,
      );
    }
  }
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

  const results: Record<string, { rows: number; count: number; status: string; error?: string }> = {};

  for (const { key, table, conflict } of TABLE_CONFIG) {
    const rows = body[key];
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      results[key] = { rows: 0, count: 0, status: "skipped" };
      continue;
    }

    // Defensive audit BEFORE upsert so regressions show up in function logs
    // even if Postgres happily accepts the NULLs.
    auditPayload(key, rows as Record<string, unknown>[]);

    // Pure passthrough upsert — no whitelist, no type stripping. Any column
    // present on the row that also exists on the table will be written.
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: conflict, ignoreDuplicates: false });

    if (error) {
      console.error(`${table} error:`, JSON.stringify(error));
      results[key] = { rows: rows.length, count: 0, status: "error", error: error.message };
    } else {
      results[key] = { rows: rows.length, count: rows.length, status: "ok" };
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
