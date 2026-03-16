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
  scoreLog: "1353977523",
  monitor: "1097453724",
  disruption: "1166534580",
};

async function fetchSheet(gid: string): Promise<Record<string, any>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  const cols: string[] = json.table.cols.map((c: any) => {
    const label = (c.label as string).trim();
    if (label.length > 20) {
      const parts = label.split(/\s+/);
      return parts[parts.length - 1];
    }
    return label;
  });
  return json.table.rows
    .map((r: any) => {
      const obj: Record<string, any> = {};
      r.c?.forEach((cell: any, i: number) => {
        obj[cols[i]] = cell?.v ?? null;
      });
      return obj;
    })
    .filter((row: any) => {
      const vals = Object.values(row);
      // Keep rows with at least one non-null value and some recognizable content
      const hasContent = vals.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
      if (!hasContent) return false;
      // Check known identifier columns (flexible)
      const keys = Object.keys(row);
      const hasId = keys.some((k) => {
        const kl = k.toLowerCase();
        return (kl.includes("ticker") || kl === "name" || kl === "type") && row[k] !== null && String(row[k]).trim() !== "";
      });
      return hasId;
    });
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

function findCol(r: Record<string, any>, ...candidates: string[]): any {
  // Exact match
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null) return r[c];
  }
  // Case-insensitive match
  const keys = Object.keys(r);
  for (const c of candidates) {
    const lower = c.toLowerCase();
    const match = keys.find((k) => k.toLowerCase() === lower);
    if (match && r[match] !== undefined && r[match] !== null) return r[match];
  }
  // Partial/contains match (for mangled headers)
  for (const c of candidates) {
    const lower = c.toLowerCase();
    const match = keys.find((k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()));
    if (match && r[match] !== undefined && r[match] !== null) return r[match];
  }
  return null;
}

function parseNum(val: any): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

function parseHoldings(rows: Record<string, any>[]) {
  return rows
    .filter((r) => {
      const ticker = findCol(r, "TICKER", "ticker");
      const mvRaw = findCol(r, "MV (£)", "MV", "mv", "(£)");
      const mv = parseMv(mvRaw);
      return ticker && String(ticker).trim() !== "" && mv > 0;
    })
    .map((r) => ({
    ticker: String(findCol(r, "TICKER", "ticker") ?? ""),
    name: String(findCol(r, "NAME", "name") ?? ""),
    layer: String(findCol(r, "LAYER", "layer") ?? ""),
    mv: parseMv(findCol(r, "MV (£)", "MV", "mv", "(£)")),
    gl: parseGl(findCol(r, "G/L %", "G/L%", "gl", "G/L")),
    day: parseDay(findCol(r, "DAY %", "Day %", "day", "DAY")),
    notes: String(findCol(r, "NOTES", "notes") ?? ""),
    action: String(findCol(r, "ACTION", "action") ?? "HOLD"),
    price: parseNum(findCol(r, "PRICE_LOCAL", "price_local", "Price_Local")),
    prevClose: parseNum(findCol(r, "PREV_CLOSE_LOCAL", "prev_close_local")),
    currency: String(findCol(r, "CURRENCY", "currency") ?? "USD"),
    costGbp: parseNum(findCol(r, "COST_GBP", "cost_gbp", "Cost_GBP")),
    shares: parseNum(findCol(r, "SHARES", "shares", "Shares")),
    add_trigger: String(findCol(r, "add_trigger", "ADD_TRIGGER") ?? ""),
    exit_trigger: String(findCol(r, "exit_trigger", "EXIT_TRIGGER") ?? ""),
    ma60: parseNum(findCol(r, "MA60", "ma60", "Ma60")),
    high_52w: parseNum(findCol(r, "HIGH_52w", "HIGH_52W", "high_52w", "High_52w")),
    low_52w: parseNum(findCol(r, "LOW_52w", "LOW_52W", "low_52w", "Low_52w")),
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
  return rows
    .filter((r) => {
      const ticker = String(r["ticker"] ?? r["TICKER"] ?? "").trim();
      // Filter out section header rows (e.g. "COMPUTE LAYER", "ENERGY LAYER", "WATCHLIST — PRICE-TRIGGERED")
      if (!ticker) return false;
      if (/\bLAYER\b/i.test(ticker)) return false;
      if (/^MACRO\s+HEDGE/i.test(ticker)) return false;
      if (/^WATCHLIST/i.test(ticker)) return false;
      // Skip rows with no score AND ticker contains a space (likely a header)
      const score = r["score"] ?? r["SCORE"];
      if (score == null && ticker.includes(" ")) return false;
      return true;
    })
    .map((r) => ({
      ticker: String(r["ticker"] ?? r["TICKER"] ?? ""),
      name: String(findCol(r, "tickerName", "TICKERNAME", "name", "NAME") ?? ""),
      layer: String(findCol(r, "Layer", "layer", "LAYER") ?? ""),
      tier: String(findCol(r, "tier", "TIER") ?? ""),
      action: String(findCol(r, "action", "ACTION") ?? ""),
      score: typeof r["score"] === "number" ? r["score"] : null,
      scoreDate: r["score_date"] ?? null,
      substrate: typeof r["substrate"] === "number" ? r["substrate"] : null,
      demand: typeof r["demand"] === "number" ? r["demand"] : null,
      moat: typeof r["moat"] === "number" ? r["moat"] : null,
      valuation: typeof r["valuation"] === "number" ? r["valuation"] : null,
      mgmt: typeof r["mgmt"] === "number" ? r["mgmt"] : null,
      disruption: typeof r["disruption"] === "number" ? r["disruption"] : null,
      buyLow: typeof r["buy_low"] === "number" ? r["buy_low"] : null,
      buyHigh: typeof r["buy_high"] === "number" ? r["buy_high"] : null,
      fullThesis: String(r["full_thesis"] ?? ""),
      currency: String(r["currency"] ?? "USD"),
      changeNote: String(r["change_note"] ?? ""),
    }));
}

function parseScoreLog(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    date: r["date"] ?? r["DATE"] ?? null,
    ticker: String(r["ticker"] ?? r["TICKER"] ?? ""),
    score: typeof r["score"] === "number" ? r["score"] : null,
    substrate: typeof r["substrate"] === "number" ? r["substrate"] : null,
    demand: typeof r["demand"] === "number" ? r["demand"] : null,
    moat: typeof r["moat"] === "number" ? r["moat"] : null,
    valuation: typeof r["valuation"] === "number" ? r["valuation"] : null,
    mgmt: typeof r["mgmt"] === "number" ? r["mgmt"] : null,
    changeNote: String(r["change_note"] ?? r["CHANGE_NOTE"] ?? ""),
  }));
}

