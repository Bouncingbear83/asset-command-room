
Goal: update the planned Google Sheets migration so “This Week’s Actions” is fully derived from live HOLDINGS + NARRATIVE data, with no standalone rendering of `week_priority_*` / `week_watch_*`.

What I found
- `CommandTab.tsx` still renders the old JSON-driven `state.tickerActions` list and the JSON textarea.
- `usePortfolioData.ts` already parses holdings/watchlist/monitor/etc. but does not yet fetch `NARRATIVE`, and holdings parsing does not yet expose all fields needed for the new action panel (`alert_status`, trigger price add, add trigger).
- The current codebase does not yet render `week_priority_*` or `week_watch_*` separately, so the main risk is accidentally adding them as standalone sections during the sheet migration.
- You clarified ticker-to-priority matching should use flexible case-insensitive contains.

Planned implementation

1. Extend live sheet ingestion
- Add `NARRATIVE` gid to `usePortfolioData.ts`.
- Add parser for `NARRATIVE!A:B` as a key→value map.
- Extend holdings parsing to include:
  - `ticker`
  - `action` (col J)
  - `mv` (col E)
  - `trigger_price_add` (col AC)
  - `add_trigger` (col Z)
  - `alert_status` (col AE)
- Add these to the exported portfolio hook types.

2. Derive action panel data in one place
- Build a derived `weeklyActions` list from holdings where `alert_status !== "CLEAR"`.
- For each action row:
  - title = holding ticker
  - badge = holding `action`
  - size context = formatted `mv` plus `trigger_price_add`
  - rationale = first `week_priority_1/2/3` narrative value whose text contains the ticker, case-insensitive
  - fallback rationale = truncated `add_trigger` (80 chars)
- Build a separate derived `weeklyWatch` list from:
  - `week_watch_1`
  - `week_watch_2`
  - `week_watch_3`
  filtered to non-empty strings.

3. Replace the Command tab panel
- Remove JSON-driven `state.tickerActions` usage.
- Render “This Week’s Actions” from `weeklyActions`.
- Add a sub-section below the action rows:
  - heading: “Watch this week”
  - each row uses a `MONITOR` badge and plain text from the narrative watch items
- If there are no action rows, still allow the watch section to appear if watches exist.
- If both are empty, show a simple empty state.

4. Keep priority/watch fields internal only
- Do not render `week_priority_1/2/3` as standalone text blocks anywhere.
- Do not render `week_watch_1/2/3` anywhere except the “Watch this week” sub-section.
- Keep them as supporting inputs only for:
  - ticker rationale matching
  - watch rows

5. Fold this into the broader Sheets-only migration
- While implementing the larger removal of JSON-only intelligence, use the same derived live data path so the action panel remains consistent.
- Remove the old Intelligence Update textarea and related state from `CommandTab.tsx`.
- Remove any future dependence on `tickerActions` from `intelligenceState`.

Files affected
- `src/hooks/usePortfolioData.ts`
- `src/components/CommandTab.tsx`
- `src/data/intelligenceState.tsx` (retired as part of full migration)
- `src/App.tsx` (if removing provider in the same pass)

Key behavior decisions locked in
- Source rows: HOLDINGS where `ALERT_STATUS != "CLEAR"`
- Priority match rule: flexible case-insensitive contains
- Fallback rationale: `ADD_TRIGGER`, truncated to 80 chars
- Watch rows: `week_watch_1/2/3` only, shown beneath actions with `MONITOR` badge
- No separate rendering of week priorities or week watches anywhere else
