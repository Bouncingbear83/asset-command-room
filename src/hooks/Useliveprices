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
        const { data, error } = await supabase.functions.invoke("live-prices", {
          body: { tickers: key.split(",") },
        });

        if (cancelled) return;

        if (error) {
          console.error("[useLivePrices] invoke error:", error);
          setState((s) => ({
            ...s,
            loading: false,
            error: error.message ?? "Edge function error",
          }));
          return;
        }

        const prices: LivePriceMap = data?.prices ?? {};
        const fetchedAt: string = data?.fetchedAt ?? new Date().toISOString();

        // Normalise keys to uppercase
        const normalised: LivePriceMap = {};
        for (const [k, v] of Object.entries(prices)) {
          normalised[k.toUpperCase()] = v as LivePrice;
        }

        const errors = data?.errors ?? [];
        if (errors.length > 0) {
          console.warn("[useLivePrices] partial errors:", errors);
        }

        console.log(
          `[useLivePrices] fetched ${Object.keys(normalised).length} prices, skipped: ${(data?.skipped ?? []).join(", ") || "none"}`,
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
