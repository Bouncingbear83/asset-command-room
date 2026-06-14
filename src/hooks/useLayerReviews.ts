import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LayerReview {
  id: string;
  layer: string;
  cycle: string;
  scheduled_date: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETE" | "SKIPPED";
  completed_date: string | null;
  session_vault_path: string | null;
  review_vault_path: string | null;
  open_trends: number;
  action_items: ActionItem[];
  prompt_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  text: string;
  done: boolean;
}

export interface TrendCount {
  layer: string;
  count: number;
}

export function useLayerReviews(cycle = "Q3-2026") {
  const [reviews, setReviews] = useState<LayerReview[]>([]);
  const [trendCounts, setTrendCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch schedule
      const { data: scheduleData, error: scheduleErr } = await supabase
        .from("layer_review_schedule")
        .select("*")
        .eq("cycle", cycle)
        .order("scheduled_date", { ascending: true });

      if (scheduleErr) throw scheduleErr;

      const parsed: LayerReview[] = (scheduleData || []).map((row: any) => ({
        ...row,
        action_items: Array.isArray(row.action_items)
          ? row.action_items
          : typeof row.action_items === "string"
            ? JSON.parse(row.action_items)
            : [],
      }));

      setReviews(parsed);

      // Fetch open trend counts from vault_notes_meta
      const { data: trendData, error: trendErr } = await supabase
        .from("vault_notes_meta")
        .select("frontmatter")
        .eq("type", "trend");

      if (!trendErr && trendData) {
        const counts: Record<string, number> = {};
        for (const row of trendData) {
          const fm = typeof row.frontmatter === "string" ? JSON.parse(row.frontmatter) : row.frontmatter;
          if (fm?.status === "OPEN" && fm?.layer) {
            counts[fm.layer] = (counts[fm.layer] || 0) + 1;
          }
        }
        setTrendCounts(counts);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  }, [cycle]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const markDone = useCallback(
    async (reviewId: string) => {
      const today = new Date().toISOString().split("T")[0];
      const { error: updateErr } = await supabase
        .from("layer_review_schedule")
        .update({ status: "COMPLETE", completed_date: today })
        .eq("id", reviewId);

      if (!updateErr) fetchReviews();
    },
    [fetchReviews],
  );

  const toggleActionItem = useCallback(
    async (reviewId: string, itemIndex: number) => {
      const review = reviews.find((r) => r.id === reviewId);
      if (!review) return;

      const updated = [...review.action_items];
      updated[itemIndex] = { ...updated[itemIndex], done: !updated[itemIndex].done };

      const { error: updateErr } = await supabase
        .from("layer_review_schedule")
        .update({ action_items: updated })
        .eq("id", reviewId);

      if (!updateErr) fetchReviews();
    },
    [reviews, fetchReviews],
  );

  return { reviews, trendCounts, loading, error, markDone, toggleActionItem, refresh: fetchReviews };
}
