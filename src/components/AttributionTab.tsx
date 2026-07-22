import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface PortfolioDailyRow {
  snapshot_date: string;
  total_mv_gbp: number;
  position_count: number;
  daily_pnl_gbp: number | null;
  daily_return_pct: number | null;
}

export interface RollingWindowRow {
  ticker: string;
  window_label: string;
  layer: string;
  factor_group: string;
  return_profile: string | null;
  reclass_status: string;
  framework: string;
  mv_start: number | null;
  mv_end: number;
  period_return_pct: number;
  period_pnl_gbp: number;
  has_capital_flow: boolean;
  flow_day_count: number;
}

export interface DimensionWindowRow {
  group_name: string;
  position_count: number;
  total_mv_gbp: number;
  weighted_return_pct: number;
  total_pnl_gbp: number;
}

export type Dimension =
  | "layer"
  | "factor_group"
  | "return_profile"
  | "reclass_status"
  | "framework";

export type WindowLabel = "7d" | "30d" | "60d" | "90d";

// ── Hook ──

export function useAttribution() {
  const [portfolioDaily, setPortfolioDaily] = useState<PortfolioDailyRow[]>([]);
  const [rollingWindow, setRollingWindow] = useState<RollingWindowRow[]>([]);
  const [dimensionData, setDimensionData] = useState<DimensionWindowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current selections
  const [dimension, setDimension] = useState<Dimension>("layer");
  const [window, setWindow] = useState<WindowLabel>("30d");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailyRes, rollingRes, dimRes] = await Promise.all([
        supabase
          .from("perf_portfolio_daily" as any)
          .select("*")
          .order("snapshot_date", { ascending: true }),
        supabase
          .from("perf_rolling_window" as any)
          .select("*"),
        supabase.rpc("perf_by_dimension_window" as any, {
          p_dimension: dimension,
          p_window: window,
        }),
      ]);

      if (dailyRes.error) throw new Error(`portfolio_daily: ${dailyRes.error.message}`);
      if (rollingRes.error) throw new Error(`rolling_window: ${rollingRes.error.message}`);
      if (dimRes.error) throw new Error(`dimension_window: ${dimRes.error.message}`);

      setPortfolioDaily((dailyRes.data ?? []) as PortfolioDailyRow[]);
      setRollingWindow((rollingRes.data ?? []) as RollingWindowRow[]);
      setDimensionData((dimRes.data ?? []) as DimensionWindowRow[]);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [dimension, window]);

  // Refetch dimension data when dimension or window changes
  const fetchDimension = useCallback(async () => {
    try {
      const res = await supabase.rpc("perf_by_dimension_window" as any, {
        p_dimension: dimension,
        p_window: window,
      });
      if (res.error) throw new Error(res.error.message);
      setDimensionData((res.data ?? []) as DimensionWindowRow[]);
    } catch (err: any) {
      console.error("dimension fetch:", err.message);
    }
  }, [dimension, window]);

  useEffect(() => {
    fetchAll();
  }, []); // Initial load

  // When dimension/window changes after initial load, only refetch the dimension data
  useEffect(() => {
    if (!loading) fetchDimension();
  }, [dimension, window]);

  return {
    portfolioDaily,
    rollingWindow,
    dimensionData,
    loading,
    error,
    dimension,
    setDimension,
    window,
    setWindow,
    refresh: fetchAll,
  };
}
