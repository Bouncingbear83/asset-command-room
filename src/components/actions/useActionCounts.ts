import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight hook that fetches open action counts grouped by ticker.
 * Used by Holdings, Watchlist, Intelligence tabs to show inline badges.
 *
 * Returns a map: { "SGL.DE": 2, "INR": 1, ... }
 *
 * Fetches once on mount; call refresh() to re-fetch.
 * Does NOT depend on usePortfolioData (no sheet fetch overhead).
 */
export function useActionCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all open items with ticker, then count client-side
      // (Supabase doesn't support GROUP BY in the JS client without RPC)
      const { data, error } = await (supabase as any)
        .from("action_tracker")
        .select("ticker")
        .eq("status", "OPEN")
        .not("ticker", "is", null);

      if (error) {
        console.error("useActionCounts:", error.message);
        setLoading(false);
        return;
      }

      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        const t = (row.ticker || "").toUpperCase();
        if (t) map[t] = (map[t] || 0) + 1;
      }
      setCounts(map);
    } catch (e) {
      console.error("useActionCounts:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { counts, loading, refresh };
}
