import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WatchlistScoreEntry {
  ticker: string;
  total_score: number | null;
  tier: string | null;
}

interface State {
  byTicker: Record<string, WatchlistScoreEntry>;
  loading: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cacheRef: { key: string; ts: number; data: Record<string, WatchlistScoreEntry> } | null = null;

/** Strip exchange suffix: "MOG.A" → "MOG", "ENR.DE" → "ENR", "6324.T" → "6324". */
function stripSuffix(t: string): string {
  return t.replace(/[.\-][A-Z0-9]{1,3}$/i, "");
}

/**
 * Latest score/tier per watchlist ticker — sourced from `scores_snapshot`
 * (daily mirror of the SCORES Google Sheet), not `score_rationales`
 * (long-form rationales for Deep Dive).
 *
 * Match strategy: case-insensitive exact ticker; if not found, retry with
 * exchange suffix stripped (e.g. "MOG.A" → "MOG", "ENR.DE" → "ENR").
 * Most recent `snapshot_date` wins per ticker.
 */
export function useWatchlistScores(tickers: string[]): State {
  const [state, setState] = useState<State>({ byTicker: {}, loading: true });

  const key = tickers
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) {
      setState({ byTicker: {}, loading: false });
      return;
    }

    if (cacheRef && cacheRef.key === key && Date.now() - cacheRef.ts < CACHE_TTL_MS) {
      setState({ byTicker: cacheRef.data, loading: false });
      return;
    }

    let cancelled = false;
    setState({ byTicker: {}, loading: true });

    (async () => {
      try {
        const upper = key.split(",");
        // Build the lookup set: original tickers + suffix-stripped variants
        const variants = new Set<string>();
        for (const t of upper) {
          variants.add(t);
          const stripped = stripSuffix(t);
          if (stripped && stripped !== t) variants.add(stripped);
        }

        const { data, error } = await supabase
          .from("scores_snapshot")
          .select("ticker, snapshot_date, score, tier")
          .in("ticker", [...variants])
          .order("snapshot_date", { ascending: false })
          .limit(2000);

        if (error) throw error;

        // Keep latest row per uppercase ticker (rows already sorted desc)
        const latestBySnapshot: Record<string, { score: number | null; tier: string | null }> = {};
        for (const row of data ?? []) {
          const t = String(row.ticker).toUpperCase();
          if (!latestBySnapshot[t]) {
            latestBySnapshot[t] = {
              score: row.score == null ? null : Number(row.score),
              tier: row.tier ?? null,
            };
          }
        }

        // Map back to the requested tickers — try exact, then stripped
        const byTicker: Record<string, WatchlistScoreEntry> = {};
        for (const t of upper) {
          const hit =
            latestBySnapshot[t] ??
            latestBySnapshot[stripSuffix(t)];
          if (hit) {
            byTicker[t] = { ticker: t, total_score: hit.score, tier: hit.tier };
          }
        }

        if (cancelled) return;
        cacheRef = { key, ts: Date.now(), data: byTicker };
        setState({ byTicker, loading: false });
      } catch (err) {
        if (cancelled) return;
        console.error("[useWatchlistScores] fetch failed:", err);
        setState({ byTicker: {}, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
