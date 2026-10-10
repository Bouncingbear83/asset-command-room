/**
 * WATCHLIST col AL "BAND" is the single source of truth for price bands.
 * The app never recomputes band thresholds; it only normalises and groups.
 */
export const BAND_VALUES = ["ZONE", "NEAR", "BENCH", "STALE", "NO_LEVEL", "UNIT_CHECK"] as const;
export type Band = (typeof BAND_VALUES)[number] | "" | "ERROR";

/** Empty → "", known value → itself, anything else (#REF!, #ERROR!, typos) → "ERROR". */
export function normBand(raw: unknown): Band {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!s) return "";
  return (BAND_VALUES as readonly string[]).includes(s) ? (s as Band) : "ERROR";
}

export const normStatusToken = (s: unknown) => String(s ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");

export type BandChip = "IN_ZONE" | "RESET" | "NEAR" | "STALE" | "DATA" | "BENCH" | "PARKED" | "ALL";
export const BAND_CHIPS: { key: BandChip; label: string }[] = [
  { key: "IN_ZONE", label: "In zone" },
  { key: "RESET", label: "Reset" },
  { key: "NEAR", label: "Near" },
  { key: "STALE", label: "Stale" },
  { key: "DATA", label: "Data" },
  { key: "BENCH", label: "Bench" },
  { key: "PARKED", label: "Parked" },
  { key: "ALL", label: "All" },
];

const PARKED_STATUSES = ["ARCHIVE", "PRE_IPO", "RESEARCH"];
const DEAD_LIKE = ["ARCHIVE", "ARCHIVED", "EXITED", "REJECTED", "REMOVED", "PRE_IPO", "RESEARCH"];
const startsAny = (st: string, list: string[]) => list.some((p) => st === p || st.startsWith(p + "_") || st.startsWith(p));

export function matchesChip(chip: BandChip, statusRaw: unknown, bandRaw: unknown): boolean {
  const st = normStatusToken(statusRaw);
  const band = normBand(bandRaw);
  switch (chip) {
    case "IN_ZONE": return band === "ZONE" && startsAny(st, ["WAIT_PRICE", "DEPLOY", "WAIT_EVENT"]);
    case "RESET": return band === "ZONE" && startsAny(st, ["ARCHIVE"]);
    case "NEAR": return band === "NEAR" && !startsAny(st, ["ARCHIVE"]);
    case "STALE": return band === "STALE" && startsAny(st, ["WAIT_PRICE"]);
    case "DATA": return band === "NO_LEVEL" || band === "UNIT_CHECK";
    case "BENCH": return band === "BENCH" && !startsAny(st, DEAD_LIKE);
    case "PARKED": return band !== "ZONE" && startsAny(st, PARKED_STATUSES);
    case "ALL": return true;
  }
}

/** Display-only distance to trigger: current / triggerPriceNumeric − 1, in %. */
export function distToTriggerPct(current: number | null | undefined, trigger: number | null | undefined): number | null {
  if (current == null || trigger == null || !(trigger > 0) || !Number.isFinite(current)) return null;
  return (current / trigger - 1) * 100;
}

export function defaultChip(counts: Record<BandChip, number>): BandChip {
  return counts.IN_ZONE > 0 ? "IN_ZONE" : "NEAR";
}
