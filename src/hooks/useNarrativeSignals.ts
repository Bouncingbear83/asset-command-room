import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NarrativeSignal {
  id: string;
  ticker: string;
  name: string;
  layer: string | null;
  source_table: string;
  signal_class: string;
  strength: string;
  headline: string | null;
  url: string | null;
  snippet: string | null;
  matched_keywords: string | null;
  created_at: string;
  review_status: string | null;
}

const STRENGTH_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function sortSignals(arr: NarrativeSignal[]): NarrativeSignal[] {
  return [...arr].sort((a, b) => {
    const r = (STRENGTH_RANK[b.strength] ?? 0) - (STRENGTH_RANK[a.strength] ?? 0);
    if (r !== 0) return r;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

const FIELDS =
  "id, ticker, name, layer, source_table, signal_class, strength, headline, url, snippet, matched_keywords, created_at, review_status";

export function useNarrativeSignals() {
  const [signals, setSignals] = useState<NarrativeSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from("narrative_signals")
      .select(FIELDS)
      .eq("review_status", "NEW")
      .in("strength", ["HIGH", "MEDIUM"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSignals(sortSignals((data ?? []) as NarrativeSignal[]));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("narrative_signals_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "narrative_signals" },
        (payload) => {
          const eventType = payload.eventType;
          if (eventType === "INSERT") {
            const row = payload.new as NarrativeSignal;
            if (
              row.review_status === "NEW" &&
              (row.strength === "HIGH" || row.strength === "MEDIUM")
            ) {
              setSignals((prev) =>
                sortSignals([row, ...prev.filter((s) => s.id !== row.id)]).slice(0, 50)
              );
            }
          } else if (eventType === "UPDATE") {
            const row = payload.new as NarrativeSignal;
            setSignals((prev) => {
              const without = prev.filter((s) => s.id !== row.id);
              if (
                row.review_status === "NEW" &&
                (row.strength === "HIGH" || row.strength === "MEDIUM")
              ) {
                return sortSignals([row, ...without]).slice(0, 50);
              }
              return without;
            });
          } else if (eventType === "DELETE") {
            const row = payload.old as { id?: string };
            if (row?.id) setSignals((prev) => prev.filter((s) => s.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const markReviewed = useCallback(async (id: string) => {
    // optimistic
    setSignals((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase
      .from("narrative_signals")
      .update({
        review_status: "REVIEWED",
        reviewed_at: new Date().toISOString(),
        reviewed_by: "command_ui",
      })
      .eq("id", id);
    if (error) {
      // rollback by refetch
      await fetchAll();
      throw error;
    }
  }, [fetchAll]);

  return { signals, loading, error, markReviewed, refetch: fetchAll };
}
