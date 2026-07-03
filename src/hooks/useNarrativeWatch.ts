/**
 * useNarrativeWatch — stub hook.
 *
 * The narrative_watch table has not been created yet. This hook returns an
 * empty state so NarrativeWatchCard renders its empty placeholder rather than
 * breaking the build. Wire up to Supabase once the table exists.
 */

import { useState, useEffect } from "react";

export type WatchCategory =
  | "catalyst"
  | "risk"
  | "thesis_check"
  | "macro"
  | "structural"
  | "other";

export const CATEGORY_LABELS: Record<WatchCategory, string> = {
  catalyst: "Catalyst",
  risk: "Risk",
  thesis_check: "Thesis Check",
  macro: "Macro",
  structural: "Structural",
  other: "Other",
};

export const CATEGORY_COLORS: Record<WatchCategory, string> = {
  catalyst: "rgb(74,222,128)",
  risk: "rgb(248,113,113)",
  thesis_check: "rgb(250,204,21)",
  macro: "rgb(96,165,250)",
  structural: "rgb(192,132,252)",
  other: "var(--text-dim)",
};

export interface NarrativeWatchItem {
  id: string;
  ticker: string | null;
  layer: string | null;
  category: WatchCategory | string;
  content: string;
  updated_at: string;
}

interface State {
  tickerItems: NarrativeWatchItem[];
  layerItems: NarrativeWatchItem[];
  loading: boolean;
}

export function useNarrativeWatchAll(): State {
  const [state] = useState<State>({
    tickerItems: [],
    layerItems: [],
    loading: false,
  });
  useEffect(() => {}, []);
  return state;
}
