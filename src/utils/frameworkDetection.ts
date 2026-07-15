import type { LiveScore, LiveWatchItem } from "@/hooks/usePortfolioData";

export type FrameworkTag = "G(m)" | "G" | "H" | "F" | "QI" | "SD" | "CS" | "CY";

export const FRAMEWORK_TAGS: readonly FrameworkTag[] = [
  "QI", "G", "G(m)", "H", "F", "SD", "CS", "CY",
] as const;

export const FRAMEWORK_LABEL: Record<FrameworkTag, string> = {
  "QI":   "Qualified Incumbent",
  "G":    "Reclass Pattern",
  "G(m)": "Micro-Cap Reclass",
  "H":    "Compound Catalyst",
  "F":    "Sovereignty",
  "SD":   "Structural Deficit",
  "CS":   "Coordination Substrate",
  "CY":   "Cyclical Substrate",
};

export const FRAMEWORK_COLOR: Record<FrameworkTag, string> = {
  "QI":   "rgb(96,165,250)",
  "G":    "rgb(245,158,11)",
  "G(m)": "rgb(251,146,60)",
  "H":    "rgb(192,132,252)",
  "F":    "rgb(34,197,94)",
  "SD":   "rgb(239,68,68)",
  "CS":   "rgb(34,211,238)",
  "CY":   "rgb(156,163,175)",
};

export interface FrameworkEntry {
  framework: FrameworkTag;
  source: "scores" | "watchlist";
}

export function getFramework(score: { framework?: string }): FrameworkTag | null {
  const fw = (score.framework ?? "").trim().toUpperCase();
  if (fw === "G(M)") return "G(m)";
  if (fw === "G") return "G";
  if (fw === "H") return "H";
  if (fw === "F") return "F";
  if (fw === "QI") return "QI";
  if (fw === "SD") return "SD";
  if (fw === "CS") return "CS";
  if (fw === "CY") return "CY";
  return null;
}

/**
 * Build a Map<ticker, FrameworkEntry> from SCORES and WATCHLIST data.
 * SCORES takes priority when a ticker appears in both.
 */
export function buildFrameworkIndex(
  scores: LiveScore[],
  watchlist: LiveWatchItem[],
): Map<string, FrameworkEntry> {
  const index = new Map<string, FrameworkEntry>();

  // Watchlist first (lower priority)
  for (const w of watchlist) {
    const t = (w.ticker ?? "").trim().toUpperCase();
    if (!t) continue;
    const fw = getFramework({ framework: (w as any).framework });
    if (fw) index.set(t, { framework: fw, source: "watchlist" });
  }

  // Scores override
  for (const s of scores) {
    const t = (s.ticker ?? "").trim().toUpperCase();
    if (!t) continue;
    const fw = getFramework(s);
    if (fw) index.set(t, { framework: fw, source: "scores" });
  }

  return index;
}
