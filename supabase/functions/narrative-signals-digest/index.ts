import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    // Auth: Bearer INGEST_SECRET
    const authHeader = req.headers.get("Authorization") ?? "";
    const ingestSecret = Deno.env.get("INGEST_SECRET");

    if (!ingestSecret) {
      return new Response(
        JSON.stringify({ error: "INGEST_SECRET not configured" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    if (authHeader !== `Bearer ${ingestSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const url = new URL(req.url);
    const run_id = url.searchParams.get("run_id");
    const strength = url.searchParams.get("strength") ?? "HIGH";

    if (!run_id) {
      return new Response(
        JSON.stringify({ error: "missing run_id" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("narrative_signals")
      .select(
        "ticker, name, layer, source_table, signal_class, strength, matched_keywords, headline, url, snippet, run_started_at",
      )
      .eq("run_id", run_id)
      .eq("strength", strength)
      .order("signal_class", { ascending: true });

    if (error) {
      console.error("narrative-signals-digest query error:", JSON.stringify(error));
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const signals = data ?? [];
    return new Response(
      JSON.stringify({
        run_id,
        count: signals.length,
        run_started_at: signals[0]?.run_started_at ?? null,
        signals,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("narrative-signals-digest error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
