import { useMemo } from "react";
import type { AssetIntelligence, ReturnProfile } from "@/types/intelligence";
import { PROFILE_PALETTE, PROFILE_LABEL } from "./profileChips";

/**
 * Profile Mix summary widget — AUM-weighted distribution of held positions
 * across RETURN_PROFILE buckets, vs Stellar Doctrine v2.4 target bands.
 *
 * CASH is excluded (shown on the Layer chart). VEHICLE/PRE_PRODUCTION ranges
 * include caps as well as bands per the doctrine.
 */

type Profile6 = Exclude<ReturnProfile, "CASH">;

interface Band {
  /** Inclusive target band [low, high] (% AUM). */
  low: number;
  high: number;
  /** Soft warning thresholds outside the band — drift = amber, breach = red. */
  warnLow?: number;
  warnHigh?: number;
}

const DOCTRINE_BANDS: Record<Profile6, Band> = {
  COMPOUNDER:       { low: 35, high: 45, warnLow: 30, warnHigh: 55 },
  RECLASSIFICATION: { low: 20, high: 30, warnLow: 15, warnHigh: 40 },
  CYCLE:            { low: 8,  high: 15, warnLow: 5,  warnHigh: 25 },
  HEDGE:            { low: 12, high: 16, warnLow: 10, warnHigh: 18 },
  PRE_PRODUCTION:   { low: 2,  high: 5,                warnHigh: 7 },
  VEHICLE:          { low: 0,  high: 8,                warnHigh: 10 },
};

const PROFILE_ORDER: Profile6[] = [
  "COMPOUNDER",
  "RECLASSIFICATION",
  "CYCLE",
  "HEDGE",
  "PRE_PRODUCTION",
  "VEHICLE",
];

type RagState = "ok" | "drift" | "breach";

function classify(pct: number, band: Band): RagState {
  if (pct >= band.low && pct <= band.high) return "ok";
  // Below band
  if (pct < band.low) {
    if (band.warnLow !== undefined && pct < band.warnLow) return "breach";
    return "drift";
  }
  // Above band
  if (band.warnHigh !== undefined && pct > band.warnHigh) return "breach";
  return "drift";
}

function ragColor(state: RagState): string {
  if (state === "ok") return "var(--green)";
  if (state === "drift") return "var(--amber)";
  return "var(--red)";
}

const SCALE_MAX = 60; // chart x-axis ceiling (% AUM)

export function ProfileMixWidget({ assets }: { assets: AssetIntelligence[] }) {
  const { byProfile, totalHeldAum } = useMemo(() => {
    const by: Record<Profile6, number> = {
      COMPOUNDER: 0, RECLASSIFICATION: 0, CYCLE: 0, HEDGE: 0, VEHICLE: 0, PRE_PRODUCTION: 0,
    };
    let total = 0;
    for (const a of assets) {
      if (a.held_status !== "HELD" || !a.position) continue;
      const aum = a.position.aum_pct;
      if (!Number.isFinite(aum) || aum <= 0) continue;
      total += aum;
      const p = a.return_profile;
      if (!p || p === "CASH") continue;
      by[p as Profile6] = (by[p as Profile6] ?? 0) + aum;
    }
    return { byProfile: by, totalHeldAum: total };
  }, [assets]);

  // Re-base on total held AUM (excluding CASH) so percentages sum to ~100 across the 6 bars
  const base = totalHeldAum > 0 ? totalHeldAum : 1;

  const rows = PROFILE_ORDER.map((p) => {
    const pct = (byProfile[p] / base) * 100;
    const band = DOCTRINE_BANDS[p];
    const state = classify(pct, band);
    return { profile: p, pct, band, state };
  });

  return (
    <div
      style={{
        margin: "0 16px 12px",
        padding: "10px 14px",
        border: "1px solid var(--rim)",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 4,
      }}
      aria-label="Return profile mix vs doctrine bands"
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--gold)",
          }}
        >
          Profile Mix · vs Doctrine v2.4
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
          AUM-weighted · CASH on Layer chart
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(({ profile, pct, band, state }) => {
          const color = ragColor(state);
          const palette = PROFILE_PALETTE[profile as ReturnProfile];
          const bandLeft = (band.low / SCALE_MAX) * 100;
          const bandWidth = ((band.high - band.low) / SCALE_MAX) * 100;
          const barWidth = Math.min((pct / SCALE_MAX) * 100, 100);
          const stateLabel =
            state === "ok" ? "in band"
            : state === "drift" ? "drift"
            : "outside";
          return (
            <div
              key={profile}
              style={{ display: "grid", gridTemplateColumns: "110px 1fr 92px", alignItems: "center", gap: 10 }}
              title={`${PROFILE_LABEL[profile]}: ${pct.toFixed(1)}% (target ${band.low}–${band.high}%) — ${stateLabel}`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  display: "inline-block",
                  width: 8, height: 8, borderRadius: 2,
                  background: palette.fg,
                }} aria-hidden />
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-mid)",
                }}>
                  {PROFILE_LABEL[profile]}
                </span>
              </div>

              {/* Track + band shading + actual bar */}
              <div style={{
                position: "relative",
                height: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--rim)",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                {/* Target band shading */}
                <div style={{
                  position: "absolute",
                  top: 0, bottom: 0,
                  left: `${bandLeft}%`,
                  width: `${bandWidth}%`,
                  background: "rgba(90,191,160,0.12)",
                  borderLeft: "1px dashed rgba(90,191,160,0.45)",
                  borderRight: "1px dashed rgba(90,191,160,0.45)",
                }} aria-hidden />
                {/* Actual bar */}
                <div style={{
                  position: "absolute",
                  top: 2, bottom: 2,
                  left: 0,
                  width: `${barWidth}%`,
                  background: color,
                  opacity: 0.85,
                  transition: "width 250ms ease",
                }} aria-hidden />
              </div>

              {/* Numeric readout */}
              <div style={{
                display: "flex",
                alignItems: "baseline",
                gap: 4,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color,
                justifyContent: "flex-end",
              }}>
                <span style={{ fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                <span style={{ color: "var(--text-dim)", fontSize: 9 }}>
                  / {band.low}-{band.high}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 8,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        color: "var(--text-dim)",
        letterSpacing: "0.08em",
      }}>
        <span><span style={{ color: "var(--green)" }}>■</span> in band</span>
        <span><span style={{ color: "var(--amber)" }}>■</span> drift</span>
        <span><span style={{ color: "var(--red)" }}>■</span> outside</span>
        <span style={{ marginLeft: "auto" }}>Held AUM base: {totalHeldAum.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default ProfileMixWidget;
