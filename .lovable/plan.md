## Watchlist coverage check — findings

### Data fetch: ✅ all rows captured

- Google Sheet (gid `496665408`) currently has **55 data rows** (sheet rows 2–57, ending at "Nutrien Ltd / NTR").
- `usePortfolioData` fetches `A1:N80`, which comfortably covers everything.
- `parseWatchlist` keeps every row that has a name *or* ticker. No truncation occurs at the data layer.

### Rendering: ❌ several rows silently disappear

The fetch is healthy, but `WatchlistTab.tsx` only renders rows that fall into one of these buckets: **In Zone, Approaching, Overdue Review, Waiting (by layer), Monitoring, Research, Pre-IPO**.

Status values currently on the sheet:

| STATUS    | Count | Rendered? |
|-----------|------:|-----------|
| `WAIT`    | 31    | ✅ falls into Waiting/Approaching/In-Zone via zone logic |
| `RESEARCH`| 8     | ✅ Research section |
| `PRE-IPO` | 7     | ✅ Pre-IPO section |
| `WATCH`   | 3     | ⚠️ only rendered if zone logic catches it; otherwise dropped from Waiting bucket only because Waiting filters by `zoneStatus === "WAITING"` (works) — actually OK |
| `BUY`     | 3     | ❌ **dropped** — no bucket matches `BUY`; only appears if it happens to be IN_ZONE/APPROACHING |
| `PRE_IPO` | 2     | ❌ **dropped** — bucket checks `"PRE-IPO"` (hyphen) not `"PRE_IPO"` (underscore) |
| `ACTIVE`  | 1     | ❌ **dropped** — no bucket matches `ACTIVE` |

That's up to **6 rows invisible** depending on their price/zone state, plus `WATCH` rows are at the mercy of zone classification.

There is also no `EXITED` status currently on the sheet, but the code intentionally hides it everywhere — worth confirming that's still desired.

### Fix plan

1. **Normalize PRE-IPO status** in the bucket filters so both `PRE-IPO` and `PRE_IPO` match (strip non-alphanumerics or accept both spellings). Updates: `preIpo` filter + the three `skipStatus` sets.
2. **Add a `BUY` / `ACTIVE` "Active Buys" section** above In Zone (or fold them into In Zone) so those statuses surface explicitly. These are the highest-priority statuses on the sheet and currently can vanish.
3. **Add a fallback "Other" / "Uncategorised" section** at the bottom that renders any row not picked up by an existing bucket. This guarantees all 55 rows are always visible and prevents future status typos from silently hiding rows.
4. **Update header counts** to include the new sections so totals reconcile to `derived.length`.
5. **Add a dev assertion in `WatchlistTab`** (console.warn in dev only) when `rendered.length !== derived.length`, so future drift is caught early.

No data layer / Supabase changes needed — purely UI bucketing in `src/components/WatchlistTab.tsx`.

### Files touched

- `src/components/WatchlistTab.tsx` — bucket filters, new Active Buys + Uncategorised sections, header counts, dev warning.

### Out of scope

- Cleaning up the sheet itself (e.g. converting `PRE_IPO` → `PRE-IPO`, deciding whether `ACTIVE` should be retired). Happy to flag these to you separately once the UI no longer hides them.
