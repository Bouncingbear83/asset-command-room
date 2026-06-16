/**
 * live-prices  –  Supabase Edge Function
 *
 * Accepts { tickers: string[] } and returns live quotes from Yahoo Finance.
 * Reads ticker→Yahoo mappings from the `ticker_aliases` Supabase table,
 * with a hardcoded fallback for any tickers not yet in the table.
 *
 * Response: { prices: Record<string, LiveQuote>, errors: string[], fetchedAt: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Hardcoded fallback (belt-and-suspenders; table is primary) ──
const FALLBACK_ALIASES: Record<string, string | null> = {
  RSW: "RSW.L",
  SGLD: "SGLD.L",
  SLVP: "SLVP.L",
  ONT: "ONT.L",
  ROBG: "ROBG.L",
  CNC: "CNC.L",
  "HEXA-B": "HEXA-B.ST",
  SIVE: "SIVE.ST",
  RHM: "RHM.DE",
  PRY: "PRY.MI",
  ALFEN: "ALFEN.AS",
  LYC: "LYC.AX",
  DIM: "DIM.PA",
  SPUT: "U-UN.TO",
  ALM: "ALM.MC",
  WINTON: null,
  RUFFER: "RICA.L",
  MOG: "MOG-A",
  "KODT.ZA": "KODT.JO",
};

interface AliasRow {
  ticker: string;
  yahoo_symbol: string | null;
  skip: boolean;
}

interface LiveQuote {
  price: number;
  currency: string;
  marketTime: number;
  marketState: string;
  previousClose: number | null;
  changePercent: number | null;
}

// ── Load aliases from Supabase (cached per invocation) ──
let aliasCache: Map<string, { yahoo: string | null; skip: boolean }> | null = null;

async function loadAliases(): Promise<Map<string, { yahoo: string | null; skip: boolean }>> {
  if (aliasCache) return aliasCache;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const { data, error } = await sb.from("ticker_aliases").select("ticker, yahoo_symbol, skip");

  const map = new Map<string, { yahoo: string | null; skip: boolean }>();
  if (error) {
    console.error("[live-prices] Failed to load ticker_aliases:", error.message);
    // Fall through to hardcoded fallback
    return map;
  }

  for (const row of (data ?? []) as AliasRow[]) {
    map.set(row.ticker.toUpperCase(), {
      yahoo: row.yahoo_symbol,
      skip: row.skip,
    });
  }

  console.log(`[live-prices] Loaded ${map.size} aliases from table`);
  aliasCache = map;
  return map;
}

function toYahooSymbol(
  ticker: string,
  aliases: Map<string, { yahoo: string | null; skip: boolean }>,
): { symbol: string | null; skip: boolean } {
  const upper = ticker.trim().toUpperCase();

  // 1. Check Supabase table
  const row = aliases.get(upper);
  if (row) {
    if (row.skip) return { symbol: null, skip: true };
    if (row.yahoo) return { symbol: row.yahoo, skip: false };
    // yahoo_symbol is null but skip is false: try bare ticker
    return { symbol: upper, skip: false };
  }

  // 2. Check hardcoded fallback
  if (upper in FALLBACK_ALIASES) {
    const fb = FALLBACK_ALIASES[upper];
    return { symbol: fb, skip: fb === null };
  }

  // 3. If it has a dot-suffix, assume Yahoo-compatible
  if (upper.includes(".")) return { symbol: upper, skip: false };

  // 4. Bare US ticker: pass through
  return { symbol: upper, skip: false };
}

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (symbols.length === 0) return result;

  const BATCH = 50;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const joined = chunk.join(",");
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(joined)}`;

    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!resp.ok) {
        console.error(`[live-prices] Yahoo ${resp.status} ${resp.statusText}`);
        continue;
      }

      const data = await resp.json();
      const quotes = data?.quoteResponse?.result ?? [];
      for (const q of quotes) {
        if (q.symbol && typeof q.regularMarketPrice === "number") {
          result.set(q.symbol.toUpperCase(), q);
        }
      }
    } catch (err) {
      console.error("[live-prices] Yahoo fetch error:", err);
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { tickers?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tickers = body?.tickers;
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return new Response(JSON.stringify({ error: "Body must contain non-empty 'tickers' array" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (tickers.length > 200) {
    return new Response(JSON.stringify({ error: `Too many tickers: ${tickers.length} > 200` }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load aliases from Supabase table
  const aliases = await loadAliases();

  // Build mapping: internalTicker -> yahooSymbol
  const tickerToYahoo = new Map<string, string>();
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const t of tickers) {
    const raw = String(t).trim().toUpperCase();
    if (!raw) continue;
    const { symbol, skip } = toYahooSymbol(raw, aliases);
    if (skip || symbol === null) {
      skipped.push(raw);
      continue;
    }
    tickerToYahoo.set(raw, symbol);
  }

  // Fetch from Yahoo
  const yahooSymbols = [...new Set(tickerToYahoo.values())];
  const quotes = await fetchYahooQuotes(yahooSymbols);

  // Reverse-map: Yahoo symbol -> internal ticker(s)
  const yahooToInternal = new Map<string, string[]>();
  for (const [internal, yahoo] of tickerToYahoo) {
    const key = yahoo.toUpperCase();
    if (!yahooToInternal.has(key)) yahooToInternal.set(key, []);
    yahooToInternal.get(key)!.push(internal);
  }

  // Build response keyed by internal ticker
  const prices: Record<string, LiveQuote> = {};
  for (const [yahooSym, q] of quotes) {
    const internals = yahooToInternal.get(yahooSym.toUpperCase()) ?? [];
    for (const internal of internals) {
      prices[internal] = {
        price: q.regularMarketPrice,
        currency: q.currency ?? "USD",
        marketTime: q.regularMarketTime ?? 0,
        marketState: q.marketState ?? "UNKNOWN",
        previousClose: q.regularMarketPreviousClose ?? null,
        changePercent: q.regularMarketChangePercent ?? null,
      };
    }
  }

  // Log anything we sent to Yahoo but got nothing back for
  const missing = yahooSymbols.filter((s) => !quotes.has(s.toUpperCase()));
  if (missing.length > 0) {
    errors.push(`No Yahoo quote for: ${missing.join(", ")}`);
  }

  return new Response(
    JSON.stringify({
      prices,
      skipped,
      errors,
      fetchedAt: new Date().toISOString(),
      count: Object.keys(prices).length,
      aliasSource: aliases.size > 0 ? "table" : "fallback",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
