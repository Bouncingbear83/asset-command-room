/**
 * AsymmetryBar - shared visualization for the asymmetry quartet vs live spot.
 *
 * Layout:
 *   ──────────────────────────────────────────────────────────────────
 *   Asymmetry                              3.6:1 / 5.9:1  HIGH
 *
 *                              ┌─ 35.48 ─┐
 *                              ▼
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   ┃         ┃                ┃        ┃   buy zone  ┃            ┃
 *  FAIL    WEAK              SPOT      BASE         (zone)    STRETCH
 *   4       18                35.48    113                       220
 *  -88%    -49%                        +218%                    +519%
 *   ──────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import type { AsymmetryQuartet, LiveAsymmetryResult } from "@/lib/liveAsymmetry";

export interface AsymmetryBarProps {
  quartet: AsymmetryQuartet;
  live: LiveAsymmetryResult;
  /** Optional buy zone overlay (e.g. SCORES buy_low / buy_high) */
  buyZone?: { low: number | null; high: number | null } | null;
  /** Optional trigger price (e.g. T1 anchor). Renders as a separate marker. */
  triggerPrice?: number | null;
  triggerLabel?: string | null;
  /** Currency / suffix shown after values */
  currency?: string | null;
  /** Compact mode: smaller for AssetExpansion row */
  compact?: boolean;
}

function formatNum(n: number | null | undefined, precision = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  return n.toLocaleString("en-GB", { maximumFractionDigits: precision });
}

function pctFromSpot(value: number | null, spot: number | null): string | null {
  if (value == null || spot == null || spot === 0) return null;
  const pct = ((value - spot) / spot) * 100;
  if (!Number.isFinite(pct)) return null;
  const sign = pct >= 0 ? "+" : "";
  if (Math.abs(pct) >= 100) {
    // Express as multiple for large upside
    const mult = value / spot;
    if (mult >= 2 && mult < 100) return `${mult.toFixed(1)}×`;
  }
  return `${sign}${pct.toFixed(0)}%`;
}

