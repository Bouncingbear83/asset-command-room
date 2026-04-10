import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DailyPricePoint } from "./useDailyPrices";

export interface TickerHistory {
  points: DailyPricePoint[];
  loading: boolean;
}

export function useTickerHistory() {
  const [cache, setCache] = useState<Map<string, DailyPricePoint[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const inflight = useRef<Set<string>>(new Set());

  const fetchHistory = useCallback(async (ticker: string) => {
    if (cache.has(ticker) || inflight.current.has(ticker)) return;
    inflight.current.add(ticker);
    setLoading(prev => new Set(prev).add(ticker));

    try {
      const { data, error } = await supabase
        .from("daily_prices")
        .select("snapshot_date, price_local, price_gbp")
        .eq("ticker", ticker)
        .order("snapshot_date", { ascending: true });

      if (error) {
        console.error(`ticker history fetch error for ${ticker}:`, error.message);
        return;
      }

      const points: DailyPricePoint[] = (data || []).map(row => ({
        date: row.snapshot_date,
        priceLocal: Number(row.price_local),
        priceGbp: Number(row.price_gbp),
      }));

      setCache(prev => new Map(prev).set(ticker, points));
    } finally {
      inflight.current.delete(ticker);
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(ticker);
        return next;
      });
    }
  }, [cache]);

  const getHistory = useCallback((ticker: string): TickerHistory => {
    return {
      points: cache.get(ticker) || [],
      loading: loading.has(ticker),
    };
  }, [cache, loading]);

  return { fetchHistory, getHistory };
}
