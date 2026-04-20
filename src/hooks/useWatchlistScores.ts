import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WatchlistScoreEntry {
  ticker: string;
  total_score: number | null;
  tier: string | null;
}

interface State {
  byTicker: Record<string, WatchlistScoreEntry>;
  loading: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cacheRef: { key: string; ts: number; data: Record<string, WatchlistScoreEntry> } | null = null;

/**
 * Batched fetch of latest score_rationales row per ticker. Uses a single
 * query with `in.()`, then keeps the most recent `scored_at` per ticker
 * client-side (PostgREST has no `distinct on`).
 */
export function useWatchlistScores(tickers: string[]): State {
  const [state, setState] = useState<State>({ byTicker: {}, loading: true });

  const key = tickers
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) {
      setState({ byTicker: {}, loading: false });
      return;
    }

    if (cacheRef && cacheRef.key === key && Date.now() - cacheRef.ts < CACHE_TTL_MS) {
      setState({ byTicker: cacheRef.data, loading: false });
      return;
    }

    let cancelled = false;
    setState({ byTicker: {}, loading: true });

    (async () => {
      try {
        const upper = key.split(",");
        const { data, error } = await supabase
          .from("score_rationales")
          .select("ticker, scored_at, total_score, tier")
          .in("ticker", upper)
          .order("scored_at", { ascending: false })
          .limit(1000);

        if (error) throw error;

        const latest: Record<string, WatchlistScoreEntry> = {};
        for (const row of data ?? []) {
          const t = String(row.ticker).toUpperCase();
          if (!latest[t]) {
            latest[t] = {
              ticker: t,
              total_score: row.total_score == null ? null : Number(row.total_score),
              tier: row.tier ?? null,
            };
          }
        }

        if (cancelled) return;
        cacheRef = { key, ts: Date.now(), data: latest };
        setState({ byTicker: latest, loading: false });
      } catch (err) {
        if (cancelled) return;
        console.error("[useWatchlistScores] fetch failed:", err);
        setState({ byTicker: {}, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
