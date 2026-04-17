import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortfolioData, type LiveScore, type LiveDisruption, type LiveHolding } from "./usePortfolioData";
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

  return {
    ticker,
    name: String(s.name ?? ""),
    layer,
    held_status,
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
      low: buyLow && buyLow > 0 ? buyLow : null,
      high: buyHigh && buyHigh > 0 ? buyHigh : null,
      currency: String(s.currency ?? "USD"),
    },
    action: String(s.action ?? ""),
    disruption: disruptionData,
    position,
    rationales,
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
  for (const raw of (data ?? []) as T[]) {
    const t = canonTicker(raw.ticker);
    if (!t) continue;
    if (!map.has(t)) map.set(t, raw); // first wins = newest (ordered desc)
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
  const { scores, disruption, holdings, loading: sheetsLoading, error: sheetsError } = usePortfolioData();

  const [scoreRationaleByTicker, setScoreRationaleByTicker] = useState<Map<string, ScoreRationaleRow>>(new Map());
  const [disruptionRationaleByTicker, setDisruptionRationaleByTicker] = useState<Map<string, DisruptionRationaleRow>>(new Map());
  const [rationalesLoading, setRationalesLoading] = useState(true);
  const [rationalesError, setRationalesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRationalesLoading(true);
    setRationalesError(null);

    Promise.all([
      fetchLatestRationales<ScoreRationaleRow>("score_rationales"),
      fetchLatestRationales<DisruptionRationaleRow>("disruption_rationales"),
    ])
      .then(([scoreMap, disruptionMap]) => {
        if (cancelled) return;
        setScoreRationaleByTicker(scoreMap);
        setDisruptionRationaleByTicker(disruptionMap);
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

    // Index disruption by canonical ticker (exact match; no case folding)
    const disruptionByTicker = new Map<string, LiveDisruption>();
    for (const d of disruption ?? []) {
      const t = canonTicker(d.ticker);
      if (t) disruptionByTicker.set(t, d);
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
      buildOne(s, disruptionByTicker, holdingsByTicker, scoreRationaleByTicker, disruptionRationaleByTicker),
    );
  }, [scores, disruption, holdings, scoreRationaleByTicker, disruptionRationaleByTicker]);

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

