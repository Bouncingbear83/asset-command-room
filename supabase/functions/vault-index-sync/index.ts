// vault-index-sync: service-role writes for the nightly STELLAR Vault Index (n8n YoU6CgRqSURYdH0S).
// The n8n Supabase credential is the anon key, which has no DELETE on vault_notes_meta and
// no INSERT/DELETE on vault_backlinks (migrations 20260707095754 / 20260707095853).
// Auth: Bearer INGEST_SECRET (same pattern as manage-layer-reviews and ingest-*).
//
// Actions:
//   REPLACE_BACKLINKS { rows: [{source_path, source_type, target_type, target_id}] }
//     -> deletes every row in vault_backlinks, inserts rows. Refuses an empty rows[] (no wipe).
//   PURGE_PATHS { paths: string[] }   (1..50 paths)
//     -> deletes those paths from vault_notes_meta; returns the deleted paths.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_BACKLINKS = 20000;
const MAX_PURGE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ingestSecret = Deno.env.get("INGEST_SECRET");
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!ingestSecret || token !== ingestSecret) return json({ error: "unauthorized" }, 401);

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
    if (action === "REPLACE_BACKLINKS") {
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      if (rows.length === 0) return json({ error: "rows[] required; refusing to wipe backlinks" }, 400);
      if (rows.length > MAX_BACKLINKS) return json({ error: `rows[] exceeds ${MAX_BACKLINKS}` }, 400);
      const clean = rows
        .filter((r: any) => r && r.source_path && r.target_type && r.target_id)
        .map((r: any) => ({
          source_path: String(r.source_path),
          source_type: r.source_type ? String(r.source_type) : "unknown",
          target_type: String(r.target_type),
          target_id: String(r.target_id),
        }));
      if (clean.length === 0) return json({ error: "no valid rows" }, 400);

      const del = await supabase.from("vault_backlinks").delete().gt("id", 0);
      if (del.error) return json({ error: "delete_failed", detail: del.error.message }, 500);

      let inserted = 0;
      for (let i = 0; i < clean.length; i += 1000) {
        const chunk = clean.slice(i, i + 1000);
        const ins = await supabase.from("vault_backlinks").insert(chunk);
        if (ins.error) {
          return json({ error: "insert_failed", detail: ins.error.message, inserted }, 500);
        }
        inserted += chunk.length;
      }
      return json({ status: "ok", action, requested: rows.length, inserted });
    }

    if (action === "PURGE_PATHS") {
      const paths = Array.isArray(payload.paths) ? payload.paths.map(String).filter(Boolean) : [];
      if (paths.length === 0 || paths.length > MAX_PURGE) {
        return json({ error: `paths[] must hold 1..${MAX_PURGE} entries` }, 400);
      }
      const { data, error } = await supabase
        .from("vault_notes_meta")
        .delete()
        .in("path", paths)
        .select("path");
      if (error) return json({ error: "purge_failed", detail: error.message }, 500);
      const deleted = (data || []).map((r: any) => r.path);
      return json({ status: "ok", action, requested: paths.length, deleted });
    }

    return json({ error: "action must be REPLACE_BACKLINKS or PURGE_PATHS" }, 400);
  } catch (e) {
    return json({ error: "internal", detail: String((e as Error)?.message || e) }, 500);
  }
});
