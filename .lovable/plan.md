

The user wants Intelligence and Holdings tabs mobile-friendly without losing desktop functionality. Let me explore the current state of these components to understand what needs adapting.
<lov-tool-use id="toolu_vrtx_01E6MEeyCxF89iQ8VtGA63bG" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/IntelligenceFilters.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013osSgrpB16x81zvNRgqnMc" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/IntelligenceListHeader.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NbviZQds89oaC7fmkfYVNt" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/AssetRow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_016VgQHwnCfHKzHP49rJRVnQ" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/columns.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KRWijfU24aL6J2g9cVvHrS" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/IntelligenceTab.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Mv54DjGEnHhTWt3qeY8JmM" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/HoldingsTab.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FbqyMd98jqZNSo7UgiecZt" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/holdings/HoldingsFilters.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01WijeiifrZGH96WPrtWyatY" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/AssetRow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JmVnnTtwBcA5YjMJwFHnud" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/IntelligenceListHeader.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01AnQgYCdJkp4mnwTneMBWc4" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/columns.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SAJetzAqGqas2CssNZvHYr" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/IntelligenceFilters.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0179ymum7mwGKuqxazNaqJaG" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/HoldingsTab.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XQ21wYETA8irEfGQPdZ1Ay" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/holdings/HoldingsFilters.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Spe4RvonBErAUA9DH56nSy" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/intelligence/AssetExpansion.tsx\"}">
</lov-tool-use>
I have enough context. Let me present the plan.

<lov-plan>
# Mobile Responsiveness Plan: Intelligence + Holdings

## The problem (verified from current viewport 430×659)

Both tabs use **fixed-width pixel columns** in flex layouts that overflow narrow screens:

**Intelligence (`AssetRow.tsx` + `IntelligenceListHeader.tsx`)**
- Row sums to ~96+100+64+420+84+92+104+20 = **~980px minimum** plus gaps
- 6D bars use `gridTemplateColumns: "repeat(6, 1fr)"` with `minWidth: 420` — never collapses
- Currently only the buy-range column has a CSS hide rule (`<1100px`)

**Holdings (`HoldingsTab.tsx` UnifiedView)**
- Wraps `<table>` in `overflow-x: auto` — works but forces horizontal scroll for everything including the ticker
- `useIsMobile` hides Name/Layer/Account/30D/MA20/MA50/Cost/P&L/Notes — but G/L%, Day%, Price, Ann.Ret all stay, still overflows on 430px
- Filter chip rows (`HoldingsFilters`) wrap OK but eat 4–5 vertical rows on mobile

**Filters / chrome (both tabs)**
- `IntelligenceFilters` + `HoldingsFilters` already use `flexWrap: wrap` so they degrade gracefully — but are noisy at 430px (account + action + factor + layer = potentially 30+ chips visible)
- Group toggle buttons are wide

**Expansion (`AssetExpansion.tsx`)**
- Already mostly OK — `AssetExpansion.css` has media queries that collapse 6D/disruption/position grids to 1 column at ≤720px

## Strategy: progressive disclosure, no functionality removed

Keep desktop layout 1:1. On mobile (≤767px) switch each row to a **stacked card** that surfaces the same data in a vertical hierarchy. Tap still expands. All filters, sort, group, search still work — chrome just becomes more compact.

Three-tier breakpoint approach:
- **Desktop (≥1100px)**: current layout unchanged
- **Tablet (768–1099px)**: hide buy-range column (already done), shrink 6D bar minWidth, allow horizontal scroll on Holdings table
- **Mobile (≤767px)**: switch row layouts to stacked cards; collapse filter chrome behind a "Filters" disclosure

## Changes by file

### Intelligence tab

**`src/components/intelligence/AssetRow.css`** (extend)
- Add `@media (max-width: 767px)` rules that hide the desktop flex row's column wrappers and reveal a mobile-only stacked card. Use a `.asset-row-mobile` / `.asset-row-desktop` toggle pair.

