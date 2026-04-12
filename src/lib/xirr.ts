import { LiveTransaction, LiveHolding } from "@/hooks/usePortfolioData";

/**
 * XIRR calculates the annualised internal rate of return for a series
 * of dated cash flows using Newton-Raphson iteration.
 * Returns annualised rate as a decimal (0.15 = 15% pa). Returns null if fails to converge.
 */
export function xirr(cashflows: { date: Date; amount: number }[]): number | null {
  if (!cashflows || cashflows.length < 2) return null;

  const d0 = cashflows[0].date;
  const years = cashflows.map(cf => (cf.date.getTime() - d0.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const amounts = cashflows.map(cf => cf.amount);

  const npv = (r: number) => amounts.reduce((sum, amt, i) => sum + amt / Math.pow(1 + r, years[i]), 0);
  const dnpv = (r: number) => amounts.reduce((sum, amt, i) => sum - years[i] * amt / Math.pow(1 + r, years[i] + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const n = npv(rate);
    const d = dnpv(rate);
    if (Math.abs(d) < 1e-10) break;
    const newRate = rate - n / d;
    if (Math.abs(newRate - rate) < 1e-7) return newRate;
    rate = newRate;
    if (rate < -0.99) rate = -0.99;
  }
  return Math.abs(npv(rate)) < 0.01 ? rate : null;
}

export interface HoldingReturns {
  totalCost: number;
  truePL: number;
  truePLpct: number;
  annualisedReturn: number;
  entryDate: string;
  daysHeld: number;
  trancheCount: number;
}

/**
 * Calculate cost basis and returns for a single holding from its transactions.
 */
export function calcHoldingReturns(
  ticker: string,
  account: string,
  currentMV: number,
  transactions: LiveTransaction[]
): HoldingReturns {
  const txns = transactions.filter(t => t.ticker.toUpperCase() === ticker.toUpperCase() && t.account.toUpperCase() === account.toUpperCase());

  const buys = txns.filter(t => (t.shares || 0) > 0 && t.action !== "DIVIDEND");
  const totalBuyCost = buys.reduce((sum, t) => sum + (t.valueGbp || 0), 0);
  const totalSharesBought = buys.reduce((sum, t) => sum + (t.shares || 0), 0);

  // Net shares (buys minus sells, excluding dividends)
  const netShares = txns.filter(t => t.action !== "DIVIDEND").reduce((sum, t) => sum + (t.shares || 0), 0);

  // Average cost method: adjust cost basis for shares already sold
  const avgCostPerShare = totalSharesBought > 0 ? totalBuyCost / totalSharesBought : 0;
  const totalCost = netShares > 0 ? avgCostPerShare * Math.abs(netShares) : totalBuyCost;

  const dates = txns.map(t => t.date).filter(Boolean).sort();
  const entryDate = dates[0] || "";
  const daysHeld = entryDate ? Math.floor((Date.now() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const trancheCount = txns.filter(t => ["BUY", "SIZE_UP", "OPENING_BALANCE"].includes(t.action)).length;

  const truePL = currentMV - totalCost;
  const truePLpct = totalCost > 0 ? ((currentMV - totalCost) / totalCost) * 100 : 0;

  // Build XIRR cashflows
  const cashflows: { date: Date; amount: number }[] = [];
  txns.forEach(t => {
    const date = new Date(t.date);
    if (isNaN(date.getTime())) return;
    const val = t.valueGbp || 0;
    const shares = t.shares || 0;

    if (t.action === "DIVIDEND") {
      if (val > 0) cashflows.push({ date, amount: val });
    } else if (shares > 0) {
      cashflows.push({ date, amount: -val }); // buy = money out
    } else if (shares < 0) {
      cashflows.push({ date, amount: val }); // sell = money in
    }
  });

  if (currentMV > 0) {
    cashflows.push({ date: new Date(), amount: currentMV });
  }

  cashflows.sort((a, b) => a.date.getTime() - b.date.getTime());

  const annualisedReturn = cashflows.length >= 2
    ? (xirr(cashflows) || 0) * 100
    : 0;

  return { totalCost, truePL, truePLpct, annualisedReturn, entryDate, daysHeld, trancheCount };
}

/**
 * Calculate returns for a ticker across ALL accounts (for drill-down view).
 */
export function calcTickerReturns(
  ticker: string,
  transactions: LiveTransaction[],
  holdings: LiveHolding[]
): {
  totalCost: number;
  totalProceeds: number;
  currentMV: number;
  netShares: number;
  sharesByAccount: Record<string, number>;
  totalPL: number;
  totalReturnPct: number;
  annualisedReturn: number;
  entryDate: string;
  isClosed: boolean;
} {
  const txns = transactions.filter(t => t.ticker.toUpperCase() === ticker.toUpperCase());
  const buyTxns = txns.filter(t => (t.shares || 0) > 0 && t.action !== "DIVIDEND");
  const sellTxns = txns.filter(t => (t.shares || 0) < 0);

  const sharesByAccount: Record<string, number> = {};
  txns.filter(t => t.action !== "DIVIDEND").forEach(t => {
    const acct = t.account;
    sharesByAccount[acct] = (sharesByAccount[acct] || 0) + (t.shares || 0);
  });

  const totalBuyCost = buyTxns.reduce((sum, t) => sum + (t.valueGbp || 0), 0);
  const totalSharesBought = buyTxns.reduce((sum, t) => sum + (t.shares || 0), 0);
  const totalProceeds = sellTxns.reduce((sum, t) => sum + Math.abs(t.valueGbp || 0), 0);

  // Find current MV from holdings
  const matchingHoldings = holdings.filter(h => h.ticker.toUpperCase() === ticker.toUpperCase());
  const currentMV = matchingHoldings.reduce((sum, h) => sum + (h.mv || 0), 0);

  const netShares = Object.values(sharesByAccount).reduce((a, b) => a + b, 0);
  const isClosed = netShares <= 0;

  // Average cost method
  const avgCostPerShare = totalSharesBought > 0 ? totalBuyCost / totalSharesBought : 0;
  const totalCost = netShares > 0 ? avgCostPerShare * Math.abs(netShares) : totalBuyCost;

  const totalPL = netShares > 0
    ? currentMV + totalProceeds - totalCost
    : totalProceeds - totalCost;

  const totalReturnPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  // XIRR
  const cashflows: { date: Date; amount: number }[] = [];
  txns.forEach(t => {
    const date = new Date(t.date);
    if (isNaN(date.getTime())) return;
    const val = t.valueGbp || 0;
    const shares = t.shares || 0;

    if (t.action === "DIVIDEND") {
      if (val > 0) cashflows.push({ date, amount: val });
    } else if (shares > 0) {
      cashflows.push({ date, amount: -val });
    } else if (shares < 0) {
      cashflows.push({ date, amount: val });
    }
  });

  if (netShares > 0 && currentMV > 0) {
    cashflows.push({ date: new Date(), amount: currentMV });
  }

  cashflows.sort((a, b) => a.date.getTime() - b.date.getTime());

  const annualisedReturn = cashflows.length >= 2
    ? (xirr(cashflows) || 0) * 100
    : 0;

  const dates = txns.map(t => t.date).filter(Boolean).sort();
  const entryDate = dates[0] || "";

  return { totalCost, totalProceeds, currentMV, netShares, sharesByAccount, totalPL, totalReturnPct, annualisedReturn, entryDate, isClosed };
}
