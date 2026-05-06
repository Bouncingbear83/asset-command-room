import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FactorGroupWeightRow {
  factor_group: string;
  snapshot_date: string;
  current_pct: number;
  mv_gbp: number | null;
  priority: string | null;
}

export interface FactorGroupWeightsState {
  latest: FactorGroupWeightRow[];
  latestDate: string | null;
  history: FactorGroupWeightRow[];
  distinctDays: number;
  loading: boolean;
  error: string | null;
}

// `distinctDays` counts unique snapshot_date values found in the trailing 30-day
// window of `factor_group_weights`. UI gates (Section 3 trend chart, cap-tightening
// monitor) activate automatically once distinctDays >= 14.
export function useFactorGroupWeights(): FactorGroupWeightsState {
  const [state, setState] = useState<FactorGroupWeightsState>({
    latest: [], latestDate: null, history: [], distinctDays: 0, loading: true, error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("factor_group_weights")
          .select("factor_group, snapshot_date, current_pct, mv_gbp, priority")
          .gte("snapshot_date", cutoffStr)
          .order("snapshot_date", { ascending: true })
          .order("factor_group", { ascending: true });

        if (cancelled) return;
        if (error) {
          setState((s) => ({ ...s, loading: false, error: error.message }));
          return;
        }

        const rows = (data || []).map((r) => ({
          factor_group: String(r.factor_group ?? ""),
          snapshot_date: String(r.snapshot_date ?? ""),
          current_pct: Number(r.current_pct ?? 0),
          mv_gbp: r.mv_gbp === null ? null : Number(r.mv_gbp),
          priority: r.priority === null ? null : String(r.priority),
        })) as FactorGroupWeightRow[];

        const days = Array.from(new Set(rows.map((r) => r.snapshot_date))).sort();
        const latestDate = days.length ? days[days.length - 1] : null;
        const latest = latestDate ? rows.filter((r) => r.snapshot_date === latestDate) : [];

        setState({
          latest,
          latestDate,
          history: rows,
          distinctDays: days.length,
          loading: false,
          error: null,
        });
      } catch (e: any) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e?.message ?? "fetch error" }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
