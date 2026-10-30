import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDeadSet, holdAlert, isAutomationNote, isSuperseded, routeTrackerRow, isTrackerHygiene, type Lane,
} from "@/lib/actionSurface";
import { EARNINGS_PREPARE_DAYS } from "@/config/signalRules";
import { evaluateRoutine, BACKSTOP_DAYS, COVER_AHEAD_DAYS } from "@/lib/routineReview";
import type {
  LiveHolding,
  LiveWatchItem,
  LiveEarningsCalendarItem,
  LiveScore,
} from "@/hooks/usePortfolioData";

// ── Types ──

export type ActionType =
  | "EARNINGS_GATE"
  | "PRICE_GATE"
  | "CATALYST_WATCH"
  | "REVIEW_DUE"
  | "KILL_CHECK"
  | "DEPLOY_READY"
  | "MANUAL"
  | "INFRA"
  | "DOCTRINE"
  | "SOURCING"
  | "RESEARCH";

export type ActionStatus = "OPEN" | "CONFIRMED" | "DISMISSED" | "EXPIRED";
export type ActionPriority = "HIGH" | "MEDIUM" | "LOW";
export type ActionSource =
  | "WATCHLIST"
  | "HOLDINGS"
  | "EARNINGS"
  | "SCORES"
  | "SESSION"
  | "MANUAL";

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
  /** Earnings engine staging (read-only in the app except decision / viewed_at). */
  apply_target?: string | null;
  staged_payload?: any;
  /**
   * True for auto-generated staleness reviews.
   * False for event-driven items (sessions, manual, earnings, explicit triggers).
   * Used by the tab to separate routine from signal.
   */
  is_routine: boolean;
  /** Spec v1 lane (R17). BACKLOG items never appear on the Command tab. */
  lane: Lane;
  /** R32 — OPEN tracker row on a dead ticker (Actions “Hygiene” filter). */
  hygiene?: boolean;
}

interface Args {
  watchlist: LiveWatchItem[];
  holdings: LiveHolding[];
  earnings: LiveEarningsCalendarItem[];
  scores?: LiveScore[];
}

// ── Helpers ──

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

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000,
  );
}

function makeKey(
  prefix: string,
  ticker: string | null,
  discriminant: string,
): string {
  return `${prefix}:${(ticker ?? "").toUpperCase()}:${discriminant}`;
}

/**
 * True if a trigger review note has enough substance to be an explicit
 * event-driven action (not a routine review).
 */
function isSubstantiveNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const s = note.trim();
  if (!s) return false;
  if (/^[A-Z_-]{1,12}$/i.test(s)) return false;
  return s.split(/\s+/).length >= 2;
}

// ── Review cadence by status ──

/**
 * Normalise status tokens from both SCORES.held_status and WATCHLIST.status
 * to a common key for cadence lookup.
 */
function normStatus(s: string | null | undefined): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Days between routine reviews, by normalised status. null = never auto-review. */
const CADENCE: Record<string, number | null> = {
  // SCORES held_status values
  HELD: 30,
  WATCHLIST: 45,
  RESEARCH: 60,
  PREIPO: 90,
  DORMANT: 90,
  // WATCHLIST status values (normalised)
  DEPLOY: 14, // active buy: check frequently
  WAITPRICE: 45,
  WAITEVENT: null, // event-driven only: no auto-review
  SCALINGWATCH: 45,
  POSTRECLASSHOLD: 60,
  ARCHIVE: null, // never
  EXITED: null,
  REJECTED: null,
};

function getCadence(status: string): number | null {
  return CADENCE[normStatus(status)] ?? 45; // default 45d for unknown
}

// ── Main hook ──

