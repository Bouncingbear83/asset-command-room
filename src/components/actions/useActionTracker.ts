import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";

export type ActionType =
  | "EARNINGS_GATE"
  | "PRICE_GATE"
  | "CATALYST_WATCH"
  | "REVIEW_DUE"
  | "KILL_CHECK"
  | "DEPLOY_READY"
  | "MANUAL";

export type ActionStatus = "OPEN" | "CONFIRMED" | "DISMISSED" | "EXPIRED";
export type ActionPriority = "HIGH" | "MEDIUM" | "LOW";
export type ActionSource = "WATCHLIST" | "HOLDINGS" | "EARNINGS" | "SESSION" | "MANUAL";

export interface ActionItem {
  id: string;
  ticker: string | null;
  name: string | null;
  layer: string | null;
  action_type: ActionType;
  due_date: string; // yyyy-mm-dd
  summary: string;
  context: string | null;
  source: ActionSource | null;
  source_ref: string | null;
  status: ActionStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  priority: ActionPriority;
  dedupe_key: string | null;
  persisted: boolean;
}

interface Args {
  watchlist: LiveWatchItem[];
  holdings: LiveHolding[];
  earnings: LiveEarningsCalendarItem[];
  /** Set of held tickers for priority boosting earnings */
  heldTickers?: Set<string>;
}

// ── helpers ──

function toDateISO(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFrom(dateStr: string, ref = new Date()): number {
  const d = new Date(dateStr);
  ref.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - ref.getTime()) / 86400000);
}

function makeKey(prefix: string, ticker: string | null, discriminant: string): string {
  return `${prefix}:${(ticker ?? "").toUpperCase()}:${discriminant}`;
}

/**
 * Returns true if a trigger review note is substantive enough to auto-generate an action.
 * Filters out: empty, "OK", single words, pure status labels.
 */
function isSubstantiveNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const s = note.trim();
  if (!s) return false;
  // Reject single tokens like "OK", "WAIT", "HOLD", "PENDING", "-"
  if (/^[A-Z_-]{1,12}$/i.test(s)) return false;
  // Must have at least 2 words to be meaningful
  return s.split(/\s+/).length >= 2;
}

// ── main hook ──

