import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ROWS = 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const TEXT_FIELDS = [
  "map_id",
  "stack",
  "subsystem",
  "subsystem_slug",
  "layer",
  "supplier_name",
  "ticker",
  "listing",
  "source",
  "note",
] as const;

const INT_FIELDS = ["irreplaceability", "penetration", "qual_barrier_yrs", "reclass_potential"] as const;

type Row = Record<string, unknown>;

function normalise(row: Row, i: number): { row?: Row; error?: string } {
  if (!row || typeof row !== "object") return { error: `Row ${i}: not an object` };

  const out: Row = {};

  for (const f of TEXT_FIELDS) {
    const v = row[f];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string") return { error: `Row ${i}: ${f} must be a string` };
    out[f] = v.trim();
  }

  // Required text columns
  for (const f of ["map_id", "stack", "subsystem", "subsystem_slug"] as const) {
    if (!out[f]) return { error: `Row ${i}: ${f} is required` };
  }

  for (const f of INT_FIELDS) {
    const v = row[f];
    if (v === undefined || v === null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return { error: `Row ${i}: ${f} must be numeric` };
    out[f] = Math.round(n);
  }

  if (row.keystone_flag !== undefined && row.keystone_flag !== null && row.keystone_flag !== "") {
    const v = row.keystone_flag;
    if (typeof v === "boolean") out.keystone_flag = v;
    else if (v === "true" || v === "TRUE" || v === 1 || v === "1") out.keystone_flag = true;
    else if (v === "false" || v === "FALSE" || v === 0 || v === "0") out.keystone_flag = false;
    else return { error: `Row ${i}: keystone_flag must be boolean` };
  }

  if (row.last_reviewed !== undefined && row.last_reviewed !== null && row.last_reviewed !== "") {
    const v = row.last_reviewed;
    if (typeof v !== "string" || !DATE_RE.test(v) || isNaN(Date.parse(v))) {
      return { error: `Row ${i}: last_reviewed must be YYYY-MM-DD` };
    }
    out.last_reviewed = v;
  }

  return { row: out };
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

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ingestSecret = Deno.env.get("INGEST_SECRET");
  if (!ingestSecret || token !== ingestSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    return new Response(JSON.stringify({ upserted: 0, errors: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (rows.length > MAX_ROWS) {
    return new Response(JSON.stringify({ error: `Too many rows: ${rows.length} > ${MAX_ROWS}` }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const errors: string[] = [];
  const normalised: Row[] = [];
  for (let i = 0; i < rows.length; i++) {
    const res = normalise(rows[i] as Row, i);
    if (res.error) errors.push(res.error);
    else normalised.push(res.row!);
  }
  if (errors.length > 0) {
    return new Response(JSON.stringify({ error: "Validation failed", errors }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("bottleneck_map")
    .upsert(normalised, { onConflict: "map_id", ignoreDuplicates: false });

  if (error) {
    console.error("bottleneck_map upsert error:", JSON.stringify(error));
    return new Response(JSON.stringify({ error: error.message, errors: [error.message] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ upserted: normalised.length, errors: [] }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
