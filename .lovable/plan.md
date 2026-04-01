

## Improve Command Tab Mobile UX/UI

### Current Issues (at 430px)
1. **Card padding too generous** — `14px 20px` and `padding: 32px` waste space on small screens
2. **Deploy Queue rows are dense** — ticker, tier badge, amount, price, layer, and context all crammed into one flex row
3. **Quick Commands grid is 2-column** (`gridTemplateColumns: 1fr 1fr`) — too tight at 430px
4. **Webhook actions** have a fixed 90px label width that wastes space
5. **Narrative section** uses `padding: 32` — excessive on mobile
6. **"Open Stellar Intelligence" button** is large and inline with heading — awkward on mobile
7. **Next Actions context text** truncates with ellipsis — could wrap instead on mobile
8. **Earnings rows** have gap between ticker/date and prep button that doesn't compact well
9. **No visual breathing room** — cards feel like dense walls of monospace text

### Plan

**File: `src/components/CommandTab.tsx`** — use `isMobile` (already imported) to adjust:

1. **Card padding** — reduce from `14px 20px` to `10px 12px` on mobile; narrative section from `32px` to `16px`
2. **Next Actions** — allow context text to wrap on mobile instead of `whiteSpace: nowrap` + ellipsis
3. **Today's Movers** — reduce inner padding; looks OK otherwise
4. **Deploy Queue** — on mobile, use a two-line stacked layout per item: line 1 = rank + ticker + tier + amount; line 2 = layer + context (indented). Remove `minWidth` constraints on mobile
5. **Earnings This Week** — stack ticker/date above the prep button on mobile instead of side-by-side
6. **Quick Commands** — switch from `1fr 1fr` grid to `1fr` single column on mobile
7. **Webhook actions** — reduce label width from 90px to 70px on mobile; stack vertically if needed
8. **"Open Stellar Intelligence"** — make full-width on mobile, placed below the label
9. **Narrative** — reduce padding to 16px; reduce macro regime font from 18px to 15px on mobile
10. **This Week's Actions** — allow size context to wrap below the action badge on mobile

### Summary of visual result
- Tighter padding throughout cards (saves ~30% vertical space)
- Content wraps naturally instead of truncating
- Deploy Queue and Earnings rows are scannable two-line blocks on mobile
- Quick Commands stack single-column so buttons are tappable
- No horizontal overflow anywhere

