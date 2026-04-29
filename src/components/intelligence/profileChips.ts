import type { CSSProperties } from "react";
import type { ReturnProfile, CompounderSubtype } from "@/types/intelligence";

/** Doctrine v2.4 colour palette for RETURN_PROFILE chips. HSL-ish hex tokens. */
export const PROFILE_PALETTE: Record<ReturnProfile, { bg: string; fg: string; border: string }> = {
  COMPOUNDER:       { bg: "rgba(110,142,200,0.12)", fg: "#7da4d8", border: "rgba(110,142,200,0.45)" }, // blue
  RECLASSIFICATION: { bg: "rgba(155,89,182,0.12)",  fg: "#b27bc9", border: "rgba(155,89,182,0.45)" },  // purple
  CYCLE:            { bg: "rgba(200,146,90,0.12)",  fg: "#d4a06a", border: "rgba(200,146,90,0.45)" },  // amber
  HEDGE:            { bg: "rgba(150,150,165,0.12)", fg: "#a8a8b8", border: "rgba(150,150,165,0.45)" }, // grey
  VEHICLE:          { bg: "rgba(100,116,139,0.12)", fg: "#94a3b8", border: "rgba(100,116,139,0.45)" }, // slate
  PRE_PRODUCTION:   { bg: "rgba(220,130,70,0.12)",  fg: "#e89766", border: "rgba(220,130,70,0.45)" },  // orange
  CASH:             { bg: "rgba(90,191,160,0.12)",  fg: "#5abfa0", border: "rgba(90,191,160,0.45)" },  // green
};

export const PROFILE_LABEL: Record<ReturnProfile, string> = {
  COMPOUNDER:       "Compounder",
  RECLASSIFICATION: "Reclass",
  CYCLE:            "Cycle",
  HEDGE:            "Hedge",
  VEHICLE:          "Vehicle",
  PRE_PRODUCTION:   "Pre-Prod",
  CASH:             "Cash",
};

const baseChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 6px",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  borderRadius: 2,
  whiteSpace: "nowrap",
  lineHeight: 1.4,
};

export function profileChipStyle(profile: ReturnProfile): CSSProperties {
  const c = PROFILE_PALETTE[profile];
  return { ...baseChip, background: c.bg, color: c.fg, border: `1px solid ${c.border}` };
}

export function subtypeChipStyle(subtype: CompounderSubtype): CSSProperties {
  // STELLAR = filled blue; GENERIC = outlined blue
  const blue = PROFILE_PALETTE.COMPOUNDER;
  if (subtype === "STELLAR_COMPOUNDER") {
    return {
      ...baseChip,
      background: blue.fg,
      color: "var(--void, #0a0a1a)",
      border: `1px solid ${blue.fg}`,
    };
  }
  return {
    ...baseChip,
    background: "transparent",
    color: blue.fg,
    border: `1px solid ${blue.border}`,
  };
}

export const SUBTYPE_LABEL: Record<CompounderSubtype, string> = {
  STELLAR_COMPOUNDER: "Stellar",
  GENERIC_COMPOUNDER: "Generic",
};
