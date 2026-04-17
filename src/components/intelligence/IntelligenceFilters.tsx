import { CSSProperties } from "react";
import { Search, Layers, Tag, List, AlignJustify } from "lucide-react";
import type { AssetIntelligence, HeldStatus, Layer } from "@/types/intelligence";
import { HELD_STATUS_VALUES, LAYER_VALUES } from "@/types/intelligence";
import type { GroupBy } from "@/lib/url-state";

interface Props {
  assets: AssetIntelligence[];
  total: number;
  statusFilter: HeldStatus[];
  layerFilter: Layer[];
  search: string;
  groupBy: GroupBy;
  onToggleStatus: (s: HeldStatus) => void;
  onResetStatus: () => void;
  onToggleLayer: (l: Layer) => void;
  onResetLayer: () => void;
  onSearchChange: (v: string) => void;
  onGroupChange: (g: GroupBy) => void;
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

function Chip({
  label,
  count,
  active,
  onClick,
  ariaLabel,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      style={{ ...chipBase, ...(active ? chipActive : null) }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span style={{ color: active ? "var(--gold)" : "var(--text-mid)", fontSize: 10 }}>{count}</span>
      )}
    </button>
  );
}

const GROUP_OPTIONS: { value: GroupBy; label: string; Icon: typeof Layers }[] = [
  { value: "none",   label: "Flat",       Icon: AlignJustify },
  { value: "layer",  label: "By Layer",   Icon: Layers },
  { value: "status", label: "By Status",  Icon: List },
  { value: "tier",   label: "By Tier",    Icon: Tag },
];

export function IntelligenceFilters({
  assets,
  total,
  statusFilter,
  layerFilter,
  search,
  groupBy,
  onToggleStatus,
  onResetStatus,
  onToggleLayer,
  onResetLayer,
  onSearchChange,
  onGroupChange,
}: Props) {
  // Counts always on full set so users can see distribution regardless of active filters.
  const statusCounts: Record<HeldStatus, number> = {
    HELD: 0, WATCHLIST: 0, RESEARCH: 0, PRE_IPO: 0, REJECTED: 0, EXITED: 0,
  };
  for (const a of assets) statusCounts[a.held_status]++;

  const layersInUse = new Set(assets.map((a) => a.layer).filter((l): l is Layer => l !== null));
  // Empty arrays mean "all on" semantically.
  const allStatusesActive = statusFilter.length === 0;
  const allLayersActive = layerFilter.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--rim)" }}>
      {/* Row 1: search + grouping */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search ticker or name…"
            style={{
              width: "100%",
              padding: "6px 8px 6px 26px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--rim)",
              color: "var(--text-mid)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              borderRadius: 2,
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }} role="group" aria-label="Group by">
          {GROUP_OPTIONS.map(({ value, label, Icon }) => {
            const active = groupBy === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onGroupChange(value)}
                title={label}
                style={{ ...chipBase, ...(active ? chipActive : null), padding: "5px 10px" }}
              >
                <Icon size={12} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: status chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
        <Chip
          label="Scored"
          count={total}
          active={allStatusesActive}
          onClick={onResetStatus}
          ariaLabel="Reset status filters"
        />
        {HELD_STATUS_VALUES.map((s) => (
          <Chip
            key={s}
            label={s.replace("_", " ")}
            count={statusCounts[s]}
            active={!allStatusesActive && statusFilter.includes(s)}
            onClick={() => onToggleStatus(s)}
          />
        ))}
      </div>

      {/* Row 3: layer chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
        <Chip
          label="All Layers"
          active={allLayersActive}
          onClick={onResetLayer}
          ariaLabel="Reset layer filters"
        />
        {LAYER_VALUES.map((l) => {
          const present = layersInUse.has(l);
          return (
            <Chip
              key={l}
              label={l}
              active={!allLayersActive && layerFilter.includes(l)}
              onClick={() => onToggleLayer(l)}
              ariaLabel={`Filter ${l}${present ? "" : " (no assets)"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default IntelligenceFilters;
