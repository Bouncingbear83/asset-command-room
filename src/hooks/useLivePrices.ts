import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LivePrice {
  price: number;
  currency: string;
  marketTime: number;
  marketState: string;
  previousClose: number | null;
  changePercent: number | null;
}

export type LivePriceMap = Record<string, LivePrice>;

interface State {
  prices: LivePriceMap;
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cacheRef: { key: string; ts: number; data: LivePriceMap; fetchedAt: string } | null = null;

/**
 * Fetches live prices for the given tickers via the live-prices edge function.
 * Client-side cache: 5 minutes. Skips fetch if tickers array is empty.
 */
export function useLivePrices(tickers: string[]): State {
  const [state, setState] = useState<State>({
    prices: {},
    loading: true,
    error: null,
    fetchedAt: null,
  });

  const key = tickers
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(",");

  // Track the key to avoid stale closures
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!key) {
      setState({ prices: {}, loading: false, error: null, fetchedAt: null });
      return;
    }

    // Return cached data if fresh
    if (cacheRef && cacheRef.key === key && Date.now() - cacheRef.ts < CACHE_TTL_MS) {
      setState({
        prices: cacheRef.data,
        loading: false,
        error: null,
        fetchedAt: cacheRef.fetchedAt,
      });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const allTickers = key.split(",");
        const BATCH_SIZE = 20;
        const batches: string[][] = [];
        for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
          batches.push(allTickers.slice(i, i + BATCH_SIZE));
        }

        const results = await Promise.all(
          batches.map((batch) =>
            supabase.functions.invoke("live-prices", { body: { tickers: batch } }),
          ),
        );

        if (cancelled) return;

        const normalised: LivePriceMap = {};
        const errors: string[] = [];
        const allSkipped: string[] = [];
        let fetchedAt: string = new Date().toISOString();

        for (const { data, error } of results) {
          if (error) {
            console.error("[useLivePrices] invoke error:", error);
            errors.push(error.message ?? "Edge function error");
            continue;
          }
          const prices: LivePriceMap = data?.prices ?? {};
          for (const [k, v] of Object.entries(prices)) {
            normalised[k.toUpperCase()] = v as LivePrice;
          }
          if (data?.fetchedAt) fetchedAt = data.fetchedAt;
          if (data?.errors?.length) errors.push(...data.errors);
          if (data?.skipped?.length) allSkipped.push(...data.skipped);
        }

        console.log(
          `[useLivePrices] fetched ${Object.keys(normalised).length} prices in ${batches.length} batch(es), skipped: ${allSkipped.join(", ") || "none"}`,
        );

        cacheRef = { key, ts: Date.now(), data: normalised, fetchedAt };
        setState({
          prices: normalised,
          loading: false,
          error: errors.length > 0 ? errors.join("; ") : null,
          fetchedAt,
        });
      } catch (err: any) {
        if (cancelled) return;
        console.error("[useLivePrices] fetch failed:", err);
        setState((s) => ({
          ...s,
          loading: false,
          error: err.message ?? "fetch failed",
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
