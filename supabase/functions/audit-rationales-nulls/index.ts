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

// v2.14 hard validation cutover — anything before this date had no schema requirement
const V214_DEPLOY_DATE = "2026-05-17T18:30:00.000Z";

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

    // -- Pull score_rationales (full history, paginated) --
    const selectCols = ["ticker", "scored_at", ...CRITICAL_COLS].join(",");
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

    // -- Determine "currently held" set: tickers in the latest holdings_snapshot date --
    const heldSet = new Set<string>();
    {
      const { data: latestDateRow, error: dateErr } = await supabase
        .from("holdings_snapshot")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1);
      if (dateErr) throw dateErr;
      const latestDate = latestDateRow?.[0]?.snapshot_date;
      if (latestDate) {
        let hFrom = 0;
        while (true) {
          const { data, error } = await supabase
            .from("holdings_snapshot")
            .select("ticker")
            .eq("snapshot_date", latestDate)
            .range(hFrom, hFrom + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          for (const r of data as Array<{ ticker: string }>) {
            if (r.ticker) heldSet.add(r.ticker.toUpperCase());
          }
          if (data.length < pageSize) break;
          hFrom += pageSize;
        }
      }
    }

    const isHeld = (ticker: string) => heldSet.has((ticker ?? "").toUpperCase());

    // Pass 1: null_counts across ALL rows (informational)
    const null_counts: Record<string, number> = {};
    for (const c of CRITICAL_COLS) null_counts[c] = 0;
    for (const row of rows) {
      for (const c of CRITICAL_COLS) {
        if (row[c] === null || row[c] === undefined) null_counts[c]++;
      }
    }

    // Pass 2: latest scored_at per ticker
    const latestPerTicker = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const ticker = row.ticker as string;
      if (!ticker) continue;
      const scoredAt = row.scored_at ? new Date(row.scored_at as string).getTime() : NaN;
      if (Number.isNaN(scoredAt)) continue;
      const existing = latestPerTicker.get(ticker);
      const existingTime = existing
        ? new Date(existing.scored_at as string).getTime()
        : -Infinity;
      if (scoredAt > existingTime) {
        latestPerTicker.set(ticker, row);
      }
    }

    // Pass 3: classify latest-per-ticker NULL hits using HELD binary gate
    const cutoff = new Date(V214_DEPLOY_DATE).getTime();

    const alerts: Array<{
      ticker: string;
      scored_at: unknown;
      null_columns: string[];
    }> = [];
    const stale_rescore_warnings: Array<{
      ticker: string;
      scored_at: unknown;
      null_columns: string[];
    }> = [];
    const inactive_with_nulls: Array<{
      ticker: string;
      scored_at: unknown;
      null_columns: string[];
    }> = [];

    for (const row of latestPerTicker.values()) {
      const ticker = row.ticker as string;
      const missing = HARD_ALERT_COLS.filter(
        (c) => row[c] === null || row[c] === undefined,
      );
      if (missing.length === 0) continue;

      if (!isHeld(ticker)) {
        // Not in latest holdings_snapshot — informational only
        inactive_informational.push({
          ticker,
          scored_at: row.scored_at,
          null_columns: missing,
        });
        continue;
      }

      // HELD with NULL hard cols — split by v2.14 cutover
      const scoredAt = new Date(row.scored_at as string).getTime();
      if (scoredAt >= cutoff) {
        alerts.push({
          ticker,
          scored_at: row.scored_at,
          null_columns: missing,
        });
      } else {
        stale_rescore_warnings.push({
          ticker,
          scored_at: row.scored_at,
          null_columns: missing,
        });
      }
    }

    // Pass 4: historical post-v2.14 violations (compliance archive — never decreases)
    const historical_violations: Array<{
      ticker: unknown;
      scored_at: unknown;
      null_columns: string[];
    }> = [];
    for (const row of rows) {
      const scoredAt = row.scored_at ? new Date(row.scored_at as string).getTime() : NaN;
      if (Number.isNaN(scoredAt) || scoredAt < cutoff) continue;
      const missing = HARD_ALERT_COLS.filter(
        (c) => row[c] === null || row[c] === undefined,
      );
      if (missing.length > 0) {
        historical_violations.push({
          ticker: row.ticker,
          scored_at: row.scored_at,
          null_columns: missing,
        });
      }
    }

    return new Response(
      JSON.stringify({
        total_rows: rows.length,
        held_count: heldSet.size,
        null_counts,

        // Primary operational signal — HELD ticker with NULL hard col scored post-v2.14
        alerts,
        alert_count: alerts.length,

        // HELD ticker with NULL hard col, last scored before v2.14 — clears at rescore
        stale_rescore_warnings,
        stale_rescore_warning_count: stale_rescore_warnings.length,

        // Not in latest holdings_snapshot — exempt, informational
        inactive_with_nulls,
        inactive_with_nulls_count: inactive_informational.length,

        // All post-v2.14 NULL events ever shipped — compliance archive
        historical_violations,
        historical_violation_count: historical_violations.length,

        v214_deploy_cutoff: V214_DEPLOY_DATE,
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
