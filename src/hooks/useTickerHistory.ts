import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DailyPricePoint } from "./useDailyPrices";

export interface TickerHistory {
  points: DailyPricePoint[];
  loading: boolean;
}

export function useTickerHistory() {
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const cacheRef = useRef<Map<string, DailyPricePoint[]>>(new Map());
  const inflight = useRef<Set<string>>(new Set());

  const fetchHistory = useCallback(async (ticker: string) => {
    if (cacheRef.current.has(ticker) || inflight.current.has(ticker)) return;
    inflight.current.add(ticker);
    setLoading(prev => new Set(prev).add(ticker));

    try {
      const { data, error } = await supabase
        .from("daily_prices")
        .select("snapshot_date, price_local, price_gbp")
        .eq("ticker", ticker)
        .order("snapshot_date", { ascending: true })
        .limit(5000);

      if (error) {
        console.error(`ticker history fetch error for ${ticker}:`, error.message);
        return;
      }

      const points: DailyPricePoint[] = (data || []).map(row => ({
        date: row.snapshot_date,
        priceLocal: Number(row.price_local),
        priceGbp: Number(row.price_gbp),
      }));

      cacheRef.current.set(ticker, points);
      setTick(t => t + 1); // trigger re-render
    } finally {
      inflight.current.delete(ticker);
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(ticker);
        return next;
      });
    }
  }, []);

  const getHistory = useCallback((ticker: string): TickerHistory => {
    return {
      points: cacheRef.current.get(ticker) || [],
      loading: loading.has(ticker),
    };
  }, [loading]);

  return { fetchHistory, getHistory };
}
