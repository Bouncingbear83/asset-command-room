import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DailyPricePoint {
  date: string;
  priceLocal: number;
  priceGbp: number;
}

export interface TickerPriceData {
  points: DailyPricePoint[];
  ma20: number | null;
  ma50: number | null;
  sparklineColor: "green" | "red" | "neutral";
}

export type PriceDataMap = Map<string, TickerPriceData>;

export const normaliseTicker = (t: string | null | undefined): string =>
  String(t ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

function computeMA(points: DailyPricePoint[], n: number): number | null {
  if (points.length < n) return null;
  const slice = points.slice(-n);
  return slice.reduce((s, p) => s + p.priceLocal, 0) / n;
}

function getSparklineColor(points: DailyPricePoint[]): "green" | "red" | "neutral" {
  if (points.length < 5) return "neutral";
  // Use last 30 points for sparkline
  const spark = points.slice(-30);
  if (spark.length < 5) return "neutral";
  const first = spark[0].priceGbp;
  const last = spark[spark.length - 1].priceGbp;
  if (first === 0) return "neutral";
  const pctChange = ((last - first) / first) * 100;
  if (pctChange > 0.5) return "green";
  if (pctChange < -0.5) return "red";
  return "neutral";
}

export function useDailyPrices(): { priceData: PriceDataMap; loading: boolean } {
  const [priceData, setPriceData] = useState<PriceDataMap>(new Map());
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const load = async () => {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 75);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        // Paginate past the PostgREST 1000-row cap
        const PAGE_SIZE = 1000;
        const MAX_PAGES = 10;
        const allRows: Array<{ ticker: string; snapshot_date: string; price_local: number; price_gbp: number }> = [];

        for (let page = 0; page < MAX_PAGES; page++) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          const { data, error } = await supabase
            .from("daily_prices")
            .select("ticker, snapshot_date, price_local, price_gbp")
            .gte("snapshot_date", cutoffStr)
            .order("ticker", { ascending: true })
            .order("snapshot_date", { ascending: true })
            .range(from, to);

          if (error) {
            console.error("daily_prices fetch error:", error.message);
            setLoading(false);
            return;
          }

          const batch = data || [];
          allRows.push(...batch);
          if (batch.length < PAGE_SIZE) break;
        }

        const map = new Map<string, TickerPriceData>();
        const grouped = new Map<string, DailyPricePoint[]>();

        for (const row of allRows) {
          const ticker = String(row.ticker).toUpperCase().trim();
          if (!grouped.has(ticker)) grouped.set(ticker, []);
          grouped.get(ticker)!.push({
            date: row.snapshot_date,
            priceLocal: Number(row.price_local),
            priceGbp: Number(row.price_gbp),
          });
        }

        for (const [ticker, points] of grouped) {
          map.set(ticker, {
            points,
            ma20: computeMA(points, 20),
            ma50: computeMA(points, 50),
            sparklineColor: getSparklineColor(points),
          });
        }

        setPriceData(map);
      } catch (err) {
        console.error("daily_prices fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { priceData, loading };
}
