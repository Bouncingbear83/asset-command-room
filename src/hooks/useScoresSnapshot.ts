import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuartetSnapshotRow {
  ticker: string;
  bull_base: number | null;
  bull_stretch: number | null;
  bear_thesis_weak: number | null;
  bear_substrate_fail: number | null;
  bull_bear_at_date: string | null;
  bb_target_date: string | null;
  div_yield: number | null;
  snapshot_date: string;
}

interface State {
  byTicker: Map<string, QuartetSnapshotRow>;
  loading: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cacheRef: { ts: number; data: Map<string, QuartetSnapshotRow> } | null = null;

/**
 * Latest quartet + IRR-BB fields per ticker from scores_snapshot.
 * Supabase mirror of SCORES sheet AK-AS, populated by Daily Snapshot.
 *
 * Spot price is intentionally NOT fetched here; IRR-BB and ratios are
 * calculated at render time using live price from HOLDINGS/WATCHLIST.
 */
export function useScoresSnapshot(): State {
  const [state, setState] = useState<State>({ byTicker: new Map(), loading: true });

  useEffect(() => {
    if (cacheRef && Date.now() - cacheRef.ts < CACHE_TTL_MS) {
      setState({ byTicker: cacheRef.data, loading: false });
      return;
    }

    let cancelled = false;
    setState({ byTicker: new Map(), loading: true });

    (async () => {
      try {
        const { data, error } = await supabase
          .from("scores_snapshot")
          .select("ticker, snapshot_date, bull_base, bull_stretch, bear_thesis_weak, bear_substrate_fail, bull_bear_at_date, bb_target_date, div_yield")
          .order("snapshot_date", { ascending: false })
          .limit(5000);

        if (error || !data || cancelled) {
          if (!cancelled) setState({ byTicker: new Map(), loading: false });
          return;
        }

        // Dedup by ticker (already sorted desc, first occurrence wins)
        const byTicker = new Map<string, QuartetSnapshotRow>();
        for (const row of data as QuartetSnapshotRow[]) {
          const t = String(row.ticker).toUpperCase();
          if (!byTicker.has(t)) byTicker.set(t, row);
        }

        cacheRef = { ts: Date.now(), data: byTicker };
        if (!cancelled) setState({ byTicker, loading: false });
      } catch {
        if (!cancelled) setState({ byTicker: new Map(), loading: false });
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
