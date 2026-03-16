

## Problem

The Scores Google Sheet has been restructured with:
1. **Section header rows** (e.g. "COMPUTE LAYER", "ENERGY LAYER") that will be parsed as scores and break the table
2. **New columns**: `Name`, `Layer`, `tier`, `action` that aren't being captured
3. The sheet now provides explicit `tier` and `action` values that should be displayed instead of being derived

## Changes

### 1. `src/hooks/usePortfolioData.ts` — Update `parseScores`

- **Filter out section headers**: Skip rows where ticker matches patterns like "COMPUTE LAYER", "ENERGY LAYER", "MATERIALS LAYER", etc. (any row where ticker contains "LAYER" or "HEDGE" or "WATCHLIST" as a section marker, or where `score` is null AND `ticker` contains a space)
- **Parse new fields**: Add `name`, `layer`, `tier`, `action` to the returned object
- The `LiveScore` type is derived from `parseScores` return type, so it updates automatically

### 2. `src/components/ScoresTab.tsx` — Wire new fields

- **Tier column**: Use explicit `tier` from sheet data instead of deriving from score via `getTier()`. Fall back to derived tier if sheet tier is empty.
- **Action column**: Add a new column showing the `action` value (BUY, HOLD, TRIMMED, PENDING, WATCHLIST, etc.) with appropriate badge styling
- **Layer column**: Add layer display (compact, after ticker)
- **Name**: Show on hover or as subtitle under ticker
- **Update STATIC fallback** to include the new fields
- **Update sort keys** to include `layer`, `tier`, `action`
- **Update summary counts** to use explicit tier values when available

### Tier badge mapping (from sheet values):
- "Core" → green style
- "Anchor" → accent/blue style  
- "Satellite" → amber style
- "Spec" → red style
- "Residual" → dim/muted style

### Action badge colours (reuse from CommandTab pattern):
- BOUGHT/SIZE UP → solid green
- HOLD → outline muted
- TRIMMED → solid red
- PENDING → outline gold
- WATCHLIST → outline dim
- REVIEW → outline amber
- MONITOR → outline amber

