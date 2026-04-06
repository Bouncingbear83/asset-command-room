

## Hardcode Test Q_REVIEW Flags on Sample Holdings

### Summary
Inject test review flags into the holdings data after it's parsed from the spreadsheet, so the Review Queue banner and priority dots become visible for verification. This is a temporary change — easy to remove after testing.

### Approach
In `src/hooks/usePortfolioData.ts`, after the `parseHoldings()` call returns the array (~line 341), add a post-processing step that injects `trigger_review_date` and `trigger_review_note` on the first 5 holdings (or by known tickers if available). This ensures the data flows through all downstream components without modifying parsing logic.

### Test data to inject (on first 5 holdings with tickers)
| Index | Priority | Flag | Note |
|-------|----------|------|------|
| 0 | HIGH | EARNINGS | Revenue miss 15% vs consensus |
| 1 | HIGH | COMPETITOR | Starlink Direct-to-Cell launch |
| 2 | HIGH | KILL_CONDITION | Thesis invalidated by merger |
| 3 | MEDIUM | STALE | Score date >90 days old |
| 4 | LOW | PRICE_MOVE | Price moved >30% since last scored |

### Technical detail

**File**: `src/hooks/usePortfolioData.ts`

After the `parseHoldings()` function returns the mapped array (line ~341), add a clearly marked `// TEST: inject review flags` block that overwrites `trigger_review_date` and `trigger_review_note` on holdings at indices 0–4 (only if the array has that many items). Use today's date for the review date.

### Files changed
- `src/hooks/usePortfolioData.ts` — temporary test injection after parseHoldings return