export function AsymmetryBar({
  quartet, live, buyZone, triggerPrice, triggerLabel, currency, compact = false,
}: AsymmetryBarProps) {
  const [hover, setHover] = useState<string | null>(null);

  const lo = quartet.bearSubstrateFail ?? quartet.bearThesisWeak;
  const hi = quartet.bullStretch ?? quartet.bullBase;
  const range = lo !== null && hi !== null && hi > lo ? hi - lo : null;
  if (range === null || lo === null) return null;

  const pctOf = (v: number | null): number | null =>
    v !== null ? Math.max(0, Math.min(100, ((v - lo) / range) * 100)) : null;

  const spot = live.price;
  const spotP = pctOf(spot);

  if (spotP === null) return null;

  const barHeight = compact ? 8 : 10;
  const trackHeight = compact ? 28 : 36;

  // Anchor definitions with metadata
  const anchors: Array<{
    key: "fail" | "weak" | "base" | "stretch";
    label: string;
    value: number | null;
    color: string;
    side: "bear" | "bull";
  }> = [
    { key: "fail", label: "Sub fail", value: quartet.bearSubstrateFail, color: "var(--red)", side: "bear" },
    { key: "weak", label: "Thesis weak", value: quartet.bearThesisWeak, color: "var(--red)", side: "bear" },
    { key: "base", label: "Bull base", value: quartet.bullBase, color: "var(--green)", side: "bull" },
    { key: "stretch", label: "Stretch", value: quartet.bullStretch, color: "var(--green)", side: "bull" },
  ];

  const buyZoneLow = buyZone?.low ?? null;
  const buyZoneHigh = buyZone?.high ?? null;
  const buyZoneP1 = pctOf(buyZoneLow);
  const buyZoneP2 = pctOf(buyZoneHigh);
  const showBuyZone = buyZoneP1 !== null && buyZoneP2 !== null && buyZoneP2 > buyZoneP1;

  const triggerP = pctOf(triggerPrice ?? null);

  const ccy = currency ?? "";

  return (
    <div style={{ marginBottom: compact ? 10 : 14 }}>
      {/* Spot price floating label above bar */}
      <div style={{ position: "relative", height: compact ? 18 : 22, marginBottom: 4 }}>
        <div
          style={{
            position: "absolute", left: `${spotP}%`, transform: "translateX(-50%)",
            padding: "2px 6px", background: "var(--accent)", color: "var(--void)",
            fontFamily: "var(--font-mono)", fontSize: compact ? 9 : 10,
            fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap",
          }}
        >
          {formatNum(spot)}
        </div>
        {/* Connector triangle */}
        <div
          style={{
            position: "absolute", left: `${spotP}%`, top: compact ? 14 : 18,
            transform: "translateX(-50%)",
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderTop: "4px solid var(--accent)",
          }}
        />
      </div>

      {/* The bar itself */}
      <div style={{ position: "relative", height: trackHeight }}>
        {/* Track background */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: barHeight,
            background: "var(--surface)", border: "1px solid var(--rim)", borderRadius: 1,
          }}
        />
        {/* Bear zone fill (lo → spot) */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, width: `${spotP}%`, height: barHeight,
            background: "linear-gradient(to right, rgba(200,90,90,0.5), rgba(200,90,90,0.2))",
            borderRadius: 1,
          }}
        />
        {/* Bull zone fill (spot → hi) */}
        <div
          style={{
            position: "absolute", top: 0, left: `${spotP}%`, width: `${100 - spotP}%`, height: barHeight,
            background: "linear-gradient(to right, rgba(90,180,140,0.2), rgba(90,180,140,0.5))",
            borderRadius: 1,
          }}
        />
        {/* Buy zone overlay */}
        {showBuyZone && (
          <div
            style={{
              position: "absolute",
              top: -2, left: `${buyZoneP1}%`, width: `${buyZoneP2! - buyZoneP1!}%`,
              height: barHeight + 4,
              background: "rgba(200,169,110,0.18)",
              border: "1px dashed rgba(200,169,110,0.5)",
              borderRadius: 1,
            }}
            onMouseEnter={() => setHover("zone")}
            onMouseLeave={() => setHover(null)}
            title={`Buy zone: ${formatNum(buyZoneLow)} – ${formatNum(buyZoneHigh)}`}
          />
        )}

        {/* Anchor notches on the bar */}
        {anchors.map((a) => {
          const p = pctOf(a.value);
          if (p === null) return null;
          return (
            <div
              key={a.key}
              onMouseEnter={() => setHover(a.key)}
              onMouseLeave={() => setHover(null)}
              style={{
                position: "absolute", left: `${p}%`, transform: "translateX(-50%)",
                top: -3, width: 2, height: barHeight + 6,
                background: a.color, cursor: "default",
              }}
              title={`${a.label}: ${formatNum(a.value)}`}
            />
          );
        })}

        {/* Spot vertical line through bar */}
        <div
          style={{
            position: "absolute", left: `${spotP}%`, transform: "translateX(-50%)",
            top: -4, width: 2, height: barHeight + 8,
            background: "var(--accent)",
            boxShadow: "0 0 0 1px var(--void)",
          }}
        />

        {/* Trigger marker (if provided) */}
        {triggerP !== null && (
          <div
            onMouseEnter={() => setHover("trigger")}
            onMouseLeave={() => setHover(null)}
            style={{
              position: "absolute", left: `${triggerP}%`, transform: "translateX(-50%)",
              top: -5, width: 0, height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "6px solid var(--gold)",
              cursor: "help",
            }}
            title={triggerLabel ? `Trigger: ${triggerLabel}` : `Trigger: ${formatNum(triggerPrice)}`}
          />
        )}
      </div>

      {/* Anchor labels row */}
      <div style={{ position: "relative", height: compact ? 32 : 38, marginTop: 2 }}>
        {anchors.map((a) => {
          const p = pctOf(a.value);
          if (p === null) return null;
          const distance = pctFromSpot(a.value, spot);
          const isActive = hover === a.key;
          return (
            <div
              key={a.key}
              style={{
                position: "absolute", left: `${p}%`, transform: "translateX(-50%)",
                textAlign: "center", minWidth: 50,
                opacity: isActive ? 1 : 0.85,
                transition: "opacity 0.15s",
              }}
            >
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: compact ? 8 : 9,
                color: "var(--text-dim)", letterSpacing: "0.08em",
                textTransform: "uppercase", lineHeight: 1,
              }}>
                {a.label}
              </div>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: compact ? 10 : 11,
                color: a.color, fontWeight: 600, marginTop: 2, lineHeight: 1,
              }}>
                {formatNum(a.value)}
              </div>
              {distance && (
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 8,
                  color: a.side === "bear" ? "var(--red)" : "var(--green)",
                  opacity: 0.7, marginTop: 2, lineHeight: 1,
                }}>
                  {distance}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Currency / context line */}
      {(ccy || showBuyZone || triggerP !== null) && (
        <div style={{
          marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 8,
          color: "var(--text-dim)", letterSpacing: "0.06em",
          display: "flex", gap: 12, flexWrap: "wrap",
        }}>
          {ccy && <span>VALUES IN {ccy.toUpperCase()}</span>}
          {showBuyZone && (
            <span>
              <span style={{ display: "inline-block", width: 8, height: 8, border: "1px dashed var(--gold)", marginRight: 4, verticalAlign: "middle" }} />
              BUY ZONE {formatNum(buyZoneLow)}–{formatNum(buyZoneHigh)}
            </span>
          )}
          {triggerP !== null && (
            <span>
              <span style={{ display: "inline-block", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid var(--gold)", marginRight: 4, verticalAlign: "middle" }} />
              TRIGGER {formatNum(triggerPrice)}{triggerLabel ? ` (${triggerLabel})` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
