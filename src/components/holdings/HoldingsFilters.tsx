import { CSSProperties } from "react";
import { Layers, Tag, List, AlignJustify, Wallet } from "lucide-react";
import {
  Chip,
  ChipGroup,
  SearchBox,
  GroupToggle,
  type GroupOption,
} from "@/components/shared/filters";
import { LAYER_VALUES, type Layer } from "@/types/intelligence";
import {
  ALERT_STATUS_VALUES,
  HOLDINGS_ACCOUNT_VALUES,
  type HoldingsAccount,
  type HoldingsAlertStatus,
  type HoldingsGroupBy,
} from "@/lib/url-state-holdings";

interface AccountCounts {
  SIPP: number;
  ISA: number;
  "SIPP+ISA": number;
}
type AlertCounts = Record<HoldingsAlertStatus, number>;
type LayerCounts = Partial<Record<Layer, number>>;

interface Props {
  accountCounts: AccountCounts;
  alertCounts: AlertCounts;
  layerCounts: LayerCounts;
  totalPositions: number;
  accountFilter: HoldingsAccount[];
  alertFilter: HoldingsAlertStatus[];
  layerFilter: Layer[];
  search: string;
  groupBy: HoldingsGroupBy;
  onToggleAccount: (a: HoldingsAccount) => void;
  onResetAccount: () => void;
  onToggleAlert: (a: HoldingsAlertStatus) => void;
  onResetAlert: () => void;
  onToggleLayer: (l: Layer) => void;
  onResetLayer: () => void;
  onSearchChange: (v: string) => void;
  onGroupChange: (g: HoldingsGroupBy) => void;
}

const GROUP_OPTIONS: GroupOption<HoldingsGroupBy>[] = [
  { value: "none",    label: "Flat",       Icon: AlignJustify },
  { value: "layer",   label: "By Layer",   Icon: Layers },
  { value: "account", label: "By Account", Icon: Wallet },
  { value: "tier",    label: "By Tier",    Icon: Tag },
];

const wrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 16px",
  borderBottom: "1px solid var(--rim)",
};

export function HoldingsFilters({
  accountCounts, alertCounts, layerCounts, totalPositions,
  accountFilter, alertFilter, layerFilter, search, groupBy,
  onToggleAccount, onResetAccount,
  onToggleAlert, onResetAlert,
  onToggleLayer, onResetLayer,
  onSearchChange, onGroupChange,
}: Props) {
  const allAccountsActive = accountFilter.length === 0;
  const allAlertsActive = alertFilter.length === 0;
  const allLayersActive = layerFilter.length === 0;

  return (
    <div style={wrap}>
      {/* Row 1: search + group toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <SearchBox value={search} onChange={onSearchChange} />
        <div style={{ marginLeft: "auto" }}>
          <GroupToggle options={GROUP_OPTIONS} value={groupBy} onChange={onGroupChange} />
        </div>
      </div>

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

      {/* Row 3: alert chips — only meaningful if any non-CLEAR alerts present */}
      <ChipGroup ariaLabel="Filter by alert status">
        <Chip
          label="All Alerts"
          active={allAlertsActive}
          onClick={onResetAlert}
          ariaLabel="Reset alert filters"
        />
        {ALERT_STATUS_VALUES.map((s) => (
          <Chip
            key={s}
            label={s.replace("_", " ")}
            count={alertCounts[s]}
            active={!allAlertsActive && alertFilter.includes(s)}
            onClick={() => onToggleAlert(s)}
            variant={s === "EXIT_ZONE" || s === "REVIEW" ? "danger" : "default"}
          />
        ))}
      </ChipGroup>

      {/* Row 4: layer chips */}
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
    </div>
  );
}

export default HoldingsFilters;
