import { Layers, Tag, List, AlignJustify, Boxes, Activity } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import type { AssetIntelligence, HeldStatus, Layer } from "@/types/intelligence";
import { HELD_STATUS_VALUES, LAYER_VALUES } from "@/types/intelligence";
import type { GroupBy, SortField, ProfileFilterKey, SubstrateLevel, StackLayerKey, DriverKey } from "@/lib/url-state";
import { PROFILE_FILTER_KEYS, SUBSTRATE_LEVEL_VALUES } from "@/lib/url-state";
import { FACTOR_GROUP_VALUES, STACK_LAYER_VALUES, FACTOR_GROUP_COLORS } from "@/components/holdings/DriverChip";
import { LBAND_COLORS } from "./LBandPill";
import { profileChipStyle, subtypeChipStyle, PROFILE_LABEL } from "./profileChips";

interface Props {
  assets: AssetIntelligence[];
  total: number;
  statusFilter: HeldStatus[];
  layerFilter: Layer[];
  profileFilter: ProfileFilterKey[];
  lbandFilter: SubstrateLevel[];
  stackFilter: StackLayerKey[];
  driverFilter: DriverKey[];
  search: string;
  groupBy: GroupBy;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onToggleStatus: (s: HeldStatus) => void;
  onResetStatus: () => void;
  onToggleLayer: (l: Layer) => void;
  onResetLayer: () => void;
  onToggleProfile: (p: ProfileFilterKey) => void;
  onResetProfile: () => void;
  onToggleLband: (l: SubstrateLevel) => void;
  onResetLband: () => void;
  onToggleStack: (s: StackLayerKey) => void;
  onResetStack: () => void;
  onToggleDriver: (d: DriverKey) => void;
  onResetDriver: () => void;
  onSearchChange: (v: string) => void;
  onGroupChange: (g: GroupBy) => void;
  onSortChange: (field: SortField, dir: "asc" | "desc") => void;
}

const GROUP_OPTIONS: GroupOption<GroupBy>[] = [
  { value: "none",   label: "Flat",       Icon: AlignJustify },
  { value: "layer",  label: "By Layer",   Icon: Layers },
  { value: "status", label: "By Status",  Icon: List },
  { value: "tier",   label: "By Tier",    Icon: Tag },
  { value: "driver", label: "By Driver",  Icon: Boxes },
  { value: "lband",  label: "By L-band",  Icon: Activity },
];

