import { useState, useEffect, useCallback } from "react";

const SHEET_ID = "1T2afEG3mLjxmonduDugHA5SlJ44-RBJmv0bxISfalNo";

export const GIDS = {
  sipp: "2109415850",
  isa: "408093485",
  watchlist: "496665408",
  layers: "547494965",
  scores: "1674996535",
  prices: "542365971",
  cash: "356224071",
  cashflow: "1642346013",
};

async function fetchSheet(gid: string): Promise<Record<string, any>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  const cols: string[] = json.table.cols.map((c: any) => c.label as string);
  return json.table.rows
    .map((r: any) => {
      const obj: Record<string, any> = {};
      r.c?.forEach((cell: any, i: number) => {
        obj[cols[i]] = cell?.v ?? null;
      });
      return obj;
    })
    .filter((row: any) => row["ticker"] || row["TICKER"] || row["NAME"] || row["name"]);
}

// ── Parsers ────────────────────────────────────────────────────────────────

function parseMv(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[£,\s]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return 0;
}

function parseGl(val: any): number {
  if (typeof val === "number") return val * 100;
  if (typeof val === "string") {
    const cleaned = val.replace(/[%+,\s]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return 0;
}

function parseDay(val: any): number {
  if (typeof val === "number") return val * 100;
  if (typeof val === "string") {
    const cleaned = val.replace(/[%+,\s]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return 0;
}

function parseHoldings(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    ticker: String(r["TICKER"] ?? ""),
    name: String(r["NAME"] ?? ""),
    layer: String(r["LAYER"] ?? ""),
    mv: parseMv(r["MV (£)"]),
    gl: parseGl(r["G/L %"]),
    day: parseDay(r["DAY %"] ?? r["Day %"]),
    notes: String(r["NOTES"] ?? ""),
    action: String(r["ACTION"] ?? "HOLD"),
    price: typeof r["PRICE_LOCAL"] === "number" ? r["PRICE_LOCAL"] : null,
    prevClose: typeof r["PREV_CLOSE_LOCAL"] === "number" ? r["PREV_CLOSE_LOCAL"] : null,
    currency: String(r["CURRENCY"] ?? "USD"),
    costGbp: typeof r["COST_GBP"] === "number" ? r["COST_GBP"] : null,
    shares: typeof r["SHARES"] === "number" ? r["SHARES"] : null,
  }));
}

function parseWatchlist(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    name: String(r["NAME"] ?? ""),
    ticker: String(r["TICKER"] ?? ""),
    layer: String(r["LAYER"] ?? ""),
    entry: String(r["ENTRY TARGET"] ?? ""),
    current: r["CURRENT PRICE"] ?? null,
    trigger: String(r["TRIGGER CONDITION"] ?? ""),
    rationale: String(r["THESIS / RATIONALE"] ?? ""),
    status: String(r["STATUS"] ?? "WATCH"),
  }));
}

function parseLayers(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    name: String(r["LAYER"] ?? r["NAME"] ?? r["layer"] ?? r["name"] ?? ""),
    target:
      typeof r["TARGET %"] === "number" ? r["TARGET %"] * 100 : typeof r["target"] === "number" ? r["target"] * 100 : 0,
    current:
      typeof r["CURRENT %"] === "number"
        ? r["CURRENT %"] * 100
        : typeof r["current"] === "number"
          ? r["current"] * 100
          : 0,
    mv: typeof r["MV (£)"] === "number" ? r["MV (£)"] : 0,
  }));
}

function parseScores(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    ticker: String(r["ticker"] ?? r["TICKER"] ?? ""),
    score: typeof r["score"] === "number" ? r["score"] : null,
    scoreDate: r["score_date"] ?? null,
    substrate: typeof r["substrate"] === "number" ? r["substrate"] : null,
    demand: typeof r["demand"] === "number" ? r["demand"] : null,
    moat: typeof r["moat"] === "number" ? r["moat"] : null,
    valuation: typeof r["valuation"] === "number" ? r["valuation"] : null,
    mgmt: typeof r["mgmt"] === "number" ? r["mgmt"] : null,
    buyLow: typeof r["buy_low"] === "number" ? r["buy_low"] : null,
    buyHigh: typeof r["buy_high"] === "number" ? r["buy_high"] : null,
    fullThesis: String(r["full_thesis"] ?? ""),
    currency: String(r["currency"] ?? "USD"),
    changeNote: String(r["change_note"] ?? ""),
  }));
}

// ── Types ──────────────────────────────────────────────────────────────────

export type LiveHolding = ReturnType<typeof parseHoldings>[number];
export type LiveWatchItem = ReturnType<typeof parseWatchlist>[number];
export type LiveLayer = ReturnType<typeof parseLayers>[number];
export type LiveScore = ReturnType<typeof parseScores>[number];

export interface PortfolioData {
  sipp: LiveHolding[];
  isa: LiveHolding[];
  watchlist: LiveWatchItem[];
  layers: LiveLayer[];
  scores: LiveScore[];
  lastUpdated: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePortfolioData(): PortfolioData {
  const [state, setState] = useState<Omit<PortfolioData, "refresh">>({
    sipp: [],
    isa: [],
    watchlist: [],
    layers: [],
    scores: [],
    lastUpdated: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((p) => ({ ...p, loading: true, error: null }));
    try {
      const [sippRaw, isaRaw, watchRaw, layersRaw, scoresRaw] = await Promise.all([
        fetchSheet(GIDS.sipp),
        fetchSheet(GIDS.isa),
        fetchSheet(GIDS.watchlist),
        fetchSheet(GIDS.layers).catch(() => []),
        fetchSheet(GIDS.scores).catch(() => []),
      ]);
      setState({
        sipp: parseHoldings(sippRaw),
        isa: parseHoldings(isaRaw),
        watchlist: parseWatchlist(watchRaw),
        layers: parseLayers(layersRaw),
        scores: parseScores(scoresRaw),
        lastUpdated: new Date().toLocaleTimeString("en-GB"),
        loading: false,
        error: null,
      });
    } catch (e: any) {
      setState((p) => ({
        ...p,
        loading: false,
        error: `Sheet unreachable — static snapshot. (${e.message})`,
      }));
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { ...state, refresh: load };
}
