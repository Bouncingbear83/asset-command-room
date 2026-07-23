import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface Test5Row {
  ticker: string;
  current_price: number;
  mv_gbp: number;
  reclass_status: string;
  price_at_first_add: number | null;
  pe_at_first_add: number | null;
  first_add_date: string | null;
  price_move_pct: number | null;
  price_proximity_pct: number | null;
  months_elapsed: number | null;
  time_proximity_pct: number | null;
  entry_pe: number | null;
  test5_signal: "CLEAR" | "WATCH" | "TRIGGERED";
}

// ── Hook ──

export function useTest5Warning() {
  const [data, setData] = useState<Test5Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch5 = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supabase
        .from("test5_early_warning" as any)
        .select("*")
        .order("price_proximity_pct", { ascending: false, nullsFirst: false });

      if (res.error) throw new Error(`test5: ${res.error.message}`);
      setData((res.data ?? []) as Test5Row[]);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch5();
  }, [fetch5]);

  const triggered = data.filter((r) => r.test5_signal === "TRIGGERED");
  const watching = data.filter((r) => r.test5_signal === "WATCH");
  const clear = data.filter((r) => r.test5_signal === "CLEAR");

  return {
    data,
    triggered,
    watching,
    clear,
    loading,
    error,
    refresh: fetch5,
  };
}
