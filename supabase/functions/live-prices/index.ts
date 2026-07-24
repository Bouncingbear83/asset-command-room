/**
 * live-prices  –  Supabase Edge Function
 *
 * Accepts { tickers: string[] } and returns live quotes from Yahoo Finance.
 * Uses crumb+cookie auth flow for the v7/finance/quote batch endpoint.
 * Falls back to per-symbol v8/finance/chart if crumb flow fails.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

// ── Alias loading ──
let aliasCache: Map<string, { yahoo: string | null; skip: boolean }> | null = null;

async function loadAliases(): Promise<Map<string, { yahoo: string | null; skip: boolean }>> {
  if (aliasCache) return aliasCache;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.from("ticker_aliases").select("ticker, yahoo_symbol, skip");
    if (error) throw error;
    const map = new Map<string, { yahoo: string | null; skip: boolean }>();
    for (const row of (data ?? []) as AliasRow[]) {
      map.set(row.ticker.toUpperCase(), { yahoo: row.yahoo_symbol, skip: row.skip });
    }
    console.log(`[live-prices] Loaded ${map.size} aliases from table`);
    aliasCache = map;
    return map;
  } catch (err) {
    console.error("[live-prices] alias load failed:", err);
    return new Map();
  }
}

function toYahooSymbol(
  ticker: string,
  aliases: Map<string, { yahoo: string | null; skip: boolean }>,
): { symbol: string | null; skip: boolean } {
  const upper = ticker.trim().toUpperCase();
  const row = aliases.get(upper);
  if (row) {
    if (row.skip) return { symbol: null, skip: true };
    if (row.yahoo) return { symbol: row.yahoo, skip: false };
    return { symbol: upper, skip: false };
  }
  if (upper in FALLBACK_ALIASES) {
    const fb = FALLBACK_ALIASES[upper];
    return { symbol: fb, skip: fb === null };
  }
  if (upper.includes(".")) return { symbol: upper, skip: false };
  return { symbol: upper, skip: false };
}

// ── Yahoo crumb + cookie auth ──
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null;
const CRUMB_TTL_MS = 10 * 60 * 1000; // 10 min

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache && Date.now() - crumbCache.ts < CRUMB_TTL_MS) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }
  try {
    // Step 1: hit fc.yahoo.com to get cookies
    const initResp = await fetch("https://fc.yahoo.com/", {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const setCookies = initResp.headers.getSetCookie?.() ?? [];
    const cookieStr = setCookies.map((c) => c.split(";")[0]).join("; ");

    // Step 2: get crumb
    const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: cookieStr,
      },
    });
    if (!crumbResp.ok) {
      console.error(`[live-prices] crumb fetch failed: ${crumbResp.status}`);
      return null;
    }
    const crumb = await crumbResp.text();
    if (!crumb || crumb.length > 50) {
      console.error("[live-prices] invalid crumb:", crumb.slice(0, 100));
      return null;
    }
    console.log(`[live-prices] crumb obtained: ${crumb.slice(0, 8)}...`);
    crumbCache = { crumb, cookie: cookieStr, ts: Date.now() };
    return { crumb, cookie: cookieStr };
  } catch (err) {
    console.error("[live-prices] crumb flow error:", err);
    return null;
  }
}

// ── Primary: v7 batch with crumb ──
async function fetchV7Batch(symbols: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (symbols.length === 0) return result;

  const auth = await getCrumb();
  if (!auth) {
    console.warn("[live-prices] No crumb, falling back to v8/chart");
    return result;
  }

  const BATCH = 50;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const joined = chunk.join(",");
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(joined)}&crumb=${encodeURIComponent(auth.crumb)}`;
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Cookie: auth.cookie,
        },
      });
      if (!resp.ok) {
        console.error(`[live-prices] v7 batch ${resp.status}: ${await resp.text().catch(() => "")}`);
        crumbCache = null; // invalidate stale crumb
        continue;
      }
      const data = await resp.json();
      for (const q of data?.quoteResponse?.result ?? []) {
        if (q.symbol && typeof q.regularMarketPrice === "number") {
          result.set(q.symbol.toUpperCase(), q);
        }
      }
    } catch (err) {
      console.error("[live-prices] v7 fetch error:", err);
    }
  }
  return result;
}

// ── Fallback: v8/chart per symbol (no crumb needed) ──
async function fetchV8Chart(symbols: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (symbols.length === 0) return result;

  const fetchOne = async (sym: string) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && typeof meta.regularMarketPrice === "number") {
        result.set(sym.toUpperCase(), {
          symbol: sym.toUpperCase(),
          regularMarketPrice: meta.regularMarketPrice,
          currency: meta.currency ?? "USD",
          regularMarketTime: meta.regularMarketTime ?? 0,
          marketState: meta.marketState ?? "UNKNOWN",
          regularMarketPreviousClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
          regularMarketChangePercent: meta.previousClose
            ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
            : null,
        });
      }
    } catch (err) {
      console.error(`[live-prices] v8 chart ${sym}:`, err);
    }
  };

  // Parallel with concurrency limit of 10
  const CONCURRENCY = 10;
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    await Promise.all(symbols.slice(i, i + CONCURRENCY).map(fetchOne));
  }
  return result;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
  if (tickers.length > 20) {
    return new Response(JSON.stringify({ error: "Max 20 tickers per request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aliases = await loadAliases();
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

  const yahooSymbols = [...new Set(tickerToYahoo.values())];

  // Try v7 batch first, fall back to v8 chart
  let quotes = await fetchV7Batch(yahooSymbols);
  let source = "v7_batch";
  if (quotes.size === 0 && yahooSymbols.length > 0) {
    console.log(`[live-prices] v7 returned 0, falling back to v8/chart for ${yahooSymbols.length} symbols`);
    quotes = await fetchV8Chart(yahooSymbols);
    source = "v8_chart_fallback";
  }

  // Reverse-map
  const yahooToInternal = new Map<string, string[]>();
  for (const [internal, yahoo] of tickerToYahoo) {
    const key = yahoo.toUpperCase();
    if (!yahooToInternal.has(key)) yahooToInternal.set(key, []);
    yahooToInternal.get(key)!.push(internal);
  }

  const prices: Record<string, LiveQuote> = {};
  for (const [yahooSym, q] of quotes) {
    for (const internal of yahooToInternal.get(yahooSym.toUpperCase()) ?? []) {
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
  if (missing.length > 0) errors.push(`No quote for: ${missing.join(", ")}`);

  return new Response(
    JSON.stringify({
      prices,
      skipped,
      errors,
      fetchedAt: new Date().toISOString(),
      count: Object.keys(prices).length,
      source,
      aliasSource: aliases.size > 0 ? "table" : "fallback",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
