/**
 * Single source of truth for live asymmetry ratios.
 *
 * Quartet: SCORES tab AK–AO (BULL_BASE, BULL_STRETCH, BEAR_THESIS_WEAK,
 *          BEAR_SUBSTRATE_FAIL, BULL_BEAR_AT_DATE).
 * Price:   HOLDINGS price_local for HELD tickers;
 *          WATCHLIST current_price for non-held.
 */

import { useMemo } from "react";
import {
  computeLiveAsymmetry,
  type AsymmetryQuartet,
  type LiveAsymmetryResult,
} from "@/lib/liveAsymmetry";
import type { LiveScore, LiveHolding, LiveWatchItem } from "@/hooks/usePortfolioData";

export interface QuartetMapEntry {
  asymmetry: LiveAsymmetryResult;
  quartet: AsymmetryQuartet;
  priceUsed: number | null;
  priceSource: "holdings" | "watchlist" | "none";
}

export function useQuartetMap(
  scores: LiveScore[],
  holdings: LiveHolding[],
  watchlist: LiveWatchItem[],
): Map<string, QuartetMapEntry> {
  return useMemo(() => {
    const map = new Map<string, QuartetMapEntry>();

    const holdingPriceByTicker = new Map<string, number>();
    for (const h of holdings) {
      const t = String(h.ticker ?? "").trim().toUpperCase();
      if (t && h.price != null && h.price > 0) {
        if (!holdingPriceByTicker.has(t)) holdingPriceByTicker.set(t, h.price);
      }
    }

    const watchlistPriceByTicker = new Map<string, number | null>();
    for (const w of watchlist) {
      const t = String(w.ticker ?? "").trim().toUpperCase();
      if (t && !watchlistPriceByTicker.has(t)) {
        watchlistPriceByTicker.set(t, w.current);
      }
    }

    for (const s of scores) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (!t) continue;

      const quartet: AsymmetryQuartet = {
        bullBase: s.bullBase ?? null,
        bullStretch: s.bullStretch ?? null,
        bearThesisWeak: s.bearThesisWeak ?? null,
        bearSubstrateFail: s.bearSubstrateFail ?? null,
        bullBearAtDate: s.bullBearAtDate ?? null,
      };

      const isHeld = String(s.heldStatus ?? "").trim().toUpperCase() === "HELD";
      let priceUsed: number | null = null;
      let priceSource: QuartetMapEntry["priceSource"] = "none";

      if (isHeld) {
        const hp = holdingPriceByTicker.get(t);
        if (hp != null && hp > 0) {
          priceUsed = hp;
          priceSource = "holdings";
        }
      }
      if (priceUsed === null) {
        const wp = watchlistPriceByTicker.get(t);
        if (wp != null && wp > 0) {
          priceUsed = wp;
          priceSource = "watchlist";
        }
      }

      map.set(t, {
        asymmetry: computeLiveAsymmetry(quartet, priceUsed),
        quartet,
        priceUsed,
        priceSource,
      });
    }

    return map;
  }, [scores, holdings, watchlist]);
}

export function lookupQuartet(
  map: Map<string, QuartetMapEntry>,
  ticker: string | null | undefined,
): QuartetMapEntry | null {
  if (!ticker) return null;
  return map.get(ticker.trim().toUpperCase()) ?? null;
}
