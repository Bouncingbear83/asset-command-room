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

    // Parse body
    const body = await req.json();
    const run_id: string = body.run_id;
    const run_started_at: string = body.run_started_at;
    const signals: any[] = body.signals;
    const dedupe_window_days: number = body.dedupe_window_days ?? 7;

    if (!Array.isArray(signals) || signals.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, skipped_dedupe: 0, run_id }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const originalCount = signals.length;

    // Supabase client (service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Compute dedupe cutoff
    const cutoff = new Date(
      Date.now() - dedupe_window_days * 86400 * 1000,
    ).toISOString();

    // Fetch recent rows for dedupe
    const tickers = Array.from(new Set(signals.map((s) => s.ticker)));
    const { data: recent, error: fetchErr } = await supabase
      .from("narrative_signals")
      .select("ticker, signal_class")
      .in("ticker", tickers)
      .gte("created_at", cutoff);

    if (fetchErr) {
      console.error("dedupe fetch error:", JSON.stringify(fetchErr));
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const dedupeKeys = new Set(
      (recent ?? []).map((r: any) => `${r.ticker}::${r.signal_class}`),
    );

    const toInsert = signals.filter(
      (s) => !dedupeKeys.has(`${s.ticker}::${s.signal_class}`),
    );
    const skipped = originalCount - toInsert.length;

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, skipped_dedupe: skipped, run_id }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const rows = toInsert.map((s) => ({
      run_id,
      run_started_at,
      ticker: s.ticker,
      name: s.name,
      layer: s.layer ?? null,
      source_table: s.source_table,
      signal_class: s.signal_class,
      strength: s.strength,
      matched_keywords: s.matched_keywords ?? null,
      headline: s.headline ?? null,
      url: s.url ?? null,
      snippet: s.snippet ?? null,
      published_date: s.published_date ?? null,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("narrative_signals")
      .insert(rows)
      .select("id, ticker, signal_class, strength");

    if (insertErr) {
      console.error("narrative_signals insert error:", JSON.stringify(insertErr));
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        inserted: inserted?.length ?? 0,
        skipped_dedupe: skipped,
        run_id,
        inserted_rows: inserted ?? [],
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("ingest-narrative-signals error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
