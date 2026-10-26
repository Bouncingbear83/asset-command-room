export type Alias = { yahoo: string | null; skip: boolean };

export const FALLBACK_ALIASES: Record<string, string | null> = {
  RSW: "RSW.L", SGLD: "SGLD.L", SLVP: "SLVP.L", ONT: "ONT.L",
  ROBG: "ROBG.L", CNC: "CNC.L", "HEXA-B": "HEXA-B.ST", SIVE: "SIVE.ST",
  RHM: "RHM.DE", PRY: "PRY.MI", ALFEN: "ALFEN.AS", LYC: "LYC.AX",
  DIM: "DIM.PA", SPUT: "U-UN.TO", WINTON: null, RUFFER: "RICA.L",
  MOG: "MOG-A", "KODT.ZA": "KODT.JO",
  INR: "INR.AX", AMG: "AMG.AS", ALM: "ALM", GAM: null,
  DBMG: "DBMG.L", RICA: "RICA.L", CRPR: "CRPR.L",
};

export function currencyUnit(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  return value === "GBp" || value.toUpperCase() === "GBX" ? "GBX" : value.toUpperCase();
}

export function currenciesMatch(quote: string | undefined, sheet: string | undefined): boolean {
  return !!currencyUnit(sheet) && currencyUnit(quote) === currencyUnit(sheet);
}

export function toYahooSymbol(ticker: string, aliases: Map<string, Alias>, currency?: string): { symbol: string | null; skip: boolean } {
  const upper = ticker.trim().toUpperCase();
  const row = aliases.get(upper);
  if (row?.skip) return { symbol: null, skip: true };
  if (row?.yahoo) return { symbol: row.yahoo, skip: false };
  if (upper in FALLBACK_ALIASES) {
    const symbol = FALLBACK_ALIASES[upper];
    return { symbol, skip: symbol === null };
  }
  if (upper.includes(".") || currencyUnit(currency) === "USD") return { symbol: upper, skip: false };
  return { symbol: null, skip: true };
}