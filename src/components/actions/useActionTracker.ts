import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";

export type ActionType =
  | "EARNINGS_GATE"
  | "PRICE_GATE"
  | "CATALYST_WATCH"
  | "REVIEW_DUE"
  | "KILL_CHECK"
  | "MANUAL";

export type ActionStatus = "OPEN" | "CONFIRMED" | "DISMISSED" | "EXPIRED";
export type ActionPriority = "HIGH" | "MEDIUM" | "LOW";
export type ActionSource = "WATCHLIST" | "HOLDINGS" | "EARNINGS" | "SESSION" | "MANUAL";

export interface ActionItem {
  id: string; // supabase id or ephemeral synthetic id
  ticker: string | null;
  action_type: ActionType;
  due_date: string; // yyyy-mm-dd
  summary: string;
  context: string | null;
  source: ActionSource | null;
  source_session: string | null;
  status: ActionStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  priority: ActionPriority;
  dedupe_key: string | null;
  persisted: boolean; // false when purely sheet-derived and not yet upserted
}

interface Args {
  watchlist: LiveWatchItem[];
  holdings: LiveHolding[];
  earnings: LiveEarningsCalendarItem[];
}

function toDateISO(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Accept yyyy-mm-dd directly; otherwise attempt Date parse
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function makeKey(ticker: string | null, type: ActionType, due: string): string {
  return `${(ticker ?? "").toUpperCase()}|${type}|${due}`;
}

export function useActionTracker({ watchlist, holdings, earnings }: Args) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any)
      .from("action_tracker")
      .select("*")
      .order("due_date", { ascending: true });
    if (err) setError(err.message);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Build sheet-derived items
  const sheetItems: ActionItem[] = useMemo(() => {
    const out: ActionItem[] = [];
    const today = new Date();
    const cutoffPast = new Date(today);
    cutoffPast.setDate(cutoffPast.getDate() - 7);

    // Watchlist trigger reviews
    for (const w of watchlist) {
      const due = toDateISO(w.triggerReviewDate);
      if (!due) continue;
      const key = makeKey(w.ticker, "REVIEW_DUE", due);
      out.push({
        id: `sheet:${key}`,
        ticker: w.ticker || null,
        action_type: "REVIEW_DUE",
        due_date: due,
        summary: w.triggerReviewNote || `Review ${w.ticker} watchlist trigger`,
        context: [w.trigger, w.rationale].filter(Boolean).join(" — ") || null,
        source: "WATCHLIST",
        source_session: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: "MEDIUM",
        dedupe_key: key,
        persisted: false,
      });
    }

    // Holdings trigger reviews
    for (const h of holdings) {
      const due = toDateISO((h as any).trigger_review_date);
      if (!due) continue;
      const key = makeKey(h.ticker, "REVIEW_DUE", due);
      out.push({
        id: `sheet:${key}`,
        ticker: h.ticker || null,
        action_type: "REVIEW_DUE",
        due_date: due,
        summary: (h as any).trigger_review_note || `Review ${h.ticker} holding trigger`,
        context: [(h as any).add_trigger, (h as any).exit_trigger].filter(Boolean).join(" · ") || null,
        source: "HOLDINGS",
        source_session: null,
        status: (h as any).alert_status === "FIRED" ? "OPEN" : "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: (h as any).alert_status === "FIRED" ? "HIGH" : "MEDIUM",
        dedupe_key: key,
        persisted: false,
      });
    }

    // Earnings — future or within last 7 days
    for (const e of earnings) {
      const due = toDateISO(e.nextEarningsDate);
      if (!due) continue;
      const d = new Date(due);
      if (d < cutoffPast) continue;
      const key = makeKey(e.ticker, "EARNINGS_GATE", due);
      out.push({
        id: `sheet:${key}`,
        ticker: e.ticker || null,
        action_type: "EARNINGS_GATE",
        due_date: due,
        summary: `${e.ticker} earnings${e.fiscalPeriod ? ` (${e.fiscalPeriod})` : ""}`,
        context: e.confirmed ? "Confirmed date." : "Date unconfirmed — verify closer to release.",
        source: "EARNINGS",
        source_session: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: "MEDIUM",
        dedupe_key: key,
        persisted: false,
      });
    }

    return out;
  }, [watchlist, holdings, earnings]);

  // Merge sheet + supabase
  const items: ActionItem[] = useMemo(() => {
    const byKey = new Map<string, ActionItem>();
    for (const s of sheetItems) {
      if (s.dedupe_key) byKey.set(s.dedupe_key, s);
    }
    const supaItems: ActionItem[] = rows.map((r) => ({
      id: r.id,
      ticker: r.ticker,
      action_type: r.action_type,
      due_date: r.due_date,
      summary: r.summary,
      context: r.context,
      source: r.source,
      source_session: r.source_session,
      status: r.status,
      resolution_note: r.resolution_note,
      resolved_at: r.resolved_at,
      priority: r.priority,
      dedupe_key: r.dedupe_key,
      persisted: true,
    }));
    for (const s of supaItems) {
      if (s.dedupe_key && byKey.has(s.dedupe_key)) {
        const sheet = byKey.get(s.dedupe_key)!;
        byKey.set(s.dedupe_key, { ...sheet, ...s, persisted: true });
      } else {
        byKey.set(s.id, s);
      }
    }
    return Array.from(byKey.values());
  }, [sheetItems, rows]);

  const resolve = useCallback(
    async (
      item: ActionItem,
      resolutionStatus: "CONFIRMED" | "DISMISSED",
      note: string,
    ) => {
      if (item.persisted) {
        await (supabase as any)
          .from("action_tracker")
          .update({
            status: resolutionStatus,
            resolution_note: note || null,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      } else {
        // Upsert sheet-derived item
        await (supabase as any).from("action_tracker").insert({
          ticker: item.ticker,
          action_type: item.action_type,
          due_date: item.due_date,
          summary: item.summary,
          context: item.context,
          source: item.source,
          priority: item.priority,
          status: resolutionStatus,
          resolution_note: note || null,
          resolved_at: new Date().toISOString(),
          dedupe_key: item.dedupe_key,
        });
      }
      await fetchRows();
    },
    [fetchRows],
  );

  const reopen = useCallback(
    async (item: ActionItem) => {
      if (!item.persisted) return;
      await (supabase as any)
        .from("action_tracker")
        .update({ status: "OPEN", resolution_note: null, resolved_at: null })
        .eq("id", item.id);
      await fetchRows();
    },
    [fetchRows],
  );

  const addManual = useCallback(
    async (payload: {
      ticker?: string | null;
      action_type: ActionType;
      due_date: string;
      summary: string;
      context?: string | null;
      priority?: ActionPriority;
    }) => {
      await (supabase as any).from("action_tracker").insert({
        ticker: payload.ticker || null,
        action_type: payload.action_type,
        due_date: payload.due_date,
        summary: payload.summary,
        context: payload.context || null,
        priority: payload.priority || "MEDIUM",
        source: "MANUAL",
        status: "OPEN",
      });
      await fetchRows();
    },
    [fetchRows],
  );

  const remove = useCallback(
    async (item: ActionItem) => {
      if (!item.persisted) return;
      await (supabase as any).from("action_tracker").delete().eq("id", item.id);
      await fetchRows();
    },
    [fetchRows],
  );

  const updateNote = useCallback(
    async (item: ActionItem, note: string) => {
      if (!item.persisted) return;
      await (supabase as any)
        .from("action_tracker")
        .update({ resolution_note: note || null })
        .eq("id", item.id);
      await fetchRows();
    },
    [fetchRows],
  );

  return { items, loading, error, resolve, reopen, addManual, remove, updateNote, refresh: fetchRows };
}
