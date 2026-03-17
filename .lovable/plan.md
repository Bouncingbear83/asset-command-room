

## Fix: Disruption Data Not Linking to Scores

### Root Cause

The disruption sheet's column B has the decorated header `"ticker ── CURRENT HOLDINGS ── COMPUTE LAYER"`. The `fetchSheet` column mapping scans KNOWN_COLS sorted by **length descending** for a substring match. The word `"current"` (7 chars) is in KNOWN_COLS and appears in this header — and it's longer than `"ticker"` (6 chars). So column B gets mapped to key `"current"` instead of `"ticker"`.

Result: every disruption row has its ticker stored under `r["current"]`, not `r["ticker"]`. The `parseDisruption` function calls `findCol(r, "ticker", "TICKER")` which returns null. The `disruptionMap` ends up with empty-string keys, so no score row ever matches.

### Fix: `src/hooks/usePortfolioData.ts`

Change the KNOWN_COLS matching in `fetchSheet` (lines 50-57) to break ties by **earliest position** in the label string, not just longest match. This way `"ticker"` at position 0 beats `"current"` at position ~10.

```ts
// Current (broken): first match from length-descending sort
for (const known of [...KNOWN_COLS].sort((a, b) => b.length - a.length)) {
  if (labelLower.includes(known.toLowerCase())) return known;
}

// Fixed: find ALL matches, pick earliest position, break ties with longest
const matches = KNOWN_COLS
  .map(k => ({ k, pos: labelLower.indexOf(k.toLowerCase()) }))
  .filter(m => m.pos >= 0)
  .sort((a, b) => a.pos - b.pos || b.k.length - a.k.length);
if (matches.length > 0) return matches[0].k;
```

This single change fixes the disruption lookup without touching any other parser or component. All other sheets are unaffected because their first-word matches already win by length.

