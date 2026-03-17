import { useState, useEffect, useCallback } from "react";

const SHEET_ID = "1T2afEG3mLjxmonduDugHA5SlJ44-RBJmv0bxISfalNo";

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
  "tickername","mv (£)","g/l %","day %",
  "date","sipp_mv","isa_mv","total_mv","cash_sipp","cash_isa","total_cash",
  "total_sipp","total_isa","total_value","deposits_in_period_sipp",
  "deposits_in_period_isa","deposits_in_period_total","sub_period_rtn_sipp",
  "sub_period_rtn_isa","sub_period_rtn_total","cumulative_twr_sipp",
  "cumulative_twr_isa","cumulative_twr_total","note",
  "trigger_price_add","trigger_price_exit","alert_status","alert_fired_date","key","value",
];

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
      .map(k => ({ k, pos: labelLower.indexOf(k.toLowerCase()) }))
      .filter(m => m.pos >= 0)
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
      const vals = Object.values(row);
      const hasContent = vals.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
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
      return hasId;
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
  return rows.reduce<Record<string, string>>((acc, row) => {
    const keys = Object.keys(row);
    const rawKey = findCol(row, "key", "KEY") ?? (keys[0] ? row[keys[0]] : null);
    const rawValue = findCol(row, "value", "VALUE") ?? (keys[1] ? row[keys[1]] : null);
    const key = String(rawKey ?? "").trim();
    const value = String(rawValue ?? "").trim();

    if (key && value) {
      acc[key] = value;
    }

    return acc;
  }, {});
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
    lastUpdated: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((p) => ({ ...p, loading: true, error: null }));
    try {
      const [holdingsRaw, watchRaw, layersRaw, scoresRaw, scoreLogRaw, monitorRaw, disruptionRaw, performanceRaw, narrativeRaw] = await Promise.all([
        fetchSheet(GIDS.holdings),
        fetchSheet(GIDS.watchlist),
        fetchSheet(GIDS.layers).catch(() => []),
        fetchSheet(GIDS.scores).catch(() => []),
        fetchSheet(GIDS.scoreLog).catch(() => []),
        fetchSheet(GIDS.monitor).catch(() => []),
        fetchSheet(GIDS.disruption).catch(() => []),
        fetchSheet(GIDS.performance).catch(() => []),
        fetchSheet(GIDS.narrative).catch(() => []),
      ]);
      const allHoldings = parseHoldings(holdingsRaw);
      const sipp = allHoldings.filter((h) => h.account.toUpperCase() === "SIPP");
      const isa = allHoldings.filter((h) => h.account.toUpperCase() === "ISA");
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
        narrative: parseNarrative(narrativeRaw),
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
