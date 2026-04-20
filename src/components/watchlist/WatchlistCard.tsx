import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiveWatchItem } from "@/hooks/usePortfolioData";
import { WatchlistSparkline } from "./WatchlistSparkline";
import type { WatchlistTrajectory } from "@/hooks/useWatchlistHistory";
import type { WatchlistScoreEntry } from "@/hooks/useWatchlistScores";
import type { EntryZone } from "@/lib/parseEntryTarget";
import { triggerWebhook } from "@/lib/webhooks";
import { buildDeepDivePrompt, buildWatchlistReviewPrompt, CLAUDE_PROJECT_URL } from "@/lib/claudePrompts";

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
}

interface Props {
  row: DerivedRow;
  variant: "full" | "compact";
  /** Hide action buttons (used for MONITORING / PRE-IPO sections) */
  hideActions?: boolean;
  /** Override default tint */
  tint?: "in-zone" | "approaching" | "overdue" | "none";
}

const STATUS_STYLE: Record<string, CSSProperties> = {
  "BUY T1": { background: "var(--green-dim)", color: "var(--green)" },
  "BUY T2": { background: "var(--green-dim)", color: "var(--green)" },
  "BUY NOW": { background: "var(--green-dim)", color: "var(--green)" },
  ACTIVE_MONITORING: { background: "var(--amber-dim)", color: "var(--amber)" },
  MONITOR: { background: "var(--accent-dim)", color: "var(--accent)" },
  WAIT: { background: "rgba(80,80,120,0.15)", color: "var(--text-dim)" },
  WATCH: { background: "rgba(80,80,120,0.15)", color: "var(--text-dim)" },
  RESEARCH: { background: "rgba(80,80,160,0.15)", color: "rgb(140,140,220)" },
  "PRE-IPO": { background: "rgba(130,80,180,0.15)", color: "rgb(170,120,220)" },
  EXITED: { background: "rgba(60,60,80,0.15)", color: "var(--text-dim)" },
  REVIEW_FLAGGED: { background: "rgba(239, 159, 39, 0.12)", color: "#EF9F27" },
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

function ActionButtons({ ticker, stop }: { ticker: string; stop: (e: React.MouseEvent) => void }) {
  const handleDeepDive = (e: React.MouseEvent) => {
    stop(e);
    const prompt = buildWatchlistReviewPrompt(ticker);
    const url = `${CLAUDE_PROJECT_URL}?prompt=${encodeURIComponent(prompt)}`;
    (window.top || window).open(url, "_blank");
  };

  const handleEarnings = (e: React.MouseEvent) => {
    stop(e);
    triggerWebhook("stellar-earnings-prep", { ticker }, `Earnings prep triggered for ${ticker}`);
  };

  const handleReview = (e: React.MouseEvent) => {
    stop(e);
    triggerWebhook("stellar-watchlist-review", { ticker }, `Watchlist review triggered for ${ticker}. Check email.`);
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
      <button onClick={handleReview} style={btn}>🔄 Review</button>
      <button onClick={handleDeepDive} style={{ ...btn, color: "var(--accent)" }}>🔬 Deep Dive</button>
    </div>
  );
}

// ── Card ──

export function WatchlistCard({ row, variant, hideActions, tint = "none" }: Props) {
  const isMobile = useIsMobile();
  // Mobile compacts expand on tap
  const [expanded, setExpanded] = useState(false);

  const { item, zone, distanceToEntryPct, change7dPct, change30dPct, trajectory, score, daysSinceReview } = row;
  const showFull = variant === "full" || (isMobile && expanded);
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
    // On mobile, compact cards tap-to-expand; otherwise no-op (dedicated buttons)
    if (isCompact && isMobile) setExpanded((v) => !v);
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
          cursor: isMobile ? "pointer" : "default",
          ...tintStyle,
        }}
      >
        {/* Primary data row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 60 }}>
            {item.ticker}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: "1 1 140px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </span>
          <LayerChip layer={item.layer} />
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
          <WatchlistSparkline points={trajectory?.spark30d ?? []} zone={zone} width={sparkW} height={28} mood={mood} />
          {daysSinceReview != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: row.isOverdue ? "var(--red)" : "var(--text-dim)" }}>
              {row.isOverdue ? `${daysSinceReview}d ⚠` : `${daysSinceReview}d`}
            </span>
          )}
          {!hideActions && (
            <button
              onClick={(e) => {
                stop(e);
                triggerWebhook("stellar-watchlist-review", { ticker: item.ticker }, `Watchlist review triggered for ${item.ticker}. Check email.`);
              }}
              style={{
                background: "none",
                border: "1px solid var(--rim)",
                color: "var(--gold)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                padding: "3px 9px",
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              Review →
            </button>
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {item.ticker}
        </span>
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </span>
        <LayerChip layer={item.layer} />
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
        {!hideActions && <ActionButtons ticker={item.ticker} stop={stop} />}
      </div>

      {isCompact && isMobile && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
          <ChevronDown size={12} style={{ color: "var(--text-dim)" }} />
        </div>
      )}
    </div>
  );
}
