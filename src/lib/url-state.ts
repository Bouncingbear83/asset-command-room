/**
 * Tiny URL <-> filter state serialiser used by the Intelligence tab.
 * Pure functions; React Router's `useSearchParams` is the carrier.
 */

import type { HeldStatus, Layer } from "@/types/intelligence";
import { HELD_STATUS_VALUES, LAYER_VALUES } from "@/types/intelligence";

export type SortField = "score" | "ticker" | "layer" | "disruption" | "buy_distance";
export type GroupBy = "none" | "layer" | "status" | "tier";

export interface IntelligenceUiState {
  sortField: SortField;
  sortDir: "asc" | "desc";
  groupBy: GroupBy;
  statusFilter: HeldStatus[]; // empty = all
  layerFilter: Layer[];       // empty = all
  search: string;
}

export const DEFAULT_STATE: IntelligenceUiState = {
  sortField: "score",
  sortDir: "desc",
  groupBy: "none",
  statusFilter: [],
  layerFilter: [],
  search: "",
};

const SORT_FIELDS: SortField[] = ["score", "ticker", "layer", "disruption", "buy_distance"];
const GROUP_BYS: GroupBy[] = ["none", "layer", "status", "tier"];

export function stateFromParams(params: URLSearchParams): IntelligenceUiState {
  const rawSort = params.get("sort") ?? "-score";
  const dir: "asc" | "desc" = rawSort.startsWith("-") ? "desc" : "asc";
  const fieldRaw = (rawSort.startsWith("-") ? rawSort.slice(1) : rawSort) as SortField;
  const sortField: SortField = SORT_FIELDS.includes(fieldRaw) ? fieldRaw : "score";

  const groupRaw = (params.get("group") ?? "none") as GroupBy;
  const groupBy: GroupBy = GROUP_BYS.includes(groupRaw) ? groupRaw : "none";

  const statusRaw = params.get("status");
  const statusFilter: HeldStatus[] = statusRaw
    ? statusRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s): s is HeldStatus => (HELD_STATUS_VALUES as string[]).includes(s))
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
    statusFilter,
    layerFilter,
    search: params.get("q") ?? "",
  };
}

export function stateToParams(state: IntelligenceUiState): URLSearchParams {
  const out = new URLSearchParams();
  const sortKey = `${state.sortDir === "desc" ? "-" : ""}${state.sortField}`;
  // Only emit non-defaults to keep URLs clean.
  if (sortKey !== "-score") out.set("sort", sortKey);
  if (state.groupBy !== "none") out.set("group", state.groupBy);
  if (state.statusFilter.length > 0) out.set("status", state.statusFilter.join(","));
  if (state.layerFilter.length > 0) out.set("layer", state.layerFilter.join(","));
  if (state.search.trim() !== "") out.set("q", state.search.trim());
  return out;
}
