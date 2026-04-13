import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResearchSummary {
  ticker: string;
  total_score: number;
  scored_at: string;
  scored_by: string;
  thesis_summary: string | null;
  tier: string | null;
  action: string;
  change_note: string | null;
}

export function useResearchSummary() {
  const [summaryMap, setSummaryMap] = useState<Map<string, ResearchSummary>>(new Map());
  const [recentResearch, setRecentResearch] = useState<ResearchSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      // Fetch all score_rationales (latest per ticker via JS dedup)
      const { data, error } = await supabase
        .from("score_rationales")
        .select("ticker, total_score, scored_at, scored_by, thesis_summary, tier, action, change_note")
        .order("scored_at", { ascending: false });

      if (error || !data || cancelled) return;

      // Deduplicate to latest per ticker
      const map = new Map<string, ResearchSummary>();
      for (const row of data as ResearchSummary[]) {
        if (!map.has(row.ticker)) {
          map.set(row.ticker, row);
        }
      }

      // Recent 5 (already sorted desc)
      const recent = (data as ResearchSummary[]).slice(0, 5);

      if (!cancelled) {
        setSummaryMap(map);
        setRecentResearch(recent);
        setLoaded(true);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  const getSummary = useCallback((ticker: string): ResearchSummary | undefined => {
    return summaryMap.get(ticker);
  }, [summaryMap]);

  const getResearchFreshness = useCallback((ticker: string): { color: string; label: string; days: number | null } => {
    const summary = summaryMap.get(ticker);
    if (!summary) return { color: "#555", label: "No data", days: null };
    const days = Math.floor((Date.now() - new Date(summary.scored_at).getTime()) / 86400000);
    if (days <= 30) return { color: "var(--green)", label: `${days}d`, days };
    if (days <= 60) return { color: "var(--amber)", label: `${days}d`, days };
    return { color: "var(--red)", label: `${days}d stale`, days };
  }, [summaryMap]);

  return { summaryMap, recentResearch, loaded, getSummary, getResearchFreshness };
}
