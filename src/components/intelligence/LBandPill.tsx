import { CSSProperties } from "react";
import { AlertTriangle } from "lucide-react";

export const LBAND_COLORS: Record<string, string> = {
  L4: "#10b981",
  L3: "#3b82f6",
  L2: "#f59e0b",
  L1: "#ef4444",
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "2px 6px",
  borderRadius: 2,
  whiteSpace: "nowrap",
  lineHeight: 1.2,
};

export function LBandPill({
  level,
  stackLayer,
}: {
  level: string | null | undefined;
  stackLayer?: string | null | undefined;
}) {
  const v = String(level ?? "").trim().toUpperCase();
  if (!v || !LBAND_COLORS[v]) {
    return <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>;
  }
  const color = LBAND_COLORS[v];
  const stack = String(stackLayer ?? "").trim().toUpperCase();
  const contradiction = v === "L4" && stack === "COMPONENT";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span
        style={{
          ...pillBase,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          color,
          border: `1px solid color-mix(in srgb, ${color} 50%, transparent)`,
        }}
        title={`Substrate Level ${v}`}
      >
        {v}
      </span>
      {contradiction && (
        <span
          title="L4-Component contradiction — classification audit recommended"
          style={{ display: "inline-flex", color: "#f59e0b" }}
        >
          <AlertTriangle size={11} />
        </span>
      )}
    </span>
  );
}
