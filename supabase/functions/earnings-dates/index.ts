/**
 * earnings-dates — Supabase Edge Function
 *
 * Accepts { tickers: string[] } and returns next earnings dates from Yahoo Finance.
 * Reuses the same crumb+cookie auth flow and ticker aliasing as live-prices.
 * Designed to be called monthly by an n8n workflow that populates the
 * EARNINGS_CALENDAR sheet tab.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_ALIASES: Record<string, string | null> = {
  RSW: "RSW.L", SGLD: "SGLD.L", SLVP: "SLVP.L", ONT: "ONT.L",
  ROBG: "ROBG.L", CNC: "CNC.L", "HEXA-B": "HEXA-B.ST", SIVE: "SIVE.ST",
  RHM: "RHM.DE", PRY: "PRY.MI", ALFEN: "ALFEN.AS", LYC: "LYC.AX",
  DIM: "DIM.PA", SPUT: "U-UN.TO", ALM: "ALM.MC",
  WINTON: null, RUFFER: "RICA.L", MOG: "MOG-A", "KODT.ZA": "KODT.JO",
};

interface AliasRow { ticker: string; yahoo_symbol: string | null; skip: boolean; }

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
    aliasCache = map;
    return map;
  } catch (err) {
    console.error("[earnings-dates] alias load failed:", err);
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

let crumbCache: { crumb: string; cookie: string; ts: number } | null = null;
const CRUMB_TTL_MS = 10 * 60 * 1000;

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache && Date.now() - crumbCache.ts < CRUMB_TTL_MS) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }
  try {
    const initResp = await fetch("https://fc.yahoo.com/", {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const setCookies = initResp.headers.getSetCookie?.() ?? [];
    const cookieStr = setCookies.map((c) => c.split(";")[0]).join("; ");

    const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: cookieStr,
      },
    });
    if (!crumbResp.ok) return null;
    const crumb = await crumbResp.text();
    if (!crumb || crumb.length > 50) return null;
    crumbCache = { crumb, cookie: cookieStr, ts: Date.now() };
    return { crumb, cookie: cookieStr };
  } catch (err) {
    console.error("[earnings-dates] crumb flow error:", err);
    return null;
  }
}

interface EarningsResult {
  nextEarningsDate: string | null;
  nextEarningsTimestamp: number | null;
  fiscalPeriod: string | null;
  confirmed: boolean;
}

async function fetchEarningsBatch(symbols: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (symbols.length === 0) return result;

  const auth = await getCrumb();
  if (!auth) {
    console.warn("[earnings-dates] No crumb available");
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
        console.error(`[earnings-dates] v7 batch ${resp.status}`);
        crumbCache = null;
        continue;
      }
      const data = await resp.json();
      for (const q of data?.quoteResponse?.result ?? []) {
        if (q.symbol) {
          result.set(q.symbol.toUpperCase(), q);
        }
      }
    } catch (err) {
      console.error("[earnings-dates] v7 fetch error:", err);
    }
  }
  return result;
}

function epochToIso(epoch: number | null | undefined): string | null {
  if (!epoch) return null;
  try {
    return new Date(epoch * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function deriveFiscalPeriod(q: any): string | null {
  const ts = q.earningsTimestamp ?? q.earningsTimestampStart;
  if (!ts) return null;
  const d = new Date(ts * 1000);
  const month = d.getMonth();
  const year = d.getFullYear();
  let quarter: string;
  if (month >= 0 && month <= 2) quarter = `Q4 ${year - 1}`;
  else if (month >= 3 && month <= 5) quarter = `Q1 ${year}`;
  else if (month >= 6 && month <= 8) quarter = `Q2 ${year}`;
  else quarter = `Q3 ${year}`;
  return quarter;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { tickers?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tickers = body?.tickers;
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return new Response(JSON.stringify({ error: "Body must contain non-empty 'tickers' array" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (tickers.length > 20) {
    return new Response(JSON.stringify({ error: "Max 20 tickers per request" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aliases = await loadAliases();
  const tickerToYahoo = new Map<string, string>();
  const skipped: string[] = [];

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
  const quotes = await fetchEarningsBatch(yahooSymbols);

  const yahooToInternal = new Map<string, string[]>();
  for (const [internal, yahoo] of tickerToYahoo) {
    const key = yahoo.toUpperCase();
    if (!yahooToInternal.has(key)) yahooToInternal.set(key, []);
    yahooToInternal.get(key)!.push(internal);
  }

  const earnings: Record<string, EarningsResult> = {};
  for (const [yahooSym, q] of quotes) {
    const ts = q.earningsTimestamp ?? q.earningsTimestampStart ?? null;
    const confirmed = q.earningsTimestamp != null;

    for (const internal of yahooToInternal.get(yahooSym.toUpperCase()) ?? []) {
      earnings[internal] = {
        nextEarningsDate: epochToIso(ts),
        nextEarningsTimestamp: ts ?? null,
        fiscalPeriod: deriveFiscalPeriod(q),
        confirmed,
      };
    }
  }

  const missing = yahooSymbols.filter((s) => !quotes.has(s.toUpperCase()));

  return new Response(
    JSON.stringify({
      earnings,
      skipped,
      missing,
      fetchedAt: new Date().toISOString(),
      count: Object.keys(earnings).length,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
