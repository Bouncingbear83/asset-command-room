/** Rule #13 — per-driver (FACTOR_GROUP) caps. AI_INFRA is tighter (OB v3.13). Display only. */
export const DEFAULT_WARN_PCT = 35;
export const DEFAULT_BREACH_PCT = 40;
export const AI_INFRA_WARN_PCT = 30;
export const AI_INFRA_BREACH_PCT = 35;

export type DriverPriority = "OK" | "WARN" | "BREACH";

export function capsForGroup(group: string): { warn: number; breach: number } {
  return group === "AI_INFRA"
    ? { warn: AI_INFRA_WARN_PCT, breach: AI_INFRA_BREACH_PCT }
    : { warn: DEFAULT_WARN_PCT, breach: DEFAULT_BREACH_PCT };
}

/** Sheet priority (if set) wins; otherwise compare the weight to the group's caps. */
export function priorityFor(pct: number, raw: string | null, group?: string): DriverPriority {
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "BREACH" || u === "WARN" || u === "OK") return u as DriverPriority;
  const caps = group ? capsForGroup(group) : { warn: DEFAULT_WARN_PCT, breach: DEFAULT_BREACH_PCT };
  if (pct >= caps.breach) return "BREACH";
  if (pct >= caps.warn) return "WARN";
  return "OK";
}

export function driverCapCounts(latest: { factor_group: string; current_pct: number; priority: string | null }[]) {
  let breach = 0, warn = 0, ok = 0;
  for (const r of latest) {
    const p = priorityFor(r.current_pct, r.priority, r.factor_group);
    if (p === "BREACH") breach++; else if (p === "WARN") warn++; else ok++;
  }
  return { breach, warn, ok };
}
