/**
 * Tiny URL <-> filter state serialiser used by the Intelligence tab.
 * Pure functions; React Router's `useSearchParams` is the carrier.
 */

import type { HeldStatus, Layer } from "@/types/intelligence";
import { HELD_STATUS_VALUES, LAYER_VALUES, RETURN_PROFILE_VALUES } from "@/types/intelligence";
import { FACTOR_GROUP_VALUES, STACK_LAYER_VALUES } from "@/components/holdings/DriverChip";

export type SortField = "score" | "ticker" | "layer" | "disruption" | "buy_distance" | "lband" | "stack" | "asymmetry";
export type GroupBy = "none" | "layer" | "status" | "tier" | "driver" | "lband";

export type SubstrateLevel = "L1" | "L2" | "L3" | "L4";
export const SUBSTRATE_LEVEL_VALUES: SubstrateLevel[] = ["L1", "L2", "L3", "L4"];

export type StackLayerKey = (typeof STACK_LAYER_VALUES)[number];
export type DriverKey = (typeof FACTOR_GROUP_VALUES)[number];

/** Profile filter token — RETURN_PROFILE values plus split for COMPOUNDER subtypes. */
export type ProfileFilterKey =
  | "STELLAR_COMPOUNDER"
  | "GENERIC_COMPOUNDER"
  | "RECLASSIFICATION"
  | "CYCLE"
  | "HEDGE"
  | "VEHICLE"
  | "PRE_PRODUCTION";

export const PROFILE_FILTER_KEYS: ProfileFilterKey[] = [
  "STELLAR_COMPOUNDER",
  "GENERIC_COMPOUNDER",
  "RECLASSIFICATION",
  "CYCLE",
  "HEDGE",
  "VEHICLE",
  "PRE_PRODUCTION",
];

export interface IntelligenceUiState {
  sortField: SortField;
  sortDir: "asc" | "desc";
  groupBy: GroupBy;
  statusFilter: HeldStatus[]; // empty = all
  layerFilter: Layer[];       // empty = all
  profileFilter: ProfileFilterKey[]; // empty = all
  lbandFilter: SubstrateLevel[]; // empty = all
  stackFilter: StackLayerKey[]; // empty = all
  driverFilter: DriverKey[]; // empty = all
  search: string;
}

export const DEFAULT_STATE: IntelligenceUiState = {
  sortField: "score",
  sortDir: "desc",
  groupBy: "none",
  statusFilter: [],
  layerFilter: [],
  profileFilter: [],
  lbandFilter: [],
  stackFilter: [],
  driverFilter: [],
  search: "",
};

const SORT_FIELDS: SortField[] = ["score", "ticker", "layer", "disruption", "buy_distance", "lband", "stack"];
const GROUP_BYS: GroupBy[] = ["none", "layer", "status", "tier", "driver", "lband"];

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

  const profileRaw = params.get("profile");
  const profileFilter: ProfileFilterKey[] = profileRaw
    ? profileRaw
        .split(",")
        .map((s) => s.trim().toUpperCase().replace(/[\s-]+/g, "_"))
        .filter((s): s is ProfileFilterKey => (PROFILE_FILTER_KEYS as string[]).includes(s))
    : [];

  const lbandRaw = params.get("lband");
  const lbandFilter: SubstrateLevel[] = lbandRaw
    ? lbandRaw.split(",").map((s) => s.trim().toUpperCase())
        .filter((s): s is SubstrateLevel => (SUBSTRATE_LEVEL_VALUES as string[]).includes(s))
    : [];

  const stackRaw = params.get("stack");
  const stackFilter: StackLayerKey[] = stackRaw
    ? stackRaw.split(",").map((s) => s.trim().toUpperCase())
        .filter((s): s is StackLayerKey => (STACK_LAYER_VALUES as readonly string[]).includes(s))
    : [];

  const driverRaw = params.get("driver");
  const driverFilter: DriverKey[] = driverRaw
    ? driverRaw.split(",").map((s) => s.trim().toUpperCase())
        .filter((s): s is DriverKey => (FACTOR_GROUP_VALUES as readonly string[]).includes(s))
    : [];

  return {
    sortField,
    sortDir: dir,
    groupBy,
    statusFilter,
    layerFilter,
    profileFilter,
    lbandFilter,
    stackFilter,
    driverFilter,
    search: params.get("q") ?? "",
  };
}

export function stateToParams(state: IntelligenceUiState): URLSearchParams {
  const out = new URLSearchParams();
  const sortKey = `${state.sortDir === "desc" ? "-" : ""}${state.sortField}`;
  if (sortKey !== "-score") out.set("sort", sortKey);
  if (state.groupBy !== "none") out.set("group", state.groupBy);
  if (state.statusFilter.length > 0) out.set("status", state.statusFilter.join(","));
  if (state.layerFilter.length > 0) out.set("layer", state.layerFilter.join(","));
  if (state.profileFilter.length > 0) out.set("profile", state.profileFilter.join(","));
  if (state.lbandFilter.length > 0) out.set("lband", state.lbandFilter.join(","));
  if (state.stackFilter.length > 0) out.set("stack", state.stackFilter.join(","));
  if (state.driverFilter.length > 0) out.set("driver", state.driverFilter.join(","));
  if (state.search.trim() !== "") out.set("q", state.search.trim());
  return out;
}

export { RETURN_PROFILE_VALUES };
