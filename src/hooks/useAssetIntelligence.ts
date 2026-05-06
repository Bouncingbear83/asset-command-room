import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  usePortfolioData,
  type LiveScore,
  type LiveDisruption,
  type LiveHolding,
  type LiveScoreLog,
  type LiveWatchItem,
} from "./usePortfolioData";
import {
  AssetIntelligence,
  AssetDisruption,
  AssetPosition,
  AssetRationales,
  ScoreRationales,
  DisruptionRationales,
  HeldStatus,
  HELD_STATUS_VALUES,
  LAYER_VALUES,
  Layer,
  Tier,
  DisruptionStatus,
  AssetAccount,
  AssetIntelligenceTrend,
  ScoreTrend,
  EMPTY_TREND,
  EMPTY_SCORE_TREND,
  BuyDistance,
  ReturnProfile,
  RETURN_PROFILE_VALUES,
  CompounderSubtype,
} from "@/types/intelligence";

// ── Rationale row shapes (subset of Supabase tables) ────────────────────────

interface ScoreRationaleRow {
  ticker: string;
  scored_at: string;
  substrate_rationale: string | null;
  demand_rationale: string | null;
  moat_rationale: string | null;
  valuation_rationale: string | null;
  mgmt_rationale: string | null;
  disruption_rationale: string | null;
}

interface DisruptionRationaleRow {
  ticker: string;
  scored_at: string;
  sub_avail_rationale: string | null;
  economics_rationale: string | null;
  govt_support_rationale: string | null;
  demand_vuln_rationale: string | null;
  time_viability_rationale: string | null;
}

const EMPTY_SCORE_RATIONALES: ScoreRationales = {
  substrate: "",
  demand: "",
  moat: "",
  valuation: "",
  mgmt: "",
  disruption: "",
};

const EMPTY_DISRUPTION_RATIONALES: DisruptionRationales = {
  sub_avail: "",
  economics: "",
  govt_support: "",
  demand_vuln: "",
  time_viability: "",
};


// ── Parsing helpers ─────────────────────────────────────────────────────────

/** Strip currency/percent/comma noise; return number or null on NaN. */
function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const cleaned = String(val).replace(/[£$€,%\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Same as toNum but defaults to 0 for non-nullable numeric fields. */
function toNum0(val: unknown): number {
  return toNum(val) ?? 0;
}

/** Trim only — preserve case for ticker suffixes (.L, .T, .TO, .TW, -B, .A, .F). */
function canonTicker(t: unknown): string {
  return String(t ?? "").trim();
}

const TIER_VALUES: Tier[] = ["Core", "Anchor", "Satellite", "Spec", "Residual"];

function normalizeTier(raw: unknown): Tier | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const match = TIER_VALUES.find((t) => t.toLowerCase() === s.toLowerCase());
  return match ?? null;
}

function normalizeLayer(raw: unknown, ticker: string): Layer | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const match = LAYER_VALUES.find((l) => l.toLowerCase() === s.toLowerCase());
  if (!match) {
    console.warn(`[useAssetIntelligence] Unknown layer "${s}" for ${ticker} — defaulting to null`);
    return null;
  }
  return match;
}

function normalizeHeldStatus(raw: unknown, ticker: string): HeldStatus {
  const upper = String(raw ?? "").trim().toUpperCase();
  if (!upper) {
    console.warn(`[useAssetIntelligence] Missing Held_Status for ${ticker} — defaulting to RESEARCH`);
    return "RESEARCH";
  }
  if ((HELD_STATUS_VALUES as string[]).includes(upper)) return upper as HeldStatus;
  console.warn(`[useAssetIntelligence] Unknown Held_Status "${raw}" for ${ticker} — defaulting to RESEARCH`);
  return "RESEARCH";
}

function normalizeReturnProfile(raw: unknown): ReturnProfile | null {
  const upper = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return null;
  return (RETURN_PROFILE_VALUES as string[]).includes(upper) ? (upper as ReturnProfile) : null;
}

function normalizeCompounderSubtype(raw: unknown): CompounderSubtype | null {
  const upper = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (upper === "STELLAR_COMPOUNDER" || upper === "STELLAR") return "STELLAR_COMPOUNDER";
  if (upper === "GENERIC_COMPOUNDER" || upper === "GENERIC") return "GENERIC_COMPOUNDER";
  return null;
}

