

## Goal
Make the HOLD STATUS column visibly read as a status, by replacing the current tiny 9px badge with coloured pills using the same visual grammar as the action filter pills at the top of the Holdings page (the shared `Chip` component style: 10px uppercase mono, 5×10 padding, border + tinted background). Also add a missing **MONITOR** state (blue) that the current mapping silently swallows.

## Scope
Single file: `src/components/HoldingsTab.tsx`. The badge component is reused in three places (group header row, table cell, and the mobile card variant), so updating `HoldStatusBadge` propagates everywhere automatically.

## Changes

### 1. Extend the status vocabulary
Add `MONITOR` as a first-class kind. Update the mapping so `HOLD` is treated as CLEAR (no badge), per spec.

```text
SIZE_UP    ← SIZE_UP | ADD_ZONE | ADD          → green   "▲ SIZE UP"
SIZE_DOWN  ← SIZE_DOWN | REVIEW | TRIM         → amber   "▼ SIZE DOWN"
MONITOR    ← MONITOR | WATCH                   → blue    "◉ MONITOR"
EXIT       ← EXIT | EXIT_ZONE | SELL           → red     "✕ EXIT"
CLEAR      ← CLEAR | HOLD | "" | unknown       → no badge
```

Blue uses the existing `--accent` token (`#6e8ec8`) and `--accent-dim` background — already in the palette, no new colours.

### 2. Restyle `HoldStatusBadge` to match action filter pills
Adopt the Chip visual language:

- `fontSize: 10` (was 9)
- `letterSpacing: 0.1em`
- `padding: 5px 10px` (was 2×8)
- `borderRadius: 2`
- `fontFamily: var(--font-mono)`, uppercase
- Width: intrinsic (`display: inline-flex`, `whiteSpace: nowrap`) — fits content
- Each variant keeps its tinted background + matching-tone border (same pattern as the active-state Chip), so the colour is what reads, not just the icon

### 3. No call-site changes
All three existing `<HoldStatusBadge status={h.alert_status} />` usages stay as-is. The mobile compact card and group-header chips automatically pick up the new look.

## Out of scope
- Filter chips, table headers, sort logic — untouched.
- `alert_status` field semantics in `usePortfolioData` / the sheet — untouched. Just one more value (`MONITOR`) is now rendered instead of being dropped to CLEAR.

