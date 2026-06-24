import { useMemo } from "react";
import type { LiveHolding, LiveScore, LiveWatchItem } from "@/hooks/usePortfolioData";
import { useScoresSnapshot, type QuartetSnapshotRow } from "@/hooks/useScoresSnapshot";
import { computeIrrBb, type IrrBbResult } from "@/lib/computeIrrBb";
import { normaliseTicker } from "@/lib/tickerAlias";

export interface IrrBbEntry {
  ticker: string;
  name: string;
  result: IrrBbResult;
  score: number | null;
  held: boolean;
  layer: string;
}

/** Regex for numeric-prefix tickers (Japanese: 4175.T, 6268.T etc.) */
export const IS_NUMERIC_TICKER = /^\d{3,5}\.[A-Z]{1,2}$/;

interface UseIrrBbReturn {
  /** IRR-BB results keyed by normalised uppercase ticker. */
  byTicker: Map<string, IrrBbEntry>;
  /** Ticker → company name map (all sources). */
  nameMap: Map<string, string>;
  /** Sorted array: descending by IRR-BB, nulls last. */
  ranked: IrrBbEntry[];
  /** True if ALL bb_target_dates are null (bootstrap state). */
  isBootstrap: boolean;
  loading: boolean;
}

export function useIrrBb(
  scores: LiveScore[],
  holdings: LiveHolding[],
  watchlist: LiveWatchItem[],
): UseIrrBbReturn {
  const { byTicker: snapshotMap, loading: snapLoading } = useScoresSnapshot();

  return useMemo(() => {
    // 1. Build name map (score → holding → watchlist, first non-empty wins)
    const nameMap = new Map<string, string>();
    for (const s of scores) {
      const t = normaliseTicker(s.ticker);
      if (t && s.name && !nameMap.has(t)) nameMap.set(t, s.name);
    }
    for (const h of holdings) {
      const t = normaliseTicker(h.ticker);
      if (t && h.name && !nameMap.has(t)) nameMap.set(t, h.name);
    }
    for (const w of watchlist) {
      const t = normaliseTicker(w.ticker);
      if (t && w.name && !nameMap.has(t)) nameMap.set(t, w.name);
    }

    // 2. Build held set + live price map
    const heldSet = new Set<string>();
    const priceMap = new Map<string, number>();
    for (const h of holdings) {
      const t = normaliseTicker(h.ticker);
      if (!t) continue;
      heldSet.add(t);
      if (h.price > 0 && !priceMap.has(t)) priceMap.set(t, h.price);
    }
    for (const w of watchlist) {
      const t = normaliseTicker(w.ticker);
      if (!t) continue;
      const p = typeof w.current === "number" && w.current > 0 ? w.current : null;
      if (p && !priceMap.has(t)) priceMap.set(t, p);
    }

    // 3. Build score lookup (for score value, priceAtLastScore, layer, and fallback bb fields)
    const scoreMap = new Map<string, LiveScore>();
    for (const s of scores) {
      const t = normaliseTicker(s.ticker);
      if (t && !scoreMap.has(t)) scoreMap.set(t, s);
    }

    // 4. Detect bootstrap: check if ANY snapshot row has bb_target_date
    let hasAnyBbDate = false;
    for (const snap of snapshotMap.values()) {
      if (snap.bb_target_date) { hasAnyBbDate = true; break; }
    }

    // 5. Compute IRR-BB for every scored name
    const byTicker = new Map<string, IrrBbEntry>();
    for (const s of scores) {
      const t = normaliseTicker(s.ticker);
      if (!t) continue;
      if (byTicker.has(t)) continue;

      const snap = snapshotMap.get(t);
      const livePrice = priceMap.get(t) ?? null;
      const isHeld = heldSet.has(t);

      // Resolve bb_target_date: prefer Supabase snapshot, fallback to sheet
      const bbTargetDate = snap?.bb_target_date
        || (s as any).bbTargetDate  // from parseScores extension
        || null;

      // Resolve div_yield: prefer Supabase, fallback to sheet
      const divYield = snap?.div_yield
        ?? (s as any).divYield  // from parseScores extension
        ?? null;

      // Resolve bull_base: prefer Supabase, fallback to sheet
      const bullBase = snap?.bull_base ?? s.bullBase ?? null;

      const result = computeIrrBb(
        bullBase,
        livePrice,
        bbTargetDate,
        divYield,
        s.priceAtLastScore ?? null,
        isHeld,
      );

      byTicker.set(t, {
        ticker: s.ticker || t,
        name: nameMap.get(t) || "",
        result,
        score: s.score,
        held: isHeld,
        layer: s.layer || "",
      });
    }

    // 6. Build ranked array (descending IRR-BB, nulls last)
    const ranked = Array.from(byTicker.values()).sort((a, b) => {
      const aIrr = a.result.irrBb;
      const bIrr = b.result.irrBb;
      if (aIrr === null && bIrr === null) return 0;
      if (aIrr === null) return 1;
      if (bIrr === null) return -1;
      return bIrr - aIrr;
    });

    return {
      byTicker,
      nameMap,
      ranked,
      isBootstrap: !hasAnyBbDate && snapshotMap.size > 0,
      loading: snapLoading,
    };
  }, [scores, holdings, watchlist, snapshotMap, snapLoading]);
}
