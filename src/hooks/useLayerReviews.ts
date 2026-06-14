import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LayerReviewStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETE" | "SKIPPED";

export interface ActionItem {
  text: string;
  done: boolean;
}

export interface LayerReview {
  id: string;
  layer: string;
  cycle: string;
  scheduled_date: string;
  status: LayerReviewStatus;
  completed_date: string | null;
  session_vault_path: string | null;
  review_vault_path: string | null;
  open_trends: number | null;
  action_items: ActionItem[];
  prompt_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseLayerReviewsResult {
  reviews: LayerReview[];
  trendCountsByLayer: Record<string, number>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markComplete: (id: string) => Promise<void>;
  updateActionItems: (id: string, items: ActionItem[]) => Promise<void>;
}

function normalizeActionItems(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is { text?: unknown; done?: unknown } => typeof x === "object" && x !== null)
    .map((x) => ({
      text: typeof x.text === "string" ? x.text : "",
      done: Boolean(x.done),
    }));
}

export function useLayerReviews(cycle: string): UseLayerReviewsResult {
  const [reviews, setReviews] = useState<LayerReview[]>([]);
  const [trendCountsByLayer, setTrendCountsByLayer] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("layer_review_schedule")
        .select("*")
        .eq("cycle", cycle)
        .order("scheduled_date", { ascending: true });

      if (qErr) throw qErr;

      const rows = (data || []).map((r: any) => ({
        ...r,
        action_items: normalizeActionItems(r.action_items),
      })) as LayerReview[];
      setReviews(rows);

      // Fetch trend counts from vault_notes_meta where type=trend, status=OPEN
      const { data: trendData, error: trendErr } = await supabase
        .from("vault_notes_meta")
        .select("frontmatter")
        .eq("type", "trend");

      if (!trendErr && trendData) {
        const counts: Record<string, number> = {};
        for (const row of trendData as any[]) {
          const fm = row.frontmatter || {};
          const status = (fm.status || "").toString().toUpperCase();
          if (status !== "OPEN") continue;
          const layer = fm.layer || fm.Layer;
          if (typeof layer === "string" && layer.trim()) {
            counts[layer] = (counts[layer] || 0) + 1;
          }
        }
        setTrendCountsByLayer(counts);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load layer reviews");
    } finally {
      setLoading(false);
    }
  }, [cycle]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const markComplete = useCallback(
    async (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error: uErr } = await supabase
        .from("layer_review_schedule")
        .update({ status: "COMPLETE", completed_date: today } as any)
        .eq("id", id);
      if (uErr) throw uErr;
      await fetchReviews();
    },
    [fetchReviews]
  );

  const updateActionItems = useCallback(
    async (id: string, items: ActionItem[]) => {
      const { error: uErr } = await supabase
        .from("layer_review_schedule")
        .update({ action_items: items as any })
        .eq("id", id);
      if (uErr) throw uErr;
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, action_items: items } : r)));
    },
    []
  );

  return { reviews, trendCountsByLayer, loading, error, refetch: fetchReviews, markComplete, updateActionItems };
}
