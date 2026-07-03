/**
 * useNarrativeWatch — reads persistent narrative watch items from Supabase.
 *
 * Sources: vault ## Narrative Watch sections, synced nightly.
 * Scope: ticker-level items, layer-level items, or both.
 * Used by: NarrativeWatchCard (CommandTab), FactSheet ticker panel.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NarrativeWatchItem {
  id: string;
  ticker: string | null;
  layer: string | null;
  category: string;
  content: string;
  source_path: string;
  authored_session: string | null;
  updated_at: string;
}

export type WatchCategory = "CATALYST" | "RISK" | "TAPE" | "SECTOR" | "THESIS" | "OTHER";

export const CATEGORY_LABELS: Record<WatchCategory, string> = {
  CATALYST: "Catalyst",
  RISK: "Risk",
  TAPE: "Tape",
  SECTOR: "Sector",
  THESIS: "Thesis",
  OTHER: "Other",
};

export const CATEGORY_COLORS: Record<WatchCategory, string> = {
  CATALYST: "var(--green)",
  RISK: "var(--red)",
  TAPE: "var(--amber)",
  SECTOR: "rgb(96,165,250)",
  THESIS: "var(--gold)",
  OTHER: "var(--text-dim)",
};

const FIELDS = "id, ticker, layer, category, content, source_path, authored_session, updated_at";

export function useNarrativeWatch(opts?: { ticker?: string; layer?: string }) {
  const [items, setItems] = useState<NarrativeWatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    let query = supabase
      .from("narrative_watch")
      .select(FIELDS)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (opts?.ticker) {
      query = query.eq("ticker", opts.ticker);
    }
    if (opts?.layer) {
      query = query.eq("layer", opts.layer);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[useNarrativeWatch] fetch error:", error);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as NarrativeWatchItem[]);
    setLoading(false);
  }, [opts?.ticker, opts?.layer]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, loading, refetch: fetchItems };
}

/**
 * useNarrativeWatchAll — loads all active watch items (ticker + layer level).
 * For CommandTab: shows everything, grouped by ticker then layer.
 */
export function useNarrativeWatchAll() {
  const [items, setItems] = useState<NarrativeWatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("narrative_watch")
        .select(FIELDS)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[useNarrativeWatchAll] fetch error:", error);
        setLoading(false);
        return;
      }
      setItems((data ?? []) as NarrativeWatchItem[]);
      setLoading(false);
    })();
  }, []);

  // Group by scope: ticker items first, then layer items
  const tickerItems = items.filter((i) => i.ticker != null);
  const layerItems = items.filter((i) => i.ticker == null && i.layer != null);

  return { items, tickerItems, layerItems, loading };
}
