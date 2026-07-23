import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface RegimeRow {
  reclass_status: string;
  window_days: number;
  position_count: number;
  mv_start_gbp: number;
  price_return_pct: number;
  mv_return_pct: number;
  net_capital_flow_gbp: number;
  trade_count: number;
  top_contributor: string | null;
  bottom_contributor: string | null;
}

const REGIME_WINDOWS = [7, 30, 60, 90] as const;

// ── Hook ──

export function useRegimeAnalysis() {
  const [data, setData] = useState<RegimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegime = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Call perf_by_dimension_window for reclass_status across all windows
      const results = await Promise.all(
        REGIME_WINDOWS.map(async (w) => {
          const res = await supabase.rpc("perf_by_dimension_window" as any, {
            p_dimension: "reclass_status",
            p_window: w,
          });
          if (res.error) throw new Error(`regime ${w}d: ${res.error.message}`);
          return ((res.data ?? []) as any[]).map((row: any) => ({
            reclass_status: row.dimension_value ?? "UNKNOWN",
            window_days: w,
            position_count: row.position_count ?? 0,
            mv_start_gbp: row.mv_start_gbp ?? 0,
            price_return_pct: row.price_return_pct ?? 0,
            mv_return_pct: row.mv_return_pct ?? 0,
            net_capital_flow_gbp: row.net_capital_flow_gbp ?? 0,
            trade_count: row.trade_count ?? 0,
            top_contributor: row.top_contributor ?? null,
            bottom_contributor: row.bottom_contributor ?? null,
          }));
        })
      );
      setData(results.flat());
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegime();
  }, [fetchRegime]);

  // Derived: pivot by reclass_status for chart rendering
  const regimesByStatus = data.reduce<Record<string, RegimeRow[]>>(
    (acc, row) => {
      const key = row.reclass_status;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    },
    {}
  );

  // Derived: alpha decay (PRE return - COMPLETE return) per window
  const alphaDecay = REGIME_WINDOWS.map((w) => {
    const preRow = data.find(
      (r) => r.reclass_status === "PRE" && r.window_days === w
    );
    const completeRow = data.find(
      (r) => r.reclass_status === "COMPLETE" && r.window_days === w
    );
    return {
      window_days: w,
      label: `${w}d`,
      pre_return: preRow?.price_return_pct ?? null,
      in_progress_return:
        data.find(
          (r) => r.reclass_status === "IN_PROGRESS" && r.window_days === w
        )?.price_return_pct ?? null,
      complete_return: completeRow?.price_return_pct ?? null,
      alpha:
        preRow && completeRow
          ? preRow.price_return_pct - completeRow.price_return_pct
          : null,
    };
  });

  return {
    data,
    regimesByStatus,
    alphaDecay,
    loading,
    error,
    refresh: fetchRegime,
  };
}
