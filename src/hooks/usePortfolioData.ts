import { useState, useEffect, useCallback } from "react";

const SHEET_ID = "1T2afEG3mLjxmonduDugHA5SlJmv0bxISfalNo";

export const GIDS = {
  holdings: "408093485",
  watchlist: "496665408",
  layers: "547494965",
  scores: "1674996535",
  prices: "542365971",
  cash: "356224071",
  cashflow: "1642346013",
  scoreLog: "1353977523",
  monitor: "1097453724",
  disruption: "1166534580",
  performance: "7099973",
  narrative: "457911094",
  macroState: "448795117",
};

const KNOWN_COLS = [
  "ticker","name","layer","score","score_date","substrate","demand","moat",
  "valuation","mgmt","disruption","buy_low","buy_high","full_thesis",
  "currency","tier","action","change_note","mv","account","aum_pct",
  "g/l","day","shares","price_local","prev_close_local","cost_gbp",
  "cost_local","ccy_val","code_gf","code_ft","prefix","ma60","high_52w",
  "low_52w","add_trigger","exit_trigger","notes","disruption_score",
  "sub_avail","economics","govt_support","demand_vuln","time_viability",
  "status","last_checked","amber_trigger","red_trigger","evidence",
  "row_type","type","current","unit","amber_threshold","red_threshold",
  "last_updated","target","entry target","current price","trigger condition",
  "thesis / rationale","hex color","key holdings","gap / notes","priority",
  "target %","current %","%_below_52w_high","%_above_52w_low",
  "tickername","mv (£)","g/l %","day %","date","sipp_mv","isa_mv",
  "total_mv","cash_sipp","cash_isa","total_cash","total_sipp","total_isa",
  "total_value","deposits_in_period_sipp","deposits_in_period_isa",
  "deposits_in_period_total","sub_period_rtn_sipp","sub_period_rtn_isa",
  "sub_period_rtn_total","cumulative_twr_sipp","cumulative_twr_isa",
  "cumulative_twr_total","note","trigger_price_add","trigger_price_exit",
  "alert_status","alert_fired_date","key","value","section","category",
  "detail","description","threshold","rule","label","metric",
];

function normalizeToken(value: any): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stringifyValue(value: any): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function populatedCount(row: Record<string, any>) {
  return Object.values(row).filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
}

async function fetchSheet(gid: string): Promise<Record<string, any>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  const cols: string[] = json.table.cols.map((c: any) => {
    const label = (c.label as string).trim();
    if (!label.includes(" ")) return label;
    const labelLower = label.toLowerCase();
    const matches = KNOWN_COLS
      .map((k) => ({ k, pos: labelLower.indexOf(k.toLowerCase()) }))
      .filter((m) => m.pos >= 0)
      .sort((a, b) => a.pos - b.pos || b.k.length - a.k.length);
    if (matches.length > 0) return matches[0].k;
    const parts = label.split(/\s+/);
    return parts[parts.length - 1];
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
      const values = Object.values(row);
      const count = populatedCount(row);
      const hasContent = values.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
      if (!hasContent) return false;
      const rowType = row["row_type"] ?? row["Row_Type"] ?? row["ROW_TYPE"];
      if (rowType !== null && rowType !== undefined) return true;
      const keys = Object.keys(row);
      const hasId = keys.some((k) => {
        const kl = k.toLowerCase();
        return (
          (kl.includes("ticker") || kl === "name" || kl === "type" || kl === "date" || kl === "layer" || kl === "key") &&
          row[k] !== null &&
          String(row[k]).trim() !== ""
        );
      });
      return hasId || count >= 3;
    });
}

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
  for (const c of candidates) {
    if (r[c] !== undefined && r[c] !== null) return r[c];
  }
  const keys = Object.keys(r);
  for (const c of candidates) {
    const lower = c.toLowerCase();
    const match = keys.find((k) => k.toLowerCase() === lower);
    if (match && r[match] !== undefined && r[match] !== null) return r[match];
  }
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
      account: String(findCol(r, "Account", "account", "ACCOUNT") ?? ""),
      mv: parseMv(findCol(r, "MV (£)", "mv (£)", "MV", "mv", "(£)")),
      gl: parseGl(findCol(r, "G/L %", "g/l %", "G/L%", "gl", "G/L")),
      day: parseDay(findCol(r, "DAY %", "day %", "Day %", "day", "DAY")),
      notes: String(findCol(r, "NOTES", "notes") ?? ""),
      action: String(findCol(r, "ACTION", "action") ?? "HOLD"),
      price: parseNum(findCol(r, "PRICE_LOCAL", "price_local", "Price_Local")),
      prevClose: parseNum(findCol(r, "PREV_CLOSE_LOCAL", "prev_close_local")),
      currency: String(findCol(r, "CURRENCY", "currency") ?? "USD"),
      costGbp: parseNum(findCol(r, "COST_GBP", "cost_gbp", "Cost_GBP")),
      shares: parseNum(findCol(r, "SHARES", "shares", "Shares")),
      add_trigger: String(findCol(r, "add_trigger", "ADD_TRIGGER") ?? ""),
      exit_trigger: String(findCol(r, "exit_trigger", "EXIT_TRIGGER") ?? ""),
      trigger_price_add: String(findCol(r, "trigger_price_add", "TRIGGER_PRICE_ADD") ?? ""),
      alert_status: String(findCol(r, "alert_status", "ALERT_STATUS") ?? ""),
      ma60: parseNum(findCol(r, "MA60", "ma60", "Ma60")),
      high_52w: parseNum(findCol(r, "HIGH_52w", "HIGH_52W", "high_52w", "High_52w")),
      low_52w: parseNum(findCol(r, "LOW_52w", "LOW_52W", "low_52w", "Low_52w")),
    }));
}

