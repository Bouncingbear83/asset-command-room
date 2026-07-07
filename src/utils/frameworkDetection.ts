/**
 * Framework detection utilities.
 * Scans SCORES changeNote / fullThesis and WATCHLIST rationale
 * for framework markers: G(m), G, H, F.
 */

import type { LiveScore, LiveWatchItem } from "@/hooks/usePortfolioData";

export type FrameworkTag = "G(m)" | "G" | "H" | "F";

const GM_PATTERNS = ["G(M)", "FRAMEWORK=G(M)", "RECLASS_PATTERN_GM"];
const G_PATTERNS = ["RECLASS_PATTERN_G:"]; // colon distinguishes from G(M)
const H_PATTERNS = ["FRAMEWORK_H", "COMPOUND_CATALYST"];
const F_PATTERNS = ["FRAMEWORK_F", "IAA_SOVEREIGNTY"];

function matchesAny(text: string, patterns: string[]): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return patterns.some((p) => upper.includes(p));
}

export function detectFramework(changeNote: string, fullThesis: string): FrameworkTag | null {
  const combined = `${changeNote} ${fullThesis}`;
  if (matchesAny(combined, GM_PATTERNS)) return "G(m)";
  if (matchesAny(combined, G_PATTERNS)) return "G";
  if (matchesAny(combined, H_PATTERNS)) return "H";
  if (matchesAny(combined, F_PATTERNS)) return "F";
  return null;
}

export function detectWatchlistFramework(rationale: string): FrameworkTag | null {
  if (matchesAny(rationale, GM_PATTERNS)) return "G(m)";
  if (matchesAny(rationale, G_PATTERNS)) return "G";
  if (matchesAny(rationale, H_PATTERNS)) return "H";
  if (matchesAny(rationale, F_PATTERNS)) return "F";
  return null;
}

export interface FrameworkEntry {
  ticker: string;
  framework: FrameworkTag;
  source: "scores" | "watchlist";
}

export function buildFrameworkIndex(
  scores: LiveScore[],
  watchlist: LiveWatchItem[],
): Map<string, FrameworkEntry> {
  const map = new Map<string, FrameworkEntry>();
  for (const s of scores) {
    const t = s.ticker.trim().toUpperCase();
    if (!t) continue;
    const fw = detectFramework(s.changeNote, s.fullThesis);
    if (fw) map.set(t, { ticker: t, framework: fw, source: "scores" });
  }
  for (const w of watchlist) {
    const t = w.ticker.trim().toUpperCase();
    if (!t || map.has(t)) continue;
    const fw = detectWatchlistFramework(w.rationale);
    if (fw) map.set(t, { ticker: t, framework: fw, source: "watchlist" });
  }
  return map;
}
