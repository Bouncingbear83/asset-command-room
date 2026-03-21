

## Watchlist Tab Redesign: Grouped Actionable Layout

### Summary
Replace the flat sortable table with three grouped sections based on actionability, inline review notes, and per-row webhook action buttons.

### Architecture

Rewrite `src/components/WatchlistTab.tsx` completely. Keep all existing helper functions (parsing, badge components, stat cards) but replace the rendering logic.

### Data Grouping

Using existing `LiveWatchItem` fields — no data hook changes needed:

- **Buy Targets**: `status` in `["BUY NOW", "BUY T1", "BUY T2"]` — sorted by % below target (most actionable first)
- **Waiting for Entry**: `status` in `["WAIT", "WATCH", "MONITOR"]` — sorted by % above target ascending (closest to entry first). Entries >25% above target dimmed. Show first 6, expandable.
- **Pre-IPO / Research**: `status` in `["PRE-IPO", "RESEARCH"]` — sorted alphabetically, dimmed (opacity 0.7)

### Section Layout

Each section gets a colored dot header (green/grey/purple) with count.

### Row Component

Each row renders as a card-style block (not a grid table):
- **Line 1**: Ticker (bold) · Name · Layer tag · Status badge
- **Line 2**: Target: $X · Current: $Y · ±Z% (color-coded: green if at/below target, amber if within 10%, red if >10% above)
- **Line 3**: Trigger condition text
- **Line 4** (conditional): Review note card with colored left border (orange=STALE, green=OK), parsed reason, suggested target/condition in gold italic
- **Line 5**: Review date line
- **Line 6**: Action buttons — Rescore + Earnings Prep (using `triggerWebhook`)

### Summary Cards

Keep existing 4 stat cards: Buy Ready, In Zone, Stale Triggers, Total Watching. Keep MACRO PAUSE banner in Buy Targets section.

### Badge Colors

- BUY T1/T2: green bg + text
- WAIT/WATCH/MONITOR: grey
- PRE-IPO: purple
- RESEARCH: blue

### Per-Row Actions

- **Rescore**: always shown, calls `/stellar-rescore` with `{ ticker }`
- **Earnings Prep**: calls `/stellar-earnings-prep` with `{ ticker }`, shown for all entries (user decides relevance)
- Small ghost-style buttons matching existing app aesthetic

### Files

- `src/components/WatchlistTab.tsx` — full rewrite, keeping existing helpers and imports

