import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    // Auth: Bearer INGEST_SECRET (same secret as ingest-narrative-signals)
    const authHeader = req.headers.get("Authorization") ?? "";
    const ingestSecret = Deno.env.get("INGEST_SECRET");

    if (!ingestSecret) {
      return new Response(
        JSON.stringify({ error: "INGEST_SECRET not configured" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    if (authHeader !== `Bearer ${ingestSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    // Optional window override; defaults to 7 days
    let withinDays = 7;
    try {
      const body = await req.json();
      if (typeof body?.within_days === "number") withinDays = body.within_days;
    } catch (_) {
      // empty body is fine
    }

    const cutoff = new Date(Date.now() + withinDays * 86400 * 1000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("scheduled_reviews")
      .select("*")
      .not("status", "in", "(COMPLETED,DISMISSED)")
      .lte("next_due", cutoff)
      .order("next_due", { ascending: true });

    if (error) {
      console.error("get-scheduled-reviews error:", JSON.stringify(error));
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    // Bare array, matching the prior PostgREST response shape
    return new Response(JSON.stringify(data ?? []), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error("get-scheduled-reviews fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
