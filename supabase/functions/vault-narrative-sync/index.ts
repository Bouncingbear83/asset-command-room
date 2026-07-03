/**
 * vault-narrative-sync — Supabase Edge Function
 *
 * Queries vault_fts for notes containing ## Narrative Watch sections,
 * parses items, deactivates stale rows, inserts fresh ones.
 * Called monthly/daily by n8n workflow; all Supabase auth handled internally
 * via service role from env vars.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WatchItem {
  ticker: string | null;
  layer: string | null;
  category: string;
  content: string;
  source_path: string;
  active: boolean;
}

const VALID_CATEGORIES = new Set(["CATALYST", "RISK", "TAPE", "SECTOR", "THESIS", "OTHER"]);

function parseNarrativeWatch(
  content: string,
  path: string,
  frontmatter: Record<string, any>,
): WatchItem[] {
  const items: WatchItem[] = [];

  const sectionMatch = content.match(/## Narrative Watch([\s\S]*?)(?=\n## |$)/);
  if (!sectionMatch) return items;
  const section = sectionMatch[1];

  const itemPattern = /^-\s+\*\*(\w+):\*\*\s+(.+)$/gm;
  let match;
  while ((match = itemPattern.exec(section)) !== null) {
    const category = match[1].toUpperCase();
    const itemContent = match[2].trim();
    if (!itemContent) continue;

    items.push({
      ticker: frontmatter.ticker ?? null,
      layer: frontmatter.layer ?? null,
      category: VALID_CATEGORIES.has(category) ? category : "OTHER",
      content: itemContent,
      source_path: path,
      active: true,
    });
  }

  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey);

  const { data: vaultNotes, error: queryErr } = await sb
    .from("vault_fts")
    .select("path, content, frontmatter")
    .ilike("content", "%Narrative Watch%");

  if (queryErr) {
    console.error("[vault-narrative-sync] vault_fts query error:", queryErr);
    return new Response(
      JSON.stringify({ error: "vault_fts query failed", detail: queryErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const allItems: WatchItem[] = [];
  for (const note of vaultNotes ?? []) {
    let fm: Record<string, any> = {};
    try {
      fm =
        typeof note.frontmatter === "string"
          ? JSON.parse(note.frontmatter)
          : note.frontmatter ?? {};
    } catch {
      /* ignore parse errors */
    }

    const items = parseNarrativeWatch(String(note.content ?? ""), String(note.path ?? ""), fm);
    allItems.push(...items);
  }

  const { error: deactivateErr } = await sb
    .from("narrative_watch")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("active", true);

  if (deactivateErr) {
    console.error("[vault-narrative-sync] deactivate error:", deactivateErr);
    return new Response(
      JSON.stringify({ error: "deactivate failed", detail: deactivateErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let inserted = 0;
  if (allItems.length > 0) {
    const { error: insertErr } = await sb
      .from("narrative_watch")
      .insert(
        allItems.map((item) => ({
          ...item,
          updated_at: new Date().toISOString(),
        })),
      )
      .select("id");

    if (insertErr) {
      console.error("[vault-narrative-sync] insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "insert failed", detail: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    inserted = allItems.length;
  }

  return new Response(
    JSON.stringify({
      success: true,
      vaultNotesScanned: vaultNotes?.length ?? 0,
      itemsParsed: allItems.length,
      itemsInserted: inserted,
      syncedAt: new Date().toISOString(),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
