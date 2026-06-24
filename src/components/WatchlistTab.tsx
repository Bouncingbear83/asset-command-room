import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiveWatchItem, LiveMacroState, LiveScore } from "@/hooks/usePortfolioData";
import { parseEntryTarget } from "@/lib/parseEntryTarget";
import TickerButton from "@/components/factsheet/TickerButton";
import { useWatchlistHistory } from "@/hooks/useWatchlistHistory";
import { useWatchlistScores } from "@/hooks/useWatchlistScores";
import { useLivePrices } from "@/hooks/useLivePrices";
import { WatchlistCard, ProfileChip, type DerivedRow, type ZoneStatus } from "./watchlist/WatchlistCard";
import WatchlistDebugTable from "./WatchlistDebugTable";
import { buildSubstrateAuditPrompt, CLAUDE_PROJECT_URL } from "@/lib/claudePrompts";
import { computeLiveAsymmetry, type AsymmetryQuartet } from "@/lib/liveAsymmetry";
import { useIrrBb } from "@/hooks/useIrrBb";
import type { LiveHolding } from "@/hooks/usePortfolioData";

import {
  RETURN_PROFILE_VALUES,
  type ReturnProfile,
  type CompounderSubtype,
} from "@/types/intelligence";
import { PROFILE_LABEL } from "@/components/intelligence/profileChips";
import {
  FACTOR_GROUP_VALUES,
  STACK_LAYER_VALUES,
  stackLayerOrder,
} from "@/components/holdings/DriverChip";

interface Props {
  liveData: LiveWatchItem[];
  macroState: LiveMacroState;
  /** SCORES sheet rows — used to attach RETURN_PROFILE / COMPOUNDER_SUBTYPE to watchlist rows. */
  scores?: LiveScore[];
  /** All holdings — used by useIrrBb for live prices and held status. */
  holdings?: LiveHolding[];
}

// ── Profile filter keys (compounder split into Stellar / Generic, matches Intelligence tab) ──
type ProfileFilterKey =
  | "STELLAR_COMPOUNDER"
  | "GENERIC_COMPOUNDER"
  | "RECLASSIFICATION"
  | "CYCLE"
  | "HEDGE"
  | "VEHICLE"
  | "PRE_PRODUCTION";

const PROFILE_FILTER_KEYS: ProfileFilterKey[] = [
  "STELLAR_COMPOUNDER",
  "GENERIC_COMPOUNDER",
  "RECLASSIFICATION",
  "CYCLE",
  "HEDGE",
  "VEHICLE",
  "PRE_PRODUCTION",
];

const PROFILE_FILTER_LABEL: Record<ProfileFilterKey, string> = {
  STELLAR_COMPOUNDER: "Stellar Compounder",
  GENERIC_COMPOUNDER: "Generic Compounder",
  RECLASSIFICATION: PROFILE_LABEL.RECLASSIFICATION,
  CYCLE: PROFILE_LABEL.CYCLE,
  HEDGE: PROFILE_LABEL.HEDGE,
  VEHICLE: PROFILE_LABEL.VEHICLE,
  PRE_PRODUCTION: PROFILE_LABEL.PRE_PRODUCTION,
};

function profileKeyFor(p: ReturnProfile | null, sub: CompounderSubtype | null): ProfileFilterKey | null {
  if (!p) return null;
  if (p === "COMPOUNDER") {
    if (sub === "STELLAR_COMPOUNDER") return "STELLAR_COMPOUNDER";
    if (sub === "GENERIC_COMPOUNDER") return "GENERIC_COMPOUNDER";
    return null;
  }
  if (p === "CASH") return null;
  return p as ProfileFilterKey;
}

// Sort rank — Stellar first then Generic, then doctrine order, then empty.
const PROFILE_SORT_RANK: Record<string, number> = {
  STELLAR_COMPOUNDER: 0,
  GENERIC_COMPOUNDER: 1,
  RECLASSIFICATION: 2,
  CYCLE: 3,
  HEDGE: 4,
  VEHICLE: 5,
  PRE_PRODUCTION: 6,
};
function profileSortRank(p: ReturnProfile | null, sub: CompounderSubtype | null): number {
  if (!p) return 99;
  if (p === "COMPOUNDER") {
    if (sub === "STELLAR_COMPOUNDER") return 0;
    if (sub === "GENERIC_COMPOUNDER") return 1;
    return 1.5;
  }
  return PROFILE_SORT_RANK[p] ?? 99;
}

function stripSuffix(t: string): string {
  return t.replace(/[.\-][A-Z0-9]{1,3}$/i, "");
}

function normalizeProfile(raw: unknown): ReturnProfile | null {
  const upper = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return null;
  return (RETURN_PROFILE_VALUES as string[]).includes(upper) ? (upper as ReturnProfile) : null;
}
function normalizeSubtype(raw: unknown): CompounderSubtype | null {
  const upper = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (upper === "STELLAR_COMPOUNDER" || upper === "STELLAR") return "STELLAR_COMPOUNDER";
  if (upper === "GENERIC_COMPOUNDER" || upper === "GENERIC") return "GENERIC_COMPOUNDER";
  return null;
}

const OVERDUE_DAYS = 14;

