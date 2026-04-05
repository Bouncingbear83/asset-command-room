

## Improve JISA "All" View — Child Section Separators

### Problem
When viewing "All" children, the transition between Bear → Alfie → Edie is a single small gold text label in a table row that visually blends into the data. It's too subtle to act as a section boundary.

### Solution
Replace the minimal text-only header row with a visually distinct section divider:

1. **Sticky section header row** with:
   - Larger top margin/padding (20px top gap before each child after the first)
   - Full-width background stripe (`rgba(200,169,110,0.08)` — subtle gold tint)
   - Child name in bolder, slightly larger text (12px instead of 10px)
   - A summary stat inline: total MV and G/L % for that child (pulled from `childSummaries`)
   - Left gold accent border (3px solid var(--gold)) for scanability

2. **Mobile card view**: Insert a similar divider banner between child groups — a full-width bar with the child's name and MV total.

### Visual result
```text
───────────────────────────────────────────────────
▌ BEAR                              £69,811  +25.1%
───────────────────────────────────────────────────
  VWRL   Vanguard FTSE...   158   £19,402 ...
  TWST   Twist Bioscience   130   £7,478  ...

───────────────────────────────────────────────────
▌ ALFIE                             £58,299  +25.2%
───────────────────────────────────────────────────
  VWRL   Vanguard FTSE...   132   £16,210 ...
```

### Files changed
- `src/components/JisasTab.tsx` — restyle the child header `<tr>` in the "All" view (desktop table + mobile cards)

