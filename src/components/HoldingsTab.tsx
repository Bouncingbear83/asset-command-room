import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ChevronDown, Microscope } from "lucide-react";
import { SIPP_HOLDINGS, ISA_HOLDINGS } from "@/data/portfolio";
import { LiveHolding, LiveDisruption, LiveTransaction, LiveScore, type LiveLayer, usePortfolioData } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";
import { calcHoldingReturns, HoldingReturns } from "@/lib/xirr";
import { PriceDataMap } from "@/hooks/useDailyPrices";
import { Sparkline } from "@/components/Sparkline";
import ReviewQueue, { parseReviewFlag as parseFlag } from "@/components/ReviewQueue";
import { useResearchSummary } from "@/hooks/useResearchSummary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildDeepDivePrompt } from "@/lib/claudePrompts";
import { HoldingsExpansionRow } from "@/components/HoldingsExpansionRow";
import { HoldingsHeader } from "@/components/holdings/HoldingsHeader";
import { HoldingsFilters } from "@/components/holdings/HoldingsFilters";
import { HoldingsGroupHeader } from "@/components/holdings/HoldingsGroupHeader";
import {
  DEFAULT_HOLDINGS_STATE,
  holdingsStateFromParams,
  holdingsStateToParams,
  normalizeAlert,
  normalizeAccount,
  ALERT_STATUS_VALUES,
  HOLDINGS_ACCOUNT_VALUES,
  type HoldingsUiState,
  type HoldingsSortField,
  type HoldingsGroupBy,
  type HoldingsAccount,
  type HoldingsAlertStatus,
} from "@/lib/url-state-holdings";
import { LAYER_VALUES, type Layer } from "@/types/intelligence";

const CLAUDE_PROJECT_URL = "https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1";