function parseWatchlist(rows: Record<string, any>[]) {
  return rows.map((r) => ({
    name: String(findCol(r, "name", "NAME", "Name") ?? ""),
    ticker: String(findCol(r, "ticker", "TICKER", "Ticker") ?? ""),
    layer: String(findCol(r, "layer", "LAYER", "Layer") ?? ""),
    entry: String(findCol(r, "entry target", "ENTRY TARGET", "Entry Target") ?? ""),
    current: findCol(r, "current price", "CURRENT PRICE", "Current Price") ?? null,
    trigger: String(findCol(r, "trigger condition", "TRIGGER CONDITION", "Trigger Condition") ?? ""),
    rationale: String(findCol(r, "thesis / rationale", "THESIS / RATIONALE", "Thesis / Rationale") ?? ""),
    status: String(findCol(r, "status", "STATUS", "Status") ?? "WATCH"),
  }));
}

function parseLayers(rows: Record<string, any>[]) {
  return rows.map((r) => {
    const targetRaw = findCol(r, "target %", "TARGET %", "target");
    const currentRaw = findCol(r, "current %", "CURRENT %", "current");
    return {
      name: String(findCol(r, "layer", "LAYER", "name", "NAME") ?? ""),
      target: typeof targetRaw === "number" ? targetRaw * 100 : 0,
      current: typeof currentRaw === "number" ? currentRaw * 100 : 0,
      mv: parseMv(findCol(r, "mv (£)", "MV (£)", "mv", "MV")),
      hexColor: String(findCol(r, "hex color", "Hex Color", "hex_color") ?? ""),
      keyHoldings: String(findCol(r, "key holdings", "Key Holdings", "key_holdings") ?? ""),
      gapNotes: String(findCol(r, "gap / notes", "Gap / Notes", "gap_notes") ?? ""),
      priority: String(findCol(r, "priority", "Priority", "PRIORITY") ?? ""),
    };
  });
}

function parseScores(rows: Record<string, any>[]) {
  return rows
    .filter((r) => {
      const rowType = findCol(r, "row_type", "Row_Type", "ROW_TYPE");
      if (rowType) {
        const rt = String(rowType).trim().toLowerCase();
        return rt === "data" || rt === "watchlist";
      }
      const ticker = String(findCol(r, "ticker", "TICKER") ?? "").trim();
      return ticker !== "" && !ticker.includes(" ");
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
      rowType: String(findCol(r, "row_type", "Row_Type", "ROW_TYPE") ?? "data").trim().toLowerCase(),
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
    type: normalizeToken(findCol(r, "type", "TYPE", "category", "CATEGORY", "section", "SECTION") ?? ""),
    name: String(findCol(r, "name", "NAME", "key", "KEY", "metric", "METRIC") ?? ""),
    current: findCol(r, "current", "CURRENT", "value", "VALUE") ?? null,
    unit: String(findCol(r, "unit", "UNIT") ?? ""),
    amberThreshold: findCol(r, "amber_threshold", "AMBER_THRESHOLD") ?? null,
    redThreshold: findCol(r, "red_threshold", "RED_THRESHOLD") ?? null,
    status: String(findCol(r, "status", "STATUS") ?? ""),
    lastUpdated: findCol(r, "last_updated", "LAST_UPDATED"),
    notes: String(findCol(r, "notes", "NOTES", "detail", "DETAIL", "evidence", "EVIDENCE") ?? ""),
  }));
}