function deriveDisruptionStatus(rawStatus: unknown, total: number): DisruptionStatus {
  const s = String(rawStatus ?? "").trim().toUpperCase();
  if (s === "GREEN" || s === "AMBER" || s === "RED") return s as DisruptionStatus;
  if (total >= 70) return "GREEN";
  if (total >= 50) return "AMBER";
  return "RED";
}

function parseSheetDateLike(val: unknown): string {
  if (typeof val === "string") {
    const m = val.match(/^Date\((\d+),(\d+),(\d+)\)$/);
    if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return val;
  }
  return String(val ?? "");
}

/**
 * Parse a UK-format date "DD/MM/YYYY" → Date (local). Falls back to new Date(str) on failure.
 * Returns null if completely unparseable. Sheet API may return raw "Date(yyyy,m,d)" strings —
 * handle those too.
 */
function parseUkDate(raw: unknown): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const gviz = s.match(/^Date\((\d+),(\d+),(\d+)\)$/);
  if (gviz) {
    const d = new Date(+gviz[1], +gviz[2], +gviz[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  const uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const d = new Date(+uk[3], +uk[2] - 1, +uk[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

/** Lenient price parser — strips ~, currency symbols, takes midpoint of ranges. */
function parseLenientPrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Strip ~, currency symbols, GBX trailing 'p', spaces, commas
  const cleaned = s.replace(/[~£$€¥₹\s,]/g, "").replace(/p$/i, "");
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)[\-–](\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const lo = Number(rangeMatch[1]);
    const hi = Number(rangeMatch[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return (lo + hi) / 2;
  }
  const numMatch = cleaned.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function computeBuyDistance(price: number | null, low: number | null, high: number | null): BuyDistance {
  if (low === null || high === null) return { status: "NO_RANGE", pct_from_zone: null };
  if (price === null) return { status: "NO_PRICE", pct_from_zone: null };
  if (price >= low && price <= high) return { status: "IN_ZONE", pct_from_zone: 0 };
  if (price > high) return { status: "ABOVE", pct_from_zone: ((price - high) / high) * 100 };
  return { status: "BELOW", pct_from_zone: ((price - low) / low) * 100 };
}

function makeTrend(latest: number | null, prior: number | null): ScoreTrend {
  if (latest === null || prior === null) return { ...EMPTY_SCORE_TREND, prior_value: prior };
  const delta = latest - prior;
  const direction: ScoreTrend["direction"] = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return { delta, direction, prior_value: prior };
}

interface TrendBuildContext {
  latest: LiveScoreLog;
  prior: LiveScoreLog | null;
}

function buildTrend(ctx: TrendBuildContext | undefined): AssetIntelligenceTrend {
  if (!ctx) return EMPTY_TREND;
  const { latest, prior } = ctx;
  const priorDate = prior?.date ? parseSheetDateLike(prior.date) : null;
  return {
    score:      makeTrend(latest.score      ?? null, prior?.score      ?? null),
    substrate:  makeTrend(latest.substrate  ?? null, prior?.substrate  ?? null),
    demand:     makeTrend(latest.demand     ?? null, prior?.demand     ?? null),
    moat:       makeTrend(latest.moat       ?? null, prior?.moat       ?? null),
    valuation:  makeTrend(latest.valuation  ?? null, prior?.valuation  ?? null),
    mgmt:       makeTrend(latest.mgmt       ?? null, prior?.mgmt       ?? null),
    disruption: makeTrend(latest.disruption ?? null, prior?.disruption ?? null),
    prior_score_date: priorDate,
  };
}

// ── Joiners ─────────────────────────────────────────────────────────────────

function buildDisruption(d: LiveDisruption | undefined): AssetDisruption | null {
  if (!d) return null;
  const total = toNum0(d.disruptionScore);
  return {
    total,
    status: deriveDisruptionStatus(d.status, total),
    sub_avail: toNum0(d.subAvail),
    economics: toNum0(d.economics),
    govt_support: toNum0(d.govtSupport),
    demand_vuln: toNum0(d.demandVuln),
    time_viability: toNum0(d.timeViability),
    amber_trigger: String(d.amberTrigger ?? ""),
    red_trigger: String(d.redTrigger ?? ""),
    evidence: String(d.evidence ?? ""),
    last_checked: parseSheetDateLike(d.lastChecked),
  };
}

/**
 * Build position from one or more HOLDINGS rows.
 * - Single row → use as-is.
 * - ILMN (ISA + SIPP) → sum shares/mv/cost/aum_pct, weighted-avg G/L%, set account 'SIPP+ISA'.
 * - Any OTHER duplicate → console.error, use first row.
 */
function buildPosition(rows: LiveHolding[], ticker: string): AssetPosition | null {
  if (rows.length === 0) return null;

  let merged: LiveHolding;
  let account: AssetAccount;

  if (rows.length === 1) {
    merged = rows[0];
    const a = String(rows[0].account ?? "").toUpperCase();
    account = a === "SIPP" || a === "ISA" ? (a as AssetAccount) : "SIPP";
  } else if (ticker.toUpperCase() === "ILMN" && rows.length === 2) {
    const sumShares = (rows[0].shares ?? 0) + (rows[1].shares ?? 0);
    const sumMv = (rows[0].mv ?? 0) + (rows[1].mv ?? 0);
    const sumCost = (rows[0].costGbp ?? 0) + (rows[1].costGbp ?? 0);
    const sumAumPct = (rows[0].aum_pct ?? 0) + (rows[1].aum_pct ?? 0);
    // Weighted-average G/L% by cost
    const totalCost = sumCost || 1;
    const wAvgGl =
      ((rows[0].gl ?? 0) * (rows[0].costGbp ?? 0) +
        (rows[1].gl ?? 0) * (rows[1].costGbp ?? 0)) /
      totalCost;
    merged = {
      ...rows[0],
      shares: sumShares,
      mv: sumMv,
      costGbp: sumCost,
      aum_pct: sumAumPct,
      gl: wAvgGl,
    };
    account = "SIPP+ISA";
  } else {
    console.error(
      `[useAssetIntelligence] Unexpected duplicate HOLDINGS rows for ${ticker} (${rows.length} rows) — using first.`,
    );
    merged = rows[0];
    const a = String(rows[0].account ?? "").toUpperCase();
    account = a === "SIPP" || a === "ISA" ? (a as AssetAccount) : "SIPP";
  }

  return {
    account,
    mv_gbp: toNum0(merged.mv),
    aum_pct: toNum0(merged.aum_pct),
    cost_gbp: toNum0(merged.costGbp),
    gl_pct: toNum0(merged.gl),
    day_pct: toNum0(merged.day),
    price_local: toNum0(merged.price),
    currency: String(merged.currency ?? ""),
    shares: toNum0(merged.shares),
    high_52w: toNum0(merged.high_52w),
    low_52w: toNum0(merged.low_52w),
    pct_below_52w_high: toNum0(merged.pct_below_52w_high),
    pct_above_52w_low: toNum0(merged.pct_above_52w_low),
    ma60: toNum0(merged.ma60),
    add_trigger: String(merged.add_trigger ?? ""),
    exit_trigger: String(merged.exit_trigger ?? ""),
    trigger_type: String(merged.trigger_type ?? ""),
    trigger_price_add: toNum(merged.trigger_price_add),
    trigger_price_exit: toNum(merged.trigger_price_exit),
    alert_status: String(merged.alert_status ?? ""),
    factor_primary: String(merged.factor_primary ?? ""),
  };
}

function buildScoreRationales(row: ScoreRationaleRow | undefined): ScoreRationales {
  if (!row) return { ...EMPTY_SCORE_RATIONALES };
  return {
    substrate: row.substrate_rationale ?? "",
    demand: row.demand_rationale ?? "",
    moat: row.moat_rationale ?? "",
    valuation: row.valuation_rationale ?? "",
    mgmt: row.mgmt_rationale ?? "",
    disruption: row.disruption_rationale ?? "",
  };
}

function buildDisruptionRationales(
  row: DisruptionRationaleRow | undefined,
  hasDisruption: boolean,
): DisruptionRationales | null {
  if (!hasDisruption) return null;
  if (!row) return { ...EMPTY_DISRUPTION_RATIONALES };
  return {
    sub_avail: row.sub_avail_rationale ?? "",
    economics: row.economics_rationale ?? "",
    govt_support: row.govt_support_rationale ?? "",
    demand_vuln: row.demand_vuln_rationale ?? "",
    time_viability: row.time_viability_rationale ?? "",
  };
}

function buildOne(
  s: LiveScore,
  disruptionByTicker: Map<string, LiveDisruption>,
  holdingsByTicker: Map<string, LiveHolding[]>,
  scoreRationaleByTicker: Map<string, ScoreRationaleRow>,
  disruptionRationaleByTicker: Map<string, DisruptionRationaleRow>,
  trendByTicker: Map<string, TrendBuildContext>,
  watchlistPriceByTicker: Map<string, number | null>,
): AssetIntelligence {
  const ticker = canonTicker(s.ticker);
  const held_status = normalizeHeldStatus(s.heldStatus, ticker);
  const layer = normalizeLayer(s.layer, ticker);

  const buyLow = toNum(s.buyLow);
  const buyHigh = toNum(s.buyHigh);

  const positionRows = held_status === "HELD" ? holdingsByTicker.get(ticker) ?? [] : [];
  const position = held_status === "HELD" ? buildPosition(positionRows, ticker) : null;

  if (held_status === "HELD" && positionRows.length === 0) {
    console.warn(
      `[useAssetIntelligence] ${ticker} marked HELD in SCORES but no HOLDINGS row — rendering as unheld.`,
    );
  }

  const disruptionData = buildDisruption(disruptionByTicker.get(ticker));
  const rationales: AssetRationales = {
    score: buildScoreRationales(scoreRationaleByTicker.get(ticker)),
    disruption: buildDisruptionRationales(disruptionRationaleByTicker.get(ticker), disruptionData !== null),
  };

  const trend = buildTrend(trendByTicker.get(ticker));

  // Current price preference: held → position.price_local; else watchlist parsed
  const lowFinal = buyLow && buyLow > 0 ? buyLow : null;
  const highFinal = buyHigh && buyHigh > 0 ? buyHigh : null;
  let current_price: number | null = null;
  if (position && position.price_local > 0) {
    current_price = position.price_local;
  } else {
    const w = watchlistPriceByTicker.get(ticker);
    if (w !== undefined && w !== null) current_price = w;
  }
  const buy_distance = computeBuyDistance(current_price, lowFinal, highFinal);

  const return_profile = normalizeReturnProfile((s as { returnProfile?: unknown }).returnProfile);
  const rawSubtype = normalizeCompounderSubtype((s as { compounderSubtype?: unknown }).compounderSubtype);
  const compounder_subtype = return_profile === "COMPOUNDER" ? rawSubtype : null;

  const slRaw = String((s as { substrateLevel?: unknown }).substrateLevel ?? "").trim().toUpperCase();
  const substrate_level = (["L1", "L2", "L3", "L4"] as const).find((l) => l === slRaw) ?? null;
  const stRaw = String((s as { stackLayer?: unknown }).stackLayer ?? "").trim().toUpperCase();
  const stack_layer = stRaw && stRaw !== "N/A" ? stRaw : null;
  // factor_group joined from HOLDINGS for HELD rows
  const factor_group = position?.factor_primary ? null : null; // placeholder, set below
  const fgFromHolding = positionRows[0]?.factor_group
    ? String(positionRows[0].factor_group).trim().toUpperCase()
    : "";
  const factor_group_final = fgFromHolding || null;

  return {
    ticker,
    name: String(s.name ?? ""),
    layer,
    held_status,
    return_profile,
    compounder_subtype,
    substrate_level,
    stack_layer,
    factor_group: factor_group_final,
    score: toNum0(s.score),
    tier: normalizeTier(s.tier),
    sub_scores: {
      substrate: toNum0(s.substrate),
      demand: toNum0(s.demand),
      moat: toNum0(s.moat),
      valuation: toNum0(s.valuation),
      mgmt: toNum0(s.mgmt),
      disruption_score: toNum0(s.disruption),
    },
    score_date: parseSheetDateLike(s.scoreDate),
    thesis: String(s.fullThesis ?? ""),
    change_note: String(s.changeNote ?? ""),
    reclass_status: String(s.reclassStatus ?? ""),
    thesis_age_months: toNum0(s.thesisAgeMonths),
    buy_range: {
      low: lowFinal,
      high: highFinal,
      currency: String(s.currency ?? "USD"),
    },
    action: String(s.action ?? ""),
    disruption: disruptionData,
    position,
    rationales,
    trend,
    current_price,
    buy_distance,
  };
}

// ── Rationale fetcher (latest row per ticker) ───────────────────────────────

async function fetchLatestRationales<T extends { ticker: string; scored_at: string }>(
  table: "score_rationales" | "disruption_rationales",
): Promise<Map<string, T>> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("scored_at", { ascending: false })
    .range(0, 999);

  if (error) {
    console.error(`[useAssetIntelligence] ${table} fetch error:`, error);
    return new Map();
  }
  if ((data?.length ?? 0) === 1000) {
    console.warn(
      `[useAssetIntelligence] ${table} returned 1000 rows — pagination cap hit. Add keyset pagination if growth continues.`,
    );
  }

  const map = new Map<string, T>();
  for (const raw of (data ?? []) as unknown as T[]) {
    const t = canonTicker(raw.ticker);
    if (!t) continue;
    if (!map.has(t)) map.set(t, raw); // first wins = newest (ordered desc)
  }
  return map;
}

/**
 * Fetch the latest disruption_snapshot row per ticker as a fallback when the
 * live DISRUPTION sheet has no entry. Returns LiveDisruption-shaped objects
 * (camelCase) so they slot into the same map as parseDisruption() output.
 */
async function fetchLatestDisruptionSnapshot(): Promise<Map<string, LiveDisruption>> {
  const { data, error } = await supabase
    .from("disruption_snapshot")
    .select("ticker,snapshot_date,disruption_score,sub_avail,economics,govt_support,demand_vuln,time_viability,status")
    .order("snapshot_date", { ascending: false })
    .range(0, 999);

  if (error) {
    console.error("[useAssetIntelligence] disruption_snapshot fetch error:", error);
    return new Map();
  }

  const map = new Map<string, LiveDisruption>();
  for (const row of data ?? []) {
    const t = canonTicker(row.ticker);
    if (!t || map.has(t)) continue; // first wins = newest
    map.set(t, {
      ticker: t,
      name: "",
      layer: "",
      disruptionScore: Number(row.disruption_score ?? 0),
      subAvail: Number(row.sub_avail ?? 0),
      economics: Number(row.economics ?? 0),
      govtSupport: Number(row.govt_support ?? 0),
      demandVuln: Number(row.demand_vuln ?? 0),
      timeViability: Number(row.time_viability ?? 0),
      status: String(row.status ?? ""),
      lastChecked: row.snapshot_date ?? null,
      amberTrigger: "",
      redTrigger: "",
      evidence: "",
    } as LiveDisruption);
  }
  return map;
}

// ── Public hook ─────────────────────────────────────────────────────────────

export interface UseAssetIntelligenceResult {
  data: AssetIntelligence[];
  loading: boolean;
  error: string | null;
}

export function useAssetIntelligence(): UseAssetIntelligenceResult {
  const {
    scores,
    disruption,
    holdings,
    scoreLog,
    watchlist,
    loading: sheetsLoading,
    error: sheetsError,
  } = usePortfolioData();

  const [scoreRationaleByTicker, setScoreRationaleByTicker] = useState<Map<string, ScoreRationaleRow>>(new Map());
  const [disruptionRationaleByTicker, setDisruptionRationaleByTicker] = useState<Map<string, DisruptionRationaleRow>>(new Map());
  const [disruptionSnapshotByTicker, setDisruptionSnapshotByTicker] = useState<Map<string, LiveDisruption>>(new Map());
  const [rationalesLoading, setRationalesLoading] = useState(true);
  const [rationalesError, setRationalesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRationalesLoading(true);
    setRationalesError(null);

    Promise.all([
      fetchLatestRationales<ScoreRationaleRow>("score_rationales"),
      fetchLatestRationales<DisruptionRationaleRow>("disruption_rationales"),
      fetchLatestDisruptionSnapshot(),
    ])
      .then(([scoreMap, disruptionMap, snapshotMap]) => {
        if (cancelled) return;
        setScoreRationaleByTicker(scoreMap);
        setDisruptionRationaleByTicker(disruptionMap);
        setDisruptionSnapshotByTicker(snapshotMap);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[useAssetIntelligence] rationale fetch failed:", e);
        setRationalesError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setRationalesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo<AssetIntelligence[]>(() => {
    if (!scores || scores.length === 0) return [];

    // Index disruption by canonical ticker. Live DISRUPTION sheet wins; fall
    // back to disruption_snapshot (Supabase mirror) when sheet has no row —
    // ensures tickers like MP Materials get real sub-scores instead of 0/20.
    const disruptionByTicker = new Map<string, LiveDisruption>();
    for (const [t, d] of disruptionSnapshotByTicker) {
      disruptionByTicker.set(t, d);
    }
    for (const d of disruption ?? []) {
      const t = canonTicker(d.ticker);
      // Only override snapshot if the live sheet row has a real disruption_score
      if (t && (d.disruptionScore ?? 0) > 0) disruptionByTicker.set(t, d);
    }

    // Group holdings by canonical ticker (lists, to handle ILMN dual-row)
    const holdingsByTicker = new Map<string, LiveHolding[]>();
    for (const h of holdings ?? []) {
      const t = canonTicker(h.ticker);
      if (!t) continue;
      const list = holdingsByTicker.get(t);
      if (list) list.push(h);
      else holdingsByTicker.set(t, [h]);
    }

    // Build trend context: latest+prior SCORE_LOG row per ticker (UK-date sorted desc)
    const logsByTicker = new Map<string, LiveScoreLog[]>();
    for (const row of scoreLog ?? []) {
      const t = canonTicker(row.ticker);
      if (!t) continue;
      const list = logsByTicker.get(t);
      if (list) list.push(row);
      else logsByTicker.set(t, [row]);
    }
    const trendByTicker = new Map<string, TrendBuildContext>();
    for (const [t, rows] of logsByTicker) {
      const sorted = [...rows].sort((a, b) => {
        const da = parseUkDate(a.date)?.getTime() ?? 0;
        const db = parseUkDate(b.date)?.getTime() ?? 0;
        return db - da; // desc
      });
      trendByTicker.set(t, { latest: sorted[0], prior: sorted[1] ?? null });
    }

    // Watchlist current price (lenient parse on raw cell)
    const watchlistPriceByTicker = new Map<string, number | null>();
    for (const w of (watchlist ?? []) as LiveWatchItem[]) {
      const t = canonTicker(w.ticker);
      if (!t) continue;
      const parsed = w.current !== null && w.current !== undefined && w.current > 0
        ? w.current
        : parseLenientPrice(w.currentRaw);
      watchlistPriceByTicker.set(t, parsed);
    }

    // Warn about orphan rationales (ticker not in SCORES)
    const knownTickers = new Set(scores.map((s) => canonTicker(s.ticker)));
    for (const t of scoreRationaleByTicker.keys()) {
      if (!knownTickers.has(t)) {
        console.warn(`[useAssetIntelligence] orphan score_rationales row for ${t} (not in SCORES) — dropped.`);
      }
    }
    for (const t of disruptionRationaleByTicker.keys()) {
      if (!knownTickers.has(t)) {
        console.warn(`[useAssetIntelligence] orphan disruption_rationales row for ${t} (not in SCORES) — dropped.`);
      }
    }

    return scores.map((s) =>
      buildOne(
        s,
        disruptionByTicker,
        holdingsByTicker,
        scoreRationaleByTicker,
        disruptionRationaleByTicker,
        trendByTicker,
        watchlistPriceByTicker,
      ),
    );
  }, [scores, disruption, holdings, scoreLog, watchlist, scoreRationaleByTicker, disruptionRationaleByTicker, disruptionSnapshotByTicker]);

  return {
    data,
    loading: sheetsLoading || rationalesLoading,
    error: sheetsError ?? rationalesError,
  };
}

/** Lookup helper for a single ticker. */
export function useAssetIntelligenceByTicker(ticker: string) {
  const { data, ...rest } = useAssetIntelligence();
  const canonical = canonTicker(ticker);
  return { data: data.find((a) => a.ticker === canonical), ...rest };
}

