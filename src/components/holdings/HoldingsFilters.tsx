import { CSSProperties, useState } from "react";
import { Layers, Tag, AlignJustify, Wallet, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { FRAMEWORK_TAGS, FRAMEWORK_COLOR, type FrameworkTag } from "@/utils/frameworkDetection";
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
  frameworkCounts: Record<string, number>;
  layerCounts: LayerCounts;
  totalPositions: number;
  accountFilter: HoldingsAccount[];
  actionFilter: string[];
  factorFilter: string[];
  driverFilter: string[];
  stackFilter: string[];
  frameworkFilter: string[];
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
  onToggleFramework: (f: string) => void;
  onResetFramework: () => void;
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

/** Display label: underscores → spaces, kept uppercase. */
function displayLabel(v: string): string {
  return v.replace(/_/g, " ");
}

/* ── Secondary-filter disclosure toggle (desktop + mobile) ────────── */
const disclosureBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.12em",
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

const disclosureBtnActive: CSSProperties = {
  background: "var(--gold-dim, rgba(201,168,76,0.12))",
  color: "var(--gold)",
  borderColor: "rgba(201,168,76,0.4)",
};

const divider: CSSProperties = {
  height: 1,
  background: "var(--rim)",
  opacity: 0.4,
  margin: "2px 0",
};

export function HoldingsFilters({
  accountCounts, actionCounts, factorCounts, driverCounts, stackCounts, layerCounts, totalPositions,
  accountFilter, actionFilter, factorFilter, driverFilter, stackFilter, layerFilter, search, groupBy,
  sortField, sortDir,
  onToggleAccount, onResetAccount,
  onToggleAction, onResetAction,
  onToggleFactor, onResetFactor,
  onToggleDriver, onResetDriver,
  onToggleStack, onResetStack,
  onToggleFramework, onResetFramework,
  onToggleLayer, onResetLayer,
  onSearchChange, onGroupChange, onSortChange,
  frameworkCounts, frameworkFilter,
}: Props) {
  const isMobile = useIsMobile();
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const allAccountsActive = accountFilter.length === 0;
  const allActionsActive = actionFilter.length === 0;
  const allFactorsActive = factorFilter.length === 0;
  const allDriversActive = driverFilter.length === 0;
  const allStacksActive = stackFilter.length === 0;
  const allFrameworksActive = frameworkFilter.length === 0;
  const allLayersActive = layerFilter.length === 0;

  const frameworkEntries = Object.entries(frameworkCounts).filter(([, c]) => c > 0).sort(
    ([a], [b]) => (FRAMEWORK_TAGS as readonly string[]).indexOf(a) - (FRAMEWORK_TAGS as readonly string[]).indexOf(b)
  );
  const totalFrameworks = frameworkEntries.reduce((s, [, c]) => s + c, 0);

  const actionEntries = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]);
  const factorEntries = Object.entries(factorCounts).sort((a, b) => b[1] - a[1]);
  const driverEntries = Object.entries(driverCounts).sort((a, b) => b[1] - a[1]);
  const stackEntries = Object.entries(stackCounts).sort((a, b) => b[1] - a[1]);

  const totalActions = actionEntries.reduce((s, [, n]) => s + n, 0);
  const totalFactors = factorEntries.reduce((s, [, n]) => s + n, 0);
  const totalDrivers = driverEntries.reduce((s, [, n]) => s + n, 0);
  const totalStacks  = stackEntries.reduce((s, [, n]) => s + n, 0);

  // Count of active primary + secondary filter dimensions (for mobile disclosure)
  const primaryActiveCount =
    (accountFilter.length > 0 ? 1 : 0) +
    (actionFilter.length > 0 ? 1 : 0) +
    (layerFilter.length > 0 ? 1 : 0) +
    (search.trim() ? 1 : 0);

  // Count of active secondary (taxonomy) filter dimensions
  const secondaryActiveCount =
    (factorFilter.length > 0 ? 1 : 0) +
    (driverFilter.length > 0 ? 1 : 0) +
    (stackFilter.length > 0 ? 1 : 0) +
    (frameworkFilter.length > 0 ? 1 : 0);

  const hasSecondaryFilters =
    factorEntries.length > 0 || driverEntries.length > 0 ||
    stackEntries.length > 0 || frameworkEntries.length > 0;

  const totalActiveCount = primaryActiveCount + secondaryActiveCount;

  /* ── Always-visible row: search + sort + group toggle ──────────── */
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

  /* ── Tier 1: primary filters (always visible on desktop) ───────── */
  const primaryChips = (
    <>
      {/* Account */}
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

      {/* Action */}
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

      {/* Layer */}
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

  /* ── Tier 2: taxonomy filters (collapsible) ────────────────────── */
  const secondaryChips = (
    <>
      {/* Factor */}
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

      {/* Driver */}
      {driverEntries.length > 0 && (
        <ChipGroup ariaLabel="Filter by driver">
          <Chip
            label="All Drivers"
            count={totalDrivers}
            active={allDriversActive}
            onClick={onResetDriver}
            ariaLabel="Reset driver filters"
          />
          {driverEntries.map(([value, count]) => (
            <Chip
              key={value}
              label={displayLabel(value)}
              count={count}
              active={!allDriversActive && driverFilter.includes(value)}
              onClick={() => onToggleDriver(value)}
            />
          ))}
        </ChipGroup>
      )}

      {/* Stack */}
      {stackEntries.length > 0 && (
        <ChipGroup ariaLabel="Filter by stack layer">
          <Chip
            label="All Stack"
            count={totalStacks}
            active={allStacksActive}
            onClick={onResetStack}
            ariaLabel="Reset stack filters"
          />
          {stackEntries.map(([value, count]) => (
            <Chip
              key={value}
              label={displayLabel(value)}
              count={count}
              active={!allStacksActive && stackFilter.includes(value)}
              onClick={() => onToggleStack(value)}
            />
          ))}
        </ChipGroup>
      )}

      {/* Framework */}
      {frameworkEntries.length > 0 && (
        <ChipGroup ariaLabel="Filter by framework">
          <Chip
            label="All Frameworks"
            count={totalFrameworks}
            active={allFrameworksActive}
            onClick={onResetFramework}
            ariaLabel="Reset framework filters"
          />
          {frameworkEntries.map(([value, count]) => {
            const color = FRAMEWORK_COLOR[value as FrameworkTag];
            const swatch = color ? (
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, marginRight: 2,
                background: `color-mix(in srgb, ${color} 30%, transparent)`, border: `1px solid ${color}` }} aria-hidden />
            ) : null;
            return (
              <Chip
                key={value}
                label={value}
                count={count}
                active={!allFrameworksActive && frameworkFilter.includes(value)}
                onClick={() => onToggleFramework(value)}
                icon={swatch}
              />
            );
          })}
        </ChipGroup>
      )}
    </>
  );

  /* ── Desktop disclosure toggle for secondary filters ───────────── */
  const secondaryDisclosureToggle = hasSecondaryFilters ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={divider} />
      <button
        type="button"
        aria-expanded={secondaryOpen}
        onClick={() => setSecondaryOpen((o) => !o)}
        style={{
          ...disclosureBtn,
          ...(secondaryActiveCount > 0 || secondaryOpen ? disclosureBtnActive : null),
          alignSelf: "flex-start",
        }}
      >
        <SlidersHorizontal size={11} />
        <span>
          {secondaryActiveCount > 0
            ? `Classification (${secondaryActiveCount} active)`
            : "Classification"}
        </span>
        {secondaryOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
    </div>
  ) : null;

  return (
    <div style={isMobile ? wrapMobile : wrapDesktop}>
      <FilterDisclosure activeCount={totalActiveCount} alwaysVisible={alwaysVisible}>
        {primaryChips}
        {secondaryDisclosureToggle}
        {secondaryOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 6 : 10 }}>
            {secondaryChips}
          </div>
        )}
      </FilterDisclosure>
    </div>
  );
}

export default HoldingsFilters;