// Normalize status values to a canonical token: uppercase, alphanumeric only.
// "PRE-IPO", "PRE_IPO", "pre ipo" → "PREIPO".
function normStatus(s: string | null | undefined): string {
  return String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
// Status taxonomy v2 (2026 Doctrine). Tokens are normalised via normStatus().
const DEPLOY = "DEPLOY";
const WAIT_PRICE = "WAITPRICE";
const WAIT_EVENT = "WAITEVENT";
const PREIPO = "PREIPO";
const RESEARCH = "RESEARCH";
const POST_RECLASS_HOLD = "POSTRECLASSHOLD";
const SCALING_WATCH = "SCALINGWATCH";
const ARCHIVE = "ARCHIVE";

interface StatusDef { token: string; label: string; dotColor: string; }
const STATUS_DEFS: StatusDef[] = [
  { token: DEPLOY,            label: "Deploy",            dotColor: "rgb(34,197,94)" },
  { token: WAIT_PRICE,        label: "Wait · Price",      dotColor: "rgb(96,165,250)" },
  { token: WAIT_EVENT,        label: "Wait · Event",      dotColor: "rgb(245,158,11)" },
  { token: RESEARCH,          label: "Research",          dotColor: "rgb(192,132,252)" },
  { token: PREIPO,            label: "Pre-IPO",           dotColor: "rgb(148,163,184)" },
  { token: POST_RECLASS_HOLD, label: "Post-Reclass Hold", dotColor: "rgb(251,146,60)" },
  { token: SCALING_WATCH,     label: "Scaling Watch",     dotColor: "rgb(34,211,238)" },
  { token: ARCHIVE,           label: "Archive",           dotColor: "rgb(156,163,175)" },
];
const KNOWN_STATUS_TOKENS = new Set(STATUS_DEFS.map((d) => d.token));
const DEFAULT_STATUS_FILTER = new Set(
  STATUS_DEFS.filter((d) => d.token !== ARCHIVE).map((d) => d.token),
);

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Research row (compact, with rationale + Substrate Audit) ──
function ResearchRow({ row }: { row: DerivedRow }) {
  const { item } = row;
  const handleAudit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prompt = buildSubstrateAuditPrompt(item.ticker);
    const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
    (window.top || window).open(url, "_blank");
  };
  return (
    <div style={{ padding: "10px 18px 8px", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <TickerButton ticker={item.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 60 }}>
          {item.ticker}
        </TickerButton>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: "1 1 200px" }}>
          {item.name}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
          {row.daysSinceReview != null ? `Reviewed ${row.daysSinceReview}d ago` : "Never reviewed"}
        </span>
        <button
          onClick={handleAudit}
          style={{
            background: "none",
            border: "1px solid var(--rim)",
            color: "rgb(170,140,220)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.08em",
            padding: "3px 9px",
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          🔬 Substrate Audit →
        </button>
      </div>
      {item.rationale && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            color: "var(--text-dim)",
            lineHeight: 1.55,
            marginTop: 4,
            paddingLeft: 72,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {item.rationale}
        </div>
      )}
    </div>
  );
}

// ── Section header ──

function SectionHeader({
  label,
  count,
  dotColor,
  collapsible,
  expanded,
  onToggle,
  extra,
}: {
  label: string;
  count: number;
  dotColor: string;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  extra?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "10px 14px" : "12px 18px",
        borderBottom: "1px solid var(--rim)",
        cursor: collapsible ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: dotColor,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>· {count}</span>
      {extra && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-dim)",
            letterSpacing: "0.08em",
            marginLeft: 4,
          }}
        >
          {extra}
        </span>
      )}
      {collapsible && (
        <span style={{ marginLeft: "auto", color: "var(--text-dim)" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      )}
    </div>
  );
}

// ── Empty section line ──

function EmptyLine({ label, dotColor }: { label: string; dotColor: string }) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "8px 14px" : "10px 18px",
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        borderRadius: 3,
        marginBottom: 10,
        opacity: 0.55,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.15em" }}>
        {label}
      </span>
    </div>
  );
}

// ── Generic chip filter row (Driver / Stack) ──
function ChipFilterRow({
  label,
  values,
  selected,
  onToggle,
  onReset,
  isMobile,
}: {
  label: string;
  values: readonly string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onReset: () => void;
  isMobile: boolean;
}) {
  const all = selected.size === 0;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
        padding: isMobile ? "0 14px 10px" : "0 18px 10px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: "var(--text-dim)",
          textTransform: "uppercase",
          marginRight: 4,
        }}
      >
        {label}
      </span>
      <button
        onClick={onReset}
        style={{
          background: all ? "rgba(201,168,76,0.12)" : "transparent",
          border: `1px solid ${all ? "var(--gold)" : "var(--rim)"}`,
          color: all ? "var(--gold)" : "var(--text-dim)",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.1em",
          padding: "3px 8px",
          borderRadius: 2,
          cursor: "pointer",
          textTransform: "uppercase",
        }}
      >
        All
      </button>
      {values.map((v) => {
        const active = selected.has(v);
        return (
          <button
            key={v}
            onClick={() => onToggle(v)}
            aria-pressed={active}
            style={{
              background: active ? "rgba(201,168,76,0.12)" : "transparent",
              border: `1px solid ${active ? "var(--gold)" : "var(--rim)"}`,
              color: active ? "var(--gold)" : "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              padding: "3px 8px",
              borderRadius: 2,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {v.replace(/_/g, " ")}
          </button>
        );
      })}
    </div>
  );
}

// ── Skeleton ──

