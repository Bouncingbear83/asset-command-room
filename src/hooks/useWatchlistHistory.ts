import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SparkPoint {
  date: string;
  close: number;
}

export interface WatchlistTrajectory {
  ticker: string;
  spark30d: SparkPoint[];
  currentClose: number | null;
  price7dAgo: number | null;
  price30dAgo: number | null;
  high52w: number | null;
  low52w: number | null;
}

interface State {
  byTicker: Record<string, WatchlistTrajectory>;
  loading: boolean;
  error: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache: { key: string; ts: number; data: Record<string, WatchlistTrajectory> } | null = null;
let cacheRef: typeof cache = null;

/**
 * Batched fetch of ~1y of daily closes for the given watchlist tickers, then
 * derives sparkline (last 30d) and trajectory anchors (7d ago, 30d ago, 52w
 * high/low) client-side.
 *
 * Why one query instead of N: PostgREST `in.()` lets us pull every ticker
 * in a single round-trip. The 1000-row PostgREST cap is handled with paging.
 */
export function useWatchlistHistory(tickers: string[]): State {
  const [state, setState] = useState<State>({ byTicker: {}, loading: true, error: null });

  // Stable cache key
  const key = tickers
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) {
      setState({ byTicker: {}, loading: false, error: null });
      return;
    }

    // 5-min cache
    if (cacheRef && cacheRef.key === key && Date.now() - cacheRef.ts < CACHE_TTL_MS) {
      setState({ byTicker: cacheRef.data, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const upper = key.split(",");
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 380); // ~1y + buffer
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        // Page through; PostgREST hard-caps at 1000 rows per request
        let allRows: { ticker: string; snapshot_date: string; close_price: number }[] = [];
        let from = 0;
        const PAGE = 1000;

        // Safety: max ~10k rows (≈ 25 tickers × 380 days)
        for (let i = 0; i < 12; i++) {
          const { data, error } = await supabase
            .from("watchlist_price_history")
            .select("ticker, snapshot_date, close_price")
            .in("ticker", upper)
            .gte("snapshot_date", cutoffStr)
            .order("ticker", { ascending: true })
            .order("snapshot_date", { ascending: true })
            .range(from, from + PAGE - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;
          allRows = allRows.concat(
            data.map((r) => ({
              ticker: String(r.ticker).toUpperCase(),
              snapshot_date: r.snapshot_date,
              close_price: Number(r.close_price),
            })),
          );
          if (data.length < PAGE) break;
          from += PAGE;
        }

        const byTicker: Record<string, WatchlistTrajectory> = {};
        const today = new Date();
        const d7 = new Date(today);
        d7.setDate(today.getDate() - 7);
        const d30 = new Date(today);
        d30.setDate(today.getDate() - 30);
        const d7Str = d7.toISOString().slice(0, 10);
        const d30Str = d30.toISOString().slice(0, 10);
        const dSparkStr = d30Str; // sparkline window = 30d

        // Group by ticker
        const groups: Record<string, typeof allRows> = {};
        for (const r of allRows) {
          (groups[r.ticker] ||= []).push(r);
        }

        for (const t of upper) {
          const rows = groups[t] ?? [];
          if (rows.length === 0) {
            byTicker[t] = {
              ticker: t,
              spark30d: [],
              currentClose: null,
              price7dAgo: null,
              price30dAgo: null,
              high52w: null,
              low52w: null,
            };
            continue;
          }

          // Already sorted ascending by snapshot_date
          const last = rows[rows.length - 1];
          const currentClose = last.close_price;

          // Latest close on or before d7Str / d30Str
          const findOnOrBefore = (cutoff: string) => {
            for (let i = rows.length - 1; i >= 0; i--) {
              if (rows[i].snapshot_date <= cutoff) return rows[i].close_price;
            }
            return null;
          };

          const price7dAgo = findOnOrBefore(d7Str);
          const price30dAgo = findOnOrBefore(d30Str);

          // 52w high/low across all returned rows (cutoff was 380d so this is fine)
          let high52w = -Infinity;
          let low52w = Infinity;
          for (const r of rows) {
            if (r.close_price > high52w) high52w = r.close_price;
            if (r.close_price < low52w) low52w = r.close_price;
          }

          // 30d sparkline
          const spark30d: SparkPoint[] = rows
            .filter((r) => r.snapshot_date >= dSparkStr)
            .map((r) => ({ date: r.snapshot_date, close: r.close_price }));

          byTicker[t] = {
            ticker: t,
            spark30d,
            currentClose,
            price7dAgo,
            price30dAgo,
            high52w: Number.isFinite(high52w) ? high52w : null,
            low52w: Number.isFinite(low52w) ? low52w : null,
          };
        }

        if (cancelled) return;
        cacheRef = { key, ts: Date.now(), data: byTicker };
        setState({ byTicker, loading: false, error: null });
      } catch (err: any) {
        if (cancelled) return;
        console.error("[useWatchlistHistory] fetch failed:", err);
        setState({ byTicker: {}, loading: false, error: err.message ?? "fetch failed" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
