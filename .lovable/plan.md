## Watchlist UX upgrade

Two issues to address on the Watchlist tab:

1. The per-layer sub-headers inside the Waiting section (`COMPUTE · 10`, `ENERGY · 2`, etc.) are nearly invisible — muted grey on near-black with no accent.
2. Sorting is currently three separate toggle buttons (Profile / Driver / Stack) and there's no way to sort by Score, Gap, 7d, or 30d trend.

### 1 — Brighter layer bands (`WatchlistTab.tsx`, lines 1047-1066)

Replace the dim sub-header with a higher-contrast band that reads as a real divider:

- Background: subtle gold tint (`rgba(201,168,76,0.06)`) instead of `rgba(0,0,0,0.2)`
- Left accent: 2px solid `var(--gold)` border
- Layer name: `var(--gold)` at 11px, weight 700, full opacity
- Count: `var(--text-mid)` (was `--text-dim`)
- Add a tiny ▸ chevron glyph and slightly more vertical padding (10px) so it visually separates rows above/below
- Same treatment applied wherever else the same pattern shows up (only the Waiting section currently uses it)

This keeps the "thin band" doctrine (no chunky cards) but makes the layer break unmistakable on a 27" screen.

### 2 — Unified Sort menu

Replace the three toggle buttons (`Sort: Profile`, `Sort: Driver`, `Sort: Stack`) with a single `<select>` styled like the Layer/Status dropdowns:

```
Sort by: Default · Score (high→low) · Gap (closest→furthest) · 7d trend · 30d trend · Driver · Stack · Profile
```

State change in `WatchlistTab.tsx`:
- Drop `profileSort`, `extraSort` state → single `sortBy: SortKey` state
- `SortKey = "default" | "score" | "gap" | "trend7d" | "trend30d" | "driver" | "stack" | "profile"`
- Rewrite `applySorts` to a single switch on `sortBy`. When `default`, keep each bucket's existing tie-breaker (distance / score / days-overdue) so today's behaviour is preserved.
- Sort comparators:
  - `score`: `(b.score?.total_score ?? -1) - (a.score?.total_score ?? -1)`
  - `gap`: `(a.distanceToEntryPct ?? 999) - (b.distanceToEntryPct ?? 999)` (closest to entry first; in-zone treated as 0)
  - `trend7d` / `trend30d`: most-negative first (price falling toward entry = best for a buyer)
  - `driver` / `stack` / `profile`: existing logic
- Sort applies across **all sections** uniformly; bucketing (Active Buys → In Zone → Approaching → Overdue → Waiting → Monitoring → Research → Pre-IPO) is unchanged.

### 3 — Sort hint chip

When `sortBy !== "default"`, show a small dismissable chip under the sticky header: `Sorted by Score ✕`. Click ✕ resets to default. Cheap, gives users an obvious "get back to normal" affordance.

### Files touched

- `src/components/WatchlistTab.tsx` — sub-header restyle (lines ~1047-1066), sort state refactor (lines ~380-547, 832-870), sort hint chip (new, ~875)

No changes to `WatchlistCard.tsx`, no data-layer changes, no schema changes.

### Verification

- Layer bands visibly stand out when Waiting section is expanded
- Sort dropdown re-orders rows within each section without breaking bucketing
- "Default" restores today's behaviour exactly (gap-asc in Approaching/Active Buys, score-desc/gap-asc in Waiting, days-overdue-desc in Overdue)
- Mobile: dropdown wraps cleanly under the search box; layer band remains readable at 14px padding
