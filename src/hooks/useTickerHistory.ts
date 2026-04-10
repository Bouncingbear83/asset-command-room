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
      // Fetch newest first to prioritise recent data (PostgREST caps at 1000 rows)
      const { data: batch1, error } = await supabase
        .from("daily_prices")
        .select("snapshot_date, price_local, price_gbp")
        .eq("ticker", ticker)
        .order("snapshot_date", { ascending: false })
        .limit(1000);

      if (error) {
        console.error(`ticker history fetch error for ${ticker}:`, error.message);
        return;
      }

      let allRows = batch1 || [];

      // If we hit the 1000-row cap, paginate to get older data
      if (allRows.length === 1000) {
        const { data: batch2 } = await supabase
          .from("daily_prices")
          .select("snapshot_date, price_local, price_gbp")
          .eq("ticker", ticker)
          .order("snapshot_date", { ascending: false })
          .range(1000, 1999);

        if (batch2 && batch2.length > 0) {
          allRows = [...allRows, ...batch2];
        }
      }

      // Reverse to chronological order
      allRows.reverse();

      console.log(`[useTickerHistory] ${ticker}: ${allRows.length} rows, last=${allRows.length ? allRows[allRows.length - 1].snapshot_date : "none"}`);
      const points: DailyPricePoint[] = allRows.map(row => ({
        date: row.snapshot_date,
        priceLocal: Number(row.price_local),
        priceGbp: Number(row.price_gbp),
      }));

      cacheRef.current.set(ticker, points);
      setTick(t => t + 1);
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
