/**
 * URL <-> filter state serialiser for the Holdings tab.
 * Mirrors src/lib/url-state.ts but with Holdings-specific sort fields and
 * filter dimensions (account + action + factor + layer).
 */

import { LAYER_VALUES, type Layer } from "@/types/intelligence";
import { FRAMEWORK_TAGS, type FrameworkTag } from "@/utils/frameworkDetection";

export type HoldingsSortField =
  | "ticker"
  | "name"
  | "layer"
  | "account"
  | "mv"
  | "gl"
  | "day"
  | "price"
  | "cost"
  | "truePL"
  | "annReturn"
  | "action"
  | "driver"
  | "stack"
  | "asymmetry"
  | "irrBb";


export type HoldingsGroupBy = "none" | "layer" | "account" | "tier";

export type HoldingsAccount = "SIPP" | "ISA" | "SIPP+ISA" | "BORDIER";
export const HOLDINGS_ACCOUNT_VALUES: HoldingsAccount[] = ["SIPP", "ISA", "SIPP+ISA", "BORDIER"];

export interface HoldingsUiState {
  sortField: HoldingsSortField;
  sortDir: "asc" | "desc";
  groupBy: HoldingsGroupBy;
  accountFilter: HoldingsAccount[];   // empty = all
  actionFilter: string[];             // uppercase+underscore, empty = all
  factorFilter: string[];             // uppercase+underscore, empty = all
  driverFilter: string[];             // FACTOR_GROUP enum, empty = all
  stackFilter: string[];              // STACK_LAYER enum, empty = all
  frameworkFilter: string[];           // FRAMEWORK enum, empty = all
  layerFilter: Layer[];               // empty = all
  /** Restrict to an explicit ticker set (case-insensitive). Empty = no restriction.
   *  Used by deep-links (e.g. Layers tab matrix cell → "show me these holdings"). */
  tickers: string[];
  search: string;
}

export const DEFAULT_HOLDINGS_STATE: HoldingsUiState = {
  sortField: "mv",
  sortDir: "desc",
  groupBy: "layer",
  accountFilter: [],
  actionFilter: [],
  factorFilter: [],
  driverFilter: [],
  stackFilter: [],
  frameworkFilter: [],
  layerFilter: [],
  tickers: [],
  search: "",
};

const SORT_FIELDS: HoldingsSortField[] = [
  "ticker", "name", "layer", "account", "mv", "gl", "day", "price",
  "cost", "truePL", "annReturn", "action", "driver", "stack", "asymmetry", "irrBb",
];
const GROUP_BYS: HoldingsGroupBy[] = ["none", "layer", "account", "tier"];

// External URL aliases (from spec) → internal sort field names.
const SORT_FIELD_ALIASES: Record<string, HoldingsSortField> = {
  gl_pct: "gl",
  mv_gbp: "mv",
  day_pct: "day",
  ann_ret: "annReturn",
  true_pl: "truePL",
  price_local: "price",
  factor_group: "driver",
  stack_layer: "stack",
  irr_bb: "irrBb",
  irr: "irrBb",
};

export function normalizeAccount(raw: string): HoldingsAccount | null {
  const u = raw.trim().toUpperCase();
  if (u === "SIPP" || u === "ISA" || u === "SIPP+ISA") return u as HoldingsAccount;
  // Bordier_GIA, BORDIER GIA, bordier-gia, etc. → BORDIER
  if (u.replace(/[^A-Z]/g, "").startsWith("BORDIER")) return "BORDIER";
  return null;
}

/** Canonicalise freeform ACTION / FACTOR_PRIMARY values: uppercase + underscores. */
export function normalizeActionFactor(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

export function holdingsStateFromParams(params: URLSearchParams): HoldingsUiState {
  const rawSort = params.get("sort") ?? "-mv";
  const dir: "asc" | "desc" = rawSort.startsWith("-") ? "desc" : "asc";
  const fieldRaw = (rawSort.startsWith("-") ? rawSort.slice(1) : rawSort);
  const aliased = SORT_FIELD_ALIASES[fieldRaw];
  const candidate = (aliased ?? fieldRaw) as HoldingsSortField;
  const sortField: HoldingsSortField = SORT_FIELDS.includes(candidate) ? candidate : "mv";

  const groupRaw = (params.get("group") ?? "layer") as HoldingsGroupBy;
  const groupBy: HoldingsGroupBy = GROUP_BYS.includes(groupRaw) ? groupRaw : "layer";

  const accountRaw = params.get("account");
  const accountFilter: HoldingsAccount[] = accountRaw
    ? accountRaw
        .split(",")
        .map((s) => normalizeAccount(s))
        .filter((a): a is HoldingsAccount => a !== null)
    : [];

  const actionRaw = params.get("action");
  const actionFilter: string[] = actionRaw
    ? actionRaw.split(",").map(normalizeActionFactor).filter(Boolean)
    : [];

  const factorRaw = params.get("factor");
  const factorFilter: string[] = factorRaw
    ? factorRaw.split(",").map(normalizeActionFactor).filter(Boolean)
    : [];

  const driverRaw = params.get("driver");
  const driverFilter: string[] = driverRaw
    ? driverRaw.split(",").map(normalizeActionFactor).filter(Boolean)
    : [];

  const stackRaw = params.get("stack");
  const stackFilter: string[] = stackRaw
    ? stackRaw.split(",").map(normalizeActionFactor).filter(Boolean)
    : [];

  const frameworkRaw = params.get("framework");
  const frameworkFilter: string[] = frameworkRaw
    ? frameworkRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const layerRaw = params.get("layer");
  const layerFilter: Layer[] = layerRaw
    ? layerRaw
        .split(",")
        .map((s) => s.trim())
        .map((s) => LAYER_VALUES.find((l) => l.toLowerCase() === s.toLowerCase()))
        .filter((l): l is Layer => Boolean(l))
    : [];

  const tickersRaw = params.get("tickers");
  const tickers: string[] = tickersRaw
    ? tickersRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : [];

  return {
    sortField,
    sortDir: dir,
    groupBy,
    accountFilter,
    actionFilter,
    factorFilter,
    driverFilter,
    stackFilter,
    frameworkFilter,
    layerFilter,
    tickers,
    search: params.get("q") ?? "",
  };
}

export function holdingsStateToParams(state: HoldingsUiState): URLSearchParams {
  const out = new URLSearchParams();
  const sortKey = `${state.sortDir === "desc" ? "-" : ""}${state.sortField}`;
  if (sortKey !== "-mv") out.set("sort", sortKey);
  if (state.groupBy !== "layer") out.set("group", state.groupBy);
  if (state.accountFilter.length > 0) out.set("account", state.accountFilter.join(","));
  if (state.actionFilter.length > 0) out.set("action", state.actionFilter.join(","));
  if (state.factorFilter.length > 0) out.set("factor", state.factorFilter.join(","));
  if (state.driverFilter.length > 0) out.set("driver", state.driverFilter.join(","));
  if (state.stackFilter.length > 0) out.set("stack", state.stackFilter.join(","));
  if (state.frameworkFilter.length > 0) out.set("framework", state.frameworkFilter.join(","));
  if (state.layerFilter.length > 0) out.set("layer", state.layerFilter.join(","));
  if (state.tickers.length > 0) out.set("tickers", state.tickers.join(","));
  if (state.search.trim() !== "") out.set("q", state.search.trim());
  return out;
}
