/**
 * live-prices  –  Supabase Edge Function
 *
 * Accepts { tickers: string[] } and returns live quotes from Yahoo Finance.
 * Maps internal Stellar tickers to Yahoo symbols via an alias table.
 *
 * Response: { prices: Record<string, LiveQuote>, errors: string[], fetchedAt: string }
 *
 * Auth: accepts Supabase anon JWT (sent automatically by supabase.functions.invoke).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Alias map: internal ticker → Yahoo Finance symbol ──
const YAHOO_ALIASES: Record<string, string | null> = {
  "RSW": "RSW.L",
  "SGLD": "SGLD.L",
  "SLVP": "SLVP.L",
  "ONT": "ONT.L",
  "ROBG": "ROBG.L",
  "CNC": "CNC.L",
  "HEXA-B": "HEXA-B.ST",
  "SIVE": "SIVE.ST",
  "RHM": "RHM.DE",
  "PRY": "PRY.MI",
  "ALFEN": "ALFEN.AS",
  "LYC": "LYC.AX",
  "DIM": "DIM.PA",
  "SPUT": "U-UN.TO",
  "ALM": "ALM.MC",
  "WINTON": null,
  "RUFFER": "RICA.L",
};

interface LiveQuote {
  price: number;
  currency: string;
  marketTime: number;
  marketState: string;
  previousClose: number | null;
  changePercent: number | null;
}

function toYahooSymbol(ticker: string): string | null {
  const upper = ticker.trim().toUpperCase();
  if (upper in YAHOO_ALIASES) return YAHOO_ALIASES[upper];
  if (upper.includes(".")) return upper;
  return upper;
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
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (!resp.ok) {
        console.error(`Yahoo fetch failed: ${resp.status} ${resp.statusText}`);
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
      console.error("Yahoo fetch error:", err);
    }
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { tickers?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const tickers = body?.tickers;
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return new Response(
      JSON.stringify({ error: "Body must contain non-empty 'tickers' array" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (tickers.length > 200) {
    return new Response(
      JSON.stringify({ error: `Too many tickers: ${tickers.length} > 200` }),
      { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const tickerToYahoo = new Map<string, string>();
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const t of tickers) {
    const raw = String(t).trim().toUpperCase();
    if (!raw) continue;
    const yahoo = toYahooSymbol(raw);
    if (yahoo === null) {
      skipped.push(raw);
      continue;
    }
    tickerToYahoo.set(raw, yahoo);
  }

  const yahooSymbols = [...new Set(tickerToYahoo.values())];
  const quotes = await fetchYahooQuotes(yahooSymbols);

  const yahooToInternal = new Map<string, string[]>();
  for (const [internal, yahoo] of tickerToYahoo) {
    const key = yahoo.toUpperCase();
    if (!yahooToInternal.has(key)) yahooToInternal.set(key, []);
    yahooToInternal.get(key)!.push(internal);
  }

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
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