function parseDisruption(rows: Record<string, any>[]) {
  return rows
    .filter((r) => {
      const rowType = findCol(r, "row_type", "Row_Type", "ROW_TYPE");
      if (rowType) {
        const rt = String(rowType).trim().toLowerCase();
        return rt === "data" || rt === "watchlist";
      }
      const ticker = findCol(r, "ticker", "TICKER");
      return ticker && String(ticker).trim() !== "" && !String(ticker).includes("LAYER") && !String(ticker).includes("HOLDINGS") && !String(ticker).includes("WATCHLIST") && !String(ticker).includes("HEDGE");
    })
    .map((r) => ({
      ticker: String(findCol(r, "ticker", "TICKER") ?? ""),
      name: String(findCol(r, "name", "NAME") ?? ""),
      layer: String(findCol(r, "layer", "LAYER") ?? ""),
      disruptionScore: parseNum(findCol(r, "disruption_score", "DISRUPTION_SCORE")),
      subAvail: parseNum(findCol(r, "sub_avail", "SUB_AVAIL")),
      economics: parseNum(findCol(r, "economics", "ECONOMICS")),
      govtSupport: parseNum(findCol(r, "govt_support", "GOVT_SUPPORT")),
      demandVuln: parseNum(findCol(r, "demand_vuln", "DEMAND_VULN")),
      timeViability: parseNum(findCol(r, "time_viability", "TIME_VIABILITY")),
      status: String(findCol(r, "status", "STATUS") ?? ""),
      lastChecked: findCol(r, "last_checked", "LAST_CHECKED"),
      amberTrigger: String(findCol(r, "amber_trigger", "AMBER_TRIGGER") ?? ""),
      redTrigger: String(findCol(r, "red_trigger", "RED_TRIGGER") ?? ""),
      evidence: String(findCol(r, "evidence", "EVIDENCE") ?? ""),
    }));
}

function parsePct(val: any): number {
  if (typeof val === "number") return val * 100;
  if (typeof val === "string") {
    const cleaned = val.replace(/[%+,\s]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return 0;
}

function parseSheetDate(val: any): string {
  if (typeof val === "string") {
    const m = val.match(/^Date\((\d+),(\d+),(\d+)\)$/);
    if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return String(val ?? "");
}

function parsePerformance(rows: Record<string, any>[]) {
  return rows
    .filter((r) => {
      const d = findCol(r, "date", "Date", "DATE");
      return d !== null && d !== undefined;
    })
    .map((r) => ({
      date: parseSheetDate(findCol(r, "date", "Date", "DATE")),
      sippMv: parseMv(findCol(r, "sipp_mv", "SIPP_MV", "SIPP MV")),
      isaMv: parseMv(findCol(r, "isa_mv", "ISA_MV", "ISA MV")),
      totalMv: parseMv(findCol(r, "total_mv", "TOTAL_MV", "Total MV")),
      cashSipp: parseMv(findCol(r, "cash_sipp", "CASH_SIPP", "Cash SIPP")),
      cashIsa: parseMv(findCol(r, "cash_isa", "CASH_ISA", "Cash ISA")),
      totalCash: parseMv(findCol(r, "total_cash", "TOTAL_CASH", "Total Cash")),
      totalSipp: parseMv(findCol(r, "total_sipp", "TOTAL_SIPP", "Total SIPP")),
      totalIsa: parseMv(findCol(r, "total_isa", "TOTAL_ISA", "Total ISA")),
      totalValue: parseMv(findCol(r, "total_value", "TOTAL_VALUE", "Total Value")),
      depositsSipp: parseMv(findCol(r, "deposits_in_period_sipp", "DEPOSITS_IN_PERIOD_SIPP")),
      depositsIsa: parseMv(findCol(r, "deposits_in_period_isa", "DEPOSITS_IN_PERIOD_ISA")),
      depositsTotal: parseMv(findCol(r, "deposits_in_period_total", "DEPOSITS_IN_PERIOD_TOTAL")),
      subPeriodRtnSipp: parsePct(findCol(r, "sub_period_rtn_sipp", "SUB_PERIOD_RTN_SIPP")),
      subPeriodRtnIsa: parsePct(findCol(r, "sub_period_rtn_isa", "SUB_PERIOD_RTN_ISA")),
      subPeriodRtnTotal: parsePct(findCol(r, "sub_period_rtn_total", "SUB_PERIOD_RTN_TOTAL")),
      cumulativeTwrSipp: parsePct(findCol(r, "cumulative_twr_sipp", "CUMULATIVE_TWR_SIPP")),
      cumulativeTwrIsa: parsePct(findCol(r, "cumulative_twr_isa", "CUMULATIVE_TWR_ISA")),
      cumulativeTwrTotal: parsePct(findCol(r, "cumulative_twr_total", "CUMULATIVE_TWR_TOTAL")),
      note: String(findCol(r, "note", "Note", "NOTE") ?? ""),
    }));
}

function parseNarrative(rows: Record<string, any>[]) {
  const firstRow = [...rows].sort((a, b) => populatedCount(b) - populatedCount(a))[0];
  if (!firstRow) return {};

  return Object.entries(firstRow).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = normalizeToken(key);
    const normalizedValue = stringifyValue(value);
    if (normalizedKey && normalizedValue) {
      acc[normalizedKey] = normalizedValue;
    }
    return acc;
  }, {});
}

type MacroStateRow = {
  section: string;
  name: string;
  current: string | number | null;
  status: string;
  note: string;
  threshold: string;
  search: string;
};

function parseMacroStateRows(rows: Record<string, any>[]): MacroStateRow[] {
  return rows
    .map((r) => {
      const section = normalizeToken(findCol(r, "type", "TYPE", "section", "SECTION", "category", "CATEGORY", "row_type", "ROW_TYPE") ?? "");
      const name = stringifyValue(findCol(r, "name", "NAME", "key", "KEY", "rule", "RULE", "metric", "METRIC", "label", "LABEL"));
      const current = findCol(r, "current", "CURRENT", "value", "VALUE");
      const status = stringifyValue(findCol(r, "status", "STATUS"));
      const note = stringifyValue(findCol(r, "notes", "NOTES", "detail", "DETAIL", "description", "DESCRIPTION", "evidence", "EVIDENCE"));
      const threshold = stringifyValue(findCol(r, "threshold", "THRESHOLD", "amber_threshold", "AMBER_THRESHOLD", "red_threshold", "RED_THRESHOLD"));
      const search = [section, name, stringifyValue(current), status, note, threshold].map(normalizeToken).join(" ");
      return { section, name, current, status, note, threshold, search };
    })
    .filter((entry) => entry.name || entry.section || stringifyValue(entry.current) || entry.status || entry.note);
}

function firstNarrativeValue(narrative: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = narrative[normalizeToken(key)];
    if (value) return value;
  }
  return "";
}