function parseMonitor(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    type: String(r["type"] ?? r["TYPE"] ?? ""),
    name: String(r["name"] ?? r["NAME"] ?? ""),
    current: r["current"] ?? r["CURRENT"] ?? null,
    unit: String(r["unit"] ?? r["UNIT"] ?? ""),
    amberThreshold: r["amber_threshold"] ?? r["AMBER_THRESHOLD"] ?? null,
    redThreshold: r["red_threshold"] ?? r["RED_THRESHOLD"] ?? null,
    status: String(r["status"] ?? r["STATUS"] ?? ""),
    lastUpdated: r["last_updated"] ?? r["LAST_UPDATED"] ?? null,
    notes: String(r["notes"] ?? r["NOTES"] ?? ""),
  }));
}


function parseDisruption(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    ticker: String(r["ticker"] ?? r["TICKER"] ?? ""),
    disruptionScore: typeof r["disruption_score"] === "number" ? r["disruption_score"] : null,
    status: String(r["status"] ?? r["STATUS"] ?? ""),
    lastChecked: r["last_checked"] ?? r["LAST_CHECKED"] ?? null,
    amberTrigger: String(r["amber_trigger"] ?? r["AMBER_TRIGGER"] ?? ""),
    redTrigger: String(r["red_trigger"] ?? r["RED_TRIGGER"] ?? ""),
    evidence: String(r["evidence"] ?? r["EVIDENCE"] ?? ""),
  }));
}

// ── Types ──────────────────────────────────────────────────────────────────

export type LiveHolding = ReturnType<typeof parseHoldings>[number];
export type LiveWatchItem = ReturnType<typeof parseWatchlist>[number];
export type LiveLayer = ReturnType<typeof parseLayers>[number];
export type LiveScore = ReturnType<typeof parseScores>[number];
export type LiveScoreLog = ReturnType<typeof parseScoreLog>[number];
export type LiveMonitor = ReturnType<typeof parseMonitor>[number];
export type LiveDisruption = ReturnType<typeof parseDisruption>[number];

export interface PortfolioData {
  sipp: LiveHolding[];
  isa: LiveHolding[];
  watchlist: LiveWatchItem[];
  layers: LiveLayer[];
  scores: LiveScore[];
  scoreLog: LiveScoreLog[];
  monitor: LiveMonitor[];
  disruption: LiveDisruption[];
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
    scoreLog: [],
    monitor: [],
    disruption: [],
    lastUpdated: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((p) => ({ ...p, loading: true, error: null }));
    try {
      const [sippRaw, isaRaw, watchRaw, layersRaw, scoresRaw, scoreLogRaw, monitorRaw, disruptionRaw] = await Promise.all([
        fetchSheet(GIDS.sipp),
        fetchSheet(GIDS.isa),
        fetchSheet(GIDS.watchlist),
        fetchSheet(GIDS.layers).catch(() => []),
        fetchSheet(GIDS.scores).catch(() => []),
        fetchSheet(GIDS.scoreLog).catch(() => []),
        fetchSheet(GIDS.monitor).catch(() => []),
        fetchSheet(GIDS.disruption).catch(() => []),
      ]);
      setState({
        sipp: parseHoldings(sippRaw),
        isa: parseHoldings(isaRaw),
        watchlist: parseWatchlist(watchRaw),
        layers: parseLayers(layersRaw),
        scores: parseScores(scoresRaw),
        scoreLog: parseScoreLog(scoreLogRaw),
        monitor: parseMonitor(monitorRaw),
        disruption: parseDisruption(disruptionRaw),
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
