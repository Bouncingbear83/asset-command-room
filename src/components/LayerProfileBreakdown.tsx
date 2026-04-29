/**
 * Per-layer RETURN_PROFILE breakdown bar + portfolio-wide
 * "Substrate × Return Profile" heatmap.
 *
 * Layer remains the primary dimension on the Layers tab; profile is shown
 * here as a sub-dimension (within each layer card and in the matrix).
 *
 * Data plumbing:
 *   • holdings  = held positions (sipp + isa + jisa)         → AUM
 *   • scores    = SCORES sheet rows                          → profile / subtype
 *
 * No doctrine bands or per-layer profile targets are introduced here —
 * profile target bands live on the Intelligence tab (single source of truth).
 */

import { useMemo, type CSSProperties } from "react";
import type { LiveHolding, LiveScore } from "@/hooks/usePortfolioData";
import {
  PROFILE_PALETTE,
  PROFILE_LABEL,
} from "@/components/intelligence/profileChips";
import type { ReturnProfile, CompounderSubtype } from "@/types/intelligence";

// ── Profile filter keys: COMPOUNDER split into Stellar / Generic, matches Intelligence tab. ──
export type ProfileBreakdownKey =
  | "STELLAR_COMPOUNDER"
  | "GENERIC_COMPOUNDER"
  | "RECLASSIFICATION"
  | "CYCLE"
  | "HEDGE"
  | "VEHICLE"
  | "PRE_PRODUCTION";

export const PROFILE_BREAKDOWN_KEYS: ProfileBreakdownKey[] = [
  "STELLAR_COMPOUNDER",
  "GENERIC_COMPOUNDER",
  "RECLASSIFICATION",
  "CYCLE",
  "HEDGE",
  "VEHICLE",
  "PRE_PRODUCTION",
];

export const PROFILE_BREAKDOWN_LABEL: Record<ProfileBreakdownKey, string> = {
  STELLAR_COMPOUNDER: "Stellar Compounder",
  GENERIC_COMPOUNDER: "Generic Compounder",
  RECLASSIFICATION: PROFILE_LABEL.RECLASSIFICATION,
  CYCLE: PROFILE_LABEL.CYCLE,
  HEDGE: PROFILE_LABEL.HEDGE,
  VEHICLE: PROFILE_LABEL.VEHICLE,
  PRE_PRODUCTION: PROFILE_LABEL.PRE_PRODUCTION,
};

/** Short labels for in-bar segment text (space-constrained). */
const PROFILE_SHORT_LABEL: Record<ProfileBreakdownKey, string> = {
  STELLAR_COMPOUNDER: "Stellar",
  GENERIC_COMPOUNDER: "Generic",
  RECLASSIFICATION: "Reclass",
  CYCLE: "Cycle",
  HEDGE: "Hedge",
  VEHICLE: "Vehicle",
  PRE_PRODUCTION: "Pre-Prod",
};

/** Map a breakdown key back to its base ReturnProfile palette entry. */
function paletteFor(key: ProfileBreakdownKey) {
  if (key === "STELLAR_COMPOUNDER" || key === "GENERIC_COMPOUNDER") return PROFILE_PALETTE.COMPOUNDER;
  return PROFILE_PALETTE[key as ReturnProfile];
}

/**
 * Colour application is split across `backgroundColor` (solid fill) and
 * `backgroundImage` (diagonal stripes for GENERIC_COMPOUNDER) so we never
 * use the `background:` shorthand — that shorthand was silently dropping
 * non-Compounder fills in some browsers, leaving Reclass/Cycle/Hedge/etc.
 * segments invisible against the dark track.
 */
function segmentBackgroundColor(key: ProfileBreakdownKey): string {
  if (key === "GENERIC_COMPOUNDER") {
    // Faded blue wash sits under the diagonal stripes.
    return "rgba(125,164,216,0.18)";
  }
  return paletteFor(key).fg;
}

function segmentBackgroundImage(key: ProfileBreakdownKey): string {
  if (key === "GENERIC_COMPOUNDER") {
    const fg = paletteFor(key).fg;
    return `linear-gradient(135deg, ${fg} 25%, transparent 25%, transparent 50%, ${fg} 50%, ${fg} 75%, transparent 75%, transparent)`;
  }
  return "none";
}

