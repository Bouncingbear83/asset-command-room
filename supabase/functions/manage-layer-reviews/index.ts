import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth
  const ingestSecret = Deno.env.get("INGEST_SECRET");
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!ingestSecret || token !== ingestSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = String(payload?.action || "").toUpperCase();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (action === "SEED") {
      const cycle = payload.cycle as string;
      const schedule = payload.schedule as Array<{
        layer: string;
        scheduled_date: string;
        prompt_template?: string;
      }>;
      if (!cycle || !Array.isArray(schedule) || schedule.length === 0) {
        return json({ error: "cycle and schedule[] required" }, 400);
      }

      const rows = schedule.map((s) => ({
        cycle,
        layer: s.layer,
        scheduled_date: s.scheduled_date,
        status: "SCHEDULED",
        prompt_template: s.prompt_template ?? null,
      }));

      // Replace existing SCHEDULED rows for this cycle+layer to keep idempotent
      for (const r of rows) {
        await supabase
          .from("layer_review_schedule")
          .delete()
          .eq("cycle", r.cycle)
          .eq("layer", r.layer)
          .eq("status", "SCHEDULED");
      }

      const { data, error } = await supabase
        .from("layer_review_schedule")
        .insert(rows)
        .select();
      if (error) throw error;
      return json({ ok: true, inserted: data?.length ?? 0, rows: data });
    }

    if (action === "UPDATE") {
      const { layer, cycle } = payload;
      if (!layer || !cycle) return json({ error: "layer and cycle required" }, 400);

      const patch: Record<string, unknown> = {};
      for (const k of [
        "status",
        "completed_date",
        "session_vault_path",
        "review_vault_path",
        "open_trends",
        "action_items",
        "prompt_template",
        "scheduled_date",
      ]) {
        if (payload[k] !== undefined) patch[k] = payload[k];
      }

      // Find latest matching row (prefer non-COMPLETE)
      const { data: existing, error: selErr } = await supabase
        .from("layer_review_schedule")
        .select("id, status")
        .eq("cycle", cycle)
        .eq("layer", layer)
        .order("created_at", { ascending: false });
      if (selErr) throw selErr;

      let targetId = existing?.find((r: any) => r.status !== "COMPLETE")?.id
        ?? existing?.[0]?.id;

      if (!targetId) {
        const { data: ins, error: insErr } = await supabase
          .from("layer_review_schedule")
          .insert({
            layer,
            cycle,
            scheduled_date: patch.scheduled_date ?? patch.completed_date ?? new Date().toISOString().slice(0, 10),
            ...patch,
            status: (patch.status as string) ?? "SCHEDULED",
          })
          .select()
          .single();
        if (insErr) throw insErr;
        return json({ ok: true, created: true, row: ins });
      }

      const { data, error } = await supabase
        .from("layer_review_schedule")
        .update(patch)
        .eq("id", targetId)
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, updated: true, row: data });
    }

    if (action === "GET") {
      const { cycle, layer, status } = payload;
      let q = supabase.from("layer_review_schedule").select("*");
      if (cycle) q = q.eq("cycle", cycle);
      if (layer) q = q.eq("layer", layer);
      if (status) q = q.eq("status", status);
      q = q.order("scheduled_date", { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return json({ ok: true, rows: data ?? [] });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});
