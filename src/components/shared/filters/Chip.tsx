import { CSSProperties, ReactNode } from "react";

/**
 * Atomic filter chip — uppercase mono pill with optional count badge and
 * active state. Shared by Intelligence and Holdings filter bars.
 *
 * Visual grammar:
 *   - Inactive: transparent bg, dim text, rim border
 *   - Active:   gold-dim bg, gold text, gold border
 */

export interface ChipProps {
  label: ReactNode;
  count?: number;
  active: boolean;
  onClick: () => void;
  ariaLabel?: string;
  /** Override colour palette (e.g. red for "alerts" reset). */
  variant?: "default" | "danger";
  /** Inline icon, rendered before the label. */
  icon?: ReactNode;
}

const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "5px 10px",
  border: "1px solid var(--rim)",
  background: "transparent",
  color: "var(--text-dim)",
  borderRadius: 2,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
};

const chipActive: CSSProperties = {
  background: "var(--gold-dim, rgba(201,168,76,0.12))",
  color: "var(--gold)",
  borderColor: "rgba(201,168,76,0.4)",
};

const chipActiveDanger: CSSProperties = {
  background: "var(--red-dim)",
  color: "var(--red)",
  borderColor: "rgba(200,90,90,0.4)",
};

export function Chip({ label, count, active, onClick, ariaLabel, variant = "default", icon }: ChipProps) {
  const activeStyle = variant === "danger" ? chipActiveDanger : chipActive;
  const labelStr = typeof label === "string" ? label : "chip";
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel ?? labelStr}
      onClick={onClick}
      style={{ ...chipBase, ...(active ? activeStyle : null) }}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span style={{ color: active ? (variant === "danger" ? "var(--red)" : "var(--gold)") : "var(--text-mid)", fontSize: 10 }}>
          {count}
        </span>
      )}
    </button>
  );
}

export default Chip;
