

## UX/UI Review — Stellar Command Dashboard

### Issues Found

**1. Macro banner takes too much vertical space**
The narrative/regime text block occupies ~200px of prime viewport real estate on every tab. On mobile it consumes nearly half the screen before you reach any actionable content. It repeats across all tabs identically — users scroll past it repeatedly.

**Fix**: Collapse the macro banner by default (show only the one-line VIX/S&P/Gold strip). Move the full narrative into a tooltip or expandable drawer. On tab switch, don't re-render it at the top.

**2. Tab bar clips on mobile — no visual affordance**
The horizontal tab strip has a CSS fade mask on the right, but there's no visible indicator that more tabs exist (RETURNS, HOLDINGS, TRANSACTIONS, JISAs, EARNINGS CALENDAR are all hidden). Users may never discover them.

**Fix**: Add a subtle right-arrow chevron or "scroll for more" indicator. Alternatively, show a count badge like "10 tabs →".

**3. Today's Movers sorting is unclear**
The ALL / GAIN / LOSS filter tabs work, but there's no indication of what the default sort is (absolute move? percentage?). The mix of positive and negative values interleaved is confusing.

**Fix**: Default sort by absolute percentage move (largest movers first). Add a subtle sort indicator.

**4. Empty states are plain text**
"No actions required", "No earnings this week", "No deployments queued" — these are bare mono text with no visual hierarchy. They blend into the dark background.

**Fix**: Add a subtle icon or dimmed illustration. Use slightly larger text or a centered layout for empty states to make them feel intentional rather than broken.

**5. Header stats lack context**
AUM/SIPP/ISA show raw numbers (£892k) with no change indicator. The user can't tell at a glance if the portfolio is up or down today.

**Fix**: Add a small daily change indicator (e.g., "£892k ▲ +0.4%") next to each stat in the header.

**6. Card visual hierarchy is flat**
Next Actions, Deploy Queue, Earnings, Narrative, This Week's Actions, Risk Controls, Macro Signals — they all look identical (dark panel, gold left border). Nothing stands out as most important.

**Fix**: Use differentiated card styles — Next Actions gets a stronger border or subtle glow. Risk Controls with a WATCH status gets an amber tint. Collapsed cards (Risk Controls, Macro Signals) could use a lighter treatment.

**7. Collapsible sections have tiny click targets**
Risk Controls, Macro Signals, Golden Rules — the collapse toggle is just a small "▸" character. On mobile, these are hard to tap.

**Fix**: Make the entire header row clickable (it may already be, but the visual affordance doesn't communicate it). Add a chevron icon with padding.

**8. Quick Commands grid layout breaks on mobile**
The 2x2 grid of command buttons (Substrate Audit, Layer Gaps, etc.) becomes cramped on mobile. "LOG TRADES" subtitle text overflows.

**Fix**: Stack to single column on mobile. Ensure subtitle text truncates with ellipsis.

**9. Webhook action buttons lack feedback**
FIRE buttons for Rescore/Prep/Scan have no loading state or success confirmation beyond a toast. Users may double-click.

**Fix**: Disable the button and show a spinner while the webhook fires. Show inline confirmation ("✓ Fired") for 3 seconds.

**10. No "back to top" on long pages**
Holdings tab with 27+ positions requires significant scrolling. No way to quickly return to the top or to the tab bar.

**Fix**: Add a floating "↑" button that appears after scrolling past the fold, or make the tab bar sticky (it's not currently sticky — only the header is).

### Priority Recommendations (top 3 to implement)

1. **Make the tab bar sticky** — pins navigation below the header so users can switch tabs without scrolling up. Single CSS change, high impact.
2. **Collapse macro banner by default** — reclaims 150-200px of vertical space on every tab. Users can expand when needed.
3. **Add daily change to header stats** — transforms the header from a static label into a live pulse indicator. The data likely already exists in the portfolio data.

### Files that would change
- `src/index.css` — sticky tab bar, empty state styles
- `src/pages/Index.tsx` — collapse macro banner by default, sticky nav
- `src/components/CommandTab.tsx` — empty state improvements, command grid mobile fix
- `src/hooks/usePortfolioData.ts` — expose daily change % for header stats