function segmentBackgroundSize(key: ProfileBreakdownKey): string | undefined {
  return key === "GENERIC_COMPOUNDER" ? "6px 6px" : undefined;
}

// ── Normalisation helpers ────────────────────────────────────────────────────

function normalizeProfile(raw: unknown): ReturnProfile | null {
  const upper = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return null;
  const valid: ReturnProfile[] = [
    "COMPOUNDER", "RECLASSIFICATION", "CYCLE", "HEDGE", "VEHICLE", "PRE_PRODUCTION", "CASH",
  ];
  return (valid as string[]).includes(upper) ? (upper as ReturnProfile) : null;
}
function normalizeSubtype(raw: unknown): CompounderSubtype | null {
  const upper = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (upper === "STELLAR_COMPOUNDER" || upper === "STELLAR") return "STELLAR_COMPOUNDER";
  if (upper === "GENERIC_COMPOUNDER" || upper === "GENERIC") return "GENERIC_COMPOUNDER";
  return null;
}
function stripSuffix(t: string): string {
  return t.replace(/[.\-][A-Z0-9]{1,3}$/i, "");
}

function profileKeyFor(p: ReturnProfile | null, sub: CompounderSubtype | null): ProfileBreakdownKey | null {
  if (!p) return null;
  if (p === "CASH") return null;
  if (p === "COMPOUNDER") {
    if (sub === "STELLAR_COMPOUNDER") return "STELLAR_COMPOUNDER";
    if (sub === "GENERIC_COMPOUNDER") return "GENERIC_COMPOUNDER";
    return null; // unspecified subtype — drop rather than guess
  }
  return p as ProfileBreakdownKey;
}

// ── Public hook: build the (layer, profile) → tickers + AUM% lookup ──────────

export interface ProfileMixCell {
  /** Tickers contributing to this (layer, profile) cell. */
  tickers: string[];
  /** Sum of MV (£) for the cell. */
  mvGbp: number;
  /** AUM share as a percentage of total portfolio AUM (0–100). */
  aumPct: number;
}

export interface ProfileMixIndex {
  /** For each layer name → for each profile key → cell. */
  byLayer: Map<string, Map<ProfileBreakdownKey, ProfileMixCell>>;
  /** Per-layer total AUM%. */
  layerTotals: Map<string, number>;
  /** Total AUM denominator used for percentages. */
  totalAumGbp: number;
}

export function buildProfileMixIndex(
  holdings: LiveHolding[],
  scores: LiveScore[],
): ProfileMixIndex {
  // Build profile lookup keyed by uppercase ticker (with suffix-stripping fallback).
  const profileByTicker = new Map<string, ProfileBreakdownKey | null>();
  for (const s of scores) {
    const t = String(s.ticker ?? "").trim().toUpperCase();
    if (!t) continue;
    const profile = normalizeProfile(s.returnProfile);
    const subtype = profile === "COMPOUNDER" ? normalizeSubtype(s.compounderSubtype) : null;
    const key = profileKeyFor(profile, subtype);
    profileByTicker.set(t, key);
    const stripped = stripSuffix(t);
    if (stripped && stripped !== t && !profileByTicker.has(stripped)) {
      profileByTicker.set(stripped, key);
    }
  }

  const totalAumGbp = holdings.reduce((sum, h) => sum + (Number(h.mv) || 0), 0);

  const byLayer = new Map<string, Map<ProfileBreakdownKey, ProfileMixCell>>();
  const layerTotals = new Map<string, number>();

  for (const h of holdings) {
    const mv = Number(h.mv) || 0;
    if (mv <= 0) continue;
    const ticker = String(h.ticker ?? "").trim().toUpperCase();
    if (!ticker) continue;
    const layer = String(h.layer ?? "").trim();
    if (!layer || layer.toUpperCase() === "CASH") continue;

    const key = profileByTicker.get(ticker) ?? profileByTicker.get(stripSuffix(ticker)) ?? null;
    if (!key) continue; // Skip holdings without a classified profile rather than mis-bucket.

    layerTotals.set(layer, (layerTotals.get(layer) ?? 0) + mv);

    let layerMap = byLayer.get(layer);
    if (!layerMap) {
      layerMap = new Map();
      byLayer.set(layer, layerMap);
    }
    const cell = layerMap.get(key) ?? { tickers: [], mvGbp: 0, aumPct: 0 };
    if (!cell.tickers.includes(ticker)) cell.tickers.push(ticker);
    cell.mvGbp += mv;
    layerMap.set(key, cell);
  }

  // Convert MV → AUM% (of total portfolio AUM, so cells are comparable
  // across layers in the matrix).
  if (totalAumGbp > 0) {
    for (const layerMap of byLayer.values()) {
      for (const cell of layerMap.values()) {
        cell.aumPct = (cell.mvGbp / totalAumGbp) * 100;
      }
    }
  }

  return { byLayer, layerTotals, totalAumGbp };
}