interface Props {
  sipp: LiveHolding[];
  isa: LiveHolding[];
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

const ALERT_STYLE: Record<string, React.CSSProperties> = {
  ADD_ZONE: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  EXIT_ZONE: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  REVIEW: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
};

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
const detailRowS: React.CSSProperties = {
  padding: "6px 12px 6px 36px",
  fontFamily: "'DM Mono', var(--font-mono)",
  fontSize: "0.78rem",
  background: "color-mix(in srgb, var(--panel) 90%, white 10%)",
  borderBottom: "1px solid rgba(28,28,48,0.25)",
};

function normalizeAlertStatus(value: string) {
  return value.trim().toUpperCase();
}

function AlertBadge({ status }: { status: string }) {
  const normalized = normalizeAlertStatus(status);
  const style = ALERT_STYLE[normalized];
  if (!style || normalized === "CLEAR") return null;
  return (
    <span style={{ ...style, padding: "2px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
      {normalized.replace("_", " ")}
    </span>
  );
}

type HoldingWithReturns = LiveHolding & { returns?: HoldingReturns };

function sortHoldings(data: HoldingWithReturns[], key: SortKey, dir: SortDir): HoldingWithReturns[] {
  return [...data].sort((a, b) => {
    let av: any, bv: any;
    switch (key) {
      case "annReturn": av = a.returns?.annualisedReturn ?? -999; bv = b.returns?.annualisedReturn ?? -999; break;
      case "cost": av = a.returns?.totalCost ?? 0; bv = b.returns?.totalCost ?? 0; break;
      case "truePL": av = a.returns?.truePL ?? 0; bv = b.returns?.truePL ?? 0; break;
      case "account": av = a.account ?? ""; bv = b.account ?? ""; break;
      default: av = a[key] ?? ""; bv = b[key] ?? "";
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
  { label: "Account", key: "account", hideMobile: true, sortable: true },
  { label: "MV £", key: "mv", align: "right", sortable: true },
  { label: "G/L %", key: "gl", align: "right", sortable: true },
  { label: "Day %", key: "day", align: "right", sortable: true },
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
  sortKey,
  sortDir,
  onSortChange,
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
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey) => void;
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

  const holdingsWithReturns: HoldingWithReturns[] = useMemo(() => {
    return allHoldings.map(h => ({
      ...h,
      returns: transactions.length > 0 ? calcHoldingReturns(h.ticker, h.account, h.mv || 0, transactions) : undefined,
    }));
  }, [allHoldings, transactions]);

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
  const extraDesktopCols = 6;
  const totalCols = visibleCols.length + (isMobile ? 2 : extraDesktopCols + 3);
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const pad = isMobile ? "8px 6px" : "8px 12px";
  const cellPad = isMobile ? "10px 6px" : "10px 12px";

  const thS: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
    color: "var(--text-dim)", padding: pad, borderBottom: "1px solid var(--rim)",
    textAlign: "left", fontWeight: 400, whiteSpace: "nowrap", userSelect: "none",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
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
            {!isMobile && <th style={{ ...thS, textAlign: "right", cursor: "default" }}>MA20</th>}
            {!isMobile && <th style={{ ...thS, textAlign: "right", cursor: "default" }}>MA50</th>}
            {!isMobile && <th style={{ ...thS, textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("cost")}>Cost £{arrow("cost")}</th>}
            {!isMobile && <th style={{ ...thS, textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("truePL")}>P&L £{arrow("truePL")}</th>}
            <th style={{ ...thS, textAlign: "right", cursor: "pointer" }} onClick={() => handleSort("annReturn")}>Ann. Ret{arrow("annReturn")}</th>
            {!isMobile && <th style={{ ...thS, cursor: "default" }}>Notes</th>}
            <th style={{ ...thS, cursor: "pointer" }} onClick={() => handleSort("action")}>Action{arrow("action")}</th>
            <th style={{ width: 24, padding: "8px 6px", borderBottom: "1px solid var(--rim)" }} />
          </tr>
        </thead>
        <tbody>
          {/* CASH rows pinned at the top, never sorted/filtered/grouped */}
          {cashRows.map((h) => (
            <tr key={`cash-${h.account}`} style={{ background: "rgba(28,28,48,0.4)", borderBottom: "1px solid var(--rim)" }}>
              <td colSpan={totalCols + 1} style={{ padding: cellPad, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.12em" }}>
                CASH · {h.account} · £{(h.mv || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
          {groups.map((group) => {
            const sortedHoldings = sortHoldings(group.holdings, sortKey, sortDir);
            const layerWeight = groupMode === "layer" ? layerWeights.get(group.key) : undefined;
            const groupClickable = groupMode === "layer" && (LAYER_VALUES as readonly string[]).includes(group.key);
            return (
              <>{/* Group header — rendered as a full-span row with the shared component inside */}
                {groupMode !== "none" && (
                  <tr key={`group-${group.key}`}>
                    <td colSpan={totalCols + 1} style={{ padding: 0 }}>
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
                  return (
                    <>
                      <tr key={rowKey} onClick={() => toggle(rowKey)} style={{ borderBottom: isOpen ? "none" : "1px solid rgba(28,28,48,0.3)", cursor: "pointer" }}>
                        <td style={{ padding: groupMode !== "none" && !isMobile ? "10px 12px 10px 24px" : cellPad, color: "var(--gold)", fontWeight: 700 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span style={{ cursor: "default" }}>{h.ticker}</span>
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
                            {/* Score mini-badge */}
                            {(() => {
                              const summary = getSummary(h.ticker);
                              if (!summary) return null;
                              const sc = summary.total_score;
                              const badgeColor = sc >= 80 ? "var(--green)" : sc >= 60 ? "var(--accent)" : sc >= 40 ? "var(--amber)" : "var(--red)";
                              return <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: badgeColor, background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`, padding: "1px 5px", borderRadius: 8, lineHeight: 1 }}>{sc}</span>;
                            })()}
                            {/* Research freshness dot */}
                            {(() => {
                              const freshness = getResearchFreshness(h.ticker);
                              return <span title={`Research: ${freshness.label}`} style={{ width: 6, height: 6, borderRadius: "50%", background: freshness.color, flexShrink: 0 }} />;
                            })()}
                            <AlertBadge status={h.alert_status} />
                            {(() => {
                              const flag = parseFlag(h.ticker, h.trigger_review_date, h.trigger_review_note);
                              if (!flag) return null;
                              const emoji = flag.priority === "HIGH" ? "🔴" : flag.priority === "MEDIUM" ? "🟡" : "🟢";
                              return <span title={`${flag.prefix}: ${flag.reason}`} style={{ fontSize: 8, cursor: "help" }}>{emoji}</span>;
                            })()}
                          </div>
                        </td>
                        {!isMobile && <td style={{ padding: cellPad, color: "var(--text)", whiteSpace: "nowrap" }}>{h.name}</td>}
                        {!isMobile && <td style={{ padding: cellPad, color: "var(--text-dim)", fontSize: 10 }}>{h.layer}</td>}
                        {!isMobile && <td style={{ padding: cellPad, color: "var(--text-dim)", fontSize: 10 }}>{h.account}</td>}
                        <td style={{ padding: cellPad, color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>{h.mv ? `£${h.mv.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>
                        <td style={{ padding: cellPad, color: h.gl >= 0 ? "var(--green)" : "var(--red)", textAlign: "right" }}>{h.gl != null ? `${h.gl >= 0 ? "+" : ""}${h.gl.toFixed(1)}%` : "—"}</td>
                        <td style={{ padding: cellPad, color: h.day > 0 ? "var(--green)" : h.day < 0 ? "var(--red)" : "var(--text-dim)", textAlign: "right" }}>{h.day != null ? `${h.day >= 0 ? "+" : ""}${h.day.toFixed(2)}%` : "—"}</td>
                        <td style={{ padding: cellPad, color: "var(--text-mid)", textAlign: "right" }}>{h.price != null ? `${h.price.toLocaleString("en-GB", { maximumFractionDigits: 2 })}` : "—"}</td>
                        {!isMobile && (() => {
                          const pd = priceData?.get(h.ticker);
                          return <td style={{ padding: cellPad }}>{pd && pd.points.length >= 5 ? <Sparkline points={pd.points} color={pd.sparklineColor} /> : <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>}</td>;
                        })()}
                        {!isMobile && (() => {
                          const pd = priceData?.get(h.ticker);
                          const ma20 = pd?.ma20;
                          const maColor = ma20 != null && h.price != null ? (h.price > ma20 ? "var(--green)" : "var(--amber)") : "var(--text-dim)";
                          return <td style={{ padding: cellPad, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: maColor }}>{ma20 != null ? ma20.toFixed(2) : "—"}</td>;
                        })()}
                        {!isMobile && (() => {
                          const pd = priceData?.get(h.ticker);
                          const ma50 = pd?.ma50;
                          const maColor = ma50 != null && h.price != null ? (h.price > ma50 ? "var(--green)" : "var(--amber)") : "var(--text-dim)";
                          return <td style={{ padding: cellPad, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: maColor }}>{ma50 != null ? ma50.toFixed(2) : "—"}</td>;
                        })()}
                        {!isMobile && <td style={{ padding: cellPad, color: "var(--text-dim)", textAlign: "right", fontSize: 10 }}>{hasReturns ? `£${r!.totalCost.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>}
                        {!isMobile && <td style={{ padding: cellPad, textAlign: "right", color: hasReturns ? (r!.truePL >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)" }}>{hasReturns ? `${r!.truePL >= 0 ? "+" : ""}£${Math.abs(r!.truePL).toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "—"}</td>}
                        <td style={{ padding: cellPad, textAlign: "right", color: hasReturns ? (r!.annualisedReturn >= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)", fontWeight: hasReturns ? 700 : 400, fontSize: hasReturns ? 12 : 11 }}>{hasReturns ? `${r!.annualisedReturn >= 0 ? "+" : ""}${r!.annualisedReturn.toFixed(1)}%` : "—"}</td>
                        {!isMobile && <td style={{ padding: cellPad, color: "var(--text-dim)", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: isOpen ? "unset" : "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap", lineHeight: 1.5 }}>{h.notes}</td>}
                        <td style={{ padding: cellPad }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ ...(ACTION_STYLE[h.action] ?? ACTION_STYLE.MONITOR), fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap" }}>{h.action}</span>
                            <button
                              title={`Deep dive ${h.ticker}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const prompt = buildDeepDivePrompt(h.ticker);
                                const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
                                (window.top || window).open(url, '_blank');
                              }}
                              style={{ background: "none", border: "1px solid var(--rim)", color: "var(--accent)", cursor: "pointer", padding: "2px 4px", borderRadius: 2, display: "inline-flex", alignItems: "center", transition: "color 0.2s" }}
                            >
                              <Microscope size={11} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "10px 6px", color: "var(--text-dim)" }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      </tr>
                      {isOpen && <HoldingsExpansionRow ticker={h.ticker} colSpan={totalCols + 1} />}
                    </>
                  );
                })}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={isMobile ? 2 : 4} style={{ padding: "12px", color: "var(--text-mid)", fontWeight: 700, borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>TOTAL</td>
            <td style={{ padding: "12px", color: "var(--gold)", fontWeight: 700, textAlign: "right", borderTop: "1px solid var(--rim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>£{totalAum.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</td>
            <td colSpan={totalCols - (isMobile ? 3 : 5)} style={{ borderTop: "1px solid var(--rim)" }} />
          </tr>
        </tfoot>
      </table>
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
          const pdA = priceData?.get(a.ticker);
          const pdB = priceData?.get(b.ticker);
          return getPriceMapSortValue(a, sortMode, pdA?.ma20 ?? null) - getPriceMapSortValue(b, sortMode, pdB?.ma20 ?? null);
        });
        return (
          <div key={layer} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", padding: "8px 0", borderBottom: "1px solid var(--rim)", marginBottom: 8 }}>{layer}</div>
            {sorted.map((h) => {
              const low = h.low_52w!;
              const high = h.high_52w!;
              const price = h.price!;
              const pd = priceData?.get(h.ticker);
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
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>{h.ticker}</span>
                      <AlertBadge status={h.alert_status} />
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
    ...h, account, day: 0, price: 0, prevClose: 0, currency: "USD", costGbp: 0, shares: 0,
    add_trigger: "", exit_trigger: "", trigger_type: "", trigger_price_add: "", trigger_price_exit: "",
    alert_status: "CLEAR", alert_fired_date: "", ma60: null, high_52w: null, low_52w: null,
    deploy_target_gbp: 0, deploy_note: "", trigger_review_date: "", trigger_review_note: "", factor_primary: "",
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

export default function HoldingsTab({ sipp, isa, disruption = [], transactions = [], scores = [], priceData }: Props) {
  const [showPriceMap, setShowPriceMap] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>("layer");

  const disruptionMap = new Map<string, LiveDisruption>();
  for (const d of disruption) {
    if (d.ticker) disruptionMap.set(d.ticker, d);
  }

  const sippData: LiveHolding[] = sipp.length > 0 ? sipp : SIPP_HOLDINGS.map((h) => withFallbackHolding(h, "SIPP"));
  const isaData: LiveHolding[] = isa.length > 0 ? isa : ISA_HOLDINGS.map((h) => withFallbackHolding(h, "ISA"));

  const allHoldings = [...sippData, ...isaData];
  const totalAum = allHoldings.reduce((sum, holding) => sum + (holding.mv || 0), 0);
  const sippTotal = sippData.reduce((sum, holding) => sum + (holding.mv || 0), 0);
  const isaTotal = isaData.reduce((sum, holding) => sum + (holding.mv || 0), 0);

  const scoresMap = new Map(scores.map(s => [s.ticker, s]));

  return (
    <div>
      {/* Review Queue Banner — all flag types */}
      <ReviewQueue holdings={allHoldings} />

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={cardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={cardTitle}>Holdings</span>
            {!showPriceMap && <GroupByDropdown value={groupMode} onChange={setGroupMode} />}
          </div>
          <ToggleButton active={showPriceMap} label="Price Map" onClick={() => setShowPriceMap(!showPriceMap)} />
        </div>

        {showPriceMap ? (
          <PriceMapView allHoldings={allHoldings} priceData={priceData} />
        ) : (
          <UnifiedView
            allHoldings={allHoldings}
            totalAum={totalAum}
            transactions={transactions}
            disruptionMap={disruptionMap}
            groupMode={groupMode}
            sippTotal={sippTotal}
            isaTotal={isaTotal}
            priceData={priceData}
            scores={scores}
          />
        )}
      </div>
    </div>
  );
}
