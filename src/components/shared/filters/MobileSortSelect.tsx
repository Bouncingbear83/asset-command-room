import { CSSProperties, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Native <select>-based sort control for compact viewports. Renders nothing
 * above the breakpoint — wider screens use sortable column headers. Each
 * option encodes both field and direction so users can pick e.g. "Score ↓"
 * vs "Score ↑" in one tap. Default breakpoint follows useIsMobile (768px);
 * pass `maxWidth` to override (e.g. 900 for tabs that need more room).
 */

export interface MobileSortOption<T extends string> {
  field: T;
  dir: "asc" | "desc";
  label: string;
}

interface Props<T extends string> {
  options: MobileSortOption<T>[];
  field: T;
  dir: "asc" | "desc";
  onChange: (field: T, dir: "asc" | "desc") => void;
  /** Show dropdown when viewport ≤ this width (px). Defaults to mobile (768). */
  maxWidth?: number;
}

const wrap: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
};

const select: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "5px 8px",
  background: "var(--panel)",
  color: "var(--text-mid)",
  border: "1px solid var(--rim)",
  borderRadius: 2,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: 24,
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4 L5 7 L8 4' stroke='%238a8a9a' stroke-width='1.2' fill='none'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
};

function encode<T extends string>(field: T, dir: "asc" | "desc"): string {
  return `${field}:${dir}`;
}

export function MobileSortSelect<T extends string>({ options, field, dir, onChange, maxWidth }: Props<T>) {
  const isMobileDefault = useIsMobile();
  const [show, setShow] = useState<boolean>(() => {
    if (maxWidth === undefined) return isMobileDefault;
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    if (maxWidth === undefined) {
      setShow(isMobileDefault);
      return;
    }
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = () => setShow(mql.matches);
    mql.addEventListener("change", onChange);
    setShow(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [maxWidth, isMobileDefault]);

  if (!show) return null;

  const current = encode(field, dir);
  return (
    <label style={wrap}>
      <span>Sort</span>
      <select
        style={select}
        value={current}
        onChange={(e) => {
          const [f, d] = e.target.value.split(":");
          onChange(f as T, (d as "asc" | "desc"));
        }}
      >
        {options.map((o) => (
          <option key={encode(o.field, o.dir)} value={encode(o.field, o.dir)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default MobileSortSelect;
