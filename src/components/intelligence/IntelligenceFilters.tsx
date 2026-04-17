import { Layers, Tag, List, AlignJustify } from "lucide-react";
import {
  Chip,
  ChipGroup,
  SearchBox,
  GroupToggle,
  FilterDisclosure,
  MobileSortSelect,
  type GroupOption,
  type MobileSortOption,
} from "@/components/shared/filters";
import type { AssetIntelligence, HeldStatus, Layer } from "@/types/intelligence";
import { HELD_STATUS_VALUES, LAYER_VALUES } from "@/types/intelligence";
import type { GroupBy, SortField } from "@/lib/url-state";

interface Props {
  assets: AssetIntelligence[];
  total: number;
  statusFilter: HeldStatus[];
  layerFilter: Layer[];
  search: string;
  groupBy: GroupBy;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onToggleStatus: (s: HeldStatus) => void;
  onResetStatus: () => void;
  onToggleLayer: (l: Layer) => void;
  onResetLayer: () => void;
  onSearchChange: (v: string) => void;
  onGroupChange: (g: GroupBy) => void;
  onSortChange: (field: SortField, dir: "asc" | "desc") => void;
}

const GROUP_OPTIONS: GroupOption<GroupBy>[] = [
  { value: "none",   label: "Flat",       Icon: AlignJustify },
  { value: "layer",  label: "By Layer",   Icon: Layers },
  { value: "status", label: "By Status",  Icon: List },
  { value: "tier",   label: "By Tier",    Icon: Tag },
];

const SORT_OPTIONS: MobileSortOption<SortField>[] = [
  { field: "score",        dir: "desc", label: "Score (high → low)" },
  { field: "score",        dir: "asc",  label: "Score (low → high)" },
  { field: "ticker",       dir: "asc",  label: "Ticker (A → Z)" },
  { field: "ticker",       dir: "desc", label: "Ticker (Z → A)" },
  { field: "layer",        dir: "asc",  label: "Layer" },
  { field: "disruption",   dir: "desc", label: "Disruption (high → low)" },
  { field: "buy_distance", dir: "asc",  label: "Buy distance (closest)" },
];

export function IntelligenceFilters({
  assets,
  total,
  statusFilter,
  layerFilter,
  search,
  groupBy,
  sortField,
  sortDir,
  onToggleStatus,
  onResetStatus,
  onToggleLayer,
  onResetLayer,
  onSearchChange,
  onGroupChange,
  onSortChange,
}: Props) {
  // Counts always on full set so users can see distribution regardless of active filters.
  const statusCounts: Record<HeldStatus, number> = {
    HELD: 0, WATCHLIST: 0, RESEARCH: 0, PRE_IPO: 0, REJECTED: 0, EXITED: 0,
  };
  for (const a of assets) statusCounts[a.held_status]++;

  const layersInUse = new Set(assets.map((a) => a.layer).filter((l): l is Layer => l !== null));
  const allStatusesActive = statusFilter.length === 0;
  const allLayersActive = layerFilter.length === 0;

  const activeCount =
    (statusFilter.length > 0 ? 1 : 0) +
    (layerFilter.length > 0 ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const chipsBlock = (
    <>
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
    </>
  );

  const alwaysVisible = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <SearchBox value={search} onChange={onSearchChange} />
      <MobileSortSelect
        options={SORT_OPTIONS}
        field={sortField}
        dir={sortDir}
        onChange={onSortChange}
      />
      <div style={{ marginLeft: "auto" }}>
        <GroupToggle options={GROUP_OPTIONS} value={groupBy} onChange={onGroupChange} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--rim)" }}>
      <FilterDisclosure activeCount={activeCount} alwaysVisible={alwaysVisible}>
        {chipsBlock}
      </FilterDisclosure>
    </div>
  );
}

export default IntelligenceFilters;
