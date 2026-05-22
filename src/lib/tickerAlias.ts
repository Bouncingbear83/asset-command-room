// Ticker normalisation and alias resolution for cross-source joins.
// Sheets, Supabase, and live price feeds occasionally drift on a handful of
// names (Berkshire share-class, Google split tickers, etc.). One canonical
// form lets us match without losing the original sheet display value.

export const TICKER_ALIASES: Record<string, string> = {
  "BRK-B": "BRK.B",
  "BRK.B": "BRK.B",
  "BRKB": "BRK.B",
  "BF-B": "BF.B",
  "BF.B": "BF.B",
  "GOOG": "GOOGL",
  "GOOGL": "GOOGL",
};

export function normaliseTicker(raw: string | null | undefined): string {
  const s = String(raw ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
  return TICKER_ALIASES[s] ?? s;
}

/** Variants to try when querying Supabase (covers . / - drift). */
export function tickerVariants(raw: string): string[] {
  const canonical = normaliseTicker(raw);
  const variants = new Set<string>([canonical, raw.toUpperCase().trim()]);
  if (canonical.includes(".")) variants.add(canonical.replace(/\./g, "-"));
  if (canonical.includes("-")) variants.add(canonical.replace(/-/g, "."));
  return Array.from(variants).filter(Boolean);
}
