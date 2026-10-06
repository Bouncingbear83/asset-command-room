import { isoDate } from "@/lib/actionSurface";

/**
 * CASH sheet is a ledger: col A date, col B account, col C balance.
 * Gross cash = sum of the latest row per account, excluding JISA* accounts.
 */
export function parseCashLedger(grid: unknown[][]): { byAccount: Record<string, number>; total: number } {
  const latest: Record<string, { date: string; idx: number; bal: number }> = {};
  grid.forEach((row, idx) => {
    if (!row) return;
    const date = isoDate(row[0]);
    const acct = String(row[1] ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    const bal = typeof row[2] === "number" ? row[2] : parseFloat(String(row[2] ?? "").replace(/[£,\s]/g, ""));
    if (!date || !acct || !Number.isFinite(bal) || acct.startsWith("JISA")) return;
    const prev = latest[acct];
    if (!prev || date > prev.date || (date === prev.date && idx > prev.idx)) latest[acct] = { date, idx, bal };
  });
  const byAccount = Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v.bal]));
  return { byAccount, total: Object.values(byAccount).reduce((s, n) => s + n, 0) };
}
