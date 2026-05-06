import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AssetRow } from "@/components/intelligence/AssetRow";
import { IntelligenceFilters } from "@/components/intelligence/IntelligenceFilters";
import { IntelligenceListHeader } from "@/components/intelligence/IntelligenceListHeader";
import { IntelligenceGroupHeader } from "@/components/intelligence/IntelligenceGroupHeader";
import { IntelligenceHeader } from "@/components/intelligence/IntelligenceHeader";
import { ProfileMixWidget } from "@/components/intelligence/ProfileMixWidget";
import { useAssetIntelligence } from "@/hooks/useAssetIntelligence";
import { usePortfolioData, type LiveLayer } from "@/hooks/usePortfolioData";
import {
  DEFAULT_STATE,
  stateFromParams,
  stateToParams,
  PROFILE_FILTER_KEYS,
  SUBSTRATE_LEVEL_VALUES,
  type GroupBy,
  type SortField,
  type IntelligenceUiState,
  type ProfileFilterKey,
  type SubstrateLevel,
  type StackLayerKey,
  type DriverKey,
} from "@/lib/url-state";
import type { AssetIntelligence, HeldStatus, Layer, Tier } from "@/types/intelligence";
import { HELD_STATUS_VALUES, LAYER_VALUES } from "@/types/intelligence";
import { FACTOR_GROUP_VALUES, STACK_LAYER_VALUES, stackLayerOrder } from "@/components/holdings/DriverChip";

// ── Sorting / filtering / grouping pipeline ────────────────────────────────

const TIER_ORDER: (Tier | "Untiered")[] = ["Core", "Anchor", "Satellite", "Spec", "Residual", "Untiered"];
const STATUS_ORDER: HeldStatus[] = [...HELD_STATUS_VALUES];
const LAYER_ORDER: (Layer | "Unclassified")[] = [...LAYER_VALUES, "Unclassified"];

function compareAssets(a: AssetIntelligence, b: AssetIntelligence, field: SortField, dir: "asc" | "desc"): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (field) {
    case "ticker":
      return sign * a.ticker.localeCompare(b.ticker);
    case "layer": {
      const al = a.layer ?? "zzz";
      const bl = b.layer ?? "zzz";
      const lc = al.localeCompare(bl);
      // tiebreaker: score desc within same layer regardless of dir
      if (lc !== 0) return sign * lc;
      return b.score - a.score;
    }
    case "score":
      return sign * (a.score - b.score);
    case "disruption": {
      // null disruption always sorts to bottom in either direction
      const av = a.disruption?.total;
      const bv = b.disruption?.total;
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return sign * (av - bv);
    }
    case "buy_distance": {
      // Closest-to-zone first when asc; NO_PRICE/NO_RANGE always last.
      const rank = (s: AssetIntelligence) => {
        const st = s.buy_distance.status;
        if (st === "NO_PRICE" || st === "NO_RANGE") return Number.POSITIVE_INFINITY;
        return Math.abs(s.buy_distance.pct_from_zone ?? 0);
      };
      const ar = rank(a);
      const br = rank(b);
      if (!Number.isFinite(ar) && !Number.isFinite(br)) return 0;
      if (!Number.isFinite(ar)) return 1;
      if (!Number.isFinite(br)) return -1;
      return sign * (ar - br);
    }
    case "lband": {
      // L4 highest. Null sorts to bottom.
      const rank = (s: AssetIntelligence) => {
        if (!s.substrate_level) return -1;
        return Number(s.substrate_level.slice(1)); // L1 → 1, L4 → 4
      };
      const ar = rank(a);
      const br = rank(b);
      if (ar < 0 && br < 0) return 0;
      if (ar < 0) return 1;
      if (br < 0) return -1;
      return sign * (ar - br);
    }
    case "stack": {
      const ar = a.stack_layer ? stackLayerOrder(a.stack_layer) : 999;
      const br = b.stack_layer ? stackLayerOrder(b.stack_layer) : 999;
      return sign * (ar - br);
    }
  }
}

interface GroupBucket {
  value: string;
  assets: AssetIntelligence[];
}

