import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronDown, Microscope } from "lucide-react";
import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";
import { LiveHolding, LiveDisruption, LiveTransaction, LiveScore, type LiveLayer, type LiveWatchItem, usePortfolioData } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import { calcHoldingReturns, HoldingReturns } from "@/lib/xirr";
import { PriceDataMap, normaliseTicker } from "@/hooks/useDailyPrices";
import { useLivePrices } from "@/hooks/useLivePrices";
import { Sparkline } from "@/components/Sparkline";
import ReviewQueue, { parseReviewFlag as parseFlag } from "@/components/ReviewQueue";
import TickerButton from "@/components/factsheet/TickerButton";
import { useResearchSummary } from "@/hooks/useResearchSummary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { openClaudeWithPrompt } from "@/lib/claudePromptUrl";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import { toast } from "sonner";
import { HoldingsExpansionRow } from "@/components/HoldingsExpansionRow";
import { HoldingsHeader } from "@/components/holdings/HoldingsHeader";
import { HoldingsFilters } from "@/components/holdings/HoldingsFilters";
import { HoldingsGroupHeader } from "@/components/holdings/HoldingsGroupHeader";
import {
  DEFAULT_HOLDINGS_STATE,
  holdingsStateFromParams,
  holdingsStateToParams,
  normalizeAccount,
  normalizeActionFactor,
  HOLDINGS_ACCOUNT_VALUES,
  type HoldingsUiState,
  type HoldingsSortField,
  type HoldingsGroupBy,
  type HoldingsAccount,
} from "@/lib/url-state-holdings";
import { LAYER_VALUES, type Layer } from "@/types/intelligence";
import { MobileSortSelect, type MobileSortOption } from "@/components/shared/filters/MobileSortSelect";
import { DriverChip, StackBadge, stackLayerOrder } from "@/components/holdings/DriverChip";
import { computeLiveAsymmetry, type LiveAsymmetryResult } from "@/lib/liveAsymmetry";
import { useQuartetMap } from "@/hooks/useQuartetMap";
import { AsymmetryPill } from "@/components/AsymmetryPill";
import { IrrBbPill } from "@/components/IrrBbPill";
import { PriceDevChip } from "@/components/PriceDevChip";
import { useIrrBb } from "@/hooks/useIrrBb";
import { ChinaRiskChip } from "@/components/ChinaRiskChip";
import { profileChipStyle, PROFILE_LABEL } from "@/components/intelligence/profileChips";
import type { ReturnProfile } from "@/types/intelligence";


// (Claude project URL is now constructed in src/lib/claudePromptUrl.ts)

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
  bordier?: LiveHolding[];
  disruption?: LiveDisruption[];
  transactions?: LiveTransaction[];
  scores?: LiveScore[];
  priceData?: PriceDataMap;
}

type GroupMode = HoldingsGroupBy;
type SortKey = HoldingsSortField;
type SortDir = "asc" | "desc";

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  HOLD: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  ADD: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  "SIZE UP": { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  REVIEW: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  TRIM: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  EXIT: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  SELL: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  CAP: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  WATCH: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(110,142,200,0.2)" },
};

// Hold Status — derived from HOLDINGS.ALERT_STATUS. Maps both the new
// vocabulary (SIZE_UP/SIZE_DOWN/EXIT/CLEAR) and legacy ALERT_STATUS values
// (ADD_ZONE → size up, EXIT_ZONE → exit, REVIEW → size down).
type HoldStatusKind = "SIZE_UP" | "SIZE_DOWN" | "MONITOR" | "EXIT" | "CLEAR";

const HOLD_STATUS_STYLE: Record<Exclude<HoldStatusKind, "CLEAR">, { bg: string; fg: string; border: string; label: string }> = {
  SIZE_UP:   { bg: "var(--green-dim)",  fg: "var(--green)",  border: "rgba(90,191,160,0.4)",  label: "▲ SIZE UP" },
  SIZE_DOWN: { bg: "var(--amber-dim)",  fg: "var(--amber)",  border: "rgba(200,146,90,0.4)",  label: "▼ SIZE DOWN" },
  MONITOR:   { bg: "var(--accent-dim)", fg: "var(--accent)", border: "rgba(110,142,200,0.4)", label: "◉ MONITOR" },
  EXIT:      { bg: "var(--red-dim)",    fg: "var(--red)",    border: "rgba(200,90,90,0.4)",   label: "✕ EXIT" },
};

function deriveHoldStatus(raw: string | null | undefined): HoldStatusKind {
  const u = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!u || u === "HOLD" || u === "CLEAR") return "CLEAR";
  if (u === "SIZE_UP" || u === "ADD_ZONE" || u === "ADD") return "SIZE_UP";
  if (u === "SIZE_DOWN" || u === "REVIEW" || u === "TRIM") return "SIZE_DOWN";
  if (u === "MONITOR" || u === "WATCH") return "MONITOR";
  if (u === "EXIT" || u === "EXIT_ZONE" || u === "SELL") return "EXIT";
  return "CLEAR";
}

function HoldStatusBadge({ status }: { status: string | null | undefined }) {
  const kind = deriveHoldStatus(status);
  if (kind === "CLEAR") return null;
  const s = HOLD_STATUS_STYLE[kind];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      background: s.bg,
      color: s.fg,
      border: `1px solid ${s.border}`,
      padding: "5px 10px",
      borderRadius: 2,
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      lineHeight: 1,
    }}>
      {s.label}
    </span>
  );
}

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 24 };
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
};

type HoldingWithReturns = LiveHolding & {
  returns?: HoldingReturns;
  liveAsymmetry?: LiveAsymmetryResult;
  chinaExposureFlag?: string;
  irrBbResult?: import("@/lib/computeIrrBb").IrrBbResult;
};


