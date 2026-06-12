/**
 * Single source of truth for live asymmetry ratios.
 *
 * Quartet (preferred order):
 *   1. Supabase `scores_snapshot` (passed via `snapshotMap`)
 *   2. SCORES sheet AK-AO (from `scores` array)
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
import type { QuartetSnapshotRow } from "@/hooks/useScoresSnapshot";

export interface QuartetMapEntry {
  asymmetry: LiveAsymmetryResult;
  quartet: AsymmetryQuartet;
  priceUsed: number | null;
  priceSource: "holdings" | "watchlist" | "none";
  quartetSource: "snapshot" | "sheet" | "none";
}

export function useQuartetMap(
  scores: LiveScore[],
  holdings: LiveHolding[],
  watchlist: LiveWatchItem[],
  snapshotMap?: Map<string, QuartetSnapshotRow>,
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

    // Collect all tickers we need to consider: scores + snapshot
    const allTickers = new Set<string>();
    for (const s of scores) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (t) allTickers.add(t);
    }
    if (snapshotMap) {
      for (const t of snapshotMap.keys()) allTickers.add(t);
    }

    // Build a lookup for sheet scores
    const sheetScoreByTicker = new Map<string, LiveScore>();
    for (const s of scores) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (t && !sheetScoreByTicker.has(t)) sheetScoreByTicker.set(t, s);
    }

    for (const t of allTickers) {
      const sheetScore = sheetScoreByTicker.get(t);
      const snap = snapshotMap?.get(t);

      // Prefer snapshot quartet; fall back to sheet field-by-field
      const quartet: AsymmetryQuartet = {
        bullBase: snap?.bull_base ?? sheetScore?.bullBase ?? null,
        bullStretch: snap?.bull_stretch ?? sheetScore?.bullStretch ?? null,
        bearThesisWeak: snap?.bear_thesis_weak ?? sheetScore?.bearThesisWeak ?? null,
        bearSubstrateFail: snap?.bear_substrate_fail ?? sheetScore?.bearSubstrateFail ?? null,
        bullBearAtDate: snap?.bull_bear_at_date ?? sheetScore?.bullBearAtDate ?? null,
      };

      const hasSnapshotQuartet = snap && (
        snap.bull_base != null || snap.bull_stretch != null ||
        snap.bear_thesis_weak != null || snap.bear_substrate_fail != null
      );
      const hasSheetQuartet = sheetScore && (
        sheetScore.bullBase != null || sheetScore.bullStretch != null ||
        sheetScore.bearThesisWeak != null || sheetScore.bearSubstrateFail != null
      );
      const quartetSource: QuartetMapEntry["quartetSource"] =
        hasSnapshotQuartet ? "snapshot" : hasSheetQuartet ? "sheet" : "none";

      const isHeld = String(sheetScore?.heldStatus ?? "").trim().toUpperCase() === "HELD";
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
        quartetSource,
      });
    }

    return map;
  }, [scores, holdings, watchlist, snapshotMap]);
}

export function lookupQuartet(
  map: Map<string, QuartetMapEntry>,
  ticker: string | null | undefined,
): QuartetMapEntry | null {
  if (!ticker) return null;
  return map.get(ticker.trim().toUpperCase()) ?? null;
}
