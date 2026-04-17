/**
 * URL <-> filter state serialiser for the Holdings tab.
 * Mirrors src/lib/url-state.ts but with Holdings-specific sort fields and
 * filter dimensions (account + alert + layer instead of held_status + layer).
 */

import { LAYER_VALUES, type Layer } from "@/types/intelligence";

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
  | "action";

export type HoldingsGroupBy = "none" | "layer" | "account" | "tier";

export type HoldingsAccount = "SIPP" | "ISA" | "SIPP+ISA";
export const HOLDINGS_ACCOUNT_VALUES: HoldingsAccount[] = ["SIPP", "ISA", "SIPP+ISA"];

export const ALERT_STATUS_VALUES = ["CLEAR", "WATCH", "REVIEW", "ADD_ZONE", "EXIT_ZONE"] as const;
export type HoldingsAlertStatus = (typeof ALERT_STATUS_VALUES)[number];

export interface HoldingsUiState {
  sortField: HoldingsSortField;
  sortDir: "asc" | "desc";
  groupBy: HoldingsGroupBy;
  accountFilter: HoldingsAccount[];     // empty = all
  alertFilter: HoldingsAlertStatus[];   // empty = all
  layerFilter: Layer[];                 // empty = all
  search: string;
}

export const DEFAULT_HOLDINGS_STATE: HoldingsUiState = {
  sortField: "mv",
  sortDir: "desc",
  groupBy: "layer",
  accountFilter: [],
  alertFilter: [],
  layerFilter: [],
  search: "",
};

const SORT_FIELDS: HoldingsSortField[] = [
  "ticker", "name", "layer", "account", "mv", "gl", "day", "price",
  "cost", "truePL", "annReturn", "action",
];
const GROUP_BYS: HoldingsGroupBy[] = ["none", "layer", "account", "tier"];

// External URL aliases (from spec) → internal sort field names.
// Lets users hand-craft URLs like ?sort=-gl_pct without breaking.
const SORT_FIELD_ALIASES: Record<string, HoldingsSortField> = {
  gl_pct: "gl",
  mv_gbp: "mv",
  day_pct: "day",
  ann_ret: "annReturn",
  true_pl: "truePL",
  price_local: "price",
};

export function normalizeAlert(raw: string): HoldingsAlertStatus | null {
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if ((ALERT_STATUS_VALUES as readonly string[]).includes(u)) return u as HoldingsAlertStatus;
  // Treat blank/missing as CLEAR
  if (!u) return "CLEAR";
  return null;
}

export function normalizeAccount(raw: string): HoldingsAccount | null {
  const u = raw.trim().toUpperCase();
  if (u === "SIPP" || u === "ISA" || u === "SIPP+ISA") return u as HoldingsAccount;
  return null;
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

  const alertRaw = params.get("alert");
  const alertFilter: HoldingsAlertStatus[] = alertRaw
    ? alertRaw
        .split(",")
        .map((s) => normalizeAlert(s))
        .filter((a): a is HoldingsAlertStatus => a !== null)
    : [];

  const layerRaw = params.get("layer");
  const layerFilter: Layer[] = layerRaw
    ? layerRaw
        .split(",")
        .map((s) => s.trim())
        .map((s) => LAYER_VALUES.find((l) => l.toLowerCase() === s.toLowerCase()))
        .filter((l): l is Layer => Boolean(l))
    : [];

  return {
    sortField,
    sortDir: dir,
    groupBy,
    accountFilter,
    alertFilter,
    layerFilter,
    search: params.get("q") ?? "",
  };
}

export function holdingsStateToParams(state: HoldingsUiState): URLSearchParams {
  const out = new URLSearchParams();
  const sortKey = `${state.sortDir === "desc" ? "-" : ""}${state.sortField}`;
  // Only emit non-defaults to keep URLs clean.
  if (sortKey !== "-mv") out.set("sort", sortKey);
  if (state.groupBy !== "layer") out.set("group", state.groupBy);
  if (state.accountFilter.length > 0) out.set("account", state.accountFilter.join(","));
  if (state.alertFilter.length > 0) out.set("alert", state.alertFilter.join(","));
  if (state.layerFilter.length > 0) out.set("layer", state.layerFilter.join(","));
  if (state.search.trim() !== "") out.set("q", state.search.trim());
  return out;
}