function parseMacroBanner(rows: MacroStateRow[], narrative: Record<string, string>) {
  const findEntry = (...aliases: string[]) => {
    const normalizedAliases = aliases.map(normalizeToken);
    return rows.find((entry) => normalizedAliases.some((alias) => entry.search.includes(alias)));
  };

  const getNumber = (...aliases: string[]) => parseNum(findEntry(...aliases)?.current);
  const getString = (...aliases: string[]) => stringifyValue(findEntry(...aliases)?.current);

  const posture = firstNarrativeValue(narrative, "posture", "portfolio_posture", "macro_regime");
  const headline = firstNarrativeValue(narrative, "headline", "posture_rationale", "week_priority_1");

  const metrics = {
    sp500: getNumber("s&p 500", "sp500", "s_p_500"),
    nasdaq: getNumber("nasdaq"),
    vix: getNumber("vix"),
    gold: getNumber("gold"),
    silver: getNumber("silver"),
    uraniumSpot: getNumber("uranium", "u3o8", "u_3_o_8"),
    copper: getNumber("copper"),
    oilBrent: getString("oil", "brent"),
    posture,
    headline,
  };

  const hasContent = Object.values(metrics).some((value) => value !== null && value !== "");
  return hasContent ? metrics : null;
}

function parseRiskControls(rows: MacroStateRow[]) {
  const aliases = [
    "risk", "single_name_cap", "top_5_concentration", "hedge_floor", "bio_twin",
    "dry_powder", "spec_position_cap", "score_minimum", "layer_concentration", "pause_active",
  ];

  return rows
    .filter((entry) => aliases.some((alias) => entry.search.includes(alias)))
    .map((entry) => ({
      name: entry.name,
      threshold: entry.threshold,
      status: entry.status || "MONITOR",
      detail: entry.note,
      current: stringifyValue(entry.current),
    }));
}

function parseBubbleFlags(rows: MacroStateRow[]) {
  return rows
    .filter((entry) => entry.search.includes("bubble"))
    .map((entry) => ({
      name: entry.name,
      status: entry.status || "MONITOR",
      detail: entry.note,
    }));
}

