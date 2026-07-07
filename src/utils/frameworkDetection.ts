import type { LiveScore, LiveWatchItem } from "@/hooks/usePortfolioData";

export type FrameworkTag = "G(m)" | "G" | "H" | "F";

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