const SORT_OPTIONS: MobileSortOption<SortField>[] = [
  { field: "score",        dir: "desc", label: "Score (high → low)" },
  { field: "score",        dir: "asc",  label: "Score (low → high)" },
  { field: "ticker",       dir: "asc",  label: "Ticker (A → Z)" },
  { field: "ticker",       dir: "desc", label: "Ticker (Z → A)" },
  { field: "layer",        dir: "asc",  label: "Layer" },
  { field: "lband",        dir: "desc", label: "L-band (L4 → L1)" },
  { field: "lband",        dir: "asc",  label: "L-band (L1 → L4)" },
  { field: "stack",        dir: "asc",  label: "Stack (component → foundry)" },
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
  onToggleProfile,
  onResetProfile,
  onToggleLband,
  onResetLband,
  onToggleStack,
  onResetStack,
  onToggleDriver,
  onResetDriver,
  onSearchChange,
  onGroupChange,
  onSortChange,
  profileFilter,
  lbandFilter,
  stackFilter,
  driverFilter,
}: Props) {
  // Counts always on full set so users can see distribution regardless of active filters.
  const statusCounts: Record<HeldStatus, number> = {
    HELD: 0, WATCHLIST: 0, RESEARCH: 0, PRE_IPO: 0, REJECTED: 0, EXITED: 0, DORMANT: 0,
  };
  for (const a of assets) statusCounts[a.held_status]++;

  // Profile counts (held positions only — RETURN_PROFILE is meaningless for unheld)
  const profileCounts: Record<ProfileFilterKey, number> = {
    STELLAR_COMPOUNDER: 0, GENERIC_COMPOUNDER: 0, RECLASSIFICATION: 0,
    CYCLE: 0, HEDGE: 0, VEHICLE: 0, PRE_PRODUCTION: 0,
  };
  for (const a of assets) {
    if (!a.return_profile) continue;
    if (a.return_profile === "COMPOUNDER") {
      if (a.compounder_subtype === "STELLAR_COMPOUNDER") profileCounts.STELLAR_COMPOUNDER++;
      else if (a.compounder_subtype === "GENERIC_COMPOUNDER") profileCounts.GENERIC_COMPOUNDER++;
    } else if (a.return_profile !== "CASH") {
      profileCounts[a.return_profile as ProfileFilterKey]++;
    }
  }

  // L-band counts
  const lbandCounts: Record<SubstrateLevel, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const a of assets) {
    if (a.substrate_level) lbandCounts[a.substrate_level]++;
  }
  // Stack counts
  const stackCounts = new Map<string, number>();
  for (const a of assets) {
    if (a.stack_layer) stackCounts.set(a.stack_layer, (stackCounts.get(a.stack_layer) ?? 0) + 1);
  }
  // Driver counts (from joined factor_group on HELD rows)
  const driverCounts = new Map<string, number>();
  for (const a of assets) {
    if (a.factor_group) driverCounts.set(a.factor_group, (driverCounts.get(a.factor_group) ?? 0) + 1);
  }

  const layersInUse = new Set(assets.map((a) => a.layer).filter((l): l is Layer => l !== null));
  const allStatusesActive = statusFilter.length === 0;
  const allLayersActive = layerFilter.length === 0;
  const allProfilesActive = profileFilter.length === 0;
  const allLbandActive = lbandFilter.length === 0;
  const allStackActive = stackFilter.length === 0;
  const allDriverActive = driverFilter.length === 0;

  const activeCount =
    (statusFilter.length > 0 ? 1 : 0) +
    (layerFilter.length > 0 ? 1 : 0) +
    (profileFilter.length > 0 ? 1 : 0) +
    (lbandFilter.length > 0 ? 1 : 0) +
    (stackFilter.length > 0 ? 1 : 0) +
    (driverFilter.length > 0 ? 1 : 0) +
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

      {/* Row 4: profile chips (Stellar Doctrine v2.4) */}
      <ChipGroup ariaLabel="Filter by return profile">
        <Chip
          label="All Profiles"
          active={allProfilesActive}
          onClick={onResetProfile}
          ariaLabel="Reset profile filters"
        />
        {PROFILE_FILTER_KEYS.map((p) => {
          const isActive = !allProfilesActive && profileFilter.includes(p);
          // Derive colored swatch using profile palette
          const labelText =
            p === "STELLAR_COMPOUNDER" ? "Stellar Comp"
            : p === "GENERIC_COMPOUNDER" ? "Generic Comp"
            : PROFILE_LABEL[p as keyof typeof PROFILE_LABEL] ?? p;
          // colour swatch
          const swatchStyle =
            p === "STELLAR_COMPOUNDER" ? subtypeChipStyle("STELLAR_COMPOUNDER")
            : p === "GENERIC_COMPOUNDER" ? subtypeChipStyle("GENERIC_COMPOUNDER")
            : profileChipStyle(p as never);
          const swatch = (
            <span style={{
              display: "inline-block",
              width: 8, height: 8, borderRadius: 2, marginRight: 2,
              background: swatchStyle.background as string,
              border: `1px solid ${swatchStyle.border as string}`,
            }} aria-hidden />
          );
          return (
            <Chip
              key={p}
              label={labelText}
              count={profileCounts[p]}
              active={isActive}
              onClick={() => onToggleProfile(p)}
              ariaLabel={`Filter ${labelText}`}
              icon={swatch}
            />
          );
        })}
      </ChipGroup>

      {/* Row 5: L-band chips (v2.5) */}
      <ChipGroup ariaLabel="Filter by L-band substrate level">
        <Chip label="All L-bands" active={allLbandActive} onClick={onResetLband} ariaLabel="Reset L-band filters" />
        {SUBSTRATE_LEVEL_VALUES.map((l) => {
          const color = LBAND_COLORS[l];
          const swatch = (
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, marginRight: 2,
              background: `color-mix(in srgb, ${color} 35%, transparent)`, border: `1px solid ${color}` }} aria-hidden />
          );
          return (
            <Chip key={l} label={l} count={lbandCounts[l]}
              active={!allLbandActive && lbandFilter.includes(l)}
              onClick={() => onToggleLband(l)} icon={swatch} />
          );
        })}
      </ChipGroup>

      {/* Row 6: Stack layer chips */}
      <ChipGroup ariaLabel="Filter by stack layer">
        <Chip label="All Stack" active={allStackActive} onClick={onResetStack} ariaLabel="Reset stack filters" />
        {STACK_LAYER_VALUES.filter((s) => s !== "N/A").map((s) => (
          <Chip key={s} label={s.replace(/_/g, " ")} count={stackCounts.get(s) ?? 0}
            active={!allStackActive && stackFilter.includes(s)}
            onClick={() => onToggleStack(s)} />
        ))}
      </ChipGroup>

      {/* Row 7: Driver (FACTOR_GROUP) chips */}
      <ChipGroup ariaLabel="Filter by driver">
        <Chip label="All Drivers" active={allDriverActive} onClick={onResetDriver} ariaLabel="Reset driver filters" />
        {FACTOR_GROUP_VALUES.map((d) => {
          const color = FACTOR_GROUP_COLORS[d];
          const swatch = (
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, marginRight: 2,
              background: `color-mix(in srgb, ${color} 30%, transparent)`, border: `1px solid ${color}` }} aria-hidden />
          );
          return (
            <Chip key={d} label={d.replace(/_/g, " ")} count={driverCounts.get(d) ?? 0}
              active={!allDriverActive && driverFilter.includes(d)}
              onClick={() => onToggleDriver(d)} icon={swatch} />
          );
        })}
      </ChipGroup>
    </>
  );

  const isMobile = useIsMobile();

  const alwaysVisible = isMobile ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SearchBox value={search} onChange={onSearchChange} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MobileSortSelect
            options={SORT_OPTIONS}
            field={sortField}
            dir={sortDir}
            onChange={onSortChange}
          />
        </div>
        <GroupToggle options={GROUP_OPTIONS} value={groupBy} onChange={onGroupChange} />
      </div>
    </div>
  ) : (
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? 6 : 10,
        padding: isMobile ? "8px 12px" : "12px 16px",
        borderBottom: "1px solid var(--rim)",
      }}
    >
      <FilterDisclosure activeCount={activeCount} alwaysVisible={alwaysVisible}>
        {chipsBlock}
      </FilterDisclosure>
    </div>
  );
}

export default IntelligenceFilters;