function groupAssets(sorted: AssetIntelligence[], groupBy: GroupBy): GroupBucket[] {
  if (groupBy === "none") return [{ value: "", assets: sorted }];

  const map = new Map<string, AssetIntelligence[]>();
  const keyFor = (a: AssetIntelligence): string => {
    if (groupBy === "layer") return a.layer ?? "Unclassified";
    if (groupBy === "status") return a.held_status;
    if (groupBy === "tier") return a.tier ?? "Untiered";
    if (groupBy === "driver") return a.factor_group ?? "Undriven";
    if (groupBy === "lband") return a.substrate_level ?? "Unrated";
    return "";
  };

  for (const a of sorted) {
    const k = keyFor(a);
    const list = map.get(k);
    if (list) list.push(a);
    else map.set(k, [a]);
  }

  // Canonical ordering per group type
  let order: string[];
  if (groupBy === "layer") order = LAYER_ORDER as string[];
  else if (groupBy === "status") order = STATUS_ORDER as string[];
  else if (groupBy === "tier") order = TIER_ORDER as string[];
  else if (groupBy === "driver") order = [...FACTOR_GROUP_VALUES, "Undriven"];
  else if (groupBy === "lband") order = ["L4", "L3", "L2", "L1", "Unrated"];
  else order = [];

  const buckets: GroupBucket[] = [];
  for (const k of order) {
    const list = map.get(k);
    if (list && list.length > 0) buckets.push({ value: k, assets: list });
  }
  // Any unexpected keys → append at end
  for (const [k, list] of map) {
    if (!order.includes(k)) buckets.push({ value: k, assets: list });
  }
  return buckets;
}

