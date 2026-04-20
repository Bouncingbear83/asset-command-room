import { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Generic group-by toggle row. Caller supplies the typed value list and the
 * active value; this component just renders chips and forwards changes.
 *
 * On mobile (≤767px): icon-only chips with title tooltips to save horizontal
 * space. Desktop keeps icon + label.
 */

export interface GroupOption<T extends string> {
  value: T;
  label: string;
  Icon: LucideIcon;
}

interface Props<T extends string> {
  options: GroupOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
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

const chipBaseMobile: CSSProperties = {
  ...chipBase,
  padding: "5px 7px",
  gap: 0,
};

const chipActive: CSSProperties = {
  background: "var(--gold-dim, rgba(201,168,76,0.12))",
  color: "var(--gold)",
  borderColor: "rgba(201,168,76,0.4)",
};

export function GroupToggle<T extends string>({ options, value, onChange, ariaLabel = "Group by" }: Props<T>) {
  const isMobile = useIsMobile();
  const base = isMobile ? chipBaseMobile : chipBase;
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: "flex", gap: isMobile ? 4 : 6 }}>
      {options.map(({ value: v, label, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            aria-label={label}
            onClick={() => onChange(v)}
            title={label}
            style={{ ...base, ...(active ? chipActive : null) }}
          >
            <Icon size={12} />
            {!isMobile && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default GroupToggle;