export function useActionTracker({
  watchlist,
  holdings,
  earnings,
  scores = [],
}: Args) {
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

  // Held ticker set for priority boosting
  const held = useMemo(() => {
    const s = new Set<string>();
    for (const h of holdings) if (h.ticker) s.add(h.ticker.toUpperCase());
    return s;
  }, [holdings]);

  // Score lookup by ticker (case-insensitive)
  const scoreMap = useMemo(() => {
    const m = new Map<
      string,
      { scoreDate: string | null; score: number | null; heldStatus: string; name: string; layer: string }
    >();
    for (const s of scores) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (!t) continue;
      m.set(t, {
        scoreDate: toDateISO(s.scoreDate),
        score: s.score,
        heldStatus: s.heldStatus || "",
        name: s.name || "",
        layer: s.layer || "",
      });
    }
    return m;
  }, [scores]);

  // Watchlist lookup by ticker
  const watchMap = useMemo(() => {
    const m = new Map<string, LiveWatchItem>();
    for (const w of watchlist) {
      const t = (w.ticker || "").toUpperCase();
      if (t) m.set(t, w);
    }
    return m;
  }, [watchlist]);

  // R10 — dead filter applies to every builder.
  const dead = useMemo(
    () => buildDeadSet(holdings, watchlist, scores as any),
    [holdings, watchlist, scores],
  );
  const watchStatus = useMemo(
    () => new Map(watchlist.map((w) => [(w.ticker || "").toUpperCase(), String(w.status ?? "").toUpperCase()])),
    [watchlist],
  );
  const scoreIrr = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const s of scores) m.set(String(s.ticker ?? "").trim().toUpperCase(), (s as any).irrBbSheet ?? null);
    return m;
  }, [scores]);

  // R15b inputs: every known print date per ticker (past and future) and the
  // latest accepted earnings verdict per ticker.
  const printDatesByTicker = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of earnings) {
      const t = String(e.ticker ?? "").trim().toUpperCase();
      if (!t) continue;
      const arr = m.get(t) ?? [];
      const d = toDateISO(e.nextEarningsDate);
      if (d) arr.push(d);
      m.set(t, arr);
    }
    return m;
  }, [earnings]);

  const acceptedVerdictByTicker = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.status !== "CONFIRMED" || !r.resolved_at) continue;
      const k = String(r.dedupe_key ?? "");
      if (!/^AUTO:[^:]+:VERDICT:/.test(k)) continue;
      const t = String(r.ticker ?? "").trim().toUpperCase();
      const d = String(r.resolved_at).slice(0, 10);
      if (t && (!m.has(t) || d > m.get(t)!)) m.set(t, d);
    }
    return m;
  }, [rows]);

  // ── Sheet-derived items (SELECTIVE) ──
  const sheetItems: ActionItem[] = useMemo(() => {
    const out: ActionItem[] = [];
    const today = todayISO();

    // ═══════════════════════════════════════════════════════════
    // 1. ROUTINE REVIEWS: computed from score_date staleness
    // ═══════════════════════════════════════════════════════════
    //
    // For every scored ticker, check if it's overdue for a review
    // based on its status and the cadence table above.

    const seenRoutine = new Set<string>();

    for (const [ticker, sc] of scoreMap.entries()) {
      if (dead.has(ticker)) continue;
      // R15 — calendar cadence no longer drives watchlist names; held names only.
      if (!held.has(ticker)) continue;
      // Determine status: prefer SCORES.heldStatus, fall back to WATCHLIST.status
      const wl = watchMap.get(ticker);
      const status = sc.heldStatus || wl?.status || "";
      const cadence = getCadence(status);

      // null cadence = never auto-review (ARCHIVE, EXITED, WAIT_EVENT, etc.)
      if (cadence === null) continue;

      // Need a freshness date to compute staleness
      const lastReview =
        sc.scoreDate ||
        toDateISO(wl?.lastChecked) ||
        toDateISO(wl?.firstAddDate) ||
        null;

      if (!lastReview) continue;

      // R15b: print-aware staleness (src/lib/routineReview.ts)
      const rr = evaluateRoutine({
        today,
        cadence,
        scoreDate: lastReview,
        printDates: printDatesByTicker.get(ticker) ?? [],
        hasCalendarRow: printDatesByTicker.has(ticker),
        lastAcceptedVerdict: acceptedVerdictByTicker.get(ticker) ?? null,
      });
      if (rr.outcome !== "DUE" && rr.outcome !== "BACKSTOP") continue;
      const isBackstop = rr.outcome === "BACKSTOP";
      const reviewFrom = isBackstop ? lastReview : rr.lastReview ?? lastReview;
      const daysSince = daysBetween(reviewFrom, today);

      // Compute when the review became due
      const dueDate = new Date(reviewFrom);
      dueDate.setDate(dueDate.getDate() + (isBackstop ? BACKSTOP_DAYS : cadence));
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      // Dedup key by ticker + month (one routine review per ticker per month)
      const monthKey = today.slice(0, 7);
      const key = makeKey("ROUTINE", ticker, monthKey);

      const isHeld = held.has(ticker);
      const isVeryStale = daysSince > cadence * 2;
      const priority: ActionPriority =
        isBackstop || (isHeld && isVeryStale) ? "HIGH" : isHeld ? "MEDIUM" : "LOW";

      const scoreStr = sc.score != null ? `Score ${sc.score}/100. ` : "";
      const statusLabel = normStatus(status).replace(/([A-Z])/g, " $1").trim();

      out.push({
        id: `sheet:${key}`,
        ticker,
        name: sc.name || wl?.name || null,
        layer: sc.layer || wl?.layer || null,
        action_type: "REVIEW_DUE",
        due_date: dueDateStr,
        summary: isBackstop
          ? `Backstop: score ${daysSince}d old (>${BACKSTOP_DAYS}d); full rescore owed`
          : `Routine review: last reviewed ${daysSince}d ago`,
        context: isBackstop
          ? `${scoreStr}Score predates two prints. Rescore at the next print regardless of band (R15b).`
          : `${scoreStr}${cadence}d cadence for ${statusLabel} names; no print within ${COVER_AHEAD_DAYS}d. Last review: ${reviewFrom}.`,
        source: "SCORES",
        source_ref: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority,
        dedupe_key: key,
        persisted: false,
        is_routine: true,
        lane: "WATCH",
      });

      seenRoutine.add(ticker);
    }

    // ═══════════════════════════════════════════════════════════
    // 2. EXPLICIT TRIGGER DATES with substantive notes
    // ═══════════════════════════════════════════════════════════
    //
    // These are event-driven: someone wrote a specific note about
    // what to check on a specific date. NOT routine.

    for (const w of watchlist) {
      const due = toDateISO(w.triggerReviewDate);
      if (!due) continue;
      if (dead.has((w.ticker || "").toUpperCase())) continue; // R10
      if (isAutomationNote(w.triggerReviewNote)) continue; // R13
      if (!isSubstantiveNote(w.triggerReviewNote)) continue;
      if (isSuperseded(w.triggerReviewNote, w.triggerReviewDate, today)) continue; // R12

      const key = makeKey("WL_TRIGGER", w.ticker, due);
      out.push({
        id: `sheet:${key}`,
        ticker: w.ticker || null,
        name: w.name || null,
        layer: w.layer || null,
        action_type: "REVIEW_DUE",
        due_date: due,
        summary: w.triggerReviewNote!.slice(0, 120),
        context:
          [w.trigger, w.rationale].filter(Boolean).join(" — ") || null,
        source: "WATCHLIST",
        source_ref: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: held.has((w.ticker || "").toUpperCase())
          ? "HIGH"
          : "MEDIUM",
        dedupe_key: key,
        persisted: false,
        is_routine: true, // F6 — watchlist review dates belong on the Reviews tab
        lane: "WATCH",
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 3. HOLDINGS with review flags (non-routine)
    // ═══════════════════════════════════════════════════════════

    for (const h of holdings) {
      // R11 — only EXIT_ZONE / STOP_BREACH / ADD_ZONE (gated) / THESIS_BREAK.
      const alert = holdAlert(h as any, scoreIrr.get((h.ticker || "").toUpperCase()));
      if (!alert) continue;
      if (isSuperseded(h.trigger_review_note, h.trigger_review_date, today)) continue; // R12
      const alertStatus = alert.status;

      const monthKey = today.slice(0, 7);
      const key = makeKey("HOLD_ALERT", h.ticker, monthKey);
      const priceStr = h.price
        ? ` Price: ${h.currency} ${h.price.toFixed(2)}.`
        : "";

      out.push({
        id: `sheet:${key}`,
        ticker: h.ticker || null,
        name: h.name || null,
        layer: h.layer || null,
        action_type: "REVIEW_DUE",
        due_date: alert.due || today,
        summary: `Alert: ${alertStatus}${h.trigger_review_note ? ` — ${h.trigger_review_note.slice(0, 80)}` : ""}`,
        context: `Flagged by monitoring.${priceStr} Check thesis assumptions.`,
        source: "HOLDINGS",
        source_ref: null,
        status: "OPEN",
        resolution_note: null,
        resolved_at: null,
        priority: alert.severity === "RED" ? "HIGH" : "MEDIUM",
        dedupe_key: key,
        persisted: false,
        is_routine: false,
        lane: "DECIDE",
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 4. EARNINGS within 60 days (non-routine)
    // ═══════════════════════════════════════════════════════════

    const cutoffPast = new Date();
    cutoffPast.setDate(cutoffPast.getDate() - 1);
    const cutoffFuture = new Date();
    cutoffFuture.setDate(cutoffFuture.getDate() + EARNINGS_PREPARE_DAYS); // R14

    for (const e of earnings) {
      const due = toDateISO(e.nextEarningsDate);
      if (!due) continue;
      const d = new Date(due);
      if (d < cutoffPast || d > cutoffFuture) continue;

      const key = makeKey("EARNINGS", e.ticker, due);
      const isHeld = held.has((e.ticker || "").toUpperCase());
      if (!isHeld) continue; // R14 — unheld names never shown

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
        priority: "MEDIUM",
        dedupe_key: key,
        persisted: false,
        is_routine: false,
        lane: "PREPARE",
      });
    }

    return out;
  }, [watchlist, holdings, earnings, held, scoreMap, watchMap, dead, scoreIrr, printDatesByTicker, acceptedVerdictByTicker]);

  const knownTickers = useMemo(() => new Set<string>([
    ...holdings.map((h) => (h.ticker || "").toUpperCase()),
    ...watchlist.map((w) => (w.ticker || "").toUpperCase()),
    ...scores.map((x) => (x.ticker || "").toUpperCase()),
  ].filter(Boolean)), [holdings, watchlist, scores]);

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
      apply_target: r.apply_target ?? null,
      staged_payload: r.staged_payload ?? null,
      persisted: true,
      // Supabase items from SESSION/MANUAL are never routine
      is_routine: false,
      lane: routeTrackerRow(r, todayISO(), knownTickers, dead), // F7
      hygiene: isTrackerHygiene(r, dead, watchStatus), // R32
    }));

    for (const s of supaItems) {
      if (s.dedupe_key && byKey.has(s.dedupe_key)) {
        const sheet = byKey.get(s.dedupe_key)!;
        byKey.set(s.dedupe_key, {
          ...sheet,
          ...s,
          name: s.name || sheet.name,
          layer: s.layer || sheet.layer,
          is_routine: sheet.is_routine, // preserve routine flag from sheet
          persisted: true,
        });
      } else {
        byKey.set(s.dedupe_key || s.id, s);
      }
    }

    return Array.from(byKey.values());
  }, [sheetItems, rows, knownTickers, dead, watchStatus]);

  // ── CRUD ──

  const resolve = useCallback(
    async (
      item: ActionItem,
      resolutionStatus: "CONFIRMED" | "DISMISSED",
      note: string,
    ) => {
      if (item.persisted) {
        const { error: err } = await (supabase as any)
          .from("action_tracker")
          .update({
            status: resolutionStatus,
            resolution_note: note || null,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        if (err) {
          console.error("[action_tracker] update failed:", err);
          setError(`Resolve failed: ${err.message}`);
          return;
        }
      } else {
        // Use upsert on dedupe_key to handle re-resolve of previously-inserted items
        const { error: err } = await (supabase as any)
          .from("action_tracker")
          .upsert(
            {
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
            },
            { onConflict: "dedupe_key" },
          );
        if (err) {
          console.error("[action_tracker] upsert failed:", err);
          setError(`Resolve failed: ${err.message}`);
          return;
        }
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
        const { error: err } = await (supabase as any)
          .from("action_tracker")
          .update({ due_date: newDueStr })
          .eq("id", item.id);
        if (err) {
          console.error("[action_tracker] snooze update failed:", err);
          setError(`Snooze failed: ${err.message}`);
          return;
        }
      } else {
        const { error: err } = await (supabase as any)
          .from("action_tracker")
          .upsert(
            {
              ticker: item.ticker,
              action_type: item.action_type,
              due_date: newDueStr,
              summary: item.summary,
              context: item.context,
              source: item.source,
              priority: item.priority,
              status: "OPEN",
              dedupe_key: item.dedupe_key,
            },
            { onConflict: "dedupe_key" },
          );
        if (err) {
          console.error("[action_tracker] snooze upsert failed:", err);
          setError(`Snooze failed: ${err.message}`);
          return;
        }
      }
      await fetchRows();
    },
    [fetchRows],
  );

  const reopen = useCallback(
    async (item: ActionItem) => {
      if (!item.persisted) return;
      const { error: err } = await (supabase as any)
        .from("action_tracker")
        .update({ status: "OPEN", resolution_note: null, resolved_at: null })
        .eq("id", item.id);
      if (err) {
        console.error("[action_tracker] reopen failed:", err);
        setError(`Reopen failed: ${err.message}`);
        return;
      }
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
      const { error: err } = await (supabase as any).from("action_tracker").insert({
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
      if (err) {
        console.error("[action_tracker] addManual failed:", err);
        setError(`Add failed: ${err.message}`);
        return;
      }
      await fetchRows();
    },
    [fetchRows],
  );

  const remove = useCallback(
    async (item: ActionItem) => {
      if (!item.persisted) return;
      const { error: err } = await (supabase as any)
        .from("action_tracker")
        .delete()
        .eq("id", item.id);
      if (err) {
        console.error("[action_tracker] delete failed:", err);
        setError(`Delete failed: ${err.message}`);
        return;
      }
      await fetchRows();
    },
    [fetchRows],
  );

  const updateNote = useCallback(
    async (item: ActionItem, note: string) => {
      if (!item.persisted) return;
      const { error: err } = await (supabase as any)
        .from("action_tracker")
        .update({ resolution_note: note || null })
        .eq("id", item.id);
      if (err) {
        console.error("[action_tracker] updateNote failed:", err);
        setError(`Update note failed: ${err.message}`);
        return;
      }
      await fetchRows();
    },
    [fetchRows],
  );

  return {
    items,
    loading,
    error,
    resolve,
    snooze,
    reopen,
    addManual,
    remove,
    updateNote,
    refresh: fetchRows,
  };
}