// ── Skeleton row ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--rim)" }}>
      <div style={{ width: 96, height: 24, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ width: 84, height: 14, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ width: 64, height: 24, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ flex: 1, minWidth: 280, height: 16, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ width: 88, height: 16, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ width: 96, height: 14, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ width: 110, height: 16, background: "rgba(255,255,255,0.04)" }} />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function IntelligenceTab() {
  const { data, loading, error } = useAssetIntelligence();
  const portfolio = usePortfolioData();

  const [searchParams, setSearchParams] = useSearchParams();
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());

  // Mount: derive initial state from URL. Then keep state mirror so updates feel snappy.
  const [state, setState] = useState<IntelligenceUiState>(() => stateFromParams(searchParams));

  // Sync to URL on state change (replace, not push).
  useEffect(() => {
    const next = stateToParams(state);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const update = (patch: Partial<IntelligenceUiState>) => setState((prev) => ({ ...prev, ...patch }));

  const toggleStatus = (s: HeldStatus) => {
    setState((prev) => {
      const has = prev.statusFilter.includes(s);
      const next = has ? prev.statusFilter.filter((x) => x !== s) : [...prev.statusFilter, s];
      // If user selects every status, normalise to "all" (empty array).
      const allOn = HELD_STATUS_VALUES.every((v) => next.includes(v));
      return { ...prev, statusFilter: allOn ? [] : next };
    });
  };
  const resetStatus = () => update({ statusFilter: [] });

  const toggleLayer = (l: Layer) => {
    setState((prev) => {
      const has = prev.layerFilter.includes(l);
      const next = has ? prev.layerFilter.filter((x) => x !== l) : [...prev.layerFilter, l];
      const allOn = LAYER_VALUES.every((v) => next.includes(v));
      return { ...prev, layerFilter: allOn ? [] : next };
    });
  };
  const resetLayer = () => update({ layerFilter: [] });

  const toggleProfile = (p: ProfileFilterKey) => {
    setState((prev) => {
      const has = prev.profileFilter.includes(p);
      const next = has ? prev.profileFilter.filter((x) => x !== p) : [...prev.profileFilter, p];
      const allOn = PROFILE_FILTER_KEYS.every((v) => next.includes(v));
      return { ...prev, profileFilter: allOn ? [] : next };
    });
  };
  const resetProfile = () => update({ profileFilter: [] });

  const handleSort = (field: SortField) => {
    setState((prev) => {
      if (prev.sortField === field) {
        return { ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" };
      }
      // Default direction: desc for numeric, asc for text
      const dir: "asc" | "desc" = field === "ticker" || field === "layer" ? "asc" : "desc";
      return { ...prev, sortField: field, sortDir: dir };
    });
  };

  const resetAll = () => setState(DEFAULT_STATE);

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    const profileSet = new Set(state.profileFilter);
    return data.filter((a) => {
      if (state.statusFilter.length > 0 && !state.statusFilter.includes(a.held_status)) return false;
      if (state.layerFilter.length > 0) {
        if (!a.layer || !state.layerFilter.includes(a.layer)) return false;
      }
      if (state.profileFilter.length > 0) {
        if (!a.return_profile) return false;
        // Map asset → ProfileFilterKey
        let key: ProfileFilterKey | null = null;
        if (a.return_profile === "COMPOUNDER") {
          if (a.compounder_subtype === "STELLAR_COMPOUNDER") key = "STELLAR_COMPOUNDER";
          else if (a.compounder_subtype === "GENERIC_COMPOUNDER") key = "GENERIC_COMPOUNDER";
        } else if (a.return_profile !== "CASH") {
          key = a.return_profile as ProfileFilterKey;
        }
        if (!key || !profileSet.has(key)) return false;
      }
      if (q) {
        const hay = `${a.ticker} ${a.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, state.statusFilter, state.layerFilter, state.profileFilter, state.search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => compareAssets(a, b, state.sortField, state.sortDir));
  }, [filtered, state.sortField, state.sortDir]);

  const buckets = useMemo(() => groupAssets(sorted, state.groupBy), [sorted, state.groupBy]);

  // Layer weight lookup from LAYERS sheet (for Layer group headers)
  const layerWeights = useMemo(() => {
    const m = new Map<string, { actual: number; target: number }>();
    for (const l of (portfolio.layers ?? []) as LiveLayer[]) {
      if (!l.name) continue;
      m.set(l.name.trim(), { actual: l.current ?? 0, target: l.target ?? 0 });
    }
    return m;
  }, [portfolio.layers]);

  const toggleRow = (t: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const sortLabel = `${state.sortField} ${state.sortDir}`;
  const groupLabel = state.groupBy === "none" ? "flat" : state.groupBy;
  const hasFilters =
    state.statusFilter.length > 0 ||
    state.layerFilter.length > 0 ||
    state.search.trim() !== "";

  // ── Rationale coverage telemetry (Part 4) ────────────────────────────────
  const rationaleCoverage = useMemo(() => {
    const hasScoreRationale = (a: AssetIntelligence) => {
      const r = a.rationales.score;
      return Boolean(
        r.substrate?.trim() || r.demand?.trim() || r.moat?.trim() ||
        r.valuation?.trim() || r.mgmt?.trim() || r.disruption?.trim(),
      );
    };
    const hasDisruptionRationale = (a: AssetIntelligence) => {
      const r = a.rationales.disruption;
      if (!r) return false;
      return Boolean(
        r.sub_avail?.trim() || r.economics?.trim() || r.govt_support?.trim() ||
        r.demand_vuln?.trim() || r.time_viability?.trim(),
      );
    };
    const scoreHits = data.filter(hasScoreRationale).length;
    const scoreTotal = data.length;
    const disruptionAssets = data.filter((a) => a.disruption !== null);
    const disruptionHits = disruptionAssets.filter(hasDisruptionRationale).length;
    const disruptionTotal = disruptionAssets.length;
    const missing = data
      .filter((a) => !hasScoreRationale(a))
      .slice(0, 5)
      .map((a) => a.ticker);
    return { scoreHits, scoreTotal, disruptionHits, disruptionTotal, missing };
  }, [data]);

  const [coverageDismissed, setCoverageDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem("intelligence:coverageDismissed") === "1"; } catch { return false; }
  });
  const dismissCoverage = () => {
    try { localStorage.setItem("intelligence:coverageDismissed", "1"); } catch { /* noop */ }
    setCoverageDismissed(true);
  };

  const scorePct = rationaleCoverage.scoreTotal > 0
    ? (rationaleCoverage.scoreHits / rationaleCoverage.scoreTotal) * 100 : 100;
  const disruptionPct = rationaleCoverage.disruptionTotal > 0
    ? (rationaleCoverage.disruptionHits / rationaleCoverage.disruptionTotal) * 100 : 100;
  const showCoverageBanner = !coverageDismissed && !loading && data.length > 0 && (scorePct < 80 || disruptionPct < 80);

  // ── Thesis backfill console warning (Part 5) ─────────────────────────────
  useEffect(() => {
    if (loading || data.length === 0) return;
    const heldEmptyThesis = data
      .filter((a) => a.held_status === "HELD" && !a.thesis?.trim())
      .map((a) => a.ticker);
    if (heldEmptyThesis.length > 0) {
      console.warn(
        `[Intelligence] ${heldEmptyThesis.length} HELD tickers have empty full_thesis. Backfill via Research Commit:`,
        heldEmptyThesis,
      );
    }
  }, [data, loading]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "12px 0" }}>
      <ProfileMixWidget assets={data} />

      <IntelligenceFilters
        assets={data}
        total={data.length}
        statusFilter={state.statusFilter}
        layerFilter={state.layerFilter}
        profileFilter={state.profileFilter}
        search={state.search}
        groupBy={state.groupBy}
        sortField={state.sortField}
        sortDir={state.sortDir}
        onToggleStatus={toggleStatus}
        onResetStatus={resetStatus}
        onToggleLayer={toggleLayer}
        onResetLayer={resetLayer}
        onToggleProfile={toggleProfile}
        onResetProfile={resetProfile}
        onSearchChange={(v) => update({ search: v })}
        onGroupChange={(g) => update({ groupBy: g })}
        onSortChange={(field, dir) => update({ sortField: field, sortDir: dir })}
      />

      <IntelligenceHeader
        totalAssets={data.length}
        filteredCount={sorted.length}
        sortLabel={sortLabel}
        groupLabel={groupLabel}
        hasFilters={hasFilters}
      />

      {showCoverageBanner && (
        <div
          className="intelligence-coverage-banner"
          style={{
            margin: "0 16px 12px",
            padding: "10px 14px",
            border: "1px solid var(--rim)",
            background: "rgba(28,28,48,0.35)",
            borderRadius: 4,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-mid)",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: "var(--gold)" }}>📊</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>
              Rationale coverage: <strong style={{ color: "var(--text-mid)" }}>{rationaleCoverage.scoreHits}/{rationaleCoverage.scoreTotal}</strong> score rationales ({Math.round(scorePct)}%)
              {" · "}
              <strong style={{ color: "var(--text-mid)" }}>{rationaleCoverage.disruptionHits}/{rationaleCoverage.disruptionTotal}</strong> disruption rationales ({Math.round(disruptionPct)}%)
            </div>
            {rationaleCoverage.missing.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-dim)" }}>
                Tickers missing: {rationaleCoverage.missing.join(", ")}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={dismissCoverage}
            aria-label="Dismiss coverage banner"
            style={{
              background: "transparent",
              border: "1px solid var(--rim)",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              padding: "6px 10px",
              minHeight: 32,
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            DISMISS
          </button>
        </div>
      )}

      {error && (
        <div style={{ margin: "16px", padding: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)", border: "1px solid rgba(200,90,90,0.3)", background: "var(--red-dim)" }}>
          ⚠ {error}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginLeft: 12, background: "transparent", border: "1px solid var(--red)", color: "var(--red)", padding: "2px 10px", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer" }}
          >
            RETRY
          </button>
        </div>
      )}

      <div style={{ border: "1px solid var(--rim)", background: "rgba(0,0,0,0.2)", margin: "0 16px 16px" }}>
        <IntelligenceListHeader
          sortField={state.sortField}
          sortDir={state.sortDir}
          onSortChange={handleSort}
        />

        {loading && data.length === 0 ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
              No assets match these filters.
            </p>
            <button
              type="button"
              onClick={resetAll}
              style={{
                background: "transparent",
                border: "1px solid var(--gold-dim, rgba(201,168,76,0.4))",
                color: "var(--gold)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                padding: "6px 14px",
                cursor: "pointer",
                borderRadius: 2,
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          buckets.map((bucket) => (
            <div key={bucket.value || "flat"}>
              {state.groupBy !== "none" && (
                <IntelligenceGroupHeader
                  groupBy={state.groupBy}
                  groupValue={bucket.value}
                  assets={bucket.assets}
                  weight={state.groupBy === "layer" ? layerWeights.get(bucket.value) : undefined}
                  onClick={
                    state.groupBy === "layer" && bucket.value !== "Unclassified"
                      ? () => update({ layerFilter: [bucket.value as Layer] })
                      : undefined
                  }
                />
              )}
              {bucket.assets.map((asset) => (
                <AssetRow
                  key={asset.ticker}
                  asset={asset}
                  expanded={openSet.has(asset.ticker)}
                  onToggle={() => toggleRow(asset.ticker)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