// ── Per-layer breakdown bar ──────────────────────────────────────────────────

interface BarProps {
  layerName: string;
  index: ProfileMixIndex;
  /** Total invested AUM% the layer represents (from LAYERS sheet `current`). */
  layerCurrentPct: number;
}

export function LayerProfileBreakdown({ layerName, index, layerCurrentPct }: BarProps) {
  const cells = index.byLayer.get(layerName);
  if (!cells || cells.size === 0 || layerCurrentPct <= 0) return null;

  // Order segments using the canonical doctrine order.
  const ordered = PROFILE_BREAKDOWN_KEYS
    .map((k) => ({ key: k, cell: cells.get(k) }))
    .filter((x): x is { key: ProfileBreakdownKey; cell: ProfileMixCell } => Boolean(x.cell));

  // Each segment width is its share of the LAYER total (so the bar fills 100%).
  const layerMv = index.layerTotals.get(layerName) ?? 0;
  if (layerMv <= 0) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 14,
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid var(--rim)",
          background: "rgba(0,0,0,0.25)",
        }}
        role="img"
        aria-label={`Profile breakdown for ${layerName}`}
      >
        {ordered.map(({ key, cell }) => {
          const widthPct = (cell.mvGbp / layerMv) * 100;
          const aumPct = cell.aumPct;
          const tickerList = cell.tickers.join(", ");
          const tooltip = `${PROFILE_BREAKDOWN_LABEL[key]} · ${aumPct.toFixed(1)}% AUM\n${tickerList}`;
          return (
            <div
              key={key}
              title={tooltip}
              style={{
                width: `${widthPct}%`,
                height: "100%",
                backgroundColor: segmentBackgroundColor(key),
                backgroundImage: segmentBackgroundImage(key),
                backgroundSize: segmentBackgroundSize(key),
                position: "relative",
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-dim)",
          letterSpacing: "0.05em",
        }}
      >
        {ordered.map(({ key, cell }) => (
          <span
            key={`lbl-${key}`}
            title={cell.tickers.join(", ")}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                backgroundColor: segmentBackgroundColor(key),
                backgroundImage: segmentBackgroundImage(key),
                backgroundSize: segmentBackgroundSize(key),
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <span style={{ color: paletteFor(key).fg, fontWeight: 600 }}>
              {PROFILE_SHORT_LABEL[key]}
            </span>
            <span>{cell.aumPct.toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Profile legend ───────────────────────────────────────────────────────────

export function ProfileLegend() {
  const cellStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--text-mid)",
    letterSpacing: "0.06em",
  };
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        padding: "10px 16px",
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        marginBottom: 16,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginRight: 4,
        }}
      >
        Profile Legend
      </span>
      {PROFILE_BREAKDOWN_KEYS.map((k) => (
        <span key={k} style={cellStyle}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: segmentBackgroundColor(k),
              backgroundImage: segmentBackgroundImage(k),
              backgroundSize: segmentBackgroundSize(k),
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          {PROFILE_BREAKDOWN_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

// ── Substrate × Return Profile matrix ────────────────────────────────────────

interface MatrixProps {
  index: ProfileMixIndex;
  /** Layer order for rows (filtered to layers that exist in the index, in this order). */
  layerOrder: string[];
  /** Click handler for a cell → typically navigates to Holdings filtered to those tickers. */
  onCellClick?: (layer: string, profile: ProfileBreakdownKey, tickers: string[]) => void;
}

export function ProfileMatrix({ index, layerOrder, onCellClick }: MatrixProps) {
  const layers = useMemo(
    () => layerOrder.filter((l) => index.byLayer.has(l) && (index.layerTotals.get(l) ?? 0) > 0),
    [layerOrder, index],
  );

  // Compute max cell AUM% to scale the heat shading.
  const maxAum = useMemo(() => {
    let m = 0;
    for (const layerMap of index.byLayer.values()) {
      for (const cell of layerMap.values()) {
        if (cell.aumPct > m) m = cell.aumPct;
      }
    }
    return m;
  }, [index]);

  const headerCellStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    padding: "8px 6px",
    textAlign: "center",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--rim)",
  };
  const rowLabelStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-mid)",
    padding: "8px 12px",
    textAlign: "left",
    whiteSpace: "nowrap",
    borderRight: "1px solid var(--rim)",
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--rim)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-mid)",
          }}
        >
          Substrate × Return Profile
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-dim)",
            letterSpacing: "0.08em",
          }}
        >
          AUM% · click cell to filter Holdings
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...headerCellStyle, textAlign: "left", paddingLeft: 16 }}>Layer</th>
              {PROFILE_BREAKDOWN_KEYS.map((k) => (
                <th key={k} style={headerCellStyle} title={PROFILE_BREAKDOWN_LABEL[k]}>
                  <span style={{ color: paletteFor(k).fg, fontWeight: 700 }}>
                    {PROFILE_SHORT_LABEL[k]}
                  </span>
                </th>
              ))}
              <th style={{ ...headerCellStyle, color: "var(--text-mid)" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {layers.length === 0 && (
              <tr>
                <td
                  colSpan={PROFILE_BREAKDOWN_KEYS.length + 2}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-dim)",
                    padding: "20px 16px",
                    textAlign: "center",
                  }}
                >
                  No classified holdings — assign RETURN_PROFILE in SCORES tab.
                </td>
              </tr>
            )}
            {layers.map((layer, rowIdx) => {
              const cells = index.byLayer.get(layer)!;
              const layerTotalPct =
                index.totalAumGbp > 0
                  ? ((index.layerTotals.get(layer) ?? 0) / index.totalAumGbp) * 100
                  : 0;
              return (
                <tr key={layer} style={{ borderBottom: rowIdx === layers.length - 1 ? "none" : "1px solid rgba(28,28,48,0.4)" }}>
                  <td style={rowLabelStyle}>{layer}</td>
                  {PROFILE_BREAKDOWN_KEYS.map((k) => {
                    const cell = cells.get(k);
                    if (!cell || cell.aumPct <= 0) {
                      return (
                        <td
                          key={k}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            color: "transparent",
                            padding: "10px 6px",
                            textAlign: "center",
                          }}
                        />
                      );
                    }
                    const intensity = maxAum > 0 ? Math.min(cell.aumPct / maxAum, 1) : 0;
                    // Shade with profile fg colour at 0.10 → 0.55 alpha.
                    const alpha = 0.1 + intensity * 0.45;
                    const fg = paletteFor(k).fg;
                    const tooltip = `${layer} · ${PROFILE_BREAKDOWN_LABEL[k]}\n${cell.aumPct.toFixed(2)}% AUM\n${cell.tickers.join(", ")}`;
                    return (
                      <td
                        key={k}
                        title={tooltip}
                        onClick={() => onCellClick?.(layer, k, cell.tickers)}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontWeight: 600,
                          color: fg,
                          background: `color-mix(in srgb, ${fg} ${Math.round(alpha * 100)}%, transparent)`,
                          padding: "10px 6px",
                          textAlign: "center",
                          cursor: onCellClick ? "pointer" : "default",
                          transition: "outline 0.12s",
                          outline: "1px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableCellElement).style.outline = `1px solid ${fg}`;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableCellElement).style.outline = "1px solid transparent";
                        }}
                      >
                        {cell.aumPct.toFixed(1)}%
                      </td>
                    );
                  })}
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text)",
                      padding: "10px 12px",
                      textAlign: "center",
                      borderLeft: "1px solid var(--rim)",
                    }}
                    title={`Layer total: ${layerTotalPct.toFixed(2)}% AUM`}
                  >
                    {layerTotalPct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