**`src/components/intelligence/AssetRow.tsx`**
- Wrap existing flex row in `<div className="asset-row-desktop">`
- Add a parallel `<div className="asset-row-mobile">` rendering:
  - Line 1: ticker (bold) · score (right-aligned, large) · status chip · chevron
  - Line 2: name (truncated) · layer chip · disruption badge
  - Line 3: 6D bars in a single horizontal grid (smaller, 6 columns still — they're just bars)
  - Line 4: distance chip + buy range text (full width)
- Both share the same `onClick` / `onToggle`

**`src/components/intelligence/IntelligenceListHeader.tsx`**
- Add CSS class `intelligence-list-header` and hide via `@media (max-width: 767px) { display: none }` — column headers don't make sense on stacked cards. Sort moves to a compact "Sort: Score ▼" dropdown (see filters below).

**`src/components/intelligence/IntelligenceFilters.tsx`**
- On mobile, collapse all chip rows behind a single "Filters (N active)" toggle button
- Add inline mobile-only "Sort by ▾" select that mirrors the column-header sort options
- Reuse existing `useIsMobile` hook

### Holdings tab

**`src/components/HoldingsTab.tsx` — UnifiedView**
- Already uses `useIsMobile`. Extend to a mobile card layout:
  - When `isMobile`, replace the `<table>` body with stacked `<div>` cards per row:
    - Header: ticker + score badge + Action chip + chevron
    - Metrics row: MV £ · G/L% · Day%
    - Secondary: Layer · Account · Ann.Ret
  - Keep CASH pinned card at top with its own compact style
  - Keep group headers — they already render as full-width rows
- Desktop table unchanged

**`src/components/holdings/HoldingsFilters.tsx`**
- Same collapse-behind-toggle pattern as Intelligence on mobile
- Add mobile sort dropdown

**`src/components/holdings/HoldingsHeader.tsx`** + **`HoldingsGroupHeader.tsx`**
- Reduce horizontal padding + font size on mobile via small CSS rules; layouts already wrap

### Shared

**New `src/components/shared/filters/FilterDisclosure.tsx`** (small)
- Mobile-only wrapper that hides children behind a "Filters (N)" button. Desktop renders children directly.
- Used by both `IntelligenceFilters` and `HoldingsFilters`.

**New `src/components/shared/filters/MobileSortSelect.tsx`** (small)
- Native `<select>` styled to match dark theme. Takes `options: {label, field}[]`, current `sortField` + `sortDir`, emits change. Renders only on mobile.

## What stays the same

- All sort, filter, group, search, URL state behaviour (every interaction reachable on mobile)
- AssetExpansion (already responsive via existing CSS)
- Price chart (Recharts is responsive by default)
- CASH pinning, group headers, layer click-to-filter
- All desktop layouts pixel-identical

## Verification checklist after implementation

1. At 430px: Intelligence rows render as stacked cards, all data visible without horizontal scroll
2. At 430px: Holdings rows render as stacked cards; tap expands to AssetExpansion
3. At 430px: Filters collapsed behind "Filters (3)" button; tapping reveals the chip rows
4. At 430px: Sort accessible via dropdown
5. At 1280px: Layouts unchanged from current desktop screenshots
6. At 900px (tablet): Buy-range column hidden, everything else still tabular
7. URL state still round-trips (filters/sort/group persist on mobile)

## Files touched

Edit: `AssetRow.tsx`, `AssetRow.css`, `IntelligenceListHeader.tsx`, `IntelligenceFilters.tsx`, `HoldingsTab.tsx`, `HoldingsFilters.tsx`, `HoldingsHeader.tsx`, `HoldingsGroupHeader.tsx`
Create: `shared/filters/FilterDisclosure.tsx`, `shared/filters/MobileSortSelect.tsx`

Estimated scope: ~6 component edits + 2 new small primitives. No data layer changes, no URL state changes, no expansion changes.
