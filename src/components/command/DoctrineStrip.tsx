import { useState } from "react";
import type { DoctrineChip, Rag } from "@/lib/actionSurface";
import { openDoctrineLink } from "@/lib/navigate";

/** Doctrine strip — one RAG chip per check, collapsed to “N/M green” when all green. Display only. */
const RAG: Record<Rag, { color: string; bg: string; dot: string }> = {
  GREEN: { color: "var(--green)", bg: "var(--green-dim)", dot: "●" },
  AMBER: { color: "var(--amber)", bg: "var(--amber-dim)", dot: "●" },
  RED: { color: "var(--red)", bg: "var(--red-dim)", dot: "●" },
  GREY: { color: "var(--text-dim)", bg: "transparent", dot: "○" },
};

const chipBase: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 2,
  whiteSpace: "nowrap", cursor: "pointer", border: "1px solid var(--rim)", textTransform: "uppercase",
};

export default function DoctrineStrip({ chips, isMobile }: { chips: DoctrineChip[]; isMobile: boolean }) {
  const green = chips.filter((c) => c.rag === "GREEN").length;
  const allGreen = chips.length > 0 && green === chips.length;
  const [expanded, setExpanded] = useState(false);
  const showChips = !allGreen || expanded;

  return (
    <div
      aria-label="Doctrine checks"
      style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        padding: isMobile ? "8px 12px" : "8px 16px", marginTop: -12, marginBottom: 16,
        background: "var(--panel)", border: "1px solid var(--rim)", borderTop: "none",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "var(--text-dim)", marginRight: 4 }}>DOCTRINE</span>
      {allGreen && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ ...chipBase, color: "var(--green)", background: "var(--green-dim)" }}
          title={expanded ? "Collapse" : "Show each check"}
        >
          {green}/{chips.length} green {expanded ? "▾" : "▸"}
        </button>
      )}
      {showChips && chips.map((c) => {
        const r = RAG[c.rag];
        return (
          <button
            key={c.id}
            onClick={() => openDoctrineLink(c.link)}
            title={c.detail}
            style={{ ...chipBase, color: r.color, background: r.bg, borderColor: `color-mix(in srgb, ${r.color} 30%, transparent)` }}
          >
            {r.dot} {c.label}
          </button>
        );
      })}
      {!allGreen && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginLeft: "auto" }}>{green}/{chips.length} green</span>
      )}
    </div>
  );
}
