/**
 * Sprint A · A3 — Rule 13 on deploy rows (Rule 13, P3b, P5). Reuses the caps in driverCaps.ts.
 * Display only.
 */
import { capsForGroup } from "@/lib/driverCaps";
import { RULE13_P5_BUFFER_PP } from "@/config/signalRules";

export type Rule13Level = "OK" | "P5" | "WARN" | "BREACH";
export interface Rule13 { level: Rule13Level; badge: string | null; blocksArmed: boolean }

export function rule13Status(group: string | null | undefined, groupPct: number | null | undefined): Rule13 {
  const g = String(group ?? "").trim().toUpperCase();
  if (!g || groupPct == null || !Number.isFinite(groupPct)) return { level: "OK", badge: null, blocksArmed: false };
  const caps = capsForGroup(g);
  if (groupPct >= caps.breach) return { level: "BREACH", badge: "RULE 13 BREACH: no add", blocksArmed: true };
  if (groupPct >= caps.warn) return { level: "WARN", badge: "RULE 13 OVERRIDE NEEDED", blocksArmed: false };
  // P5 is a display proxy: the app cannot run the P5 peak-mark test (needs 5 Oct marks); the session does.
  if (groupPct >= caps.warn - RULE13_P5_BUFFER_PP) return { level: "P5", badge: "RULE 13: P5 peak-mark test required (session)", blocksArmed: false };
  return { level: "OK", badge: null, blocksArmed: false };
}

/** P3b — Armed rows sharing a factor_primary (2+) group under "one per session (P3b)". */
export function p3bGroups<T extends { factorPrimary?: string | null }>(rows: T[]): { primary: string | null; rows: T[] }[] {
  const counts = new Map<string, number>();
  for (const r of rows) { const p = String(r.factorPrimary ?? "").trim().toUpperCase(); if (p) counts.set(p, (counts.get(p) ?? 0) + 1); }
  const out: { primary: string | null; rows: T[] }[] = [];
  const grouped = new Map<string, { primary: string | null; rows: T[] }>();
  for (const r of rows) {
    const p = String(r.factorPrimary ?? "").trim().toUpperCase();
    if (p && (counts.get(p) ?? 0) >= 2) {
      let g = grouped.get(p);
      if (!g) { g = { primary: p, rows: [] }; grouped.set(p, g); out.push(g); }
      g.rows.push(r);
    } else out.push({ primary: null, rows: [r] });
  }
  return out;
}
