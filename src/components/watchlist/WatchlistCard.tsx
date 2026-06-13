import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiveWatchItem } from "@/hooks/usePortfolioData";
import { WatchlistSparkline } from "./WatchlistSparkline";
import type { WatchlistTrajectory } from "@/hooks/useWatchlistHistory";
import type { WatchlistScoreEntry } from "@/hooks/useWatchlistScores";
import type { EntryZone } from "@/lib/parseEntryTarget";
import { triggerWebhook } from "@/lib/webhooks";
import { openClaudeWithPrompt } from "@/lib/claudePromptUrl";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import { VaultWatchlistSnippet } from "@/components/vault/VaultIntegrations";
import { useFactSheet } from "@/components/factsheet/FactSheetProvider";
import { toast } from "sonner";
import type { ReturnProfile, CompounderSubtype } from "@/types/intelligence";
import {
  PROFILE_LABEL,
  SUBTYPE_LABEL,
  profileChipStyle,
  subtypeChipStyle,
} from "@/components/intelligence/profileChips";
import { DriverChip, StackBadge } from "@/components/holdings/DriverChip";
import type { LiveAsymmetryResult } from "@/lib/liveAsymmetry";
import { AsymmetryPill } from "@/components/AsymmetryPill";
import { ChinaRiskChip } from "@/components/ChinaRiskChip";

export type ZoneStatus = "IN_ZONE" | "APPROACHING" | "WAITING" | "PRE_IPO";


export interface DerivedRow {
  item: LiveWatchItem;
  zone: EntryZone | null;
  zoneStatus: ZoneStatus;
  /** % above entryHigh; null if no zone or no price */
  distanceToEntryPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  daysSinceReview: number | null;
  isOverdue: boolean;
  trajectory: WatchlistTrajectory | null;
  score: WatchlistScoreEntry | null;
  /** Doctrine v2.4 RETURN_PROFILE; null when blank (REJECTED/EXITED). */
  return_profile: ReturnProfile | null;
  /** Sub-type (only when return_profile === "COMPOUNDER"). */
  compounder_subtype: CompounderSubtype | null;
  /** Live asymmetry computed from the quartet + current price. */
  liveAsymmetry: LiveAsymmetryResult;
  /** Raw China exposure flag from SCORES (HIGH/MEDIUM/LOW/N/A/blank). */
  chinaExposureFlag: string;
}


/** Tiny inline chip pair used on watchlist rows. */
export function ProfileChip({
  profile,
  subtype,
}: {
  profile: ReturnProfile | null;
  subtype?: CompounderSubtype | null;
}) {
  if (!profile) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={profileChipStyle(profile)} title={`Return profile: ${profile}`}>
        {PROFILE_LABEL[profile]}
      </span>
      {subtype && (
        <span style={subtypeChipStyle(subtype)} title={`Subtype: ${subtype}`}>
          {SUBTYPE_LABEL[subtype]}
        </span>
      )}
    </span>
  );
}

interface Props {
  row: DerivedRow;
  variant: "full" | "compact";
  /** Hide action buttons (used for MONITORING / PRE-IPO sections) */
  hideActions?: boolean;
  /** Override default tint */
  tint?: "in-zone" | "approaching" | "overdue" | "none";
}

// Status taxonomy v2 (Stellar Doctrine 2026):
//   DEPLOY · WAIT_PRICE · WAIT_EVENT · RESEARCH · PRE_IPO ·
//   POST_RECLASS_HOLD · SCALING_WATCH · ARCHIVE
// Keys are NORMALISED (uppercase, alphanumeric only) — see normStatus() in WatchlistTab.
const STATUS_STYLE: Record<string, CSSProperties> = {
  DEPLOY:           { background: "rgba(34,197,94,0.14)",  color: "rgb(34,197,94)" },   // green-500
  WAITPRICE:        { background: "rgba(59,130,246,0.14)", color: "rgb(96,165,250)" },  // blue-500
  WAITEVENT:        { background: "rgba(245,158,11,0.14)", color: "rgb(245,158,11)" },  // amber-500
  RESEARCH:         { background: "rgba(168,85,247,0.14)", color: "rgb(192,132,252)" }, // purple-500
  PREIPO:           { background: "rgba(148,163,184,0.14)",color: "rgb(148,163,184)" }, // slate-400
  POSTRECLASSHOLD:  { background: "rgba(251,146,60,0.14)", color: "rgb(251,146,60)" },  // orange-400
  SCALINGWATCH:     { background: "rgba(6,182,212,0.14)",  color: "rgb(34,211,238)" },  // cyan-500
  ARCHIVE:          { background: "rgba(156,163,175,0.10)",color: "rgb(156,163,175)" }, // gray-400
};