function parseWeeklyTriggers(rows: MacroStateRow[]) {
  const aliases = ["weekly", "trigger", "market_trigger", "market", "intraday_drop", "rolling_5_day"];

  return rows
    .filter((entry) => aliases.some((alias) => entry.section.includes(alias) || entry.search.includes(alias)))
    .map((entry) => ({
      name: entry.name,
      status: entry.status || "CLEAR",
      note: entry.note || entry.threshold || stringifyValue(entry.current),
    }));
}

export type LiveHolding = ReturnType<typeof parseHoldings>[number];
export type LiveWatchItem = ReturnType<typeof parseWatchlist>[number];
export type LiveLayer = ReturnType<typeof parseLayers>[number];
export type LiveScore = ReturnType<typeof parseScores>[number];
export type LiveScoreLog = ReturnType<typeof parseScoreLog>[number];
export type LiveMonitor = ReturnType<typeof parseMonitor>[number];
export type LiveDisruption = ReturnType<typeof parseDisruption>[number];
export type LivePerformance = ReturnType<typeof parsePerformance>[number];
export type LiveNarrative = ReturnType<typeof parseNarrative>;
export type LiveMacroBanner = NonNullable<ReturnType<typeof parseMacroBanner>>;
export type LiveRiskControl = ReturnType<typeof parseRiskControls>[number];
export type LiveBubbleFlag = ReturnType<typeof parseBubbleFlags>[number];
export type LiveWeeklyTrigger = ReturnType<typeof parseWeeklyTriggers>[number];

export interface PortfolioData {
  holdings: LiveHolding[];
  sipp: LiveHolding[];
  isa: LiveHolding[];
  watchlist: LiveWatchItem[];
  layers: LiveLayer[];
  scores: LiveScore[];
  scoreLog: LiveScoreLog[];
  monitor: LiveMonitor[];
  disruption: LiveDisruption[];
  performance: LivePerformance[];
  narrative: LiveNarrative;
  macroBanner: LiveMacroBanner | null;
  riskControls: LiveRiskControl[];
  bubbleFlags: LiveBubbleFlag[];
  weeklyTriggers: LiveWeeklyTrigger[];
  lastUpdated: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePortfolioData(): PortfolioData {
  const [state, setState] = useState<Omit<PortfolioData, "refresh">>({
    holdings: [],
    sipp: [],
    isa: [],
    watchlist: [],
    layers: [],
    scores: [],
    scoreLog: [],
    monitor: [],
    disruption: [],
    performance: [],
    narrative: {},
    macroBanner: null,
    riskControls: [],
    bubbleFlags: [],
    weeklyTriggers: [],
    lastUpdated: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const [holdingsRaw, watchRaw, layersRaw, scoresRaw, scoreLogRaw, monitorRaw, disruptionRaw, performanceRaw, narrativeRaw, macroStateRaw] = await Promise.all([
        fetchSheet(GIDS.holdings),
        fetchSheet(GIDS.watchlist),
        fetchSheet(GIDS.layers).catch(() => []),
        fetchSheet(GIDS.scores).catch(() => []),
        fetchSheet(GIDS.scoreLog).catch(() => []),
        fetchSheet(GIDS.monitor).catch(() => []),
        fetchSheet(GIDS.disruption).catch(() => []),
        fetchSheet(GIDS.performance).catch(() => []),
        fetchSheet(GIDS.narrative).catch(() => []),
        fetchSheet(GIDS.macroState).catch(() => []),
      ]);

      const allHoldings = parseHoldings(holdingsRaw);
      const sipp = allHoldings.filter((holding) => holding.account.toUpperCase() === "SIPP");
      const isa = allHoldings.filter((holding) => holding.account.toUpperCase() === "ISA");
      const narrative = parseNarrative(narrativeRaw);
      const macroStateRows = parseMacroStateRows(macroStateRaw);

      setState({
        holdings: allHoldings,
        sipp,
        isa,
        watchlist: parseWatchlist(watchRaw),
        layers: parseLayers(layersRaw),
        scores: parseScores(scoresRaw),
        scoreLog: parseScoreLog(scoreLogRaw),
        monitor: parseMonitor(monitorRaw),
        disruption: parseDisruption(disruptionRaw),
        performance: parsePerformance(performanceRaw),
        narrative,
        macroBanner: parseMacroBanner(macroStateRows, narrative),
        riskControls: parseRiskControls(macroStateRows),
        bubbleFlags: parseBubbleFlags(macroStateRows),
        weeklyTriggers: parseWeeklyTriggers(macroStateRows),
        lastUpdated: new Date().toLocaleTimeString("en-GB"),
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: `Sheet unreachable — static snapshot. (${error.message})`,
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
