import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScoreRationale {
  ticker: string;
  scored_at: string;
  scored_by: string;
  action: string;
  total_score: number;
  tier: string | null;
  thesis_summary: string | null;
  substrate_score: number;
  substrate_rationale: string;
  demand_score: number;
  demand_rationale: string;
  moat_score: number;
  moat_rationale: string;
  mos_score: number;
  mos_rationale: string;
  mgmt_score: number;
  mgmt_rationale: string;
  disruption_score: number;
  disruption_rationale: string;
  change_note: string | null;
  price_at_scoring: number | null;
  mv_gbp_at_scoring: number | null;
}

export interface DisruptionRationale {
  ticker: string;
  scored_at: string;
  scored_by: string;
  disruption_score: number;
  status: string | null;
  sub_avail_score: number | null;
  sub_avail_rationale: string | null;
  economics_score: number | null;
  economics_rationale: string | null;
  govt_support_score: number | null;
  govt_support_rationale: string | null;
  demand_vuln_score: number | null;
  demand_vuln_rationale: string | null;
  time_viability_score: number | null;
  time_viability_rationale: string | null;
  amber_trigger: string | null;
  red_trigger: string | null;
  evidence: string | null;
  change_note: string | null;
}

interface CachedData<T> {
  latest: T | null;
  history: T[];
}

export function useRationales() {
  const [scoreCache, setScoreCache] = useState<Map<string, CachedData<ScoreRationale>>>(new Map());
  const [disruptionCache, setDisruptionCache] = useState<Map<string, CachedData<DisruptionRationale>>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const fetchScoreRationales = useCallback(async (ticker: string) => {
    if (scoreCache.has(ticker)) return scoreCache.get(ticker)!;
    const key = `score-${ticker}`;
    setLoading(prev => new Set(prev).add(key));

    try {
      const { data, error } = await supabase
        .from("score_rationales")
        .select("*")
        .eq("ticker", ticker)
        .order("scored_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("score_rationales fetch error:", error);
        return { latest: null, history: [] };
      }

      const rows = (data || []) as ScoreRationale[];
      const result: CachedData<ScoreRationale> = {
        latest: rows[0] || null,
        history: rows,
      };

      setScoreCache(prev => new Map(prev).set(ticker, result));
      return result;
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [scoreCache]);

  const fetchDisruptionRationales = useCallback(async (ticker: string) => {
    if (disruptionCache.has(ticker)) return disruptionCache.get(ticker)!;
    const key = `disruption-${ticker}`;
    setLoading(prev => new Set(prev).add(key));

    try {
      const { data, error } = await supabase
        .from("disruption_rationales")
        .select("*")
        .eq("ticker", ticker)
        .order("scored_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("disruption_rationales fetch error:", error);
        return { latest: null, history: [] };
      }

      const rows = (data || []) as DisruptionRationale[];
      const result: CachedData<DisruptionRationale> = {
        latest: rows[0] || null,
        history: rows,
      };

      setDisruptionCache(prev => new Map(prev).set(ticker, result));
      return result;
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [disruptionCache]);

  const isLoading = useCallback((ticker: string) => {
    return loading.has(`score-${ticker}`) || loading.has(`disruption-${ticker}`);
  }, [loading]);

  return {
    scoreCache,
    disruptionCache,
    fetchScoreRationales,
    fetchDisruptionRationales,
    isLoading,
  };
}
