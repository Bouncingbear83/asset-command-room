import { supabase } from "@/integrations/supabase/client";
import type { DailyPricePoint } from "@/hooks/useDailyPrices";

/** Long-range chart windows. MAX = full history (p_days 0). */
export const LONG_RANGES = [
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1095 },
  { label: "5Y", days: 1825 },
  { label: "MAX", days: 0 },
] as const;
export type LongRangeLabel = (typeof LONG_RANGES)[number]["label"];

/** Server-bucketed series (≤500 points). priceGbp is NaN: long ranges chart local price. */
export async function fetchPriceSeries(ticker: string, days: number): Promise<DailyPricePoint[]> {
  const { data, error } = await supabase.rpc("get_price_series", { p_ticker: ticker, p_days: days, p_max_points: 500 });
  if (error) throw error;
  return (data ?? []).map((r: { date: string; close: number }) => ({ date: r.date, priceLocal: Number(r.close), priceGbp: NaN }));
}
