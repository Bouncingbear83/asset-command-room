import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ROWS = 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Row {
  ticker: unknown;
  snapshot_date: unknown;
  close_price: unknown;
  currency: unknown;
  source?: unknown;
}

function validateRow(row: Row, i: number): string | null {
  if (!row || typeof row !== "object") return `Row ${i}: not an object`;
  if (typeof row.ticker !== "string" || !row.ticker.trim()) return `Row ${i}: invalid ticker`;
  if (typeof row.snapshot_date !== "string" || !DATE_RE.test(row.snapshot_date) || isNaN(Date.parse(row.snapshot_date))) {
    return `Row ${i}: invalid snapshot_date (expected YYYY-MM-DD)`;
  }
  const price = typeof row.close_price === "number" ? row.close_price : Number(row.close_price);
  if (!Number.isFinite(price) || price <= 0) return `Row ${i}: close_price must be numeric > 0`;
  if (typeof row.currency !== "string" || !row.currency.trim()) return `Row ${i}: invalid currency`;
  if (row.source !== undefined && typeof row.source !== "string") return `Row ${i}: source must be string`;
  return null;
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

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const ingestSecret = Deno.env.get("INGEST_SECRET");
  if (!ingestSecret || token !== ingestSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse
  let body: { rows?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = body?.rows;
  if (!Array.isArray(rows)) {
    return new Response(JSON.stringify({ error: "Body must contain 'rows' array" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, skipped: 0, errors: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rows.length > MAX_ROWS) {
    return new Response(
      JSON.stringify({ error: `Too many rows: ${rows.length} > ${MAX_ROWS}` }),
      { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Validate all rows first — reject entire batch on any failure
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const err = validateRow(rows[i] as Row, i);
    if (err) errors.push(err);
  }
  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ error: "Validation failed", errors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Normalise
  const normalised = (rows as Row[]).map((r) => ({
    ticker: (r.ticker as string).trim(),
    snapshot_date: r.snapshot_date as string,
    close_price: Number(r.close_price),
    currency: (r.currency as string).trim(),
    source: typeof r.source === "string" && r.source.trim() ? r.source.trim() : "yfinance",
  }));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error, count } = await supabase
    .from("watchlist_price_history")
    .upsert(normalised, {
      onConflict: "ticker,snapshot_date",
      ignoreDuplicates: true,
      count: "exact",
    });

  if (error) {
    console.error("upsert error:", JSON.stringify(error));
    return new Response(
      JSON.stringify({ error: error.message, errors: [error.message] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const inserted = count ?? 0;
  const skipped = normalised.length - inserted;

  return new Response(
    JSON.stringify({ inserted, skipped, errors: [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
