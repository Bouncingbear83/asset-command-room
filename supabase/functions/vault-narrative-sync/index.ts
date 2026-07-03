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

function parseNarrativeWatch(content: string, path: string, frontmatter: Record<string, any>): WatchItem[] {
  const items: WatchItem[] = [];

  // Find ## Narrative Watch section
  const sectionMatch = content.match(/## Narrative Watch([\s\S]*?)(?=\n## |$)/);
  if (!sectionMatch) return items;
  const section = sectionMatch[1];

  // Parse items: - **CATEGORY:** content
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

function parseNarrativeWatchSection(
  sectionContent: string,
  path: string,
  frontmatter: Record<string, any>,
): WatchItem[] {
  const items: WatchItem[] = [];
  const itemPattern = /^-\s+\*\*(\w+):\*\*\s+(.+)$/gm;
  let match;
  while ((match = itemPattern.exec(sectionContent)) !== null) {
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

  // Step 1: Query vault_notes_meta for notes containing Narrative Watch
  // body_sections is a JSONB column with H2 sections pre-parsed as {"section_title": "content"}
  const { data: vaultNotes, error: queryErr } = await sb
    .from("vault_notes_meta")
    .select("path, body, body_sections, frontmatter")
    .ilike("body", "%Narrative Watch%");

  if (queryErr) {
    console.error("[vault-narrative-sync] vault_notes_meta query error:", queryErr);
    return new Response(JSON.stringify({ error: "vault_notes_meta query failed", detail: queryErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 2: Parse all items
  // body_sections is JSONB: {"Narrative Watch": "- **CATALYST:** ...\n- **RISK:** ..."}
  // Falls back to regex on body if body_sections is missing
  const allItems: WatchItem[] = [];
  for (const note of vaultNotes ?? []) {
    let fm: Record<string, any> = {};
    try {
      fm = typeof note.frontmatter === "string" ? JSON.parse(note.frontmatter) : (note.frontmatter ?? {});
    } catch {
      /* ignore parse errors */
    }

    // Try body_sections first (pre-parsed by Vault Index)
    const sections = note.body_sections ?? {};
    const nwSection = sections["Narrative Watch"] ?? null;

    if (nwSection) {
      // Parse items directly from the pre-parsed section content
      const items = parseNarrativeWatchSection(String(nwSection), String(note.path ?? ""), fm);
      allItems.push(...items);
    } else {
      // Fall back to regex on body
      const items = parseNarrativeWatch(String(note.body ?? ""), String(note.path ?? ""), fm);
      allItems.push(...items);
    }
  }

  // Step 3: Deactivate all existing active rows
  const { error: deactivateErr } = await sb
    .from("narrative_watch")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("active", true);

  if (deactivateErr) {
    console.error("[vault-narrative-sync] deactivate error:", deactivateErr);
    return new Response(JSON.stringify({ error: "deactivate failed", detail: deactivateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 4: Insert fresh rows (if any)
  let inserted = 0;
  if (allItems.length > 0) {
    const { error: insertErr, count } = await sb
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
      return new Response(JSON.stringify({ error: "insert failed", detail: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
