import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseRows } from "@/lib/safeRows";
import { Test5RowSchema, type Test5Row } from "@/lib/rowSchemas";

export type { Test5Row };

export function useTest5Warning() {
  const [data, setData] = useState<Test5Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch5 = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await supabase
      .from("test5_early_warning" as any)
      .select("*")
      .order("price_proximity_pct", { ascending: false, nullsFirst: false });

    const parsed = parseRows(Test5RowSchema, res, "test5_early_warning");
    if (parsed.error) {
      setError(`test5: ${parsed.error}`);
    } else {
      setData(parsed.rows);
    }
    setLoading(false);
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
