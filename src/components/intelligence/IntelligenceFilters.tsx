import { Layers, Tag, List, AlignJustify } from "lucide-react";
import {
  Chip,
  ChipGroup,
  SearchBox,
  GroupToggle,
  type GroupOption,
} from "@/components/shared/filters";
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

const GROUP_OPTIONS: GroupOption<GroupBy>[] = [
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
  const allStatusesActive = statusFilter.length === 0;
  const allLayersActive = layerFilter.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--rim)" }}>
      {/* Row 1: search + grouping */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <SearchBox value={search} onChange={onSearchChange} />
        <div style={{ marginLeft: "auto" }}>
          <GroupToggle options={GROUP_OPTIONS} value={groupBy} onChange={onGroupChange} />
        </div>
      </div>

      {/* Row 2: status chips */}
      <ChipGroup ariaLabel="Filter by held status">
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
      </ChipGroup>

      {/* Row 3: layer chips */}
      <ChipGroup ariaLabel="Filter by layer">
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
      </ChipGroup>
    </div>
  );
}

export default IntelligenceFilters;