function sortHoldings(data: HoldingWithReturns[], key: SortKey, dir: SortDir): HoldingWithReturns[] {
  return [...data].sort((a, b) => {
    let av: any, bv: any;
    switch (key) {
      case "annReturn": av = a.returns?.annualisedReturn ?? -999; bv = b.returns?.annualisedReturn ?? -999; break;
      case "cost": av = a.returns?.totalCost ?? 0; bv = b.returns?.totalCost ?? 0; break;
      case "truePL": av = a.returns?.truePL ?? 0; bv = b.returns?.truePL ?? 0; break;
      case "account": av = a.account ?? ""; bv = b.account ?? ""; break;
      case "driver": av = (a as any).factor_group ?? ""; bv = (b as any).factor_group ?? ""; break;
      case "stack": av = stackLayerOrder((a as any).stack_layer); bv = stackLayerOrder((b as any).stack_layer); break;
      case "asymmetry": av = a.liveAsymmetry?.baseRatio ?? -1; bv = b.liveAsymmetry?.baseRatio ?? -1; break;
      case "irrBb": av = a.irrBbResult?.irrBb ?? -1; bv = b.irrBbResult?.irrBb ?? -1; break;

      default: av = a[key as keyof typeof a] ?? ""; bv = b[key as keyof typeof b] ?? "";
    }
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

}

// Holdings expansion bodies (TriggerRows / DisruptionPanel / ScoreCard /
// InlineRangeBar) were removed in the Prompt 5 refactor. The shared
// <AssetExpansion> in src/components/intelligence/ now renders the full
// expansion for both Intelligence and Holdings, looked up via
// <HoldingsExpansionRow ticker={...} />.

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
        padding: "4px 12px", border: "1px solid var(--rim)",
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-dim)",
        cursor: "pointer", transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

// ── Unified columns ──

const UNIFIED_COLUMNS: { label: string; key: SortKey; align?: "right"; hideMobile?: boolean; sortable?: boolean }[] = [
  { label: "Ticker", key: "ticker", sortable: true },
  { label: "Name", key: "name", hideMobile: true, sortable: true },
  { label: "Layer", key: "layer", hideMobile: true, sortable: true },
  { label: "Driver", key: "driver", hideMobile: true, sortable: true },
  { label: "Stack", key: "stack", hideMobile: true, sortable: true },
  { label: "Account", key: "account", hideMobile: true, sortable: true },
  { label: "MV £", key: "mv", align: "right", sortable: true },
  { label: "G/L %", key: "gl", align: "right", sortable: true },
  { label: "Day %", key: "day", align: "right", sortable: true },
  { label: "Asym", key: "asymmetry", align: "right", sortable: true },
  { label: "IRR-BB", key: "irrBb", align: "right", hideMobile: true, sortable: true },
  { label: "Price", key: "price", align: "right", sortable: false },
];


// Extra columns rendered manually after Price: 30D sparkline, MA20, MA50, then Cost/P&L/Ann.Ret/Notes/Action

// ── Unified View ──

interface GroupInfo {
  key: string;
  label: string;
  sublabel?: string;
  holdings: HoldingWithReturns[];
  totalMv: number;
  pctAum: number;
}

function UnifiedView({
  allHoldings,
  totalAum,
  transactions,
  disruptionMap,
  groupMode,
  sippTotal,
  isaTotal,
  priceData,
  scores,
  watchlist,
  sortKey,
  sortDir,
  onSortChange,
  onSortSet,
  layerWeights,
  tierByTicker,
  onLayerGroupClick,
}: {
  allHoldings: LiveHolding[];
  totalAum: number;
  transactions: LiveTransaction[];
  disruptionMap: Map<string, LiveDisruption>;
  groupMode: GroupMode;
  sippTotal: number;
  isaTotal: number;
  priceData?: PriceDataMap;
  scores?: LiveScore[];
  watchlist: LiveWatchItem[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey) => void;
  onSortSet?: (key: SortKey, dir: SortDir) => void;
  layerWeights: Map<string, { actual: number; target: number }>;
  tierByTicker: Map<string, string>;
  onLayerGroupClick: (layer: Layer) => void;
}) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Note: useRationales / useTickerHistory were removed when Holdings switched
  // to the shared <AssetExpansion>. The expansion's hook (useAssetIntelligence)
  // already loads rationales eagerly, so per-row fetches are no longer needed.
  const { getSummary, getResearchFreshness } = useResearchSummary();

 // Shared quartet map: SCORES quartet + live price from HOLDINGS/WATCHLIST
  const quartetMap = useQuartetMap(scores ?? [], allHoldings, watchlist);

  // IRR-BB for all scored names
  const { byTicker: irrBbMap } = useIrrBb(scores ?? [], allHoldings, watchlist);

  // Live Yahoo prices for holdings (same edge function + alias map as Watchlist)
  const holdingsTickers = useMemo(
    () => Array.from(new Set(allHoldings.map(h => normaliseTicker(h.ticker)).filter(Boolean))),
    [allHoldings],
  );
  const { prices: livePrices } = useLivePrices(holdingsTickers);

  // Case-insensitive score lookup
  const scoreByTicker = useMemo(() => {
    const m = new Map<string, LiveScore>();
    for (const s of scores ?? []) {
      const t = String(s.ticker ?? "").trim().toUpperCase();
      if (t) m.set(t, s);
    }
    return m;
  }, [scores]);

  const holdingsWithReturns: HoldingWithReturns[] = useMemo(() => {
    return allHoldings.map(h => {
      const ticker = String(h.ticker ?? "").trim().toUpperCase();
      const matched = scoreByTicker.get(ticker);
      const entry = quartetMap.get(ticker);
      const irrEntry = irrBbMap.get(ticker);
      return {
        ...h,
        returns: transactions.length > 0 ? calcHoldingReturns(h.ticker, h.account, h.mv || 0, transactions) : undefined,
        liveAsymmetry: entry?.asymmetry ?? computeLiveAsymmetry({ bullBase: null, bullStretch: null, bearThesisWeak: null, bearSubstrateFail: null, bullBearAtDate: null }, null),
        chinaExposureFlag: String((matched as any)?.chinaExposureFlag ?? ""),
        returnProfile: String((matched as any)?.returnProfile ?? ""),
        irrBbResult: irrEntry?.result,
      };
    });
  }, [allHoldings, transactions, scoreByTicker, quartetMap, irrBbMap]);


  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSort = (key: SortKey) => onSortChange(key);

  // Build groups (CASH rows stay pinned at top, ungrouped)
  const isCash = (h: LiveHolding) => (h.ticker || "").trim().toUpperCase() === "CASH";

  const groups: GroupInfo[] = useMemo(() => {
    const positionsOnly = holdingsWithReturns.filter((h) => !isCash(h));

    if (groupMode === "none") {
      return [{
        key: "__all__",
        label: "",
        holdings: positionsOnly,
        totalMv: positionsOnly.reduce((s, h) => s + (h.mv || 0), 0),
        pctAum: 100,
      }];
    }

    const grouped = new Map<string, HoldingWithReturns[]>();
    const keyFor = (h: HoldingWithReturns): string => {
      if (groupMode === "layer") return h.layer || "Uncategorised";
      if (groupMode === "account") return h.account || "Unknown";
      // tier
      return tierByTicker.get(h.ticker) || "Untiered";
    };
    for (const h of positionsOnly) {
      const k = keyFor(h);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(h);
    }

    return Array.from(grouped.entries())
      .map(([k, holdings]) => {
        const mv = holdings.reduce((s, h) => s + (h.mv || 0), 0);
        let sublabel: string | undefined;
        if (groupMode === "account") {
          sublabel = k.toUpperCase().includes("SIPP") ? "long horizon" : "flexible wrapper";
        }
        return {
          key: k,
          label: k,
          sublabel,
          holdings,
          totalMv: mv,
          pctAum: totalAum > 0 ? (mv / totalAum) * 100 : 0,
        };
      })
      .sort((a, b) => b.totalMv - a.totalMv);
  }, [holdingsWithReturns, groupMode, totalAum, tierByTicker]);

  // CASH rows are always rendered at the top, ignored by sort/filter/group
  const cashRows = holdingsWithReturns.filter(isCash);

  const visibleCols = UNIFIED_COLUMNS.filter(c => !(isMobile && c.hideMobile));
  // Extra columns rendered after Price: 30D sparkline, Ann. Ret, Hold Status
  const extraDesktopCols = 3;
  const totalCols = visibleCols.length + (isMobile ? 2 : extraDesktopCols);
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const pad = isMobile ? "8px 6px" : "8px 12px";
  const cellPad = isMobile ? "10px 6px" : "10px 12px";

  const thS: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
    color: "var(--text-dim)", padding: pad, borderBottom: "1px solid var(--rim)",
    textAlign: "left", fontWeight: 400, whiteSpace: "nowrap", userSelect: "none",
  };

  // Mobile sort options — explicit dropdown replaces clickable column headers below 900px
  const mobileSortOptions: MobileSortOption<SortKey>[] = [
    { field: "day", dir: "desc", label: "Day % ↓" },
    { field: "day", dir: "asc",  label: "Day % ↑" },
    { field: "gl",  dir: "desc", label: "G/L % ↓" },
    { field: "gl",  dir: "asc",  label: "G/L % ↑" },
    { field: "mv",  dir: "desc", label: "MV ↓" },
    { field: "mv",  dir: "asc",  label: "MV ↑" },
    { field: "annReturn", dir: "desc", label: "Ann. Ret ↓" },
    { field: "annReturn", dir: "asc",  label: "Ann. Ret ↑" },
    { field: "irrBb", dir: "desc", label: "IRR-BB ↓" },
    { field: "irrBb", dir: "asc",  label: "IRR-BB ↑" },
    { field: "ticker", dir: "asc",  label: "A → Z" },
    { field: "ticker", dir: "desc", label: "Z → A" },
  ];
  const handleMobileSortChange = (f: SortKey, d: SortDir) => {
    if (onSortSet) onSortSet(f, d);
    else if (f !== sortKey) onSortChange(f);
  };

  // ── Mobile card layout (≤767px) ────────────────────────────────────────
  // Replaces the table entirely; keeps CASH pinned, group headers, all expansion.
  if (isMobile) {
    return (
      <div>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rim)" }}>
          <MobileSortSelect options={mobileSortOptions} field={sortKey} dir={sortDir} onChange={handleMobileSortChange} />
        </div>
        {/* Pinned CASH cards */}
        {cashRows.map((h) => (
          <div
            key={`cash-${h.account}`}
            style={{
              padding: "10px 14px",
              background: "rgba(28,28,48,0.4)",
              borderBottom: "1px solid var(--rim)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--gold)",
              letterSpacing: "0.12em",
            }}
          >
            CASH · {h.account} · £{(h.mv || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
          </div>
        ))}

        {groups.map((group) => {
          const sortedHoldings = sortHoldings(group.holdings, sortKey, sortDir);
          const layerWeight = groupMode === "layer" ? layerWeights.get(group.key) : undefined;
          const groupClickable = groupMode === "layer" && (LAYER_VALUES as readonly string[]).includes(group.key);
          return (
            <div key={`mobile-group-${group.key}`}>
              {groupMode !== "none" && (
                <HoldingsGroupHeader
                  groupBy={groupMode}
                  groupValue={group.label}
                  holdings={group.holdings}
                  totalAum={totalAum}
                  weight={layerWeight}
                  onClick={groupClickable ? () => onLayerGroupClick(group.key as Layer) : undefined}
                />
              )}
              {sortedHoldings.map((h) => {
                const rowKey = `${h.ticker}-${h.account}`;
                const isOpen = expanded.has(rowKey);
                const r = h.returns;
                const hasReturns = r && r.totalCost > 0;
                const summary = getSummary(h.ticker);
                const flag = parseFlag(h.ticker, h.trigger_review_date, h.trigger_review_note);
                const lpMobile = livePrices[normaliseTicker(h.ticker)];
                const displayDayMobile = lpMobile?.changePercent ?? h.day;
                return (
                  <div key={rowKey} style={{ borderBottom: "1px solid var(--rim)" }}>
                    <button
                      type="button"
                      onClick={() => toggle(rowKey)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        padding: "12px 14px",
                        width: "100%",
                        background: isOpen ? "rgba(28,28,48,0.30)" : "transparent",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {/* Line 1: ticker · score badge · alert · flag · chevron */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                        <TickerButton ticker={h.ticker} style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.04em" }}>
                          {h.ticker}
                        </TickerButton>
                        {summary && (() => {
                          const sc = summary.total_score;
                          const badgeColor = sc >= 80 ? "var(--green)" : sc >= 60 ? "var(--accent)" : sc >= 40 ? "var(--amber)" : "var(--red)";
                          return (
                            <span style={{
                              fontSize: 9, fontWeight: 700, color: badgeColor,
                              background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`,
                              padding: "1px 5px", borderRadius: 8, lineHeight: 1,
                            }}>{sc}</span>
                          );
                        })()}
                        <HoldStatusBadge status={h.alert_status} />
                        {flag && (
                          <span title={`${flag.prefix}: ${flag.reason}`} style={{ fontSize: 10 }}>
                            {flag.priority === "HIGH" ? "🔴" : flag.priority === "MEDIUM" ? "🟡" : "🟢"}
                          </span>
                        )}
                        <ChinaRiskChip flag={h.chinaExposureFlag} />
                        {(() => {
                          const rp = (h as any).returnProfile as string;
                          if (!rp || !PROFILE_LABEL[rp as ReturnProfile]) return null;
                          const s = profileChipStyle(rp as ReturnProfile);
                          return <span style={{ ...s, fontSize: 8, padding: "1px 4px" }}>{PROFILE_LABEL[rp as ReturnProfile]}</span>;
                        })()}

                        <span style={{
                          marginLeft: "auto",
                          fontSize: 9, letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap",
                          ...(ACTION_STYLE[h.action] ?? ACTION_STYLE.MONITOR),
                        }}>{h.action}</span>
                        <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      </div>

                      {/* Line 2: name (truncated) */}
                      <div style={{ fontSize: 10, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                        {h.name}
                      </div>

                      {/* Line 3: MV · G/L% · Day% */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 12, width: "100%", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                          {h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}
                        </span>
                        <span style={{ fontSize: 11, color: h.gl >= 0 ? "var(--green)" : "var(--red)" }}>
                          {h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"} G/L
                        </span>
                        <span style={{ fontSize: 11, color: displayDayMobile > 0 ? "var(--green)" : displayDayMobile < 0 ? "var(--red)" : "var(--text-dim)" }}>
                          {displayDayMobile != null ? `${displayDayMobile >= 0 ? "+" : ""}${displayDayMobile.toFixed(2)}%` : "—"} day
                        </span>
                        {h.liveAsymmetry?.baseRatio != null && <AsymmetryPill asymmetry={h.liveAsymmetry} />}
                        {h.irrBbResult && <IrrBbPill result={h.irrBbResult} />}
                      </div>


                      {/* Line 4: layer · account · ann return */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", flexWrap: "wrap", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        <span>{h.layer}</span>
                        <span style={{ color: "var(--rim)" }}>·</span>
                        {normalizeAccount(h.account) === "BORDIER" ? (
                          <span style={{ color: "var(--gold)", fontWeight: 700, letterSpacing: "0.1em" }}>BORDIER · JPY</span>
                        ) : (
                          <span>{h.account}</span>
                        )}
                        <DriverChip value={(h as any).factor_group} />
                        <StackBadge value={(h as any).stack_layer} />
                        {hasReturns && (
                          <>
                            <span style={{ color: "var(--rim)" }}>·</span>
                            <span style={{ color: r!.annualisedReturn >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                              {r!.annualisedReturn >= 0 ? "+" : ""}{r!.annualisedReturn.toFixed(1)}% ann
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <HoldingsExpansionRow ticker={h.ticker} colSpan={1} mode="block" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Total footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px", borderTop: "1px solid var(--rim)",
          fontFamily: "var(--font-mono)", fontSize: 11,
        }}>
          <span style={{ color: "var(--text-mid)", fontWeight: 700, letterSpacing: "0.15em" }}>TOTAL</span>
          <span style={{ color: "var(--gold)", fontWeight: 700 }}>
            £{totalAum.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Below 900px (but above mobile breakpoint) headers get cramped — show explicit sort dropdown */}
      <div style={{ padding: "10px 14px 0" }}>
        <MobileSortSelect maxWidth={899} options={mobileSortOptions} field={sortKey} dir={sortDir} onChange={handleMobileSortChange} />
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11, tableLayout: "auto", minWidth: 1100 }}>
        <thead>
          <tr>
            {visibleCols.map((col) => (
              <th
                key={col.key + col.label}
                onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                style={{
                  ...thS,
                  textAlign: col.align ?? "left",
                  color: sortKey === col.key ? "var(--gold)" : "var(--text-dim)",
                  cursor: col.sortable !== false ? "pointer" : "default",
                }}
              >
                {col.label}{col.sortable !== false ? arrow(col.key) : ""}
              </th>
            ))}
            {!isMobile && <th style={{ ...thS, cursor: "default" }} title="30-day price trend · Updated nightly">30D</th>}
            {!isMobile && <th style={{ ...thS, textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("annReturn")}>Ann. Ret{arrow("annReturn")}</th>}
            {!isMobile && <th style={{ ...thS, cursor: "default" }}>Hold Status</th>}
          </tr>
        </thead>
        <tbody>
          {cashRows.map((h) => (
            <tr key={`cash-${h.account}`} style={{ background: "rgba(28,28,48,0.4)", borderBottom: "1px solid var(--rim)" }}>
              <td colSpan={totalCols} style={{ padding: cellPad, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.12em" }}>
                CASH · {h.account} · £{(h.mv || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
          {groups.map((group) => {
            const sortedHoldings = sortHoldings(group.holdings, sortKey, sortDir);
            const layerWeight = groupMode === "layer" ? layerWeights.get(group.key) : undefined;
            const groupClickable = groupMode === "layer" && (LAYER_VALUES as readonly string[]).includes(group.key);
            return (
              <>
                {groupMode !== "none" && (
                  <tr key={`group-${group.key}`}>
                    <td colSpan={totalCols} style={{ padding: 0 }}>
                      <HoldingsGroupHeader
                        groupBy={groupMode}
                        groupValue={group.label}
                        holdings={group.holdings}
                        totalAum={totalAum}
                        weight={layerWeight}
                        onClick={groupClickable ? () => onLayerGroupClick(group.key as Layer) : undefined}
                      />
                    </td>
                  </tr>
                )}
                {sortedHoldings.map((h) => {
                  const rowKey = `${h.ticker}-${h.account}`;
                  const isOpen = expanded.has(rowKey);
                  const r = h.returns;
                  const hasReturns = r && r.totalCost > 0;
                  const lp = livePrices[normaliseTicker(h.ticker)];
                  const displayPrice = lp?.price ?? h.price;
                  const displayDay = lp?.changePercent ?? h.day;
                  return (
                    <>
                      <tr key={rowKey} onClick={() => toggle(rowKey)} style={{ borderBottom: isOpen ? "none" : "1px solid rgba(28,28,48,0.3)", cursor: "pointer" }}>
                        <td style={{ padding: groupMode !== "none" && !isMobile ? "10px 12px 10px 24px" : cellPad, color: "var(--gold)", fontWeight: 700 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <TickerButton ticker={h.ticker}>{h.ticker}</TickerButton>
                                </TooltipTrigger>
                                {(() => {
                                  const summary = getSummary(h.ticker);
                                  if (!summary?.thesis_summary) return null;
                                  return (
                                    <TooltipContent side="bottom" style={{ maxWidth: 320, background: "var(--panel)", border: "1px solid var(--rim)", color: "var(--text-mid)", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.5 }}>
                                      {summary.thesis_summary.length > 200 ? summary.thesis_summary.slice(0, 200) + "…" : summary.thesis_summary}
                                    </TooltipContent>
                                  );
                                })()}
                              </Tooltip>
                            </TooltipProvider>
                            {(() => {
                              const summary = getSummary(h.ticker);
                              if (!summary) return null;
                              const sc = summary.total_score;
                              const badgeColor = sc >= 80 ? "var(--green)" : sc >= 60 ? "var(--accent)" : sc >= 40 ? "var(--amber)" : "var(--red)";
                              return <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: badgeColor, background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`, padding: "1px 5px", borderRadius: 8, lineHeight: 1 }}>{sc}</span>;
                            })()}
                            {(() => {
                              const freshness = getResearchFreshness(h.ticker);
                              return <span title={`Research: ${freshness.label}`} style={{ width: 6, height: 6, borderRadius: "50%", background: freshness.color, flexShrink: 0 }} />;
                            })()}
                            {(() => {
                              const flag = parseFlag(h.ticker, h.trigger_review_date, h.trigger_review_note);
                              if (!flag) return null;
                              const emoji = flag.priority === "HIGH" ? "🔴" : flag.priority === "MEDIUM" ? "🟡" : "🟢";
                              return <span title={`${flag.prefix}: ${flag.reason}`} style={{ fontSize: 8, cursor: "help" }}>{emoji}</span>;
                            })()}
                            <ChinaRiskChip flag={h.chinaExposureFlag} />
                            {(() => {
                              const rp = (h as any).returnProfile as string;
                              if (!rp || !PROFILE_LABEL[rp as ReturnProfile]) return null;
                              const s = profileChipStyle(rp as ReturnProfile);
                              return <span style={{ ...s, fontSize: 7, padding: "0 3px", lineHeight: 1.3 }}>{PROFILE_LABEL[rp as ReturnProfile]}</span>;
                            })()}
                          </div>
                        </td>

                        {!isMobile && <td style={{ padding: cellPad, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>{h.name}</td>}
                        {!isMobile && <td style={{ padding: cellPad, color: "var(--text-dim)", fontSize: 10 }}>{h.layer}</td>}
                        {!isMobile && <td style={{ padding: cellPad }}><DriverChip value={(h as any).factor_group} /></td>}
                        {!isMobile && <td style={{ padding: cellPad }}><StackBadge value={(h as any).stack_layer} /></td>}
                        {!isMobile && (
                          normalizeAccount(h.account) === "BORDIER" ? (
                            <td style={{ padding: cellPad, fontSize: 10 }}>
                              <span style={{ color: "var(--gold)", fontWeight: 700, letterSpacing: "0.08em", border: "1px solid rgba(201,168,76,0.4)", padding: "1px 6px", borderRadius: 2, whiteSpace: "nowrap" }}>BORDIER · JPY</span>
                            </td>
                          ) : (
                            <td style={{ padding: cellPad, color: "var(--text-dim)", fontSize: 10 }}>{h.account}</td>
                          )
                        )}
                        <td style={{ padding: cellPad, color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>{h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>
                        <td style={{ padding: cellPad, color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>{h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"}</td>
                        <td style={{ padding: cellPad, color: displayDay > 0 ? "var(--green)" : displayDay < 0 ? "var(--red)" : "var(--text-dim)", textAlign: "right" }}>{displayDay != null ? `${displayDay >= 0 ? "+" : ""}${displayDay.toFixed(2)}%` : "—"}</td>
                        <td style={{ padding: cellPad, textAlign: "right" }}>{h.liveAsymmetry ? <AsymmetryPill asymmetry={h.liveAsymmetry} /> : <span style={{ color: "var(--text-dim)", opacity: 0.4 }}>—</span>}</td>
                        {!isMobile && (
                          <td style={{ padding: cellPad, textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              {h.irrBbResult ? <IrrBbPill result={h.irrBbResult} /> : <span style={{ color: "var(--text-dim)", opacity: 0.4 }}>—</span>}
                              {h.irrBbResult?.priceDevFlag && <PriceDevChip flag />}
                            </div>
                          </td>
                        )}
                        <td style={{ padding: cellPad, color: "var(--text-mid)", textAlign: "right" }}>{displayPrice != null ? `${displayPrice.toLocaleString("en-GB", { maximumFractionDigits: 2 })}` : "—"}</td>
                       
                        {!isMobile && (() => {
                          const pd = priceData?.get(normaliseTicker(h.ticker));
                          return <td style={{ padding: cellPad }}>{pd && pd.points.length >= 5 ? <Sparkline points={pd.points} color={pd.sparklineColor} /> : <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>}</td>;
                        })()}
                        {!isMobile && <td style={{ padding: cellPad, textAlign: "right", color: hasReturns ? (r!.annualisedReturn >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)", fontWeight: hasReturns ? 700 : 400, fontSize: hasReturns ? 12 : 11 }}>{hasReturns ? `${r!.annualisedReturn >= 0 ? "+" : ""}${r!.annualisedReturn.toFixed(1)}%` : "—"}</td>}
                        {!isMobile && (
                          <td style={{ padding: cellPad }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <HoldStatusBadge status={h.alert_status} />
                              <ClaudePromptButton
                                templateKey="holdings_deep_dive"
                                context={{
                                  ticker: h.ticker,
                                  mv: Math.round(h.mv || 0),
                                  aum_pct: (totalAum > 0 ? ((h.mv || 0) / totalAum) * 100 : 0).toFixed(1),
                                  gl_pct: h.gl != null ? h.gl.toFixed(1) : "—",
                                  add_trigger: h.add_trigger || "—",
                                  exit_trigger: h.exit_trigger || "—",
                                }}
                                stopPropagation
                                style={{ border: "1px solid var(--rim)", padding: "2px 4px", display: "inline-flex", alignItems: "center" }}
                              >
                                <Microscope size={11} />
                              </ClaudePromptButton>
                              <span style={{ marginLeft: "auto", color: "var(--text-dim)", display: "inline-flex" }}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </span>
                            </div>
                          </td>
                        )}
                      </tr>
                      {isOpen && <HoldingsExpansionRow ticker={h.ticker} colSpan={totalCols} />}
                    </>
                  );
                })}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={isMobile ? 2 : 6} style={{ padding: "12px", color: "var(--text-mid)", fontWeight: 700, borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>TOTAL</td>
            <td style={{ padding: "12px", color: "var(--gold)", fontWeight: 700, textAlign: "right", borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>£{totalAum.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</td>
            <td colSpan={Math.max(0, totalCols - (isMobile ? 3 : 7))} style={{ borderTop: "1px solid var(--rim)" }} />
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}

// ── Price Map (updated with MA20/MA50) ──

type PriceMapSort = "ma_dist" | "pct_above_low" | "pct_below_high";

function getPriceMapSortValue(h: LiveHolding, sort: PriceMapSort, ma20: number | null): number {
  const price = h.price!;
  const low = h.low_52w!;
  const high = h.high_52w!;
  const ref = ma20 ?? h.ma60 ?? price;
  switch (sort) {
    case "pct_above_low": return ((price - low) / low) * 100;
    case "pct_below_high": return ((high - price) / high) * 100;
    case "ma_dist": return Math.abs(((price - ref) / ref) * 100);
  }
}

function PriceMapView({ allHoldings, priceData }: { allHoldings: LiveHolding[]; priceData?: PriceDataMap }) {
  const [sortMode, setSortMode] = useState<PriceMapSort>("ma_dist");
  const deduped = new Map<string, LiveHolding>();
  for (const h of allHoldings) {
    const key = h.ticker || h.name;
    if (!deduped.has(key) || (h.high_52w && !deduped.get(key)!.high_52w)) deduped.set(key, h);
  }

  const valid = Array.from(deduped.values()).filter((h) => h.high_52w && h.low_52w && h.price != null);
  const grouped = new Map<string, LiveHolding[]>();
  for (const h of valid) {
    const key = h.layer || "Uncategorised";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(h);
  }
  const layers = Array.from(grouped.entries()).sort((a, b) => {
    const mvA = a[1].reduce((sum, holding) => sum + (holding.mv || 0), 0);
    const mvB = b[1].reduce((sum, holding) => sum + (holding.mv || 0), 0);
    return mvB - mvA;
  });

  if (valid.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No price map data — populate HIGH_52w, LOW_52w columns in holdings sheets.</div>;
  }

  const SORT_OPTIONS: { key: PriceMapSort; label: string }[] = [
    { key: "ma_dist", label: "MA20 Dist" },
    { key: "pct_above_low", label: "% Above 52W Low" },
    { key: "pct_below_high", label: "% Below 52W High" },
  ];

  return (
    <div style={{ padding: "12px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginRight: 4 }}>Sort</span>
        {SORT_OPTIONS.map((opt) => <ToggleButton key={opt.key} active={sortMode === opt.key} label={opt.label} onClick={() => setSortMode(opt.key)} />)}
      </div>
      {layers.map(([layer, holdings]) => {
        const sorted = [...holdings].sort((a, b) => {
          const pdA = priceData?.get(normaliseTicker(a.ticker));
          const pdB = priceData?.get(normaliseTicker(b.ticker));
          return getPriceMapSortValue(a, sortMode, pdA?.ma20 ?? null) - getPriceMapSortValue(b, sortMode, pdB?.ma20 ?? null);
        });
        return (
          <div key={layer} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", padding: "8px 0", borderBottom: "1px solid var(--rim)", marginBottom: 8 }}>{layer}</div>
            {sorted.map((h) => {
              const low = h.low_52w!;
              const high = h.high_52w!;
              const price = h.price!;
              const pd = priceData?.get(normaliseTicker(h.ticker));
              const ma20 = pd?.ma20 ?? null;
              const ma50 = pd?.ma50 ?? null;
              const range = high - low;
              if (range <= 0) return null;

              const pricePct = Math.max(0, Math.min(100, ((price - low) / range) * 100));
              const refMa = ma20 ?? h.ma60;
              const distFromMa = refMa ? ((price - refMa) / refMa) * 100 : 0;

              let statusColor: string;
              let statusLabel: string;
              if (refMa && price < refMa) { statusColor = "var(--red)"; statusLabel = "Dislocation"; }
              else if (pricePct >= 80) { statusColor = "var(--amber)"; statusLabel = "Extended"; }
              else { statusColor = "var(--green)"; statusLabel = "Healthy"; }

              return (
                <div key={h.ticker || h.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(28,28,48,0.25)" }}>
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <TickerButton ticker={h.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{h.ticker}</TickerButton>
                      <HoldStatusBadge status={h.alert_status} />
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                  </div>
                  <div style={{ flex: 1, position: "relative", height: 28, display: "flex", alignItems: "center" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, height: 6, background: "rgba(110,142,200,0.25)", borderRadius: 3 }} />
                    {/* MA20 marker */}
                    {ma20 != null && (() => {
                      const maPct = Math.max(0, Math.min(100, ((ma20 - low) / range) * 100));
                      return (
                        <div style={{ position: "absolute", left: `${maPct}%`, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 7, color: "var(--accent)", whiteSpace: "nowrap", marginBottom: 1 }}>20d</span>
                          <div style={{ width: 0, flex: 1, borderLeft: "1.5px solid var(--accent)" }} />
                        </div>
                      );
                    })()}
                    {/* MA50 marker */}
                    {ma50 != null && (() => {
                      const maPct = Math.max(0, Math.min(100, ((ma50 - low) / range) * 100));
                      return (
                        <div style={{ position: "absolute", left: `${maPct}%`, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 7, color: "var(--gold)", whiteSpace: "nowrap", marginBottom: 1 }}>50d</span>
                          <div style={{ width: 0, flex: 1, borderLeft: "1px dashed var(--gold)" }} />
                        </div>
                      );
                    })()}
                    {/* Price marker */}
                    <div style={{ position: "absolute", left: `${pricePct}%`, top: 2, bottom: 2, width: 3, background: statusColor, borderRadius: 1 }} />
                    <span style={{ position: "absolute", left: 0, bottom: -2, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{low.toFixed(0)}</span>
                    <span style={{ position: "absolute", right: 0, bottom: -2, fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)" }}>{high.toFixed(0)}</span>
                  </div>
                  <div style={{ width: 80, flexShrink: 0, textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{price.toFixed(2)}</span>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{h.currency}</div>
                  </div>
                  <div style={{ width: 140, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: statusColor === "var(--green)" ? "var(--green-dim)" : statusColor === "var(--amber)" ? "var(--amber-dim)" : "var(--red-dim)", color: statusColor, border: `1px solid ${statusColor === "var(--green)" ? "rgba(90,191,160,0.2)" : statusColor === "var(--amber)" ? "rgba(200,146,90,0.2)" : "rgba(200,90,90,0.2)"}`, padding: "1px 6px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{statusLabel}</span>
                    <span style={{ fontFamily: "'DM Mono', var(--font-mono)", fontSize: 10, color: statusColor, whiteSpace: "nowrap" }}>{distFromMa >= 0 ? "+" : ""}{distFromMa.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Fallback helper ──

function withFallbackHolding(h: (typeof SIPP_HOLDINGS)[number], account: "SIPP" | "ISA"): LiveHolding {
  return {
    ...h, account, day: 0, aum_pct: 0, pct_below_52w_high: 0, pct_above_52w_low: 0,
    price: 0, prevClose: 0, currency: "USD", costGbp: 0, costLocal: 0, shares: 0,
    add_trigger: "", exit_trigger: "", trigger_type: "", trigger_price_add: "", trigger_price_exit: "",
    alert_status: "CLEAR", alert_fired_date: "", ma60: null, high_52w: null, low_52w: null,
    deploy_target_gbp: 0, deploy_note: "", trigger_review_date: "", trigger_review_note: "", factor_primary: "", factor_group: "", stack_layer: "", priceAtFirstAdd: null, firstAddDate: "", priceAtLastScore: null,
  };
}

// ── Group By Dropdown ──

function GroupByDropdown({ value, onChange }: { value: GroupMode; onChange: (v: GroupMode) => void }) {
  const [open, setOpen] = useState(false);
  const options: { value: GroupMode; label: string }[] = [
    { value: "layer", label: "Layer" },
    { value: "account", label: "Account" },
    { value: "none", label: "None" },
  ];
  const current = options.find(o => o.value === value)!;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
          padding: "4px 12px", border: "1px solid var(--rim)", background: "var(--accent-dim)", color: "var(--accent)",
          cursor: "pointer", transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        Group: {current.label} ▾
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 2, zIndex: 50,
          background: "var(--panel)", border: "1px solid var(--rim)", minWidth: 120,
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "6px 12px", border: "none", cursor: "pointer",
                background: opt.value === value ? "var(--accent-dim)" : "transparent",
                color: opt.value === value ? "var(--accent)" : "var(--text-dim)",
                transition: "all 0.1s",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "var(--accent-dim)"; }}
              onMouseLeave={e => { if (opt.value !== value) (e.target as HTMLElement).style.background = "transparent"; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function HoldingsTab({ sipp, isa, bordier = [], disruption = [], transactions = [], scores = [], priceData }: Props) {
  const [showPriceMap, setShowPriceMap] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<HoldingsUiState>(() => holdingsStateFromParams(searchParams));

  // Sync state → URL (replace, not push)
  useEffect(() => {
    setSearchParams(holdingsStateToParams(state), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const update = (patch: Partial<HoldingsUiState>) => setState((p) => ({ ...p, ...patch }));

  const portfolio = usePortfolioData();

  const disruptionMap = new Map<string, LiveDisruption>();
  for (const d of disruption) {
    if (d.ticker) disruptionMap.set(d.ticker, d);
  }

  const sippData: LiveHolding[] = sipp.length > 0 ? sipp : SIPP_HOLDINGS.map((h) => withFallbackHolding(h, "SIPP"));
  const isaData: LiveHolding[] = isa.length > 0 ? isa : ISA_HOLDINGS.map((h) => withFallbackHolding(h, "ISA"));

  const allHoldings = [...sippData, ...isaData, ...bordier];

  useEffect(() => {
    if (!priceData) return;
    console.log("[HoldingsTab] holdings tickers:", allHoldings.map(h => JSON.stringify(h.ticker)));
    console.log("[HoldingsTab] RKLB lookup:", priceData?.get(normaliseTicker("RKLB")));
    console.log("[HoldingsTab] tickers with internal whitespace:",
      allHoldings.filter(h => /\s/.test(String(h.ticker).trim())).map(h => JSON.stringify(h.ticker))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceData]);

  const totalAum = allHoldings.reduce((sum, holding) => sum + (holding.mv || 0), 0);
  const sippTotal = sippData.reduce((sum, holding) => sum + (holding.mv || 0), 0);
  const isaTotal = isaData.reduce((sum, holding) => sum + (holding.mv || 0), 0);

  // Tier lookup from SCORES (case-insensitive ticker)
  const tierByTicker = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of scores) {
      const t = String(s.ticker ?? "").trim();
      if (!t) continue;
      const tier = String((s as { tier?: string }).tier ?? "").trim();
      if (tier) m.set(t, tier);
    }
    return m;
  }, [scores]);

  // Layer weight lookup (for layer group headers)
  const layerWeights = useMemo(() => {
    const m = new Map<string, { actual: number; target: number }>();
    for (const l of (portfolio.layers ?? []) as LiveLayer[]) {
      if (!l.name) continue;
      m.set(l.name.trim(), { actual: l.current ?? 0, target: l.target ?? 0 });
    }
    return m;
  }, [portfolio.layers]);

  // ── Counts (always on full set, exclude CASH) ────────────────────────────
  const isCash = (h: LiveHolding) => (h.ticker || "").trim().toUpperCase() === "CASH";
  const positions = allHoldings.filter((h) => !isCash(h));

  const accountCounts = useMemo(() => {
    const c: Record<HoldingsAccount, number> = { SIPP: 0, ISA: 0, "SIPP+ISA": 0, BORDIER: 0 };
    for (const h of positions) {
      const a = normalizeAccount(h.account);
      if (a) c[a]++;
    }
    return c;
  }, [positions]);

  const actionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of positions) {
      const a = normalizeActionFactor(String(h.action ?? ""));
      if (!a) continue;
      c[a] = (c[a] || 0) + 1;
    }
    return c;
  }, [positions]);

  const factorCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of positions) {
      const f = normalizeActionFactor(String(h.factor_primary ?? ""));
      if (!f) continue;
      c[f] = (c[f] || 0) + 1;
    }
    return c;
  }, [positions]);

  const driverCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of positions) {
      const d = normalizeActionFactor(String((h as any).factor_group ?? ""));
      if (!d) continue;
      c[d] = (c[d] || 0) + 1;
    }
    return c;
  }, [positions]);

  const stackCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of positions) {
      const s = normalizeActionFactor(String((h as any).stack_layer ?? ""));
      if (!s) continue;
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [positions]);

  const layerCounts = useMemo(() => {
    const c: Partial<Record<Layer, number>> = {};
    for (const h of positions) {
      const layerStr = (h.layer || "").trim();
      const match = LAYER_VALUES.find((l) => l.toLowerCase() === layerStr.toLowerCase());
      if (match) c[match] = (c[match] || 0) + 1;
    }
    return c;
  }, [positions]);

  // Debug: log unique values discovered for ACTION & FACTOR_PRIMARY
  useEffect(() => {
    if (positions.length === 0) return;
    // eslint-disable-next-line no-console
    console.log("[Holdings] Unique ACTION values:", Object.keys(actionCounts).sort());
    // eslint-disable-next-line no-console
    console.log("[Holdings] Unique FACTOR_PRIMARY values:", Object.keys(factorCounts).sort());
  }, [actionCounts, factorCounts, positions.length]);

  // ── Filter pipeline (CASH always passes through) ─────────────────────────
  const filteredHoldings = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    const tickerSet = state.tickers.length > 0 ? new Set(state.tickers.map((t) => t.toUpperCase())) : null;
    return allHoldings.filter((h) => {
      if (isCash(h)) return true;
      if (tickerSet && !tickerSet.has(String(h.ticker ?? "").trim().toUpperCase())) return false;
      if (state.accountFilter.length > 0) {
        const a = normalizeAccount(h.account);
        if (!a || !state.accountFilter.includes(a)) return false;
      }
      if (state.actionFilter.length > 0) {
        const a = normalizeActionFactor(String(h.action ?? ""));
        if (!a || !state.actionFilter.includes(a)) return false;
      }
      if (state.factorFilter.length > 0) {
        const f = normalizeActionFactor(String(h.factor_primary ?? ""));
        if (!f || !state.factorFilter.includes(f)) return false;
      }
      if (state.driverFilter.length > 0) {
        const d = normalizeActionFactor(String((h as any).factor_group ?? ""));
        if (!d || !state.driverFilter.includes(d)) return false;
      }
      if (state.stackFilter.length > 0) {
        const s = normalizeActionFactor(String((h as any).stack_layer ?? ""));
        if (!s || !state.stackFilter.includes(s)) return false;
      }
      if (state.layerFilter.length > 0) {
        const layerStr = (h.layer || "").trim();
        const match = LAYER_VALUES.find((l) => l.toLowerCase() === layerStr.toLowerCase());
        if (!match || !state.layerFilter.includes(match)) return false;
      }
      if (q) {
        const hay = `${h.ticker} ${h.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allHoldings, state.accountFilter, state.actionFilter, state.factorFilter, state.driverFilter, state.stackFilter, state.layerFilter, state.tickers, state.search]);

  const filteredPositionCount = filteredHoldings.filter((h) => !isCash(h)).length;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleAccount = (a: HoldingsAccount) => {
    setState((prev) => {
      const has = prev.accountFilter.includes(a);
      const next = has ? prev.accountFilter.filter((x) => x !== a) : [...prev.accountFilter, a];
      const allOn = HOLDINGS_ACCOUNT_VALUES.every((v) => next.includes(v));
      return { ...prev, accountFilter: allOn ? [] : next };
    });
  };
  const toggleAction = (a: string) => {
    setState((prev) => {
      const has = prev.actionFilter.includes(a);
      const next = has ? prev.actionFilter.filter((x) => x !== a) : [...prev.actionFilter, a];
      return { ...prev, actionFilter: next };
    });
  };
  const toggleFactor = (f: string) => {
    setState((prev) => {
      const has = prev.factorFilter.includes(f);
      const next = has ? prev.factorFilter.filter((x) => x !== f) : [...prev.factorFilter, f];
      return { ...prev, factorFilter: next };
    });
  };
  const toggleDriver = (d: string) => {
    setState((prev) => {
      const has = prev.driverFilter.includes(d);
      const next = has ? prev.driverFilter.filter((x) => x !== d) : [...prev.driverFilter, d];
      return { ...prev, driverFilter: next };
    });
  };
  const toggleStack = (s: string) => {
    setState((prev) => {
      const has = prev.stackFilter.includes(s);
      const next = has ? prev.stackFilter.filter((x) => x !== s) : [...prev.stackFilter, s];
      return { ...prev, stackFilter: next };
    });
  };
  const toggleLayer = (l: Layer) => {
    setState((prev) => {
      const has = prev.layerFilter.includes(l);
      const next = has ? prev.layerFilter.filter((x) => x !== l) : [...prev.layerFilter, l];
      const allOn = LAYER_VALUES.every((v) => next.includes(v));
      return { ...prev, layerFilter: allOn ? [] : next };
    });
  };

  const handleSort = (field: HoldingsSortField) => {
    setState((prev) => {
      if (prev.sortField === field) {
        return { ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc" };
      }
      const dir: "asc" | "desc" = field === "ticker" || field === "name" || field === "layer" || field === "account" || field === "action" ? "asc" : "desc";
      return { ...prev, sortField: field, sortDir: dir };
    });
  };

  const onLayerGroupClick = (l: Layer) => update({ layerFilter: [l] });

  const sortLabel = `${state.sortField} ${state.sortDir}`;
  const groupLabel = state.groupBy;
  const hasFilters =
    state.accountFilter.length > 0 ||
    state.actionFilter.length > 0 ||
    state.factorFilter.length > 0 ||
    state.driverFilter.length > 0 ||
    state.stackFilter.length > 0 ||
    state.layerFilter.length > 0 ||
    state.tickers.length > 0 ||
    state.search.trim() !== "";

  return (
    <div>
      {/* Review Queue Banner — all flag types */}
      <ReviewQueue holdings={allHoldings} />

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={cardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={cardTitle}>Holdings</span>
          </div>
          <ToggleButton active={showPriceMap} label="Price Map" onClick={() => setShowPriceMap(!showPriceMap)} />
        </div>

        {showPriceMap ? (
          <PriceMapView allHoldings={allHoldings} priceData={priceData} />
        ) : (
          <>
            {state.tickers.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  background: "rgba(201,168,76,0.08)",
                  borderBottom: "1px solid var(--rim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--gold)",
                  letterSpacing: "0.08em",
                }}
              >
                <span style={{ textTransform: "uppercase", fontWeight: 700 }}>
                  Pinned · {state.tickers.length} ticker{state.tickers.length > 1 ? "s" : ""}
                </span>
                <span style={{ color: "var(--text-mid)", textTransform: "none", letterSpacing: 0 }}>
                  {state.tickers.slice(0, 8).join(", ")}
                  {state.tickers.length > 8 ? `, +${state.tickers.length - 8} more` : ""}
                </span>
                <button
                  onClick={() => update({ tickers: [] })}
                  style={{
                    marginLeft: "auto",
                    background: "transparent",
                    border: "1px solid var(--rim)",
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    padding: "3px 8px",
                    borderRadius: 2,
                    cursor: "pointer",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            <HoldingsHeader
              positionCount={positions.length}
              accountCounts={{ total: positions.length, sipp: accountCounts.SIPP, isa: accountCounts.ISA, sippIsa: accountCounts["SIPP+ISA"], bordier: accountCounts.BORDIER }}
              filteredCount={filteredPositionCount}
              sortLabel={sortLabel}
              groupLabel={groupLabel}
              hasFilters={hasFilters}
            />
            <HoldingsFilters
              accountCounts={accountCounts}
              actionCounts={actionCounts}
              factorCounts={factorCounts}
              driverCounts={driverCounts}
              stackCounts={stackCounts}
              layerCounts={layerCounts}
              totalPositions={positions.length}
              accountFilter={state.accountFilter}
              actionFilter={state.actionFilter}
              factorFilter={state.factorFilter}
              driverFilter={state.driverFilter}
              stackFilter={state.stackFilter}
              layerFilter={state.layerFilter}
              search={state.search}
              groupBy={state.groupBy}
              sortField={state.sortField}
              sortDir={state.sortDir}
              onToggleAccount={toggleAccount}
              onResetAccount={() => update({ accountFilter: [] })}
              onToggleAction={toggleAction}
              onResetAction={() => update({ actionFilter: [] })}
              onToggleFactor={toggleFactor}
              onResetFactor={() => update({ factorFilter: [] })}
              onToggleDriver={toggleDriver}
              onResetDriver={() => update({ driverFilter: [] })}
              onToggleStack={toggleStack}
              onResetStack={() => update({ stackFilter: [] })}
              onToggleLayer={toggleLayer}
              onResetLayer={() => update({ layerFilter: [] })}
              onSearchChange={(v) => update({ search: v })}
              onGroupChange={(g) => update({ groupBy: g })}
              onSortChange={(field, dir) => update({ sortField: field, sortDir: dir })}
            />
            {filteredPositionCount === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                  No positions match these filters.
                </p>
                <button
                  type="button"
                  onClick={() => setState(DEFAULT_HOLDINGS_STATE)}
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
              <UnifiedView
                allHoldings={filteredHoldings}
                totalAum={totalAum}
                transactions={transactions}
                disruptionMap={disruptionMap}
                groupMode={state.groupBy}
                sippTotal={sippTotal}
                isaTotal={isaTotal}
                priceData={priceData}
                scores={scores}
                watchlist={portfolio.watchlist}
                sortKey={state.sortField}
                sortDir={state.sortDir}
                onSortChange={handleSort}
                onSortSet={(field, dir) => setState((prev) => ({ ...prev, sortField: field, sortDir: dir }))}
                layerWeights={layerWeights}
                tierByTicker={tierByTicker}
                onLayerGroupClick={onLayerGroupClick}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
