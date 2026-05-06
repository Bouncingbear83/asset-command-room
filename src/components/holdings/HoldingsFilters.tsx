import { CSSProperties } from "react";
import { Layers, Tag, AlignJustify, Wallet } from "lucide-react";
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
import { LAYER_VALUES, type Layer } from "@/types/intelligence";
import {
  HOLDINGS_ACCOUNT_VALUES,
  type HoldingsAccount,
  type HoldingsGroupBy,
  type HoldingsSortField,
} from "@/lib/url-state-holdings";

interface AccountCounts {
  SIPP: number;
  ISA: number;
  "SIPP+ISA": number;
}
type LayerCounts = Partial<Record<Layer, number>>;

interface Props {
  accountCounts: AccountCounts;
  actionCounts: Record<string, number>;
  factorCounts: Record<string, number>;
  driverCounts: Record<string, number>;
  stackCounts: Record<string, number>;
  layerCounts: LayerCounts;
  totalPositions: number;
  accountFilter: HoldingsAccount[];
  actionFilter: string[];
  factorFilter: string[];
  driverFilter: string[];
  stackFilter: string[];
  layerFilter: Layer[];
  search: string;
  groupBy: HoldingsGroupBy;
  sortField: HoldingsSortField;
  sortDir: "asc" | "desc";
  onToggleAccount: (a: HoldingsAccount) => void;
  onResetAccount: () => void;
  onToggleAction: (a: string) => void;
  onResetAction: () => void;
  onToggleFactor: (f: string) => void;
  onResetFactor: () => void;
  onToggleDriver: (d: string) => void;
  onResetDriver: () => void;
  onToggleStack: (s: string) => void;
  onResetStack: () => void;
  onToggleLayer: (l: Layer) => void;
  onResetLayer: () => void;
  onSearchChange: (v: string) => void;
  onGroupChange: (g: HoldingsGroupBy) => void;
  onSortChange: (field: HoldingsSortField, dir: "asc" | "desc") => void;
}

const GROUP_OPTIONS: GroupOption<HoldingsGroupBy>[] = [
  { value: "none",    label: "Flat",       Icon: AlignJustify },
  { value: "layer",   label: "By Layer",   Icon: Layers },
  { value: "account", label: "By Account", Icon: Wallet },
  { value: "tier",    label: "By Tier",    Icon: Tag },
];

const SORT_OPTIONS: MobileSortOption<HoldingsSortField>[] = [
  { field: "mv",        dir: "desc", label: "MV £ (high → low)" },
  { field: "mv",        dir: "asc",  label: "MV £ (low → high)" },
  { field: "gl",        dir: "desc", label: "G/L % (high → low)" },
  { field: "gl",        dir: "asc",  label: "G/L % (low → high)" },
  { field: "day",       dir: "desc", label: "Day % (high → low)" },
  { field: "day",       dir: "asc",  label: "Day % (low → high)" },
  { field: "annReturn", dir: "desc", label: "Ann. return (high → low)" },
  { field: "ticker",    dir: "asc",  label: "Ticker (A → Z)" },
  { field: "action",    dir: "asc",  label: "Action" },
  { field: "driver",    dir: "asc",  label: "Driver" },
  { field: "stack",     dir: "asc",  label: "Stack" },
];

const wrapDesktop: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 16px",
  borderBottom: "1px solid var(--rim)",
};

const wrapMobile: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 12px",
  borderBottom: "1px solid var(--rim)",
};

const divider: CSSProperties = {
  height: 1,
  background: "var(--rim)",
  opacity: 0.4,
  margin: "2px 0",
};

/** Display label: underscores → spaces, kept uppercase. */
function displayLabel(v: string): string {
  return v.replace(/_/g, " ");
}

