import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VaultNote {
  path: string;
  type: string;
  identifier: string | null;
  title: string | null;
  frontmatter: Record<string, any> | null;
  body?: string | null;
  body_sections?: Record<string, string> | null;
}

export interface VaultBacklink {
  source_path: string;
  source_type: string;
  target_type: string;
  target_id: string;
}

function rowToNote(row: any): VaultNote {
  const fm = (row?.frontmatter ?? {}) as Record<string, any>;
  return {
    path: row.path,
    type: row.type,
    identifier: row.identifier ?? null,
    title: row.title ?? null,
    frontmatter: fm,
    // body and body_sections are TOP-LEVEL columns on vault_notes_meta,
    // not nested inside frontmatter. Read directly from row.
    body: typeof row.body === "string" ? row.body : null,
    body_sections:
      row.body_sections && typeof row.body_sections === "object"
        ? (row.body_sections as Record<string, string>)
        : null,
  };
}

/** Fetch a single vault note by type + identifier (case-insensitive). */
export function useVaultNote(type: string, identifier: string | null) {
  const [note, setNote] = useState<VaultNote | null>(null);
  const [loading, setLoading] = useState<boolean>(!!identifier);

  useEffect(() => {
    let cancelled = false;
    if (!identifier) {
      setNote(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("vault_notes_meta")
        .select("*")
        .eq("type", type)
        .ilike("identifier", identifier)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setNote(data ? rowToNote(data) : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [type, identifier]);

  return { note, loading };
}

/** Fetch most recent notes for a given type. */
export function useVaultNotes(type: string, limit = 10) {
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("vault_notes_meta")
        .select("*")
        .eq("type", type)
        .order("last_indexed", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setNotes((data ?? []).map(rowToNote));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [type, limit]);

  return { notes, loading };
}

/** Fetch backlinks targeting a given (type, id). */
export function useVaultBacklinks(targetType: string, targetId: string | null) {
  const [backlinks, setBacklinks] = useState<VaultBacklink[]>([]);
  const [loading, setLoading] = useState<boolean>(!!targetId);

  useEffect(() => {
    let cancelled = false;
    if (!targetId) {
      setBacklinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("vault_backlinks")
        .select("source_path, source_type, target_type, target_id")
        .eq("target_type", targetType)
        .ilike("target_id", targetId);
      if (cancelled) return;
      setBacklinks((data ?? []) as VaultBacklink[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  return { backlinks, loading };
}
