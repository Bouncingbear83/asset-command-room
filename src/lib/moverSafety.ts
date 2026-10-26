// Pure cross-runtime quote contract: no server credentials or runtime dependencies.
export { currenciesMatch, currencyUnit } from "../../supabase/functions/live-prices/contract";

export type MoverPeriod = "1D" | "1W" | "1M";
export const SUSPECT_LIMITS: Record<MoverPeriod, number> = { "1D": 25, "1W": 40, "1M": 60 };
export function isSuspectMove(change: number | null, period: MoverPeriod): boolean {
  return change != null && (!Number.isFinite(change) || Math.abs(change) > SUSPECT_LIMITS[period]);
}
export function moverCurrencySymbol(currency: string): string {
  const code = currency.trim() === "GBp" ? "GBX" : currency.trim().toUpperCase();
  const symbols: Record<string, string> = { USD: "$", GBP: "£", GBX: "p", EUR: "€", JPY: "¥", AUD: "A$", CAD: "C$", NOK: "kr", SEK: "kr", CHF: "CHF" };
  return symbols[code] ?? code;
}