export function HoldingsFilters({
  accountCounts, actionCounts, factorCounts, layerCounts, totalPositions,
  accountFilter, actionFilter, factorFilter, layerFilter, search, groupBy,
  sortField, sortDir,
  onToggleAccount, onResetAccount,
  onToggleAction, onResetAction,
  onToggleFactor, onResetFactor,
  onToggleLayer, onResetLayer,
  onSearchChange, onGroupChange, onSortChange,
}: Props) {
  const allAccountsActive = accountFilter.length === 0;
  const allActionsActive = actionFilter.length === 0;
  const allFactorsActive = factorFilter.length === 0;
  const allLayersActive = layerFilter.length === 0;

  // Sort action / factor chips by count desc for stable, useful ordering.
  const actionEntries = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]);
  const factorEntries = Object.entries(factorCounts).sort((a, b) => b[1] - a[1]);

  const totalActions = actionEntries.reduce((s, [, n]) => s + n, 0);
  const totalFactors = factorEntries.reduce((s, [, n]) => s + n, 0);

  const activeCount =
    (accountFilter.length > 0 ? 1 : 0) +
    (actionFilter.length > 0 ? 1 : 0) +
    (factorFilter.length > 0 ? 1 : 0) +
    (layerFilter.length > 0 ? 1 : 0) +
    (search.trim() ? 1 : 0);

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

  const chipsBlock = (
    <>
      {/* Row 2: account chips */}
      <ChipGroup ariaLabel="Filter by account">
        <Chip
          label="All Accounts"
          count={totalPositions}
          active={allAccountsActive}
          onClick={onResetAccount}
          ariaLabel="Reset account filters"
        />
        {HOLDINGS_ACCOUNT_VALUES.map((a) => (
          <Chip
            key={a}
            label={a}
            count={accountCounts[a]}
            active={!allAccountsActive && accountFilter.includes(a)}
            onClick={() => onToggleAccount(a)}
          />
        ))}
      </ChipGroup>

      {(actionEntries.length > 0 || factorEntries.length > 0) && <div style={divider} />}

      {/* Row 3: action chips — only render if any positions have an ACTION value */}
      {actionEntries.length > 0 && (
        <ChipGroup ariaLabel="Filter by action">
          <Chip
            label="All Actions"
            count={totalActions}
            active={allActionsActive}
            onClick={onResetAction}
            ariaLabel="Reset action filters"
          />
          {actionEntries.map(([value, count]) => (
            <Chip
              key={value}
              label={displayLabel(value)}
              count={count}
              active={!allActionsActive && actionFilter.includes(value)}
              onClick={() => onToggleAction(value)}
            />
          ))}
        </ChipGroup>
      )}

      {/* Row 4: factor chips — only render if any positions have a FACTOR_PRIMARY */}
      {factorEntries.length > 0 && (
        <ChipGroup ariaLabel="Filter by primary factor">
          <Chip
            label="All Factors"
            count={totalFactors}
            active={allFactorsActive}
            onClick={onResetFactor}
            ariaLabel="Reset factor filters"
          />
          {factorEntries.map(([value, count]) => (
            <Chip
              key={value}
              label={displayLabel(value)}
              count={count}
              active={!allFactorsActive && factorFilter.includes(value)}
              onClick={() => onToggleFactor(value)}
            />
          ))}
        </ChipGroup>
      )}

      {(actionEntries.length > 0 || factorEntries.length > 0) && <div style={divider} />}

      {/* Row 5: layer chips */}
      <ChipGroup ariaLabel="Filter by layer">
        <Chip
          label="All Layers"
          active={allLayersActive}
          onClick={onResetLayer}
          ariaLabel="Reset layer filters"
        />
        {LAYER_VALUES.map((l) => (
          <Chip
            key={l}
            label={l}
            count={layerCounts[l]}
            active={!allLayersActive && layerFilter.includes(l)}
            onClick={() => onToggleLayer(l)}
          />
        ))}
      </ChipGroup>
    </>
  );

  return (
    <div style={isMobile ? wrapMobile : wrapDesktop}>
      <FilterDisclosure activeCount={activeCount} alwaysVisible={alwaysVisible}>
        {chipsBlock}
      </FilterDisclosure>
    </div>
  );
}

export default HoldingsFilters;
