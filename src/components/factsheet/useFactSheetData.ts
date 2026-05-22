import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normaliseTicker, tickerVariants } from "@/lib/tickerAlias";
import type { PortfolioData, LiveHolding, LiveScore, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import type { PriceDataMap, DailyPricePoint } from "@/hooks/useDailyPrices";
import type { ScoreRationale, DisruptionRationale } from "@/hooks/useRationales";

export interface DisruptionRow {
  ticker: string;
  snapshot_date: string;
  disruption_score: number | null;
  sub_avail: number | null;
  economics: number | null;
  govt_support: number | null;
  demand_vuln: number | null;
  time_viability: number | null;
  status: string | null;
}

export interface ScoreHistoryRow {
  scored_at: string;
  total_score: number | null;
  action: string | null;
  change_note: string | null;
}

export interface NarrativeRow {
  id: string;
  ticker: string;
  strength: string;
  signal_class: string;
  source_table: string;
  matched_keywords: string | null;
  headline: string | null;
  url: string | null;
  snippet: string | null;
  published_date: string | null;
  review_status: string | null;
  created_at: string;
}

export interface AlertRow {
  id: number;
  ticker: string;
  alert_type: string;
  previous_status: string | null;
  new_status: string;
  trigger_value: string | null;
  threshold: string | null;
  note: string | null;
  triggered_at: string;
}

export type PriceSource = "holdings" | "daily_prices" | "watchlist_history" | "none";

export interface FactSheetData {
  ticker: string;
  canonicalTicker: string;
  loading: boolean;
  errors: Record<string, string>;
  holdings: LiveHolding[];              // could be present in multiple accounts
  score: LiveScore | null;
  watchlist: LiveWatchItem | null;
  earnings: LiveEarningsCalendarItem | null;
  rationale: ScoreRationale | null;
  rationaleHistory: ScoreHistoryRow[];
  disruption: DisruptionRationale | null;
  disruptionLatest: DisruptionRow | null;
  pricePoints: DailyPricePoint[];       // up to 180d for chart
  priceMeta: { ma20: number | null; ma50: number | null } | null;
  priceSource: PriceSource;
  priceCurrency: string | null;         // currency carried with watchlist_history rows
  narratives: NarrativeRow[];
  alerts: AlertRow[];
}

const EMPTY: FactSheetData = {
  ticker: "",
  canonicalTicker: "",
  loading: true,
  errors: {},
  holdings: [],
  score: null,
  watchlist: null,
  earnings: null,
  rationale: null,
  rationaleHistory: [],
  disruption: null,
  disruptionLatest: null,
  pricePoints: [],
  priceMeta: null,
  priceSource: "none",
  priceCurrency: null,
  narratives: [],
  alerts: [],
};


function matchTicker(a: string | null | undefined, b: string): boolean {
  return normaliseTicker(a) === normaliseTicker(b);
}

export function useFactSheetData(
  ticker: string | null,
  portfolio: PortfolioData,
  priceData: PriceDataMap,
): FactSheetData {
  const [supaState, setSupaState] = useState<{
    rationale: ScoreRationale | null;
    history: ScoreHistoryRow[];
    disruption: DisruptionRationale | null;
    disruptionLatest: DisruptionRow | null;
    pricePoints: DailyPricePoint[];
    priceSource: PriceSource;
    priceCurrency: string | null;
    narratives: NarrativeRow[];
    alerts: AlertRow[];
    loading: boolean;
    errors: Record<string, string>;
  }>({
    rationale: null, history: [], disruption: null, disruptionLatest: null,
    pricePoints: [], priceSource: "none", priceCurrency: null,
    narratives: [], alerts: [],
    loading: !!ticker, errors: {},
  });

  useEffect(() => {
    if (!ticker) {
      setSupaState({ rationale: null, history: [], disruption: null, disruptionLatest: null, pricePoints: [], priceSource: "none", priceCurrency: null, narratives: [], alerts: [], loading: false, errors: {} });
      return;
    }
    let cancelled = false;
    setSupaState((p) => ({ ...p, loading: true, errors: {} }));

    const variants = tickerVariants(ticker);
    const errors: Record<string, string> = {};

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 200);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    Promise.allSettled([
      supabase.from("score_rationales").select("*").in("ticker", variants).order("scored_at", { ascending: false }).limit(10),
      supabase.from("disruption_rationales").select("*").in("ticker", variants).order("scored_at", { ascending: false }).limit(1),
      supabase.from("disruption_snapshot").select("*").in("ticker", variants).order("snapshot_date", { ascending: false }).limit(1),
      supabase.from("daily_prices").select("snapshot_date, price_local, price_gbp").in("ticker", variants).gte("snapshot_date", cutoffStr).order("snapshot_date", { ascending: true }).limit(300),
      supabase.from("watchlist_price_history").select("snapshot_date, close_price, currency").in("ticker", variants).gte("snapshot_date", cutoffStr).order("snapshot_date", { ascending: true }).limit(300),
      supabase.from("fx_rates").select("snapshot_date, pair, rate").gte("snapshot_date", cutoffStr).order("snapshot_date", { ascending: true }).limit(1000),
      supabase.from("narrative_signals").select("id, ticker, strength, signal_class, source_table, matched_keywords, headline, url, snippet, published_date, review_status, created_at").in("ticker", variants).order("created_at", { ascending: false }).limit(5),
      supabase.from("alerts_log").select("id, ticker, alert_type, previous_status, new_status, trigger_value, threshold, note, triggered_at").in("ticker", variants).order("triggered_at", { ascending: false }).limit(5),
    ]).then((results) => {
      if (cancelled) return;
      const [rRationale, rDisruption, rDisruptionSnap, rPrices, rWlPrices, rFx, rNarr, rAlerts] = results;

      let rationale: ScoreRationale | null = null;
      let history: ScoreHistoryRow[] = [];
      if (rRationale.status === "fulfilled" && !rRationale.value.error) {
        const rows = (rRationale.value.data || []) as ScoreRationale[];
        rationale = rows[0] || null;
        history = rows.slice(0, 3).map((r) => ({
          scored_at: r.scored_at,
          total_score: r.total_score ?? null,
          action: r.action ?? null,
          change_note: r.change_note ?? null,
        }));
      } else if (rRationale.status === "fulfilled") {
        errors.rationale = rRationale.value.error?.message || "fetch failed";
      } else {
        errors.rationale = String(rRationale.reason);
      }

      let disruption: DisruptionRationale | null = null;
      if (rDisruption.status === "fulfilled" && !rDisruption.value.error) {
        disruption = ((rDisruption.value.data || [])[0] as DisruptionRationale) || null;
      } else if (rDisruption.status === "fulfilled") {
        errors.disruption = rDisruption.value.error?.message || "fetch failed";
      }

      let disruptionLatest: DisruptionRow | null = null;
      if (rDisruptionSnap.status === "fulfilled" && !rDisruptionSnap.value.error) {
        disruptionLatest = ((rDisruptionSnap.value.data || [])[0] as DisruptionRow) || null;
      }

      let pricePoints: DailyPricePoint[] = [];
      let priceSource: PriceSource = "none";
      let priceCurrency: string | null = null;
      if (rPrices.status === "fulfilled" && !rPrices.value.error) {
        pricePoints = (rPrices.value.data || []).map((r: any) => ({
          date: r.snapshot_date,
          priceLocal: Number(r.price_local),
          priceGbp: Number(r.price_gbp),
        }));
        if (pricePoints.length > 0) priceSource = "daily_prices";
      } else if (rPrices.status === "fulfilled") {
        errors.prices = rPrices.value.error?.message || "fetch failed";
      }

      // Fallback to watchlist_price_history when daily_prices has nothing.
      // Convert close_price -> GBP using fx_rates so downstream GBP metrics work.
      if (pricePoints.length === 0 && rWlPrices.status === "fulfilled" && !rWlPrices.value.error) {
        const wlRows = (rWlPrices.value.data || []) as any[];
        if (wlRows.length > 0) {
          const fxByPair = new Map<string, { date: string; rate: number }[]>();
          if (rFx.status === "fulfilled" && !rFx.value.error) {
            for (const f of (rFx.value.data || []) as any[]) {
              const arr = fxByPair.get(f.pair) || [];
              arr.push({ date: f.snapshot_date, rate: Number(f.rate) });
              fxByPair.set(f.pair, arr);
            }
          }
          const rateOn = (ccy: string, date: string): number | null => {
            const arr = fxByPair.get(`GBP${ccy}`);
            if (!arr || arr.length === 0) return null;
            let r: number | null = null;
            for (const e of arr) { if (e.date <= date) r = e.rate; else break; }
            return r ?? arr[0].rate; // carry-forward; fall back to earliest known
          };
          const toGbp = (price: number, ccy: string | null, date: string): number => {
            if (!ccy || !isFinite(price)) return NaN;
            const c = String(ccy).trim();
            const upper = c.toUpperCase();
            if (upper === "GBP") return price;
            if (upper === "GBX" || c === "GBp" || upper === "GBP_PENCE") return price / 100;
            if (!/^[A-Z]{3}$/.test(upper)) return NaN; // junk like "25000"
            const rate = rateOn(upper, date);
            if (!rate || !isFinite(rate) || rate === 0) return NaN;
            return price / rate;
          };
          pricePoints = wlRows.map((r) => ({
            date: r.snapshot_date,
            priceLocal: Number(r.close_price),
            priceGbp: toGbp(Number(r.close_price), r.currency, r.snapshot_date),
          }));
          priceSource = "watchlist_history";
          priceCurrency = wlRows[wlRows.length - 1]?.currency || null;
        }
      } else if (pricePoints.length === 0 && rWlPrices.status === "fulfilled") {
        errors.watchlistPrices = rWlPrices.value.error?.message || "fetch failed";
      }

      let narratives: NarrativeRow[] = [];
      if (rNarr.status === "fulfilled" && !rNarr.value.error) {
        narratives = (rNarr.value.data || []) as NarrativeRow[];
      } else if (rNarr.status === "fulfilled") {
        errors.narratives = rNarr.value.error?.message || "fetch failed";
      }

      let alerts: AlertRow[] = [];
      if (rAlerts.status === "fulfilled" && !rAlerts.value.error) {
        alerts = (rAlerts.value.data || []) as AlertRow[];
      } else if (rAlerts.status === "fulfilled") {
        errors.alerts = rAlerts.value.error?.message || "fetch failed";
      }

      setSupaState({ rationale, history, disruption, disruptionLatest, pricePoints, priceSource, priceCurrency, narratives, alerts, loading: false, errors });
    });

    return () => { cancelled = true; };
  }, [ticker]);


  if (!ticker) return EMPTY;

  const canonical = normaliseTicker(ticker);
  const all = [...portfolio.sipp, ...portfolio.isa, ...portfolio.bordier];
  const holdings = all.filter((h) => matchTicker(h.ticker, ticker));
  const score = portfolio.scores.find((s) => matchTicker(s.ticker, ticker)) || null;
  const watchlist = portfolio.watchlist.find((w) => matchTicker(w.ticker, ticker)) || null;
  const earnings = portfolio.earningsCalendar.find((e) => matchTicker(e.ticker, ticker)) || null;
  const priceMapEntry = priceData.get(canonical) || priceData.get(ticker.toUpperCase()) || null;

  return {
    ticker,
    canonicalTicker: canonical,
    loading: supaState.loading,
    errors: supaState.errors,
    holdings,
    score,
    watchlist,
    earnings,
    rationale: supaState.rationale,
    rationaleHistory: supaState.history,
    disruption: supaState.disruption,
    disruptionLatest: supaState.disruptionLatest,
    pricePoints: supaState.pricePoints.length > 0 ? supaState.pricePoints : (priceMapEntry?.points || []),
    priceMeta: priceMapEntry ? { ma20: priceMapEntry.ma20, ma50: priceMapEntry.ma50 } : null,
    priceSource: supaState.priceSource !== "none"
      ? supaState.priceSource
      : (priceMapEntry?.points?.length ? "daily_prices" : "none"),
    priceCurrency: supaState.priceCurrency,
    narratives: supaState.narratives,
    alerts: supaState.alerts,
  };
}

