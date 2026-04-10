

## Fix: CASH parsing + confirm Ann. Return methodology

### Problem 1 — Header AUM missing ~£93k cash

The CASH sheet has a vertical/row-based layout where account labels ("ISA", "SIPP", "JISA-Bear", etc.) are in column B and values in column C. The current parser's three fallback strategies all look for labels in column A — so `cashSipp` and `cashIsa` remain 0.

**Console evidence:**
```
[CASH] raw grid: [["","account",""],["Date(2026,3,7)","ISA","354.09"],["Date(2026,3,7)","SIPP","93063.93"],...]
[CASH] parsed: {"cashSipp":0,"cashIsa":0,"cashTotal":354.09}
```

The `cashTotal` picks up 354.09 only because the positional fallback grabs `dataRow[0]` which is a date string (parsed as 0), then `dataRow[1]` = "ISA" (0), and `dataRow[2]` = "354.09" → assigned to `cashTotal` via the positional fallback. But SIPP and ISA individual values are never found.

**Fix:** In the row-based fallback (lines 914-922), also check column B (index 1) for the label, and read the value from column C (index 2). Specifically:

```typescript
// Enhanced row-based fallback: check col A and col B for labels
if (cashSipp === 0 && cashIsa === 0 && cashTotal === 0) {
  for (const row of cashGrid) {
    // Check both col A and col B for the account label
    const labelA = normalizeToken(row[0]);
    const labelB = normalizeToken(row[1]);
    const label = labelA || labelB;
    const valueCol = labelB ? 2 : 1; // value is in the column after the label
    
    if (label === "sipp" || label.includes("sipp")) {
      cashSipp = parseMv(row[valueCol]) || parseMv(row[valueCol + 1]) || 0;
    } else if (label === "isa" && !label.includes("jisa")) {
      cashIsa = parseMv(row[valueCol]) || parseMv(row[valueCol + 1]) || 0;
    } else if (label.includes("total")) {
      cashTotal = parseMv(row[valueCol]) || parseMv(row[valueCol + 1]) || 0;
    }
  }
  if (cashTotal === 0 && (cashSipp > 0 || cashIsa > 0)) cashTotal = cashSipp + cashIsa;
}
```

This will correctly parse: SIPP = £93,063.93, ISA = £354.09, Total = £93,418.02.

**File:** `src/hooks/usePortfolioData.ts` — lines 913-928 (the row-based and positional fallbacks)

### Problem 2 — Annualised Returns methodology

**No fix needed.** The "Ann. Ret" column uses XIRR (in `src/lib/xirr.ts`), which is the standard annualised IRR computed via Newton-Raphson iteration over dated cash flows (buys as negative, sells/dividends as positive, terminal MV as final positive flow). This is the correct, industry-standard approach — same as what Excel's XIRR function computes. The values displayed are correct.

### Summary

Single file change to `src/hooks/usePortfolioData.ts` — fix the CASH row-based fallback to check column B for account labels (matching the actual sheet layout). This will add ~£93k to the SIPP total and bring AUM from £937k to ~£1.03M in the header.