const STATUS_LABEL: Record<string, string> = {
  DEPLOY: "DEPLOY",
  WAITPRICE: "WAIT · PRICE",
  WAITEVENT: "WAIT · EVENT",
  RESEARCH: "RESEARCH",
  PREIPO: "PRE-IPO",
  POSTRECLASSHOLD: "POST-RECLASS HOLD",
  SCALINGWATCH: "SCALING WATCH",
  ARCHIVE: "ARCHIVE",
};

const TINT_STYLE: Record<NonNullable<Props["tint"]>, CSSProperties> = {
  "in-zone": {
    background: "rgba(90, 191, 160, 0.05)",
    borderLeft: "3px solid var(--green)",
  },
  approaching: {
    background: "rgba(200, 146, 90, 0.04)",
    borderLeft: "3px solid var(--amber)",
  },
  overdue: {
    background: "rgba(200, 90, 90, 0.04)",
    borderLeft: "3px solid var(--red)",
  },
  none: {
    borderLeft: "3px solid transparent",
  },
};

/**
 * Infer currency from ticker exchange suffix when the WATCHLIST sheet
 * doesn't carry an explicit CURRENCY column for the row.
 *   .DE/.F/.PA/.AS/.MI/.MC/.LS/.BR/.VI/.HE → EUR
 *   .T/.JP                                 → JPY
 *   .L                                     → GBX (London listings quote in pence by default)
 *   .ST                                    → SEK
 *   .CO                                    → DKK
 *   .OL                                    → NOK
 *   .TO/.V                                 → CAD
 *   .AX                                    → AUD
 *   .HK                                    → HKD
 *   .SW                                    → CHF
 */
function inferCurrencyFromTicker(ticker: string | undefined): string | null {
  if (!ticker) return null;
  const m = ticker.toUpperCase().match(/\.([A-Z]{1,3})$/);
  if (!m) return null;
  const sfx = m[1];
  const map: Record<string, string> = {
    DE: "EUR", F: "EUR", PA: "EUR", AS: "EUR", MI: "EUR", MC: "EUR",
    LS: "EUR", BR: "EUR", VI: "EUR", HE: "EUR", IR: "EUR",
    T: "JPY", JP: "JPY",
    L: "GBX",
    ST: "SEK", CO: "DKK", OL: "NOK",
    TO: "CAD", V: "CAD",
    AX: "AUD", HK: "HKD", SW: "CHF",
  };
  return map[sfx] ?? null;
}

/**
 * Currency-aware price formatting.
 * Symbols: € EUR, ¥ JPY, £ GBP, p suffix GBX/GBp, kr SEK/DKK/NOK, C$ CAD, A$ AUD, HK$ HKD, CHF, $ USD/default.
 *
 * `currency` may come from the WATCHLIST sheet's CURRENCY column; if absent
 * or "USD" while the ticker has a non-US exchange suffix, infer from the suffix.
 */
function formatPrice(n: number | null | undefined, currency?: string, ticker?: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  let c = (currency ?? "").trim().toUpperCase();
  // If sheet says USD (default) but ticker carries an exchange suffix, prefer the suffix
  const inferred = inferCurrencyFromTicker(ticker);
  if ((!c || c === "USD") && inferred) c = inferred;
  if (!c) c = "USD";

  let prefix = "$";
  let suffix = "";
  if (c === "EUR") prefix = "€";
  else if (c === "JPY") prefix = "¥";
  else if (c === "GBP") prefix = "£";
  else if (c === "GBX" || c === "GBP_PENCE" || c === "GBP".toUpperCase() + "P") { prefix = ""; suffix = "p"; }
  else if (c === "SEK" || c === "DKK" || c === "NOK") { prefix = ""; suffix = " kr"; }
  else if (c === "CAD") prefix = "C$";
  else if (c === "AUD") prefix = "A$";
  else if (c === "HKD") prefix = "HK$";
  else if (c === "CHF") { prefix = ""; suffix = " CHF"; }
  const decimals = Math.abs(n) >= 1000 ? 0 : 2;
  return `${prefix}${n.toLocaleString("en-GB", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${suffix}`;
}