export function useActionTracker({ watchlist, holdings, earnings, heldTickers }: Args) {
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

  // Build held-ticker set for priority boosting
  const held = useMemo(() => {
    if (heldTickers) return heldTickers;
    const s = new Set<string>();
    for (const h of holdings) if (h.ticker) s.add(h.ticker.toUpperCase());
    return s;
  }, [holdings, heldTickers]);

  // ── Sheet-derived items (SELECTIVE) ──
  const sheetItems: ActionItem[] = useMemo(() => {
    const out: ActionItem[] = [];
    const today = new Date();
    const todayStr = todayISO();

    // ── 1. Watchlist trigger reviews: ONLY with substantive notes ──
    for (const w of watchlist) {
      const due = toDateISO(w.triggerReviewDate);
      if (!due) continue;
      if (!isSubstantiveNote(w.triggerReviewNote)) continue;

      const key = makeKey("WL_TRIGGER", w.ticker, due);
      out.push({
        id: `sheet:${key}`,
        ticker: w.ticker || null,
        name: w.name || null,
        layer: w.layer || null,
        action_type: "REVIEW_DUE",
        due_date: due,
        summary: w.triggerReviewNote!.slice(0, 120),
        context: [w.trigger, w.rationale].filter(Boolean).join(" — ") || null,
        source: "WATCHLIST",
        source_ref: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: held.has((w.ticker || "").toUpperCase()) ? "HIGH" : "MEDIUM",
        dedupe_key: key,
        persisted: false,
      });
    }

    // ── 2. Holdings with review flags ──
    for (const h of holdings) {
      const alertStatus = (h.alert_status || "").toUpperCase();
      // Only generate for non-clear, non-empty alert statuses
      if (!alertStatus || alertStatus === "CLEAR" || alertStatus === "OK") continue;

      const monthKey = todayStr.slice(0, 7); // yyyy-mm for monthly dedup
      const key = makeKey("HOLD_ALERT", h.ticker, monthKey);
      const priceStr = h.price ? ` Price: ${h.currency} ${h.price.toFixed(2)}.` : "";
      out.push({
        id: `sheet:${key}`,
        ticker: h.ticker || null,
        name: h.name || null,
        layer: h.layer || null,
        action_type: "REVIEW_DUE",
        due_date: todayStr,
        summary: `Alert: ${alertStatus}${h.trigger_review_note ? ` — ${h.trigger_review_note.slice(0, 80)}` : ""}`,
        context: `Flagged by monitoring.${priceStr} Check thesis assumptions.`,
        source: "HOLDINGS",
        source_ref: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: "HIGH",
        dedupe_key: key,
        persisted: false,
      });
    }

    // ── 3. Holdings with substantive trigger review notes ──
    for (const h of holdings) {
      const due = toDateISO(h.trigger_review_date);
      if (!due) continue;
      if (!isSubstantiveNote(h.trigger_review_note)) continue;

      const key = makeKey("HOLD_TRIGGER", h.ticker, due);
      out.push({
        id: `sheet:${key}`,
        ticker: h.ticker || null,
        name: h.name || null,
        layer: h.layer || null,
        action_type: "REVIEW_DUE",
        due_date: due,
        summary: h.trigger_review_note!.slice(0, 120),
        context: [h.add_trigger, h.exit_trigger].filter(Boolean).join(" · ") || null,
        source: "HOLDINGS",
        source_ref: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: "HIGH",
        dedupe_key: key,
        persisted: false,
      });
    }

    // ── 4. Earnings within 60 days (or last 7 days for just-reported) ──
    const cutoffPast = new Date(today);
    cutoffPast.setDate(cutoffPast.getDate() - 7);
    const cutoffFuture = new Date(today);
    cutoffFuture.setDate(cutoffFuture.getDate() + 60);

    for (const e of earnings) {
      const due = toDateISO(e.nextEarningsDate);
      if (!due) continue;
      const d = new Date(due);
      if (d < cutoffPast || d > cutoffFuture) continue;

      const key = makeKey("EARNINGS", e.ticker, due);
      const isHeld = held.has((e.ticker || "").toUpperCase());
      out.push({
        id: `sheet:${key}`,
        ticker: e.ticker || null,
        name: null,
        layer: null,
        action_type: "EARNINGS_GATE",
        due_date: due,
        summary: `${e.ticker} earnings${e.fiscalPeriod ? ` (${e.fiscalPeriod})` : ""}`,
        context: e.confirmed
          ? "Confirmed date. Review thesis assumptions against results."
          : "Date unconfirmed — verify closer to release.",
        source: "EARNINGS",
        source_ref: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: isHeld ? "HIGH" : "MEDIUM",
        dedupe_key: key,
        persisted: false,
      });
    }

    return out;
  }, [watchlist, holdings, earnings, held]);

  // ── Merge sheet + Supabase ──
  const items: ActionItem[] = useMemo(() => {
    const byKey = new Map<string, ActionItem>();

    // Sheet items first (lower priority)
    for (const s of sheetItems) {
      if (s.dedupe_key) byKey.set(s.dedupe_key, s);
    }

    // Supabase items overlay (higher priority; resolved state wins)
    const supaItems: ActionItem[] = rows.map((r) => ({
      id: r.id,
      ticker: r.ticker,
      name: r.name ?? null,
      layer: r.layer ?? null,
      action_type: r.action_type,
      due_date: r.due_date,
      summary: r.summary,
      context: r.context,
      source: r.source,
      source_ref: r.source_ref ?? r.source_session ?? null,
      status: r.status,
      resolution_note: r.resolution_note,
      resolved_at: r.resolved_at,
      priority: r.priority,
      dedupe_key: r.dedupe_key,
      persisted: true,
    }));

    for (const s of supaItems) {
      if (s.dedupe_key && byKey.has(s.dedupe_key)) {
        // Supabase row wins for resolved state; merge name/layer from sheet
        const sheet = byKey.get(s.dedupe_key)!;
        byKey.set(s.dedupe_key, {
          ...sheet,
          ...s,
          name: s.name || sheet.name,
          layer: s.layer || sheet.layer,
          persisted: true,
        });
      } else {
        byKey.set(s.dedupe_key || s.id, s);
      }
    }

    return Array.from(byKey.values());
  }, [sheetItems, rows]);

  // ── CRUD ──

  const resolve = useCallback(
    async (item: ActionItem, resolutionStatus: "CONFIRMED" | "DISMISSED", note: string) => {
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
        // Persist sheet-derived item to Supabase on resolution
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

  const snooze = useCallback(
    async (item: ActionItem, days = 7) => {
      const newDue = new Date(item.due_date);
      newDue.setDate(newDue.getDate() + days);
      const newDueStr = newDue.toISOString().slice(0, 10);

      if (item.persisted) {
        await (supabase as any)
          .from("action_tracker")
          .update({ due_date: newDueStr })
          .eq("id", item.id);
      } else {
        // Persist with snoozed date
        await (supabase as any).from("action_tracker").insert({
          ticker: item.ticker,
          action_type: item.action_type,
          due_date: newDueStr,
          summary: item.summary,
          context: item.context,
          source: item.source,
          priority: item.priority,
          status: "OPEN",
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
      source?: ActionSource;
      source_ref?: string | null;
    }) => {
      await (supabase as any).from("action_tracker").insert({
        ticker: payload.ticker || null,
        action_type: payload.action_type,
        due_date: payload.due_date,
        summary: payload.summary,
        context: payload.context || null,
        priority: payload.priority || "MEDIUM",
        source: payload.source || "MANUAL",
        source_ref: payload.source_ref || null,
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

  return { items, loading, error, resolve, snooze, reopen, addManual, remove, updateNote, refresh: fetchRows };
}
