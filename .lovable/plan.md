

## Fix Command Tab Layout — Remove Sidebar, Add Collapsible Sections

### Problem
The current 2-column grid layout puts Risk Controls and Macro Signals in a narrow right sidebar that wastes space and looks awkward. These are important but secondary — they should be scannable at a glance without dominating the layout.

### Solution
Switch to a **single-column layout** and convert Risk Controls and Macro Signals into **collapsible `<details>` sections** (like Golden Rules already is). Each section header shows a RAG summary count so the user can see status without expanding.

### Changes — `src/components/CommandTab.tsx`

1. **Change grid to single column**: Replace `gridTemplateColumns: "1fr 1fr"` with `gridTemplateColumns: "1fr"` and remove the wrapping `<div>` elements that split left/right columns.

2. **Risk Controls — collapsible with summary chip**:
   - Wrap in `<details>` (collapsed by default)
   - Header shows: `RISK CONTROLS` + summary like `3 SAFE · 1 WATCH` derived from computed statuses
   - Content unchanged

3. **Macro Signals — collapsible with summary chip**:
   - Wrap in `<details>` (collapsed by default)
   - Header shows: `MACRO SIGNALS` + summary like `3 GREEN · 2 RED` derived from signal statuses
   - Content unchanged

4. **Reorder sections** (top to bottom):
   - Next Actions
   - Deploy Queue
   - Earnings This Week
   - Risk Controls (collapsed, with summary)
   - Macro Signals (collapsed, with summary)
   - Narrative + Quick Commands
   - This Week's Actions
   - Commit Research
   - Golden Rules

### Summary chip logic

```text
Risk Controls:  count statuses → "2 SAFE · 1 WATCH · 1 BREACH"
Macro Signals:  count statuses → "3 GREEN · 1 TRIGGERED · 1 CLEAR"
```

Color-code the counts: green for safe/clear, amber for watch/monitor, red for breach/triggered.

