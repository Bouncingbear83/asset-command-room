import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduledReview {
  id: string;
  review_type: string;
  title: string;
  next_due: string;
  last_completed: string | null;
  cadence: string;
  status: string;
  notes: string | null;
  ticker: string | null;
  vault_path: string | null;
  created_at: string;
  updated_at: string;
}

export function useScheduledReviews() {
  const [reviews, setReviews] = useState<ScheduledReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await (supabase as any)
        .from("scheduled_reviews")
        .select("*")
        .not("status", "eq", "DISMISSED")
        .order("next_due", { ascending: true });

      if (err) throw err;
      setReviews((data || []) as ScheduledReview[]);
    } catch (err: any) {
      setError(err.message || "Failed to fetch scheduled reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const markDone = useCallback(
    async (reviewId: string) => {
      const today = new Date().toISOString().split("T")[0];
      const review = reviews.find((r) => r.id === reviewId);
      if (!review) return;

      if (review.cadence === "ONE_OFF") {
        // One-off: mark completed
        await (supabase as any)
          .from("scheduled_reviews")
          .update({ status: "COMPLETED", last_completed: today })
          .eq("id", reviewId);
      } else {
        // Recurring: advance next_due by cadence, mark last_completed
        const nextDue = new Date(review.next_due);
        if (review.cadence === "QUARTERLY") nextDue.setDate(nextDue.getDate() + 90);
        else if (review.cadence === "MONTHLY") nextDue.setDate(nextDue.getDate() + 30);
        else if (review.cadence === "WEEKLY") nextDue.setDate(nextDue.getDate() + 7);

        await (supabase as any)
          .from("scheduled_reviews")
          .update({
            status: "UPCOMING",
            last_completed: today,
            next_due: nextDue.toISOString().split("T")[0],
          })
          .eq("id", reviewId);
      }
      fetchReviews();
    },
    [reviews, fetchReviews],
  );

  const dismiss = useCallback(
    async (reviewId: string) => {
      await (supabase as any)
        .from("scheduled_reviews")
        .update({ status: "DISMISSED" })
        .eq("id", reviewId);
      fetchReviews();
    },
    [fetchReviews],
  );

  return { reviews, loading, error, markDone, dismiss, refresh: fetchReviews };
}
