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
  firstDate?: string | null;
  lastDate?: string | null;
  rowCount?: number;
  /** From price_symbol_map: PRIVATE / UNRESOLVED names explain an empty sparkline. */
  symbolStatus?: SymbolStatus;
}

export type SymbolStatus = "ACTIVE" | "PRIVATE" | "UNRESOLVED";

interface State {
  byTicker: Record<string, WatchlistTrajectory>;
  symbolStatus: Record<string, SymbolStatus>;
  loading: boolean;
  error: string | null;
}

interface TrajectoryRow {
  ticker: string;
  spark30d: unknown;
  current_close: number | null;
  price_7d_ago: number | null;
  price_30d_ago: number | null;
  high_52w: number | null;
  low_52w: number | null;
  first_date: string | null;
  last_date: string | null;
  row_count: number | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cacheRef: { key: string; ts: number; data: Record<string, WatchlistTrajectory>; status: Record<string, SymbolStatus> } | null = null;

const num = (v: unknown): number | null => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

export const emptyTrajectory = (ticker: string): WatchlistTrajectory => ({
  ticker, spark30d: [], currentClose: null, price7dAgo: null, price30dAgo: null, high52w: null, low52w: null,
});

/** Pure mapping from get_price_trajectories rows; every requested ticker gets an entry. */
export function mapTrajectories(requested: string[], rows: TrajectoryRow[]): { byTicker: Record<string, WatchlistTrajectory>; missing: string[] } {
  const byTicker: Record<string, WatchlistTrajectory> = {};
  for (const r of rows) {
    const t = String(r.ticker).trim().toUpperCase();
    const spark = Array.isArray(r.spark30d) ? (r.spark30d as { date: string; close: unknown }[]) : [];
    byTicker[t] = {
      ticker: t,
      spark30d: spark.map((p) => ({ date: String(p.date), close: Number(p.close) })).filter((p) => Number.isFinite(p.close)),
      currentClose: num(r.current_close),
      price7dAgo: num(r.price_7d_ago),
      price30dAgo: num(r.price_30d_ago),
      high52w: num(r.high_52w),
      low52w: num(r.low_52w),
      firstDate: r.first_date,
      lastDate: r.last_date,
      rowCount: r.row_count ?? 0,
    };
  }
  const missing = requested.filter((t) => !byTicker[t]);
  for (const t of missing) byTicker[t] = emptyTrajectory(t);
  return { byTicker, missing };
}

/**
 * One server-side aggregation call: payload scales with ticker count, never history length.
 * The symbol map (PRIVATE / UNRESOLVED names) is a separate small select.
 */
export function useWatchlistHistory(tickers: string[]): State {
  const [state, setState] = useState<State>({ byTicker: {}, symbolStatus: {}, loading: true, error: null });

  const key = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))).sort().join(",");

  useEffect(() => {
    if (!key) {
      setState({ byTicker: {}, symbolStatus: {}, loading: false, error: null });
      return;
    }
    if (cacheRef && cacheRef.key === key && Date.now() - cacheRef.ts < CACHE_TTL_MS) {
      setState({ byTicker: cacheRef.data, symbolStatus: cacheRef.status, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const requested = key.split(",");
        const [traj, map] = await Promise.all([
          supabase.rpc("get_price_trajectories", { p_tickers: requested }),
          supabase.from("price_symbol_map").select("ticker, status"),
        ]);
        if (traj.error) throw traj.error;
        const { byTicker, missing } = mapTrajectories(requested, (traj.data ?? []) as TrajectoryRow[]);
        if (missing.length > 0) console.warn("[useWatchlistHistory] no price history (data gap):", missing.join(", "));
        const status: Record<string, SymbolStatus> = {};
        if (!map.error) for (const r of map.data ?? []) status[String(r.ticker).trim().toUpperCase()] = r.status as SymbolStatus;
        for (const t of Object.keys(byTicker)) if (status[t]) byTicker[t] = { ...byTicker[t], symbolStatus: status[t] };
        if (cancelled) return;
        cacheRef = { key, ts: Date.now(), data: byTicker, status };
        setState({ byTicker, symbolStatus: status, loading: false, error: null });
      } catch (err: any) {
        if (cancelled) return;
        console.error("[useWatchlistHistory] fetch failed:", err);
        setState({ byTicker: {}, symbolStatus: {}, loading: false, error: err.message ?? "fetch failed" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
