/**
 * Framework detection utilities.
 * Normalises the FRAMEWORK column from SCORES and WATCHLIST into a canonical
 * FrameworkTag ("G(m)" | "G" | "H" | "F") and builds a per-ticker index.
 */

import type { LiveScore, LiveWatchItem } from "@/hooks/usePortfolioData";

export type FrameworkTag = "G(m)" | "G" | "H" | "F";

export interface FrameworkEntry {
  ticker: string;
  framework: FrameworkTag;
  source: "score" | "watchlist";
}

function normalize(raw: unknown): FrameworkTag | null {
  if (raw == null) return null;
  const fw = String(raw).trim().toUpperCase();
  if (!fw) return null;
  if (fw === "G(M)" || fw === "GM" || fw === "G-M" || fw === "G_M") return "G(m)";
  if (fw === "G") return "G";
  if (fw === "H") return "H";
  if (fw === "F") return "F";
  return null;
}

export function detectFramework(score: LiveScore): FrameworkTag | null {
  return normalize((score as any)?.framework);
}

export function detectWatchlistFramework(item: LiveWatchItem): FrameworkTag | null {
  return normalize((item as any)?.framework);
}

export function buildFrameworkIndex(
  scores: LiveScore[],
  watchlist: LiveWatchItem[],
): Map<string, FrameworkEntry> {
  const idx = new Map<string, FrameworkEntry>();
  for (const s of scores) {
    const t = s.ticker?.trim().toUpperCase();
    if (!t) continue;
    const fw = detectFramework(s);
    if (fw) idx.set(t, { ticker: t, framework: fw, source: "score" });
  }
  for (const w of watchlist) {
    const t = w.ticker?.trim().toUpperCase();
    if (!t || idx.has(t)) continue;
    const fw = detectWatchlistFramework(w);
    if (fw) idx.set(t, { ticker: t, framework: fw, source: "watchlist" });
  }
  return idx;
}
