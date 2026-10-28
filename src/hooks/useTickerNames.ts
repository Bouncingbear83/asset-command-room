import { useMemo } from "react";
import { usePortfolioOptional } from "@/data/PortfolioProvider";
import { normaliseTicker } from "@/lib/tickerAlias";
import { withNames as withNamesRaw, type NameLookup } from "@/lib/tickerName";

const warned = new Set<string>();
/** console.warn once per numeric ticker that has no company name anywhere. */
export function warnMissingName(code: string) {
  const k = code.toUpperCase();
  if (warned.has(k)) return;
  warned.add(k);
  console.warn(`[tickerName] no company name for numeric ticker ${code}`);
}

type Row = { ticker?: string; name?: string };

/** Ticker → company name from data already loaded: HOLDINGS, then SCORES, then WATCHLIST. */
export function buildTickerNames(sources: Row[][]): NameLookup {
  const m: NameLookup = new Map();
  for (const rows of sources) {
    for (const r of rows ?? []) {
      const t = normaliseTicker(r?.ticker);
      const n = String(r?.name ?? "").trim();
      if (t && n && !m.has(t)) m.set(t, n);
    }
  }
  return m;
}

const EMPTY: NameLookup = new Map();

export function useTickerNames(): NameLookup {
  const p = usePortfolioOptional();
  const holdings = p?.holdings, scores = p?.scores, watchlist = p?.watchlist, bordier = p?.bordier;
  return useMemo(() => {
    if (!holdings && !scores && !watchlist) return EMPTY;
    return buildTickerNames([
      (holdings ?? []) as Row[], (bordier ?? []) as Row[], (scores ?? []) as Row[], (watchlist ?? []) as Row[],
    ]);
  }, [holdings, bordier, scores, watchlist]);
}

export function withNames(text: string | null | undefined, names: NameLookup): string {
  return withNamesRaw(text, names, warnMissingName);
}

/** Hook form: returns a stable text-namer bound to the current name map. */
export function useWithNames(): (text: string | null | undefined) => string {
  const names = useTickerNames();
  return useMemo(() => (t: string | null | undefined) => withNames(t, names), [names]);
}
