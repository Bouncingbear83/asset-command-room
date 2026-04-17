import { CSSProperties, ReactNode, useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Mobile-only collapse-behind-toggle wrapper. On desktop, renders children
 * inline (zero overhead). On mobile, hides children behind a "Filters (N)"
 * disclosure button so multi-row chip strips don't dominate the viewport.
 */

interface Props {
  children: ReactNode;
  /** Number of currently active filter dimensions, surfaced in the toggle. */
  activeCount?: number;
  /** Optional label override. */
  label?: string;
  /** Always-visible content (e.g. search box, sort select) rendered above the toggle. */
  alwaysVisible?: ReactNode;
}

const toggleBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  padding: "6px 12px",
  border: "1px solid var(--rim)",
  background: "transparent",
  color: "var(--text-mid)",
  borderRadius: 2,
  cursor: "pointer",
};

const toggleBtnActive: CSSProperties = {
  background: "var(--gold-dim, rgba(201,168,76,0.12))",
  color: "var(--gold)",
  borderColor: "rgba(201,168,76,0.4)",
};

export function FilterDisclosure({ children, activeCount = 0, label = "Filters", alwaysVisible }: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    // Desktop: render children directly, alwaysVisible is hoisted before them.
    return (
      <>
        {alwaysVisible}
        {children}
      </>
    );
  }

  return (
    <>
      {alwaysVisible}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ ...toggleBtn, ...(activeCount > 0 ? toggleBtnActive : null), alignSelf: "flex-start" }}
      >
        <SlidersHorizontal size={12} />
        <span>{label}{activeCount > 0 ? ` (${activeCount})` : ""}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && children}
    </>
  );
}

export default FilterDisclosure;