function SkeletonRow() {
  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(28,28,48,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ width: 80, height: 12, background: "var(--rim)", borderRadius: 2, animation: "pulse-alert 1.6s ease-in-out infinite" }} />
      <div style={{ flex: 1, height: 10, background: "var(--rim)", borderRadius: 2, opacity: 0.6 }} />
      <div style={{ width: 180, height: 40, background: "var(--rim)", borderRadius: 2, opacity: 0.5 }} />
      <div style={{ width: 80, height: 10, background: "var(--rim)", borderRadius: 2, opacity: 0.6 }} />
    </div>
  );
}

// ── Page ──

export default function WatchlistTab({ liveData, macroState, scores = [], holdings = [] }: Props) {  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set(DEFAULT_STATUS_FILTER));
  const [profileFilter, setProfileFilter] = useState<Set<ProfileFilterKey>>(
    () => new Set(PROFILE_FILTER_KEYS),
  );
  const [driverFilter, setDriverFilter] = useState<Set<string>>(() => new Set());
  const [stackFilter, setStackFilter] = useState<Set<string>>(() => new Set());
  type SortKey = "default" | "score" | "gap" | "trend7d" | "trend30d" | "driver" | "stack" | "profile" | "asymmetry" | "irrBb";  
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [waitingExpanded, setWaitingExpanded] = useState(false);
  const [preIpoExpanded, setPreIpoExpanded] = useState(false);

  // Pull tickers for batched Supabase fetches
  const allTickers = useMemo(
    () =>
      Array.from(
        new Set(
          liveData
            .map((d) => d.ticker?.trim().toUpperCase())
            .filter((t): t is string => !!t),
        ),
      ),
    [liveData],
  );

  const { byTicker: traj, loading: trajLoading } = useWatchlistHistory(allTickers);
  const { byTicker: scoresByTicker } = useWatchlistScores(allTickers);
  const { prices: livePrices, loading: livePricesLoading } = useLivePrices(allTickers);
    // IRR-BB for all scored names
  const { byTicker: irrBbMap } = useIrrBb(scores ?? [], holdings, liveData);

  // ── Profile lookup from SCORES sheet (case-insensitive, with suffix-stripping fallback) ──
  const profileByTicker = useMemo(() => {
    const map = new Map<string, { profile: ReturnProfile | null; subtype: CompounderSubtype | null }>();
    for (const s of scores) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (!t) continue;
      const profile = normalizeProfile(s.returnProfile);
      const subtype = profile === "COMPOUNDER" ? normalizeSubtype(s.compounderSubtype) : null;
      const entry = { profile, subtype };
      map.set(t, entry);
      const stripped = stripSuffix(t);
      if (stripped && stripped !== t && !map.has(stripped)) map.set(stripped, entry);
    }
    return map;
  }, [scores]);

  // Case-insensitive score lookup for asymmetry quartet + China flag
  const scoreByTicker = useMemo(() => {
    const m = new Map<string, LiveScore>();
    for (const s of scores) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (t) m.set(t, s);
    }
    return m;
  }, [scores]);


  // Layer filter options
  const layerOptions = useMemo(
    () => Array.from(new Set(liveData.map((d) => d.layer).filter(Boolean))).sort(),
    [liveData],
  );

  const toggleStatusFilter = (tok: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tok)) next.delete(tok);
      else next.add(tok);
      return next;
    });
  };
  const resetStatusFilter = () => setStatusFilter(new Set(DEFAULT_STATUS_FILTER));

  // ── Derive every row ──
  const derived: DerivedRow[] = useMemo(() => {
    return liveData.map((item) => {
      const ticker = item.ticker?.trim().toUpperCase() ?? "";
      const trajectory = traj[ticker] ?? null;
      const score = scoresByTicker[ticker] ?? null;
      const profileEntry =
        profileByTicker.get(ticker) ?? profileByTicker.get(stripSuffix(ticker)) ?? null;

      const zone = parseEntryTarget(item.entry, item.triggerPriceNumeric);

      // Prefer live Yahoo quote, then Supabase daily close, then sheet CURRENT PRICE
      const liveQuote = livePrices[ticker];
      const currentPrice = item.current ?? trajectory?.currentClose ?? null;
      let zoneStatus: ZoneStatus;
      if (currentPrice == null) zoneStatus = "PRE_IPO";
      else if (!zone) zoneStatus = "WAITING";
      else if (currentPrice <= zone.high && currentPrice >= zone.low) zoneStatus = "IN_ZONE";
      else if (currentPrice <= zone.high * 1.10) zoneStatus = "APPROACHING";
      else zoneStatus = "WAITING";

      const distanceToEntryPct =
        currentPrice != null && zone && zone.high > 0
          ? ((currentPrice - zone.high) / zone.high) * 100
          : null;

      const change7dPct =
        trajectory?.currentClose != null && trajectory?.price7dAgo != null && trajectory.price7dAgo > 0
          ? ((trajectory.currentClose - trajectory.price7dAgo) / trajectory.price7dAgo) * 100
          : null;
      const change30dPct =
        trajectory?.currentClose != null && trajectory?.price30dAgo != null && trajectory.price30dAgo > 0
          ? ((trajectory.currentClose - trajectory.price30dAgo) / trajectory.price30dAgo) * 100
          : null;

      const days = daysSince(item.triggerReviewDate);
      const isOverdue = days != null && days > OVERDUE_DAYS;

      const matched = scoreByTicker.get(ticker);
      const quartet: AsymmetryQuartet = matched ? {
        bullBase: matched.bullBase ?? null,
        bullStretch: matched.bullStretch ?? null,
        bearThesisWeak: matched.bearThesisWeak ?? null,
        bearSubstrateFail: matched.bearSubstrateFail ?? null,
        bullBearAtDate: matched.bullBearAtDate ?? null,
      } : { bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null };
      const liveAsymmetry = computeLiveAsymmetry(quartet, currentPrice);

     const irrEntry = irrBbMap.get(ticker);
      return {
        item,
        zone,
        zoneStatus,
        distanceToEntryPct,
        change7dPct,
        change30dPct,
        daysSinceReview: days,
        isOverdue,
        trajectory,
        score,
        return_profile: profileEntry?.profile ?? null,
        compounder_subtype: profileEntry?.subtype ?? null,
        liveAsymmetry,
        chinaExposureFlag: String((matched as any)?.chinaExposureFlag ?? ""),
        irrBbResult: irrEntry?.result,
        currentPrice,
      };
    });
  }, [liveData, traj, livePrices, scoresByTicker, profileByTicker, scoreByTicker, irrBbMap]);


  // Apply search + filter chips
  const allProfilesSelected = profileFilter.size === PROFILE_FILTER_KEYS.length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return derived.filter((r) => {
      if (q && !`${r.item.ticker} ${r.item.name}`.toLowerCase().includes(q)) return false;
      if (layerFilter !== "ALL" && r.item.layer !== layerFilter) return false;
      {
        const tok = normStatus(r.item.status);
        // Known tokens must be in the active selection; unknown tokens always pass.
        if (KNOWN_STATUS_TOKENS.has(tok) && !statusFilter.has(tok)) return false;
      }
      if (driverFilter.size > 0) {
        const fg = String(r.item.factor_group ?? "").trim().toUpperCase();
        if (!driverFilter.has(fg)) return false;
      }
      if (stackFilter.size > 0) {
        const sl = String(r.item.stack_layer ?? "").trim().toUpperCase();
        if (!stackFilter.has(sl)) return false;
      }
      // Profile filter — only restrict rows that HAVE a profile. Rows without profile
      // (REJECTED/EXITED, or any unscored row) always pass so the filter only narrows
      // the universe of profile-tagged signals it's intended to control.
      if (!allProfilesSelected) {
        const key = profileKeyFor(r.return_profile, r.compounder_subtype);
        if (key && !profileFilter.has(key)) return false;
      }
      return true;
    });
  }, [derived, search, layerFilter, statusFilter, profileFilter, allProfilesSelected, driverFilter, stackFilter]);

  const toggleProfile = (k: ProfileFilterKey) => {
    setProfileFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      // Never allow zero-selection — empty == "all" semantically. Restore all.
      if (next.size === 0) return new Set(PROFILE_FILTER_KEYS);
      return next;
    });
  };
  const resetProfileFilter = () => setProfileFilter(new Set(PROFILE_FILTER_KEYS));

  // ── Bucket rows ──
  const trendNorm = (v: number | null | undefined): number =>
    v == null || !Number.isFinite(v) ? 9999 : v;

  const applySorts = (a: DerivedRow, b: DerivedRow): number => {
    switch (sortBy) {
      case "score": {
        const sa = a.score?.total_score ?? -1;
        const sb = b.score?.total_score ?? -1;
        return sb - sa;
      }
      case "gap": {
        const ga = a.zoneStatus === "IN_ZONE" ? 0 : Math.abs(a.distanceToEntryPct ?? 9999);
        const gb = b.zoneStatus === "IN_ZONE" ? 0 : Math.abs(b.distanceToEntryPct ?? 9999);
        return ga - gb;
      }
      case "trend7d":
        return trendNorm(a.change7dPct) - trendNorm(b.change7dPct);
      case "trend30d":
        return trendNorm(a.change30dPct) - trendNorm(b.change30dPct);
      case "driver":
        return String(a.item.factor_group ?? "").localeCompare(
          String(b.item.factor_group ?? ""),
        );
      case "stack":
        return stackLayerOrder(a.item.stack_layer) - stackLayerOrder(b.item.stack_layer);
      case "profile":
        return (
          profileSortRank(a.return_profile, a.compounder_subtype) -
          profileSortRank(b.return_profile, b.compounder_subtype)
        );
      case "asymmetry": {
        const ra = a.liveAsymmetry?.baseRatio ?? -1;
        const rb = b.liveAsymmetry?.baseRatio ?? -1;
        return rb - ra;
      }
      case "irrBb": {
        const ia = a.irrBbResult?.irrBb ?? -1;
        const ib = b.irrBbResult?.irrBb ?? -1;
        return ib - ia;
      }
      default:
        return 0;
    }

  };

  const activeBuys = useMemo(
    () =>
      filtered
        .filter((r) => normStatus(r.item.status) === DEPLOY)
        .sort((a, b) => {
          const s = applySorts(a, b);
          if (s !== 0) return s;
          return (a.distanceToEntryPct ?? 999) - (b.distanceToEntryPct ?? 999);
        }),
    [filtered, sortBy],
  );
  const activeBuyIds = useMemo(
    () => new Set(activeBuys.map((r) => r.item.ticker)),
    [activeBuys],
  );

  const inZone = useMemo(() => {
    const rows = filtered.filter(
      (r) => r.zoneStatus === "IN_ZONE" && !activeBuyIds.has(r.item.ticker),
    );
    if (sortBy !== "default") return [...rows].sort(applySorts);
    return [...rows].sort((a, b) => {
      const ra = a.liveAsymmetry?.baseRatio;
      const rb = b.liveAsymmetry?.baseRatio;
      const va = ra == null ? -Infinity : ra;
      const vb = rb == null ? -Infinity : rb;
      if (vb !== va) return vb - va;
      return a.item.ticker.localeCompare(b.item.ticker);
    });
  }, [filtered, activeBuyIds, sortBy]);

  const inZoneAsymStats = useMemo(() => {
    const ratios = inZone
      .map((r) => r.liveAsymmetry?.baseRatio)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (ratios.length === 0) return null;
    const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length;
    const highCount = ratios.filter((v) => v >= 3).length;
    return { avg, highCount, total: ratios.length };
  }, [inZone]);

  const approaching = useMemo(
    () =>
      filtered
        .filter((r) => r.zoneStatus === "APPROACHING" && !activeBuyIds.has(r.item.ticker))
        .sort((a, b) => {
          const s = applySorts(a, b);
          if (s !== 0) return s;
          return (a.distanceToEntryPct ?? 999) - (b.distanceToEntryPct ?? 999);
        }),
    [filtered, activeBuyIds, sortBy],
  );

  // Tokens that get their own dedicated section — exclude them from overdue/waiting/uncategorised.
  const DEDICATED_TOKENS = new Set([
    DEPLOY, RESEARCH, PREIPO, POST_RECLASS_HOLD, SCALING_WATCH, ARCHIVE,
  ]);

  const overdue = useMemo(() => {
    return filtered
      .filter((r) => r.isOverdue && !DEDICATED_TOKENS.has(normStatus(r.item.status)))
      .sort((a, b) => {
        const s = applySorts(a, b);
        if (s !== 0) return s;
        return (b.daysSinceReview ?? 0) - (a.daysSinceReview ?? 0);
      });
  }, [filtered, sortBy]);

  const overdueIds = useMemo(() => new Set(overdue.map((r) => r.item.ticker)), [overdue]);

  // Waiting: priced & WAITING-zone & WAIT_PRICE/WAIT_EVENT & not already shown.
  const waiting = useMemo(() => {
    return filtered
      .filter(
        (r) =>
          r.zoneStatus === "WAITING" &&
          !overdueIds.has(r.item.ticker) &&
          !activeBuyIds.has(r.item.ticker) &&
          !DEDICATED_TOKENS.has(normStatus(r.item.status)),
      )
      .sort((a, b) => {
        const s = applySorts(a, b);
        if (s !== 0) return s;
        const sa = a.score?.total_score ?? null;
        const sb = b.score?.total_score ?? null;
        if (sa != null && sb != null && sa !== sb) return sb - sa;
        return (a.distanceToEntryPct ?? 999) - (b.distanceToEntryPct ?? 999);
      });
  }, [filtered, overdueIds, activeBuyIds, sortBy]);

  const waitingByLayer = useMemo(() => {
    const groups = new Map<string, DerivedRow[]>();
    for (const r of waiting) {
      const layer = r.item.layer || "—";
      if (!groups.has(layer)) groups.set(layer, []);
      groups.get(layer)!.push(r);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [waiting]);

  // SCALING_WATCH replaces the old MONITORING section.
  const monitoring = useMemo(
    () =>
      filtered
        .filter((r) => normStatus(r.item.status) === SCALING_WATCH)
        .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker)),
    [filtered],
  );
  const research = useMemo(() => {
    return filtered
      .filter((r) => normStatus(r.item.status) === RESEARCH)
      .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker));
  }, [filtered]);
  const preIpo = useMemo(
    () =>
      filtered
        .filter((r) => normStatus(r.item.status) === PREIPO)
        .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker)),
    [filtered],
  );
  const postReclassHold = useMemo(
    () =>
      filtered
        .filter((r) => normStatus(r.item.status) === POST_RECLASS_HOLD)
        .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker)),
    [filtered],
  );
  const archive = useMemo(
    () =>
      filtered
        .filter((r) => normStatus(r.item.status) === ARCHIVE)
        .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker)),
    [filtered],
  );

  // Fallback: any filtered row not picked up by an existing bucket.
  const uncategorised = useMemo(() => {
    const seen = new Set<string>([
      ...activeBuys.map((r) => r.item.ticker),
      ...inZone.map((r) => r.item.ticker),
      ...approaching.map((r) => r.item.ticker),
      ...overdue.map((r) => r.item.ticker),
      ...waiting.map((r) => r.item.ticker),
      ...monitoring.map((r) => r.item.ticker),
      ...research.map((r) => r.item.ticker),
      ...preIpo.map((r) => r.item.ticker),
      ...postReclassHold.map((r) => r.item.ticker),
      ...archive.map((r) => r.item.ticker),
    ]);
    return filtered
      .filter((r) => !seen.has(r.item.ticker))
      .sort((a, b) => a.item.ticker.localeCompare(b.item.ticker));
  }, [filtered, activeBuys, inZone, approaching, overdue, waiting, monitoring, research, preIpo, postReclassHold, archive]);

  // Dev-only drift warning
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const renderedTickers = new Set<string>([
      ...activeBuys.map((r) => r.item.ticker),
      ...inZone.map((r) => r.item.ticker),
      ...approaching.map((r) => r.item.ticker),
      ...overdue.map((r) => r.item.ticker),
      ...waiting.map((r) => r.item.ticker),
      ...monitoring.map((r) => r.item.ticker),
      ...research.map((r) => r.item.ticker),
      ...preIpo.map((r) => r.item.ticker),
      ...postReclassHold.map((r) => r.item.ticker),
      ...archive.map((r) => r.item.ticker),
      ...uncategorised.map((r) => r.item.ticker),
    ]);
    if (renderedTickers.size !== filtered.length) {
      const missing = filtered
        .filter((r) => !renderedTickers.has(r.item.ticker))
        .map((r) => `${r.item.ticker} (${r.item.status})`);
      // eslint-disable-next-line no-console
      console.warn(
        `[WatchlistTab] Rendered ${renderedTickers.size} of ${filtered.length} rows. Missing:`,
        missing,
      );
    }
  }, [filtered, activeBuys, inZone, approaching, overdue, waiting, monitoring, research, preIpo, postReclassHold, archive, uncategorised]);

  // Header counts (live, recomputed from `derived` regardless of filters)
  const counts = useMemo(() => {
    const total = derived.length;
    const inZ = derived.filter((r) => r.zoneStatus === "IN_ZONE").length;
    const appr = derived.filter((r) => r.zoneStatus === "APPROACHING").length;
    const od = derived.filter((r) => r.isOverdue && !DEDICATED_TOKENS.has(normStatus(r.item.status))).length;
    const buys = derived.filter((r) => normStatus(r.item.status) === DEPLOY).length;
    return { total, inZ, appr, od, buys };
  }, [derived]);

  const pauseActive = (macroState["PAUSE_ACTIVE"]?.currentValue || "").trim().toUpperCase() === "YES";

  // ── Empty data state ──
  if (!liveData || liveData.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          Watchlist data unavailable. Check Google Sheets connection.
        </p>
      </div>
    );
  }

  // ── Render ──

  const sectionStyle: CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--rim)",
    borderRadius: 3,
    marginBottom: 14,
    overflow: "hidden",
  };

  return (
    <div>
      {import.meta.env.DEV && (
        <div style={{ padding: "8px 14px" }}>
          <WatchlistDebugTable />
        </div>
      )}

      {/* ── Sticky header strip ── */}
      <div
        style={{
          position: "sticky",
          top: isMobile ? 84 : 84,
          zIndex: 10,
          background: "var(--void)",
          borderBottom: "1px solid var(--rim)",
          padding: isMobile ? "10px 14px" : "12px 18px",
          marginBottom: 16,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 10 : 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 18, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", color: "var(--gold)" }}>
            WATCHLIST
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            {counts.total} total ·{" "}
            <span style={{ color: counts.buys > 0 ? "var(--green)" : "var(--text-dim)", fontWeight: counts.buys > 0 ? 700 : 400 }}>
              {counts.buys} BUY
            </span>{" "}
            ·{" "}
            <span style={{ color: counts.inZ > 0 ? "var(--green)" : "var(--text-dim)", fontWeight: counts.inZ > 0 ? 700 : 400 }}>
              {counts.inZ} IN ZONE
            </span>{" "}
            ·{" "}
            <span style={{ color: counts.appr > 0 ? "var(--amber)" : "var(--text-dim)" }}>
              {counts.appr} APPROACHING
            </span>{" "}
            ·{" "}
            <span style={{ color: counts.od > 0 ? "var(--red)" : "var(--text-dim)" }}>
              {counts.od} OVERDUE
            </span>
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flex: isMobile ? "1 1 auto" : "1 1 auto", justifyContent: isMobile ? "stretch" : "flex-end", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "1 1 200px", maxWidth: isMobile ? "none" : 280 }}>
            <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticker or name…"
              aria-label="Search watchlist"
              style={{
                width: "100%",
                padding: "6px 8px 6px 26px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--rim)",
                color: "var(--text-mid)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                borderRadius: 2,
                outline: "none",
              }}
            />
          </div>
          <select
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value)}
            style={selectStyle}
            aria-label="Filter by layer"
          >
            <option value="ALL">Layer · All</option>
            {layerOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {/* Status filter moved to its own multi-select chip row below the sticky header */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{
              ...selectStyle,
              color: sortBy !== "default" ? "var(--gold)" : "var(--text-mid)",
              borderColor: sortBy !== "default" ? "var(--gold)" : "var(--rim)",
            }}
            aria-label="Sort rows"
            title="Sort rows within each section"
          >
            <option value="default">Sort · Default</option>
            <option value="score">Sort · Score (high→low)</option>
            <option value="gap">Sort · Gap (closest→furthest)</option>
            <option value="trend7d">Sort · 7d trend (falling first)</option>
            <option value="trend30d">Sort · 30d trend (falling first)</option>
            <option value="driver">Sort · Driver</option>
            <option value="stack">Sort · Stack</option>
            <option value="profile">Sort · Profile</option>
            <option value="asymmetry">Sort · Asymmetry (high→low)</option>
            <option value="irrBb">Sort · IRR-BB (high→low)</option>
          </select>
        </div>
      </div>

      {/* ── Active sort hint ── */}
      {sortBy !== "default" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "0 14px 8px" : "0 18px 8px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(201,168,76,0.12)",
              border: "1px solid var(--gold)",
              color: "var(--gold)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              padding: "3px 8px",
              borderRadius: 2,
              textTransform: "uppercase",
            }}
          >
            Sorted by {sortBy === "trend7d" ? "7d trend" : sortBy === "trend30d" ? "30d trend" : sortBy === "irrBb" ? "IRR-BB" : sortBy}
            <button
              onClick={() => setSortBy("default")}
              aria-label="Reset sort"
              style={{
                background: "none",
                border: "none",
                color: "var(--gold)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {/* ── Status filter chips (multi-select; ARCHIVE off by default) ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          padding: isMobile ? "0 14px 8px" : "0 18px 8px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.15em",
            color: "var(--text-dim)",
            textTransform: "uppercase",
            marginRight: 4,
          }}
        >
          Status
        </span>
        <button
          onClick={resetStatusFilter}
          style={{
            background: "transparent",
            border: "1px solid var(--rim)",
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
            padding: "3px 8px",
            borderRadius: 2,
            cursor: "pointer",
            textTransform: "uppercase",
          }}
          title="Reset to default (everything except Archive)"
        >
          Reset
        </button>
        {STATUS_DEFS.map((def) => {
          const active = statusFilter.has(def.token);
          return (
            <button
              key={def.token}
              onClick={() => toggleStatusFilter(def.token)}
              aria-pressed={active}
              style={{
                background: active ? `color-mix(in srgb, ${def.dotColor} 14%, transparent)` : "transparent",
                border: `1px solid ${active ? def.dotColor : "var(--rim)"}`,
                color: active ? def.dotColor : "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                padding: "3px 8px",
                borderRadius: 2,
                cursor: "pointer",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: def.dotColor, opacity: active ? 1 : 0.55 }} />
              {def.label}
            </button>
          );
        })}
      </div>


      {/* ── Profile filter chips ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          padding: isMobile ? "0 14px 10px" : "0 18px 12px",
          marginTop: -6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.15em",
            color: "var(--text-dim)",
            textTransform: "uppercase",
            marginRight: 4,
          }}
        >
          Profile
        </span>
        <button
          onClick={resetProfileFilter}
          style={{
            background: allProfilesSelected ? "rgba(201,168,76,0.12)" : "transparent",
            border: `1px solid ${allProfilesSelected ? "var(--gold)" : "var(--rim)"}`,
            color: allProfilesSelected ? "var(--gold)" : "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
            padding: "3px 8px",
            borderRadius: 2,
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          All
        </button>
        {PROFILE_FILTER_KEYS.map((k) => {
          const active = profileFilter.has(k) && !allProfilesSelected;
          return (
            <button
              key={k}
              onClick={() => toggleProfile(k)}
              style={{
                background: active ? "rgba(201,168,76,0.12)" : "transparent",
                border: `1px solid ${active ? "var(--gold)" : "var(--rim)"}`,
                color: active ? "var(--gold)" : profileFilter.has(k) ? "var(--text-mid)" : "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                padding: "3px 8px",
                borderRadius: 2,
                cursor: "pointer",
                opacity: profileFilter.has(k) ? 1 : 0.45,
              }}
              aria-pressed={profileFilter.has(k)}
            >
              {PROFILE_FILTER_LABEL[k]}
            </button>
          );
        })}
      </div>

      {/* ── Driver (FACTOR_GROUP) filter chips ── */}
      <ChipFilterRow
        label="Driver"
        values={FACTOR_GROUP_VALUES as readonly string[]}
        selected={driverFilter}
        onToggle={(v) =>
          setDriverFilter((prev) => {
            const next = new Set(prev);
            if (next.has(v)) next.delete(v);
            else next.add(v);
            return next;
          })
        }
        onReset={() => setDriverFilter(new Set())}
        isMobile={isMobile}
      />

      {/* ── Stack (STACK_LAYER) filter chips ── */}
      <ChipFilterRow
        label="Stack"
        values={STACK_LAYER_VALUES as readonly string[]}
        selected={stackFilter}
        onToggle={(v) =>
          setStackFilter((prev) => {
            const next = new Set(prev);
            if (next.has(v)) next.delete(v);
            else next.add(v);
            return next;
          })
        }
        onReset={() => setStackFilter(new Set())}
        isMobile={isMobile}
      />

      {pauseActive && (
        <div
          style={{
            background: "var(--red-dim)",
            border: "1px solid color-mix(in srgb, var(--red) 35%, transparent)",
            padding: "8px 14px",
            borderRadius: 2,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--red)",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          ⛔ MACRO PAUSE ACTIVE — NO NEW BUYS
        </div>
      )}

      {/* ── 0. ACTIVE BUYS (status = BUY / ACTIVE) ── */}
      {activeBuys.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Active Buys" count={activeBuys.length} dotColor="var(--green)" />
          {activeBuys.map((r) => (
            <WatchlistCard key={`buy-${r.item.ticker}`} row={r} variant="compact" tint="in-zone" />
          ))}
        </div>
      )}

      {/* ── 1. IN ZONE ── */}
      {inZone.length > 0 ? (
        <div style={sectionStyle}>
          <SectionHeader
            label="In Zone"
            count={inZone.length}
            dotColor="var(--green)"
            extra={
              inZoneAsymStats
                ? `· avg ${inZoneAsymStats.avg.toFixed(1)}:1 · ${inZoneAsymStats.highCount}/${inZoneAsymStats.total} ≥3:1${sortBy === "default" ? " · sorted by asym" : ""}`
                : null
            }
          />
          {inZone.map((r) => (
            <WatchlistCard key={`zone-${r.item.ticker}`} row={r} variant="compact" tint="in-zone" />
          ))}
        </div>
      ) : (
        <EmptyLine label="No tickers in buy zone" dotColor="var(--green)" />
      )}

      {/* ── 2. APPROACHING ── */}
      {approaching.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Approaching (within 10%)" count={approaching.length} dotColor="var(--amber)" />
          {approaching.map((r) => (
            <WatchlistCard key={`appr-${r.item.ticker}`} row={r} variant="compact" tint="approaching" />
          ))}
        </div>
      )}

      {/* ── 3. OVERDUE REVIEWS ── */}
      {overdue.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Overdue Reviews" count={overdue.length} dotColor="var(--red)" />
          {overdue.map((r) => (
            <WatchlistCard key={`od-${r.item.ticker}`} row={r} variant="compact" tint="overdue" />
          ))}
        </div>
      )}

      {/* ── 4. WAITING (collapsed by default) ── */}
      {waiting.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader
            label="Waiting"
            count={waiting.length}
            dotColor="var(--text-dim)"
            collapsible
            expanded={waitingExpanded}
            onToggle={() => setWaitingExpanded((v) => !v)}
          />
          {waitingExpanded &&
            waitingByLayer.map(([layer, rows]) => (
              <div key={`wait-${layer}`}>
                <div
                  style={{
                    padding: "10px 18px",
                    background: "rgba(201,168,76,0.06)",
                    borderTop: "1px solid var(--rim)",
                    borderBottom: "1px solid var(--rim)",
                    borderLeft: "2px solid var(--gold)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    color: "var(--gold)",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--gold)", opacity: 0.7 }}>▸</span>
                  <span>{layer}</span>
                  <span style={{ color: "var(--text-mid)", fontWeight: 400 }}>· {rows.length}</span>
                </div>
                {rows.map((r) => (
                  <WatchlistCard key={`wait-${r.item.ticker}`} row={r} variant="compact" />
                ))}
              </div>
            ))}
        </div>
      )}

      {/* ── 5. MONITORING ── */}
      {monitoring.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Monitoring" count={monitoring.length} dotColor="var(--accent)" />
          {monitoring.map((r) => (
            <WatchlistCard key={`mon-${r.item.ticker}`} row={r} variant="compact" hideActions />
          ))}
        </div>
      )}

      {/* ── 6. RESEARCH ── */}
      {research.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Research" count={research.length} dotColor="rgb(140,140,220)" />
          {research.map((r) => (
            <ResearchRow key={`res-${r.item.ticker}`} row={r} />
          ))}
        </div>
      )}

      {/* ── 7. PRE-IPO (collapsed) ── */}
      {preIpo.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader
            label="Pre-IPO"
            count={preIpo.length}
            dotColor="rgb(170,120,220)"
            collapsible
            expanded={preIpoExpanded}
            onToggle={() => setPreIpoExpanded((v) => !v)}
          />
          {preIpoExpanded &&
            preIpo.map((r) => (
              <div
                key={`pre-${r.item.ticker}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 18px",
                  borderBottom: "1px solid rgba(28,28,48,0.4)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 60 }}>
                  {r.item.ticker}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: "1 1 200px" }}>
                  {r.item.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 8,
                    letterSpacing: "0.12em",
                    padding: "2px 7px",
                    borderRadius: 2,
                    background: "rgba(28,28,48,0.5)",
                    border: "1px solid var(--rim)",
                    color: "var(--text-dim)",
                  }}
                >
                  {r.item.layer}
                </span>
                <ProfileChip profile={r.return_profile} subtype={r.compounder_subtype} />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "rgb(170,120,220)",
                    background: "rgba(170,120,220,0.1)",
                    padding: "2px 7px",
                    borderRadius: 2,
                  }}
                >
                  Awaiting IPO
                </span>
              </div>
            ))}
        </div>
      )}

      {/* ── 7b. POST-RECLASS HOLD ── */}
      {postReclassHold.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Post-Reclass Hold" count={postReclassHold.length} dotColor="rgb(251,146,60)" />
          {postReclassHold.map((r) => (
            <WatchlistCard key={`prh-${r.item.ticker}`} row={r} variant="compact" hideActions />
          ))}
        </div>
      )}

      {/* ── 7c. ARCHIVE (hidden unless user enables the chip) ── */}
      {archive.length > 0 && (
        <div style={{ ...sectionStyle, opacity: 0.78 }}>
          <SectionHeader label="Archive" count={archive.length} dotColor="rgb(156,163,175)" />
          {archive.map((r) => (
            <WatchlistCard key={`arc-${r.item.ticker}`} row={r} variant="compact" hideActions />
          ))}
        </div>
      )}

      {/* ── 8. UNCATEGORISED (fallback — any row not picked up above) ── */}
      {uncategorised.length > 0 && (
        <div style={sectionStyle}>
          <SectionHeader label="Uncategorised" count={uncategorised.length} dotColor="var(--text-dim)" />
          {uncategorised.map((r) => (
            <WatchlistCard key={`uncat-${r.item.ticker}`} row={r} variant="compact" />
          ))}
        </div>
      )}

      {/* Loading hint when sparkline data is still being fetched */}
      {trajLoading && (
        <div style={{ marginTop: 12 }}>
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
    </div>
  );
}

const selectStyle: CSSProperties = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--rim)",
  color: "var(--text-mid)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "6px 8px",
  borderRadius: 2,
  outline: "none",
  cursor: "pointer",
};
