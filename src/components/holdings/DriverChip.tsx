import { CSSProperties } from "react";

/** FACTOR_GROUP color map — consistent across all tabs. */
export const FACTOR_GROUP_COLORS: Record<string, string> = {
  AI_INFRA: "#3b82f6",
  GENOMICS_BIO: "#a855f7",
  ENERGY_TRANSITION: "#10b981",
  SOVEREIGNTY: "#ef4444",
  ROBOTICS_AUTOMATION: "#f97316",
  MACRO_HEDGE: "#C8A96E",
  AGRI_INPUTS: "#84cc16",
};

export const FACTOR_GROUP_VALUES = [
  "AI_INFRA",
  "GENOMICS_BIO",
  "ENERGY_TRANSITION",
  "SOVEREIGNTY",
  "ROBOTICS_AUTOMATION",
  "MACRO_HEDGE",
  "AGRI_INPUTS",
] as const;

export const STACK_LAYER_VALUES = [
  "COMPONENT",
  "SUBSYSTEM",
  "INTEGRATION",
  "PROCESS_TOOLING",
  "FOUNDRY",
  "N/A",
] as const;

const STACK_LAYER_ORDER: Record<string, number> = {
  COMPONENT: 0,
  SUBSYSTEM: 1,
  INTEGRATION: 2,
  PROCESS_TOOLING: 3,
  FOUNDRY: 4,
  "N/A": 5,
};

export function stackLayerOrder(v: string | null | undefined): number {
  const u = String(v ?? "").trim().toUpperCase();
  return STACK_LAYER_ORDER[u] ?? 99;
}

const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.08em",
  padding: "2px 6px",
  borderRadius: 2,
  whiteSpace: "nowrap",
  lineHeight: 1.2,
};

export function DriverChip({ value }: { value: string | null | undefined }) {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>
    );
  }
  const color = FACTOR_GROUP_COLORS[v] ?? "#8a8a9a";
  return (
    <span
      style={{
        ...chipBase,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      }}
      title={v.replace(/_/g, " ")}
    >
      {v.replace(/_/g, " ")}
    </span>
  );
}

export function StackBadge({ value }: { value: string | null | undefined }) {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>
    );
  }
  return (
    <span
      style={{
        ...chipBase,
        background: "rgba(138,138,154,0.12)",
        color: "var(--text-mid)",
        border: "1px solid var(--rim)",
      }}
      title={v.replace(/_/g, " ")}
    >
      {v.replace(/_/g, " ")}
    </span>
  );
}