function formatZone(zone: EntryZone | null, currency?: string, ticker?: string): string {
  if (!zone) return "—";
  if (zone.low === zone.high) return formatPrice(zone.low, currency, ticker);
  return `${formatPrice(zone.low, currency, ticker)}–${formatPrice(zone.high, currency, ticker)}`;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const style = STATUS_STYLE[normalized] ?? STATUS_STYLE.WATCH;
  return (
    <span
      style={{
        ...style,
        padding: "2px 7px",
        borderRadius: 2,
        fontSize: 8,
        letterSpacing: "0.12em",
        whiteSpace: "nowrap",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        border: `1px solid color-mix(in srgb, ${style.color as string} 35%, transparent)`,
      }}
    >
      {normalized}
    </span>
  );
}

function LayerChip({ layer }: { layer: string }) {
  if (!layer) return null;
  return (
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
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {layer}
    </span>
  );
}

/**
 * Trajectory arrow — buyer perspective.
 *   price moving DOWN → green (closing the gap toward our entry)
 *   price moving UP   → red   (widening the gap above our entry)
 *   No change / no data → muted
 */
function TrajectoryArrow({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const Icon = pct < 0 ? ArrowDown : ArrowUp;
  const colour = pct < 0 ? "var(--green)" : pct > 0 ? "var(--red)" : "var(--text-dim)";
  const sign = pct > 0 ? "+" : "";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: colour, fontWeight: 600 }}>
      <Icon size={10} strokeWidth={2.5} />
      {sign}
      {pct.toFixed(1)}%
    </span>
  );
}

function ActionButtons({ item, stop }: { item: LiveWatchItem; stop: (e: React.MouseEvent) => void }) {
  const handleEarnings = (e: React.MouseEvent) => {
    stop(e);
    triggerWebhook("stellar-earnings-prep", { ticker: item.ticker }, `Earnings prep triggered for ${item.ticker}`);
  };

  const btn: CSSProperties = {
    background: "none",
    border: "1px solid var(--rim)",
    color: "var(--text-dim)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.08em",
    padding: "3px 9px",
    borderRadius: 2,
    cursor: "pointer",
    transition: "all 0.15s",
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button onClick={handleEarnings} style={btn}>📋 Earnings Prep</button>
      <ClaudePromptButton
        templateKey="watchlist_review"
        context={{
          ticker: item.ticker,
          name: item.name,
          layer: item.layer,
          status: item.status,
          trigger_condition: item.trigger || "—",
          entry_target: item.entry || "—",
        }}
        stopPropagation
        style={{ ...btn, color: "var(--text-dim)", border: "1px solid var(--rim)" }}
      >
        🔄 Review
      </ClaudePromptButton>
      <ClaudePromptButton
        templateKey="watchlist_deep_dive"
        context={{
          ticker: item.ticker,
          name: item.name,
          layer: item.layer,
          status: item.status,
          entry_target: item.entry || "—",
          thesis: item.rationale || "—",
        }}
        stopPropagation
        style={{ ...btn, color: "var(--accent)" }}
      >
        🔬 Deep Dive
      </ClaudePromptButton>
    </div>
  );
}

// ── Card ──

