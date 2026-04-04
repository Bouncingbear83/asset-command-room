

## Fix Transactions Column Mapping

### Problem
The column mapping in `parseTransactions` doesn't match the actual sheet headers. The sheet columns are:

| Col | Header | Code maps to | Should be |
|-----|--------|-------------|-----------|
| 0–9 | DATE→TRANCHE | ✓ correct | — |
| 10 | **TRIGGER** | `layer` ❌ | `trigger` |
| 11 | **RATIONALE** | `notes` | `rationale` (rename for clarity) |
| 12 | SCORE_AT_ENTRY | ✓ | — |
| 13 | **LAYER** | `name` ❌ | `layer` |
| 14 | **LINKED_SCORE_LOG** | `accountName` ❌ | `linkedScoreLog` |

The `layer` field is currently reading col_10 (TRIGGER) instead of col_13 (LAYER). This means every transaction shows the wrong layer — or no layer at all — breaking layer dots, layer filtering, and drill-down grouping.

### Fix

**File: `src/hooks/usePortfolioData.ts`** — `parseTransactions` function

1. **col_10** → map to `trigger` (string) — e.g. "Score 86, Bio layer gap, price GBP 191"
2. **col_11** → rename from `notes` to `rationale` — e.g. "Anchor tranche. Cytiva Protein A..."
3. **col_13** → map to `layer` (was incorrectly mapped as `name`)
4. **col_14** → map to `linkedScoreLog` (was incorrectly mapped as `accountName`)
5. Remove the `name` field (no NAME column exists in this sheet)

**File: `src/components/TransactionsTab.tsx`**

6. Update any references to `t.notes` → `t.rationale`
7. Remove references to `t.name` / `t.accountName` if used
8. Verify layer filtering uses the now-correct `t.layer` field

### Result
Layer dots, layer filter dropdown, and drill-down header will show correct layer names (e.g. "Biological", "Compute", "Materials") instead of trigger text.

### Files changed
- `src/hooks/usePortfolioData.ts` — fix column mapping in parseTransactions
- `src/components/TransactionsTab.tsx` — update field references

