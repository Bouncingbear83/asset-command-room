import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseRows } from "@/lib/safeRows";
import {
  PortfolioDailyRowSchema,
  RollingWindowRowSchema,
  DimensionWindowRowSchema,
  type PortfolioDailyRow,
  type RollingWindowRow,
  type DimensionWindowRow,
} from "@/lib/rowSchemas";

export type { PortfolioDailyRow, RollingWindowRow, DimensionWindowRow };

export type Dimension =
  | "layer"
  | "factor_group"
  | "return_profile"
  | "reclass_status"
  | "framework";

export type WindowLabel = "7d" | "30d" | "60d" | "90d";

const WINDOW_DAYS: Record<WindowLabel, number> = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
  "90d": 90,
};


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
          p_window: WINDOW_DAYS[window],
        }),
      ]);

      if (dailyRes.error) throw new Error(`portfolio_daily: ${dailyRes.error.message}`);
      if (rollingRes.error) throw new Error(`rolling_window: ${rollingRes.error.message}`);
      if (dimRes.error) throw new Error(`dimension_window: ${dimRes.error.message}`);

      setPortfolioDaily((dailyRes.data ?? []) as unknown as PortfolioDailyRow[]);
      setRollingWindow((rollingRes.data ?? []) as unknown as RollingWindowRow[]);
      setDimensionData((dimRes.data ?? []) as unknown as DimensionWindowRow[]);
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
        p_window: WINDOW_DAYS[window],
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
