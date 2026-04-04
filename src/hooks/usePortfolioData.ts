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
  macroState: "448795117",
  earningsCalendar: "559427839",
  transactions: "1970586669",
  jisaHoldings: "PLACEHOLDER_GID",
} as const;

/** Always treat numeric value as a fraction and scale by 100. For cumulative TWR fields where the sheet API always returns fractions (e.g. 1.294 = 129.4%). */
function parseFractionToPercent(val: any): number {
  if (typeof val === "number") return Number.isFinite(val) ? val * 100 : 0;
  if (typeof val === "string") {
    const cleaned = val.trim().replace(/[,+\s%]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num * 100 : 0;
  }
  return 0;
}

const NARRATIVE_FIELDS = [
  "last_updated",
  "macro_regime",
  "posture_rationale",
  "week_priority_1",
  "week_priority_2",
  "week_priority_3",
  "week_watch_1",
  "week_watch_2",
  "week_watch_3",
  "key_risk_this_week",
  "thesis_integrity_note",
  "layer_narrative",
  "reclassification_watch",
  "quarterly_thesis_note",
] as const;

const KNOWN_COLS = [
  "ticker", "name", "layer", "score", "score_date", "substrate", "demand", "moat",
  "valuation", "mgmt", "disruption", "buy_low", "buy_high", "full_thesis",
  "currency", "tier", "action", "change_note", "mv", "account", "aum_pct",
  "g/l", "day", "shares", "price_local", "prev_close_local", "cost_gbp",
  "cost_local", "ccy_val", "code_gf", "code_ft", "prefix", "ma60", "high_52w",
  "low_52w", "add_trigger", "exit_trigger", "notes", "disruption_score",
  "sub_avail", "economics", "govt_support", "demand_vuln", "time_viability",
  "status", "last_checked", "amber_trigger", "red_trigger", "evidence",
  "row_type", "type", "current", "unit", "amber_threshold", "red_threshold",
  "last_updated", "target", "entry target", "current price", "trigger condition",
  "thesis / rationale", "hex color", "key holdings", "gap / notes", "priority",
  "target %", "current %", "%_below_52w_high", "%_above_52w_low",
  "tickername", "mv (£)", "g/l %", "day %", "date", "sipp_mv", "isa_mv",
  "total_mv", "cash_sipp", "cash_isa", "total_cash", "total_sipp", "total_isa",
  "total_value", "deposits_in_period_sipp", "deposits_in_period_isa",
  "deposits_in_period_total", "sub_period_rtn_sipp", "sub_period_rtn_isa",
  "sub_period_rtn_total", "cumulative_twr_sipp", "cumulative_twr_isa",
  "cumulative_twr_total", "note", "trigger_type", "trigger_price_add", "trigger_price_exit",
  "trigger_price_numeric", "alert_status", "alert_fired_date", "key", "current_value",
  "threshold_amber", "threshold_red", "value", "next_earnings_date", "fiscal_period",
  "confirmed", "sp500_tr", "msci_world_tr", "deploy_target_gbp", "deploy_note",
  "deploy_amount_gbp",
];

interface SheetFetchOptions {
  gid?: string;
  sheetName?: string;
  range?: string;
  headers?: number;
}

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

function humanizeKey(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join(" ");
}

function populatedCount(row: Record<string, any>) {
  return Object.values(row).filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
}

function buildSheetUrl({ gid, sheetName, range, headers }: SheetFetchOptions) {
  const params = new URLSearchParams({ tqx: "out:json" });
  if (gid) params.set("gid", gid);
  if (sheetName) params.set("sheet", sheetName);
  if (range) params.set("range", range);
  if (headers !== undefined) params.set("headers", String(headers));
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params.toString()}`;
}

function resolveColumnLabel(label: string) {
  const trimmed = label.trim();
  const labelLower = trimmed.toLowerCase();

  if (/\bticker\b/.test(labelLower)) return "ticker";
  if (labelLower === "layer" || labelLower === "layer name") return "layer";
  if (/\bname\b/.test(labelLower)) return "name";
  if (labelLower.includes("next earnings") || labelLower.includes("next_earnings")) return "next_earnings_date";
  if (labelLower.includes("fiscal period") || labelLower.includes("fiscal_period")) return "fiscal_period";
  // Space-separated variants for watchlist columns
  if (labelLower.includes("trigger price numeric") || labelLower.includes("trigger_price_numeric")) return "trigger_price_numeric";
  if (labelLower.includes("trigger price add") || labelLower.includes("trigger_price_add")) return "trigger_price_add";
  if (labelLower.includes("trigger price exit") || labelLower.includes("trigger_price_exit")) return "trigger_price_exit";
  if (labelLower.includes("trigger type") || labelLower.includes("trigger_type")) return "trigger_type";
  if (labelLower.includes("alert status") || labelLower.includes("alert_status")) return "alert_status";
  if (labelLower.includes("alert fired date") || labelLower.includes("alert_fired_date")) return "alert_fired_date";
  if (labelLower.includes("last checked") || labelLower.includes("last_checked")) return "last_checked";
  if (labelLower.includes("trigger review date") || labelLower.includes("trigger_review_date")) return "trigger_review_date";
  if (labelLower.includes("trigger review note") || labelLower.includes("trigger_review_note")) return "trigger_review_note";
  if (labelLower.includes("last updated") || labelLower.includes("last_updated")) return "last_updated";
  if (labelLower.includes("current price")) return "current price";
  if (labelLower.includes("entry target")) return "entry target";
  if (labelLower.includes("trigger condition")) return "trigger condition";
  if (labelLower.includes("thesis / rationale")) return "thesis / rationale";
  if (labelLower.includes("key holdings")) return "key holdings";
  if (labelLower.includes("gap / notes")) return "gap / notes";
  if (labelLower.includes("target %")) return "target %";
  if (labelLower.includes("current %")) return "current %";

  if (!trimmed.includes(" ")) return trimmed;

  const matches = KNOWN_COLS
    .map((known) => ({ known, pos: labelLower.indexOf(known.toLowerCase()) }))
    .filter((match) => match.pos >= 0)
    .sort((a, b) => a.pos - b.pos || b.known.length - a.known.length);

  if (matches.length > 0) return matches[0].known;

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

async function fetchSheet(options: SheetFetchOptions): Promise<Record<string, any>[]> {
  const url = buildSheetUrl(options);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  const cols: string[] = json.table.cols.map((column: any) => resolveColumnLabel(column.label ?? ""));

  return (json.table.rows || [])
    .map((row: any) => {
      const next: Record<string, any> = {};
      row.c?.forEach((cell: any, index: number) => {
        next[cols[index] || `col_${index}`] = cell?.v ?? null;
      });
      return next;
    })
    .filter((row: Record<string, any>) => {
      const values = Object.values(row);
      const hasContent = values.some((value) => value !== null && value !== undefined && String(value).trim() !== "");
      if (!hasContent) return false;
      const rowType = row["row_type"] ?? row["Row_Type"] ?? row["ROW_TYPE"];
      if (rowType !== null && rowType !== undefined) return true;
      const keys = Object.keys(row);
      const hasId = keys.some((key) => {
        const lower = key.toLowerCase();
        return (
          (lower.includes("ticker") || lower === "name" || lower === "type" || lower === "date" || lower === "layer" || lower === "key") &&
          row[key] !== null &&
          String(row[key]).trim() !== ""
        );
      });
      return hasId || populatedCount(row) >= 3;
    });
}

async function fetchSheetGrid(options: SheetFetchOptions): Promise<string[][]> {
  const url = buildSheetUrl({ ...options, headers: options.headers ?? 0 });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));
  const colCount = json.table.cols.length;

  return (json.table.rows || []).map((row: any) =>
    Array.from({ length: colCount }, (_, index) => stringifyValue(row.c?.[index]?.v ?? "")),
  );
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

function parsePercentLike(val: any): number {
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return 0;
    return Math.abs(val) <= 1 ? val * 100 : val;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return 0;

    const hasPercentSymbol = trimmed.includes("%");
    const cleaned = trimmed.replace(/[,+\s%]/g, "");
    const num = parseFloat(cleaned);

    if (!Number.isFinite(num)) return 0;
    if (hasPercentSymbol) return num;

    return Math.abs(num) <= 1 ? num * 100 : num;
  }

  return 0;
}

function parseGl(val: any): number {
  return parsePercentLike(val);
}

function parseDay(val: any): number {
  return parsePercentLike(val);
}

function findCol(row: Record<string, any>, ...candidates: string[]): any {
  for (const candidate of candidates) {
    if (row[candidate] !== undefined && row[candidate] !== null) return row[candidate];
  }
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const match = keys.find((key) => key.toLowerCase() === lower);
    if (match && row[match] !== undefined && row[match] !== null) return row[match];
  }
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const match = keys.find((key) => key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase()));
    if (match && row[match] !== undefined && row[match] !== null) return row[match];
  }
  return null;
}

function parseNum(val: any): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const num = parseFloat(val.replace(/[^0-9.\-]/g, ""));
    return isNaN(num) ? null : num;
  }
  return null;
}

function parsePct(val: any): number {
  return parsePercentLike(val);
}

/** For performance TWR fields: sheet stores values as whole percentages (e.g. 8.5 = 8.5%). Never multiply. */
function parseRawPct(val: any): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "string") {
    const cleaned = val.trim().replace(/[,+\s%]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function parseSheetDate(val: any): string {
  if (typeof val === "string") {
    const match = val.match(/^Date\((\d+),(\d+),(\d+)\)$/);
    if (match) return `${match[1]}-${String(+match[2] + 1).padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  return String(val ?? "");
}

function parseHoldings(rows: Record<string, any>[]) {
  return rows
    .filter((row) => {
      const ticker = findCol(row, "TICKER", "ticker");
      const mvRaw = findCol(row, "MV (£)", "MV", "mv", "(£)");
      const mv = parseMv(mvRaw);
      return ticker && String(ticker).trim() !== "" && mv > 0;
    })
    .map((row) => ({
      ticker: String(findCol(row, "TICKER", "ticker") ?? ""),
      name: String(findCol(row, "NAME", "name") ?? ""),
      layer: String(findCol(row, "LAYER", "layer") ?? ""),
      account: String(findCol(row, "Account", "account", "ACCOUNT") ?? ""),
      mv: parseMv(findCol(row, "MV (£)", "mv (£)", "MV", "mv", "(£)")),
      gl: parseGl(findCol(row, "G/L %", "g/l %", "G/L%", "gl", "G/L")),
      day: parseDay(findCol(row, "DAY %", "day %", "Day %", "day", "DAY")),
      notes: String(findCol(row, "NOTES", "notes") ?? ""),
      action: String(findCol(row, "ACTION", "action") ?? "HOLD"),
      price: parseNum(findCol(row, "PRICE_LOCAL", "price_local", "Price_Local")),
      prevClose: parseNum(findCol(row, "PREV_CLOSE_LOCAL", "prev_close_local")),
      currency: String(findCol(row, "CURRENCY", "currency") ?? "USD"),
      costGbp: parseNum(findCol(row, "COST_GBP", "cost_gbp", "Cost_GBP")),
      shares: parseNum(findCol(row, "SHARES", "shares", "Shares")),
      add_trigger: String(findCol(row, "add_trigger", "ADD_TRIGGER") ?? ""),
      exit_trigger: String(findCol(row, "exit_trigger", "EXIT_TRIGGER") ?? ""),
      trigger_type: String(findCol(row, "trigger_type", "TRIGGER_TYPE") ?? ""),
      trigger_price_add: String(findCol(row, "trigger_price_add", "TRIGGER_PRICE_ADD") ?? ""),
      trigger_price_exit: String(findCol(row, "trigger_price_exit", "TRIGGER_PRICE_EXIT") ?? ""),
      alert_status: String(findCol(row, "alert_status", "ALERT_STATUS") ?? "CLEAR"),
      alert_fired_date: parseSheetDate(findCol(row, "alert_fired_date", "ALERT_FIRED_DATE")),
      ma60: parseNum(findCol(row, "MA60", "ma60", "Ma60")),
      high_52w: parseNum(findCol(row, "HIGH_52w", "HIGH_52W", "high_52w", "High_52w")),
      low_52w: parseNum(findCol(row, "LOW_52w", "LOW_52W", "low_52w", "Low_52w")),
      deploy_target_gbp: parseNum(findCol(row, "deploy_target_gbp", "DEPLOY_TARGET_GBP", "Deploy_Target_GBP")),
      deploy_note: String(findCol(row, "deploy_note", "DEPLOY_NOTE", "Deploy_Note") ?? ""),
    }));
}

function parseWatchlist(rows: Record<string, any>[]) {
  return rows
    .map((row) => ({
      name: String(findCol(row, "name", "NAME", "Name") ?? ""),
      ticker: String(findCol(row, "ticker", "TICKER", "Ticker") ?? ""),
      layer: String(findCol(row, "layer", "LAYER", "Layer") ?? ""),
      entry: String(findCol(row, "entry target", "ENTRY TARGET", "Entry Target") ?? ""),
      current: parseNum(findCol(row, "current price", "CURRENT PRICE", "Current Price")),
      trigger: String(findCol(row, "trigger condition", "TRIGGER CONDITION", "Trigger Condition") ?? ""),
      rationale: String(findCol(row, "thesis / rationale", "THESIS / RATIONALE", "Thesis / Rationale") ?? ""),
      status: String(findCol(row, "status", "STATUS", "Status") ?? "WATCH"),
      triggerPriceNumeric: parseNum(findCol(row, "trigger_price_numeric", "TRIGGER_PRICE_NUMERIC")),
      alertStatus: String(findCol(row, "alert_status", "ALERT_STATUS") ?? "WAITING"),
      lastChecked: parseSheetDate(findCol(row, "last_checked", "LAST_CHECKED")),
      triggerReviewDate: String(findCol(row, "trigger_review_date", "TRIGGER_REVIEW_DATE") ?? ""),
      triggerReviewNote: String(findCol(row, "trigger_review_note", "TRIGGER_REVIEW_NOTE") ?? ""),
      deploy_amount_gbp: parseNum(findCol(row, "deploy_amount_gbp", "DEPLOY_AMOUNT_GBP", "Deploy_Amount_GBP")),
    }))
    .filter((item) => item.name.trim() !== "" || item.ticker.trim() !== "");
}

function parseLayers(rows: Record<string, any>[]) {
  const SKIP = ["LAYER", ""];
  return rows
    .map((row) => {
      const targetRaw = findCol(row, "target %", "TARGET %", "TARGET%", "target") ?? row["col_2"];
      const currentRaw = findCol(row, "current %", "CURRENT %", "CURRENT%", "current") ?? row["col_3"];
      const layerName = String(findCol(row, "layer", "LAYER", "name", "NAME") ?? row["MV (£)"] ?? "").trim();
      return {
        name: layerName,
        target: parsePct(targetRaw),
        current: parsePct(currentRaw),
        mv: parseMv(findCol(row, "mv (£)", "MV (£)", "mv", "MV") ?? row["col_4"]),
        hexColor: String(findCol(row, "hex color", "Hex Color", "hex_color") ?? row["col_5"] ?? ""),
        keyHoldings: String(findCol(row, "key holdings", "Key Holdings", "key_holdings") ?? row["col_6"] ?? ""),
        gapNotes: String(findCol(row, "gap / notes", "Gap / Notes", "gap_notes") ?? row["col_7"] ?? ""),
        priority: String(findCol(row, "priority", "Priority", "PRIORITY") ?? ""),
      };
    })
    .filter((l) => !SKIP.includes(l.name.toUpperCase()));
}

function parseScores(rows: Record<string, any>[]) {
  return rows
    .filter((row) => {
      const rowType = findCol(row, "row_type", "Row_Type", "ROW_TYPE");
      if (rowType) {
        const normalized = String(rowType).trim().toLowerCase();
        return normalized === "data" || normalized === "watchlist";
      }
      const ticker = String(findCol(row, "ticker", "TICKER") ?? "").trim();
      return ticker !== "" && !ticker.includes(" ");
    })
    .map((row) => ({
      ticker: String(row["ticker"] ?? row["TICKER"] ?? ""),
      name: String(findCol(row, "tickerName", "TICKERNAME", "name", "NAME") ?? ""),
      layer: String(findCol(row, "Layer", "layer", "LAYER") ?? ""),
      tier: String(findCol(row, "tier", "TIER") ?? ""),
      action: String(findCol(row, "action", "ACTION") ?? ""),
      score: typeof row["score"] === "number" ? row["score"] : null,
      scoreDate: row["score_date"] ?? null,
      substrate: typeof row["substrate"] === "number" ? row["substrate"] : null,
      demand: typeof row["demand"] === "number" ? row["demand"] : null,
      moat: typeof row["moat"] === "number" ? row["moat"] : null,
      valuation: typeof row["valuation"] === "number" ? row["valuation"] : null,
      mgmt: typeof row["mgmt"] === "number" ? row["mgmt"] : null,
      disruption: typeof row["disruption"] === "number" ? row["disruption"] : null,
      buyLow: typeof row["buy_low"] === "number" ? row["buy_low"] : null,
      buyHigh: typeof row["buy_high"] === "number" ? row["buy_high"] : null,
      fullThesis: String(row["full_thesis"] ?? ""),
      currency: String(row["currency"] ?? "USD"),
      changeNote: String(row["change_note"] ?? ""),
      rowType: String(findCol(row, "row_type", "Row_Type", "ROW_TYPE") ?? "data").trim().toLowerCase(),
    }));
}

function parseScoreLog(rows: Record<string, any>[]) {
  return rows.map((row) => ({
    date: row["date"] ?? row["DATE"] ?? null,
    ticker: String(row["ticker"] ?? row["TICKER"] ?? ""),
    score: typeof row["score"] === "number" ? row["score"] : null,
    substrate: typeof row["substrate"] === "number" ? row["substrate"] : null,
    demand: typeof row["demand"] === "number" ? row["demand"] : null,
    moat: typeof row["moat"] === "number" ? row["moat"] : null,
    valuation: typeof row["valuation"] === "number" ? row["valuation"] : null,
    mgmt: typeof row["mgmt"] === "number" ? row["mgmt"] : null,
    changeNote: String(row["change_note"] ?? row["CHANGE_NOTE"] ?? ""),
  }));
}

function parseMonitor(rows: Record<string, any>[]) {
  return rows.map((row) => ({
    type: normalizeToken(findCol(row, "type", "TYPE", "category", "CATEGORY", "section", "SECTION") ?? ""),
    name: String(findCol(row, "name", "NAME", "key", "KEY", "metric", "METRIC") ?? ""),
    current: findCol(row, "current", "CURRENT", "value", "VALUE") ?? null,
    unit: String(findCol(row, "unit", "UNIT") ?? ""),
    amberThreshold: findCol(row, "amber_threshold", "AMBER_THRESHOLD") ?? null,
    redThreshold: findCol(row, "red_threshold", "RED_THRESHOLD") ?? null,
    status: String(findCol(row, "status", "STATUS") ?? ""),
    lastUpdated: findCol(row, "last_updated", "LAST_UPDATED"),
    notes: String(findCol(row, "notes", "NOTES", "detail", "DETAIL", "evidence", "EVIDENCE") ?? ""),
  }));
}

function parseDisruption(rows: Record<string, any>[]) {
  return rows
    .filter((row) => {
      const rowType = findCol(row, "row_type", "Row_Type", "ROW_TYPE");
      if (rowType) {
        const normalized = String(rowType).trim().toLowerCase();
        return normalized === "data" || normalized === "watchlist";
      }
      const ticker = findCol(row, "ticker", "TICKER");
      return ticker && String(ticker).trim() !== "" && !String(ticker).includes("LAYER") && !String(ticker).includes("HOLDINGS") && !String(ticker).includes("WATCHLIST") && !String(ticker).includes("HEDGE");
    })
    .map((row) => ({
      ticker: String(findCol(row, "ticker", "TICKER") ?? ""),
      name: String(findCol(row, "name", "NAME") ?? ""),
      layer: String(findCol(row, "layer", "LAYER") ?? ""),
      disruptionScore: parseNum(findCol(row, "disruption_score", "DISRUPTION_SCORE")),
      subAvail: parseNum(findCol(row, "sub_avail", "SUB_AVAIL")),
      economics: parseNum(findCol(row, "economics", "ECONOMICS")),
      govtSupport: parseNum(findCol(row, "govt_support", "GOVT_SUPPORT")),
      demandVuln: parseNum(findCol(row, "demand_vuln", "DEMAND_VULN")),
      timeViability: parseNum(findCol(row, "time_viability", "TIME_VIABILITY")),
      status: String(findCol(row, "status", "STATUS") ?? ""),
      lastChecked: findCol(row, "last_checked", "LAST_CHECKED"),
      amberTrigger: String(findCol(row, "amber_trigger", "AMBER_TRIGGER") ?? ""),
      redTrigger: String(findCol(row, "red_trigger", "RED_TRIGGER") ?? ""),
      evidence: String(findCol(row, "evidence", "EVIDENCE") ?? ""),
    }));
}

function parsePerformance(rows: Record<string, any>[]) {
  return rows
    .filter((row) => {
      const date = findCol(row, "date", "Date", "DATE");
      return date !== null && date !== undefined;
    })
    .map((row) => ({
      date: parseSheetDate(findCol(row, "date", "Date", "DATE")),
      sippMv: parseMv(findCol(row, "sipp_mv", "SIPP_MV", "SIPP MV")),
      isaMv: parseMv(findCol(row, "isa_mv", "ISA_MV", "ISA MV")),
      totalMv: parseMv(findCol(row, "total_mv", "TOTAL_MV", "Total MV")),
      cashSipp: parseMv(findCol(row, "cash_sipp", "CASH_SIPP", "Cash SIPP")),
      cashIsa: parseMv(findCol(row, "cash_isa", "CASH_ISA", "Cash ISA")),
      totalCash: parseMv(findCol(row, "total_cash", "TOTAL_CASH", "Total Cash")),
      totalSipp: parseMv(findCol(row, "total_sipp", "TOTAL_SIPP", "Total SIPP")),
      totalIsa: parseMv(findCol(row, "total_isa", "TOTAL_ISA", "Total ISA")),
      totalValue: parseMv(findCol(row, "total_value", "TOTAL_VALUE", "Total Value")),
      depositsSipp: parseMv(findCol(row, "deposits_in_period_sipp", "DEPOSITS_IN_PERIOD_SIPP")),
      depositsIsa: parseMv(findCol(row, "deposits_in_period_isa", "DEPOSITS_IN_PERIOD_ISA")),
      depositsTotal: parseMv(findCol(row, "deposits_in_period_total", "DEPOSITS_IN_PERIOD_TOTAL")),
      subPeriodRtnSipp: parsePercentLike(findCol(row, "sub_period_rtn_sipp", "SUB_PERIOD_RTN_SIPP")),
      subPeriodRtnIsa: parsePercentLike(findCol(row, "sub_period_rtn_isa", "SUB_PERIOD_RTN_ISA")),
      subPeriodRtnTotal: parsePercentLike(findCol(row, "sub_period_rtn_total", "SUB_PERIOD_RTN_TOTAL")),
      cumulativeTwrSipp: parseFractionToPercent(findCol(row, "cumulative_twr_sipp", "CUMULATIVE_TWR_SIPP")),
      cumulativeTwrIsa: parseFractionToPercent(findCol(row, "cumulative_twr_isa", "CUMULATIVE_TWR_ISA")),
      cumulativeTwrTotal: parseFractionToPercent(findCol(row, "cumulative_twr_total", "CUMULATIVE_TWR_TOTAL")),
      sp500Tr: parseFractionToPercent(findCol(row, "sp500_tr", "SP500_TR", "S&P500_TR")),
      msciWorldTr: parseFractionToPercent(findCol(row, "msci_world_tr", "MSCI_WORLD_TR", "MSCI World TR")),
      note: String(findCol(row, "note", "Note", "NOTE") ?? ""),
    }));
}

export type LiveNarrativeData = Record<(typeof NARRATIVE_FIELDS)[number], string>;

function createEmptyNarrativeData(): LiveNarrativeData {
  return Object.fromEntries(NARRATIVE_FIELDS.map((field) => [field, ""])) as LiveNarrativeData;
}

function parseNarrativeData(grid: string[][]): LiveNarrativeData {
  const headers = grid[0] ?? [];
  const values = grid[1] ?? [];
  const next = createEmptyNarrativeData();

  headers.forEach((header, index) => {
    const key = normalizeToken(header);
    if ((NARRATIVE_FIELDS as readonly string[]).includes(key)) {
      const rawValue = values[index] ?? "";
      next[key as keyof LiveNarrativeData] = key === "last_updated" ? parseSheetDate(rawValue) : rawValue;
    }
  });

  return next;
}

export interface LiveMacroStateRow {
  key: string;
  currentValue: string;
  thresholdAmber: string;
  thresholdRed: string;
  status: string;
  lastUpdated: string;
  note: string;
}

export type LiveMacroState = Record<string, LiveMacroStateRow>;

function parseMacroState(grid: string[][]): LiveMacroState {
  return grid.slice(1).reduce<LiveMacroState>((acc, row) => {
    const key = stringifyValue(row[0]);
    if (!key) return acc;
    acc[key] = {
      key,
      currentValue: stringifyValue(row[1]),
      thresholdAmber: stringifyValue(row[2]),
      thresholdRed: stringifyValue(row[3]),
      status: stringifyValue(row[4]),
      lastUpdated: parseSheetDate(row[5]),
      note: stringifyValue(row[6]),
    };
    return acc;
  }, {});
}

function parseMacroStateRows(macroState: LiveMacroState) {
  return Object.values(macroState);
}

function readMacroNumber(macroState: LiveMacroState, key: string) {
  return parseNum(macroState[key]?.currentValue);
}

function readMacroString(macroState: LiveMacroState, key: string) {
  return stringifyValue(macroState[key]?.currentValue || macroState[key]?.status);
}

function parseMacroBanner(macroState: LiveMacroState, narrativeData: LiveNarrativeData) {
  const banner = {
    vix: readMacroNumber(macroState, "VIX"),
    sp500YtdPct: parsePct(macroState["SP500_YTD_PCT"]?.currentValue),
    goldUsd: readMacroNumber(macroState, "GOLD_USD"),
    pauseActive: readMacroString(macroState, "PAUSE_ACTIVE"),
    earningsBlackout: readMacroString(macroState, "EARNINGS_BLACKOUT"),
    posture: narrativeData.macro_regime,
    headline: narrativeData.posture_rationale,
  };
  return Object.values(banner).some((value) => value !== null && value !== "") ? banner : null;
}

const RISK_CONTROL_KEYS = ["SGLD_AUM_PCT", "TOP5_CONCENTRATION", "HEDGE_FLOOR_PCT", "BIO_TWIN_RISK_PCT"] as const;

function parseRiskControls(macroState: LiveMacroState) {
  return RISK_CONTROL_KEYS
    .map((key) => macroState[key])
    .filter(Boolean)
    .map((row) => ({
      key: row.key,
      label: humanizeKey(row.key),
      threshold: [
        row.thresholdAmber ? `AMBER ${row.thresholdAmber}` : "",
        row.thresholdRed ? `RED ${row.thresholdRed}` : "",
      ].filter(Boolean).join(" · "),
      status: row.status || "MONITOR",
      detail: row.note,
      current: row.currentValue,
    }));
}

const WEEKLY_TRIGGER_KEYS = ["SP500_WEEKLY_MOVE", "URANIUM_WEEKLY_MOVE", "OIL_BRENT_USD", "HORMUZ_STATUS"] as const;

function parseWeeklyTriggers(macroStateRows: LiveMacroStateRow[]) {
  const directMatches = macroStateRows.filter((row) => WEEKLY_TRIGGER_KEYS.includes(row.key as (typeof WEEKLY_TRIGGER_KEYS)[number]));
  const sourceRows = directMatches.length > 0 ? directMatches : macroStateRows.slice(-5);

  return sourceRows
    .filter((row) => row.key)
    .map((row) => ({
      key: row.key,
      name: humanizeKey(row.key),
      status: row.status || "CLEAR",
      note: row.note || row.currentValue,
      current: row.currentValue,
      threshold: [
        row.thresholdAmber ? `AMBER ${row.thresholdAmber}` : "",
        row.thresholdRed ? `RED ${row.thresholdRed}` : "",
      ].filter(Boolean).join(" · "),
    }));
}

function parseEarningsCalendar(rows: Record<string, any>[]) {
  return rows
    .map((row) => {
      const confirmedRaw = findCol(row, "confirmed", "CONFIRMED");
      return {
        ticker: String(findCol(row, "ticker", "TICKER") ?? ""),
        nextEarningsDate: parseSheetDate(findCol(row, "next_earnings_date", "NEXT_EARNINGS_DATE", "next earnings date")),
        fiscalPeriod: String(findCol(row, "fiscal_period", "FISCAL_PERIOD", "fiscal period") ?? ""),
        confirmed:
          confirmedRaw === true ||
          String(confirmedRaw ?? "")
            .trim()
            .toUpperCase() === "TRUE",
        lastUpdated: parseSheetDate(findCol(row, "last_updated", "LAST_UPDATED")),
      };
    })
    .filter((item) => item.ticker.trim() !== "" && item.nextEarningsDate.trim() !== "");
}

export type LiveHolding = ReturnType<typeof parseHoldings>[number];
export type LiveWatchItem = ReturnType<typeof parseWatchlist>[number];
export type LiveLayer = ReturnType<typeof parseLayers>[number];
export type LiveScore = ReturnType<typeof parseScores>[number];
export type LiveScoreLog = ReturnType<typeof parseScoreLog>[number];
export type LiveMonitor = ReturnType<typeof parseMonitor>[number];
export type LiveDisruption = ReturnType<typeof parseDisruption>[number];
export type LivePerformance = ReturnType<typeof parsePerformance>[number];
export type LiveMacroBanner = NonNullable<ReturnType<typeof parseMacroBanner>>;
export type LiveRiskControl = ReturnType<typeof parseRiskControls>[number];
export type LiveWeeklyTrigger = ReturnType<typeof parseWeeklyTriggers>[number];
export type LiveEarningsCalendarItem = ReturnType<typeof parseEarningsCalendar>[number];

function parseTransactions(rows: Record<string, any>[]) {
  return rows
    .map((row, idx) => {
      const dateRaw = row["col_0"] ?? findCol(row, "date", "DATE", "Date");
      const account = String(row["col_1"] ?? findCol(row, "account", "ACCOUNT", "Account") ?? "");
      const ticker = String(row["col_2"] ?? findCol(row, "ticker", "TICKER", "Ticker") ?? "");
      const action = String(row["col_3"] ?? findCol(row, "action", "ACTION", "Action") ?? "");
      const shares = parseNum(row["col_4"] ?? findCol(row, "shares", "SHARES", "Shares"));
      const price = parseNum(row["col_5"] ?? findCol(row, "price", "PRICE", "Price"));
      const currency = String(row["col_6"] ?? findCol(row, "currency", "CURRENCY", "Ccy") ?? "USD");
      const fxRate = parseNum(row["col_7"] ?? findCol(row, "fx_rate", "FX_RATE", "FX Rate"));
      const valueGbp = parseNum(row["col_8"] ?? findCol(row, "value_gbp", "VALUE_GBP", "Value GBP", "Value (£)"));
      const tranche = String(row["col_9"] ?? findCol(row, "tranche", "TRANCHE", "Tranche") ?? "");
      const trigger = String(row["col_10"] ?? findCol(row, "trigger", "TRIGGER", "Trigger") ?? "");
      const rationale = String(row["col_11"] ?? findCol(row, "rationale", "RATIONALE", "Rationale") ?? "");
      const scoreAtEntry = parseNum(row["col_12"] ?? findCol(row, "score_at_entry", "SCORE_AT_ENTRY", "Score"));
      const layerName = String(row["col_13"] ?? findCol(row, "layer", "LAYER", "Layer") ?? "");
      const linkedScoreLog = String(row["col_14"] ?? "");
      return {
        date: parseSheetDate(dateRaw),
        account: account.trim(),
        ticker: ticker.trim(),
        action: action.trim().toUpperCase(),
        shares,
        price,
        currency: currency.trim(),
        fxRate,
        valueGbp,
        tranche: tranche.trim(),
        layer: layerName.trim(),
        trigger: trigger.trim(),
        rationale: rationale.trim(),
        scoreAtEntry,
        linkedScoreLog: linkedScoreLog.trim(),
      };
    })
    .filter((t) => t.ticker !== "" && t.action !== "" && t.date !== "");
}

export type LiveTransaction = ReturnType<typeof parseTransactions>[number];

function parseJisaHoldings(rows: Record<string, any>[]) {
  return rows
    .map((row) => ({
      child: String(row["col_0"] ?? findCol(row, "child", "CHILD", "Child") ?? ""),
      ticker: String(row["col_1"] ?? findCol(row, "ticker", "TICKER") ?? ""),
      name: String(row["col_2"] ?? findCol(row, "name", "NAME") ?? ""),
      type: String(row["col_3"] ?? findCol(row, "type", "TYPE") ?? ""),
      layer: String(row["col_4"] ?? findCol(row, "layer", "LAYER") ?? ""),
      shares: parseNum(row["col_5"] ?? findCol(row, "shares", "SHARES")),
      priceLocal: parseNum(row["col_6"] ?? findCol(row, "price_local", "PRICE_LOCAL")),
      currency: String(row["col_7"] ?? findCol(row, "currency", "CURRENCY") ?? "GBP"),
      mvGbp: parseNum(row["col_8"] ?? findCol(row, "mv_gbp", "MV_GBP")),
      weightPct: parseNum(row["col_9"] ?? findCol(row, "weight_pct", "WEIGHT_PCT")),
      costGbp: parseNum(row["col_10"] ?? findCol(row, "cost_gbp", "COST_GBP")),
      glPct: parseNum(row["col_11"] ?? findCol(row, "gl_pct", "GL_PCT")),
      codeGf: String(row["col_12"] ?? ""),
      targetPct: parseNum(row["col_13"] ?? findCol(row, "target_pct", "TARGET_PCT")),
      notes: String(row["col_14"] ?? findCol(row, "notes", "NOTES") ?? ""),
    }))
    .filter((h) => h.ticker.trim() !== "" && h.child.trim() !== "");
}

export type LiveJisaHolding = ReturnType<typeof parseJisaHoldings>[number];

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
  narrativeData: LiveNarrativeData;
  macroState: LiveMacroState;
  macroStateRows: LiveMacroStateRow[];
  macroBanner: LiveMacroBanner | null;
  riskControls: LiveRiskControl[];
  weeklyTriggers: LiveWeeklyTrigger[];
  earningsCalendar: LiveEarningsCalendarItem[];
  transactions: LiveTransaction[];
  cashSipp: number;
  cashIsa: number;
  cashTotal: number;
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
    narrativeData: createEmptyNarrativeData(),
    macroState: {},
    macroStateRows: [],
    macroBanner: null,
    riskControls: [],
    weeklyTriggers: [],
    earningsCalendar: [],
    transactions: [],
    cashSipp: 0,
    cashIsa: 0,
    cashTotal: 0,
    lastUpdated: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const [
        holdingsRaw,
        watchlistRaw,
        layersRaw,
        scoresRaw,
        scoreLogRaw,
        monitorRaw,
        disruptionRaw,
        performanceRaw,
        narrativeGrid,
        macroStateGrid,
        earningsCalendarRaw,
        cashGrid,
        transactionsRaw,
      ] = await Promise.all([
        fetchSheet({ gid: GIDS.holdings, range: "A1:AF50" }),
        fetchSheet({ gid: GIDS.watchlist, range: "A1:N40" }),
        fetchSheet({ gid: GIDS.layers, range: "A2:H11" }).catch(() => []),
        fetchSheet({ gid: GIDS.scores }).catch(() => []),
        fetchSheet({ gid: GIDS.scoreLog }).catch(() => []),
        fetchSheet({ gid: GIDS.monitor }).catch(() => []),
        fetchSheet({ gid: GIDS.disruption }).catch(() => []),
        fetchSheet({ gid: GIDS.performance }).catch(() => []),
        fetchSheetGrid({ gid: GIDS.narrative, range: "A1:Z2" }).catch(() => []),
        fetchSheetGrid({ gid: GIDS.macroState, range: "A1:G22" }).catch(() => []),
        fetchSheet({ gid: GIDS.earningsCalendar, range: "A1:F32" }).catch(() => []),
        fetchSheetGrid({ gid: GIDS.cash, range: "A1:C5" }).catch(() => []),
        fetchSheet({ gid: GIDS.transactions, range: "A1:O" }).catch(() => []),
      ]);

      const allHoldings = parseHoldings(holdingsRaw);
      const sipp = allHoldings.filter((holding) => holding.account.toUpperCase() === "SIPP");
      const isa = allHoldings.filter((holding) => holding.account.toUpperCase() === "ISA");
      const narrativeData = parseNarrativeData(narrativeGrid);
      const macroState = parseMacroState(macroStateGrid);
      const macroStateRows = parseMacroStateRows(macroState);

      // Parse cash balances from CASH sheet
      let cashSipp = 0, cashIsa = 0, cashTotal = 0;
      console.log("[CASH] raw grid:", JSON.stringify(cashGrid));
      if (cashGrid.length >= 2) {
        // Try header-based parsing: find columns by header row
        const headers = cashGrid[0].map((h) => normalizeToken(h));
        const sippIdx = headers.findIndex((h) => h.includes("sipp"));
        const isaIdx = headers.findIndex((h) => h.includes("isa"));
        const totalIdx = headers.findIndex((h) => h.includes("total"));
        const dataRow = cashGrid[1];
        if (sippIdx >= 0) cashSipp = parseMv(dataRow[sippIdx]);
        if (isaIdx >= 0) cashIsa = parseMv(dataRow[isaIdx]);
        if (totalIdx >= 0) cashTotal = parseMv(dataRow[totalIdx]);
        // Fallback: if no total but have both, sum them
        if (cashTotal === 0 && (cashSipp > 0 || cashIsa > 0)) cashTotal = cashSipp + cashIsa;
        // Fallback: row-based layout (col A = label, col B/C = values)
        if (cashSipp === 0 && cashIsa === 0 && cashTotal === 0) {
          for (const row of cashGrid) {
            const label = normalizeToken(row[0]);
            if (label.includes("sipp")) cashSipp = parseMv(row[1]) || parseMv(row[2]);
            else if (label.includes("isa")) cashIsa = parseMv(row[1]) || parseMv(row[2]);
            else if (label.includes("total")) cashTotal = parseMv(row[1]) || parseMv(row[2]);
          }
          if (cashTotal === 0 && (cashSipp > 0 || cashIsa > 0)) cashTotal = cashSipp + cashIsa;
        }
        // Fallback: positional A=SIPP, B=ISA, C=Total
        if (cashSipp === 0 && cashIsa === 0 && cashTotal === 0 && dataRow.length >= 2) {
          cashSipp = parseMv(dataRow[0]);
          cashIsa = parseMv(dataRow[1]);
          cashTotal = dataRow.length >= 3 ? parseMv(dataRow[2]) : cashSipp + cashIsa;
        }
      }
      console.log("[CASH] parsed:", { cashSipp, cashIsa, cashTotal });

      setState({
        holdings: allHoldings,
        sipp,
        isa,
        watchlist: parseWatchlist(watchlistRaw),
        layers: parseLayers(layersRaw),
        scores: parseScores(scoresRaw),
        scoreLog: parseScoreLog(scoreLogRaw),
        monitor: parseMonitor(monitorRaw),
        disruption: parseDisruption(disruptionRaw),
        performance: parsePerformance(performanceRaw),
        narrativeData,
        macroState,
        macroStateRows,
        macroBanner: parseMacroBanner(macroState, narrativeData),
        riskControls: parseRiskControls(macroState),
        weeklyTriggers: parseWeeklyTriggers(macroStateRows),
        earningsCalendar: parseEarningsCalendar(earningsCalendarRaw),
        transactions: parseTransactions(transactionsRaw),
        cashSipp,
        cashIsa,
        cashTotal,
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