export function WatchlistCard({ row, variant, hideActions, tint = "none" }: Props) {
  const isMobile = useIsMobile();
  // Mobile compacts expand on tap
  const [expanded, setExpanded] = useState(false);
  const { open: openFactSheet } = useFactSheet();

  const { item, zone, distanceToEntryPct, change7dPct, change30dPct, trajectory, score, daysSinceReview } = row;
  const showFull = variant === "full" || expanded;
  const isCompact = variant === "compact";

  // Buyer mood: in zone OR price falling toward entry → 'good'; rising away → 'bad'
  const mood: "good" | "bad" | "neutral" = (() => {
    if (row.zoneStatus === "IN_ZONE") return "good";
    if (change7dPct == null) return "neutral";
    if (change7dPct < -0.2) return "good";
    if (change7dPct > 0.2) return "bad";
    return "neutral";
  })();

  const handleCardClick = () => {
    // Clicking anywhere on a compact row (except the ticker, which opens factsheet)
    // toggles expand-in-place so the user can preview without leaving the page
    if (isCompact) setExpanded((v) => !v);
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const tintStyle = TINT_STYLE[tint];

  // ── Compact desktop variant ──
  if (isCompact && !showFull) {
    const sparkW = isMobile ? 100 : 140;
    return (
      <div
        onClick={handleCardClick}
        style={{
          padding: "8px 14px 6px",
          borderBottom: "1px solid rgba(28,28,48,0.4)",
          cursor: "pointer",
          ...tintStyle,
        }}
      >
        {/* Primary data row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={(e) => { e.stopPropagation(); openFactSheet(item.ticker); }}
            title="Open fact sheet"
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
              color: "var(--gold)", minWidth: 60, textAlign: "left",
              textDecoration: "underline", textDecorationStyle: "dotted",
              textUnderlineOffset: 3, textDecorationColor: "rgba(200,169,110,0.4)",
            }}
          >
            {item.ticker}
          </button>
          <ChinaRiskChip flag={row.chinaExposureFlag} />

          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: "1 1 140px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </span>
          <LayerChip layer={item.layer} />
          <DriverChip value={item.factor_group} />
          <StackBadge value={item.stack_layer} />
          <ProfileChip profile={row.return_profile} subtype={row.compounder_subtype} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            Cur <span style={{ color: "var(--text)" }}>{formatPrice(trajectory?.currentClose ?? item.current ?? null, item.currency, item.ticker)}</span>
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
            Tgt <span style={{ color: "var(--gold)" }}>{formatZone(zone, item.currency, item.ticker)}</span>
          </span>
          {(() => {
            if (row.zoneStatus === "IN_ZONE" && zone && zone.high > zone.low) {
              const cp = trajectory?.currentClose ?? item.current ?? null;
              if (cp != null) {
                const through = ((cp - zone.low) / (zone.high - zone.low)) * 100;
                return (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)" }}>
                    Pos {through.toFixed(0)}% thru
                  </span>
                );
              }
            }
            if (distanceToEntryPct != null) {
              return (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: distanceToEntryPct <= 0 ? "var(--green)" : "var(--text-mid)" }}>
                  Gap {distanceToEntryPct >= 0 ? "+" : ""}{distanceToEntryPct.toFixed(1)}%
                </span>
              );
            }
            return null;
          })()}
          {row.liveAsymmetry?.baseRatio != null && <AsymmetryPill asymmetry={row.liveAsymmetry} />}
          <WatchlistSparkline points={trajectory?.spark30d ?? []} zone={zone} width={sparkW} height={28} mood={mood} />

          {daysSinceReview != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: row.isOverdue ? "var(--red)" : "var(--text-dim)" }}>
              {row.isOverdue ? `${daysSinceReview}d ⚠` : `${daysSinceReview}d`}
            </span>
          )}
          {!hideActions && (
            <ClaudePromptButton
              templateKey="watchlist_review"
              context={{
                ticker: item.ticker,
                name: item.name,
                layer: item.layer,
                status: item.status,
                trigger_condition: item.trigger || "—",
                entry_target: item.entry || "—",
              }}
              stopPropagation
              style={{
                background: "none",
                border: "1px solid var(--rim)",
                color: "var(--gold)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                padding: "3px 9px",
              }}
            >
              Review →
            </ClaudePromptButton>
          )}
          {isMobile && <ChevronRight size={12} style={{ color: "var(--text-dim)" }} />}
        </div>

        {/* Secondary trigger line — full width, never truncated */}
        {item.trigger && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              color: "var(--text-dim)",
              lineHeight: 1.5,
              marginTop: 4,
              paddingLeft: 72,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>Trigger:</span> {item.trigger}
          </div>
        )}
      </div>
    );
  }

  // ── Full card (also used when mobile compact expands) ──
  const sparkW = isMobile ? 130 : 180;
  const sparkH = isMobile ? 42 : 50;

  return (
    <div
      onClick={handleCardClick}
      style={{
        padding: isMobile ? "12px 14px" : "14px 18px",
        borderBottom: "1px solid rgba(28,28,48,0.4)",
        cursor: isCompact && isMobile ? "pointer" : "default",
        transition: "background 0.15s",
        ...tintStyle,
      }}
    >
      {/* Line 1 — ticker, name, layer, status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <button
          onClick={(e) => { e.stopPropagation(); openFactSheet(item.ticker); }}
          title="Open fact sheet"
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--gold)",
            textDecoration: "underline", textDecorationStyle: "dotted",
            textUnderlineOffset: 3, textDecorationColor: "rgba(200,169,110,0.4)",
          }}
        >
          {item.ticker}
        </button>
        {score?.total_score != null && (() => {
          const sc = score.total_score;
          const c = sc >= 80 ? "var(--green)" : sc >= 60 ? "var(--accent)" : sc >= 40 ? "var(--amber)" : "var(--red)";
          return (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 700,
                color: c,
                background: `color-mix(in srgb, ${c} 15%, transparent)`,
                padding: "1px 6px",
                borderRadius: 8,
                lineHeight: 1.4,
              }}
            >
              {sc}
              {score.tier ? ` · ${score.tier}` : ""}
            </span>
          );
        })()}
        <ProfileChip profile={row.return_profile} subtype={row.compounder_subtype} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </span>
        <LayerChip layer={item.layer} />
        <DriverChip value={item.factor_group} />
        <StackBadge value={item.stack_layer} />
        <StatusBadge status={item.status} />
      </div>

      {/* THESIS / RATIONALE — full text, no truncation */}
      {item.rationale && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--text-mid)",
            lineHeight: 1.55,
            marginBottom: 6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {item.rationale}
        </div>
      )}

      {/* Vault thesis from vault note */}
      <VaultWatchlistSnippet ticker={item.ticker} />

      {/* TRIGGER CONDITION — separate accent line */}
      {item.trigger && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--accent)",
            fontWeight: 600,
            lineHeight: 1.55,
            marginBottom: 10,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          ▸ TRIGGER: <span style={{ color: "var(--text)" }}>{item.trigger}</span>
        </div>
      )}

      {/* Body — sparkline + stats */}
      <div style={{ display: "flex", gap: isMobile ? 10 : 18, alignItems: "center", flexWrap: "wrap" }}>
        <WatchlistSparkline points={trajectory?.spark30d ?? []} zone={zone} width={sparkW} height={sparkH} mood={mood} />

        <div style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: "var(--font-mono)", fontSize: 10, minWidth: 180 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)" }}>Current:</span>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {formatPrice(trajectory?.currentClose ?? item.current ?? null, item.currency, item.ticker)}
            </span>
            <TrajectoryArrow pct={change7dPct} />
            <span style={{ color: "var(--text-dim)", fontSize: 9 }}>7d</span>
            <TrajectoryArrow pct={change30dPct} />
            <span style={{ color: "var(--text-dim)", fontSize: 9 }}>30d</span>
          </div>
          <div>
            <span style={{ color: "var(--text-dim)" }}>Target: </span>
            <span style={{ color: "var(--gold)" }}>{formatZone(zone, item.currency, item.ticker)}</span>
          </div>
          {(() => {
            // IN_ZONE → "Position: X% through zone" (lower = closer to bottom = better)
            const cp = trajectory?.currentClose ?? item.current ?? null;
            if (row.zoneStatus === "IN_ZONE" && zone && zone.high > zone.low && cp != null) {
              const through = ((cp - zone.low) / (zone.high - zone.low)) * 100;
              return (
                <div>
                  <span style={{ color: "var(--text-dim)" }}>Position: </span>
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>
                    {through.toFixed(0)}% through zone
                  </span>
                </div>
              );
            }
            return (
              <div>
                <span style={{ color: "var(--text-dim)" }}>Gap: </span>
                <span
                  style={{
                    color: distanceToEntryPct == null ? "var(--text-dim)" : distanceToEntryPct <= 0 ? "var(--green)" : distanceToEntryPct <= 10 ? "var(--amber)" : "var(--text-mid)",
                    fontWeight: 600,
                  }}
                >
                  {distanceToEntryPct == null
                    ? "—"
                    : distanceToEntryPct <= 0
                      ? `${distanceToEntryPct.toFixed(1)}% (in zone)`
                      : `+${distanceToEntryPct.toFixed(1)}% above zone top`}
                </span>
              </div>
            );
          })()}
          {(trajectory?.high52w != null || trajectory?.low52w != null) && (
            <div>
              <span style={{ color: "var(--text-dim)" }}>52w: </span>
              <span style={{ color: "var(--text-mid)" }}>
                {formatPrice(trajectory.low52w, item.currency, item.ticker)} – {formatPrice(trajectory.high52w, item.currency, item.ticker)}
              </span>
            </div>
          )}
          {item.deploy_amount_gbp != null && item.deploy_amount_gbp > 0 && (
            <div>
              <span style={{ color: "var(--text-dim)" }}>Deploy: </span>
              <span style={{ color: "var(--accent)" }}>
                £{item.deploy_amount_gbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer — review + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: row.isOverdue ? "var(--red)" : "var(--text-dim)" }}>
          {daysSinceReview == null
            ? "Never reviewed"
            : row.isOverdue
              ? `Reviewed ${daysSinceReview}d ago — overdue`
              : `Reviewed ${daysSinceReview}d ago`}
        </span>
        {!hideActions && <ActionButtons item={item} stop={stop} />}
      </div>

      {isCompact && isMobile && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
          <ChevronDown size={12} style={{ color: "var(--text-dim)" }} />
        </div>
      )}
    </div>
  );
}
