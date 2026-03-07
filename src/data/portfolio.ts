// Static portfolio data — will be replaced with Google Sheets connection

export interface Holding {
  ticker: string;
  name: string;
  layer: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
  targetWeight: number;
  pnl: number;
  pnlPercent: number;
  dividendYield: number;
  score: number;
}

export const sippHoldings: Holding[] = [
  { ticker: "VWRL", name: "Vanguard FTSE All-World", layer: "Core", shares: 420, avgCost: 82.50, currentPrice: 96.30, marketValue: 40446, weight: 8.2, targetWeight: 10.0, pnl: 5796, pnlPercent: 16.7, dividendYield: 1.8, score: 92 },
  { ticker: "VUSA", name: "Vanguard S&P 500", layer: "Core", shares: 310, avgCost: 58.20, currentPrice: 72.10, marketValue: 22351, weight: 4.5, targetWeight: 5.0, pnl: 4309, pnlPercent: 23.9, dividendYield: 1.3, score: 88 },
  { ticker: "SMT", name: "Scottish Mortgage IT", layer: "Growth", shares: 580, avgCost: 7.80, currentPrice: 9.45, marketValue: 5481, weight: 1.1, targetWeight: 2.0, pnl: 957, pnlPercent: 21.2, dividendYield: 0.3, score: 74 },
  { ticker: "LGEN", name: "Legal & General", layer: "Income", shares: 2400, avgCost: 2.35, currentPrice: 2.68, marketValue: 6432, weight: 1.3, targetWeight: 1.5, pnl: 792, pnlPercent: 14.0, dividendYield: 8.2, score: 81 },
  { ticker: "GSK", name: "GSK plc", layer: "Income", shares: 850, avgCost: 14.20, currentPrice: 16.50, marketValue: 14025, weight: 2.8, targetWeight: 3.0, pnl: 1955, pnlPercent: 16.2, dividendYield: 3.8, score: 77 },
  { ticker: "SHEL", name: "Shell plc", layer: "Tactical", shares: 620, avgCost: 23.40, currentPrice: 27.80, marketValue: 17236, weight: 3.5, targetWeight: 3.0, pnl: 2728, pnlPercent: 18.8, dividendYield: 3.5, score: 83 },
  { ticker: "AZN", name: "AstraZeneca", layer: "Growth", shares: 180, avgCost: 98.50, currentPrice: 118.60, marketValue: 21348, weight: 4.3, targetWeight: 4.0, pnl: 3618, pnlPercent: 20.4, dividendYield: 2.1, score: 90 },
  { ticker: "HSBA", name: "HSBC Holdings", layer: "Income", shares: 3200, avgCost: 5.90, currentPrice: 7.15, marketValue: 22880, weight: 4.6, targetWeight: 4.5, pnl: 4000, pnlPercent: 21.2, dividendYield: 5.1, score: 79 },
  { ticker: "ULVR", name: "Unilever", layer: "Core", shares: 350, avgCost: 39.80, currentPrice: 44.20, marketValue: 15470, weight: 3.1, targetWeight: 3.0, pnl: 1540, pnlPercent: 11.1, dividendYield: 3.4, score: 85 },
  { ticker: "RIO", name: "Rio Tinto", layer: "Tactical", shares: 280, avgCost: 52.30, currentPrice: 58.90, marketValue: 16492, weight: 3.3, targetWeight: 3.0, pnl: 1848, pnlPercent: 12.6, dividendYield: 6.2, score: 76 },
];

export const isaHoldings: Holding[] = [
  { ticker: "VWRL", name: "Vanguard FTSE All-World", layer: "Core", shares: 680, avgCost: 81.20, currentPrice: 96.30, marketValue: 65484, weight: 13.2, targetWeight: 15.0, pnl: 10268, pnlPercent: 18.6, dividendYield: 1.8, score: 92 },
  { ticker: "IITU", name: "iShares S&P 500 IT", layer: "Growth", shares: 520, avgCost: 38.50, currentPrice: 48.70, marketValue: 25324, weight: 5.1, targetWeight: 5.0, pnl: 5304, pnlPercent: 26.5, dividendYield: 0.6, score: 86 },
  { ticker: "VMID", name: "Vanguard FTSE 250", layer: "Core", shares: 1800, avgCost: 31.20, currentPrice: 35.60, marketValue: 64080, weight: 12.9, targetWeight: 12.0, pnl: 7920, pnlPercent: 14.1, dividendYield: 3.1, score: 80 },
  { ticker: "BATS", name: "British American Tobacco", layer: "Income", shares: 900, avgCost: 24.80, currentPrice: 28.40, marketValue: 25560, weight: 5.2, targetWeight: 4.5, pnl: 3240, pnlPercent: 14.5, dividendYield: 7.8, score: 72 },
  { ticker: "DGE", name: "Diageo", layer: "Core", shares: 620, avgCost: 28.50, currentPrice: 26.80, marketValue: 16616, weight: 3.4, targetWeight: 3.5, pnl: -1054, pnlPercent: -5.9, dividendYield: 2.9, score: 68 },
  { ticker: "BNZL", name: "Bunzl plc", layer: "Growth", shares: 420, avgCost: 30.10, currentPrice: 36.80, marketValue: 15456, weight: 3.1, targetWeight: 3.0, pnl: 2814, pnlPercent: 22.2, dividendYield: 2.0, score: 84 },
];

export const layers = [
  { name: "Core", current: 49.3, target: 53.0, color: "hsl(var(--primary))" },
  { name: "Growth", current: 13.6, target: 14.0, color: "hsl(142, 70%, 45%)" },
  { name: "Income", current: 22.1, target: 21.5, color: "hsl(200, 70%, 50%)" },
  { name: "Tactical", current: 10.1, target: 8.0, color: "hsl(280, 60%, 55%)" },
  { name: "Cash", current: 4.9, target: 3.5, color: "hsl(var(--muted-foreground))" },
];

export const watchlist = [
  { ticker: "MNDI", name: "Mondi plc", price: 14.32, change: 2.1, signal: "Approaching support", rag: "green" as const },
  { ticker: "EXPN", name: "Experian", price: 34.80, change: -0.8, signal: "Earnings next week", rag: "amber" as const },
  { ticker: "DARK", name: "Darktrace", price: 4.15, change: -3.2, signal: "Below 200 DMA", rag: "red" as const },
  { ticker: "INF", name: "Informa plc", price: 8.42, change: 1.4, signal: "Breakout candidate", rag: "green" as const },
  { ticker: "AUTO", name: "Auto Trader", price: 7.88, change: 0.3, signal: "Consolidating", rag: "amber" as const },
  { ticker: "CRDA", name: "Croda International", price: 38.50, change: -1.7, signal: "Oversold territory", rag: "green" as const },
];

export const monitorMetrics = [
  { name: "Cost Curve Position", value: "Below Avg", detail: "Portfolio avg cost 14.2% below market", rag: "green" as const },
  { name: "Dividend Coverage", value: "2.4x", detail: "Income covers drawdown target", rag: "green" as const },
  { name: "Concentration Risk", value: "Top 5 = 43%", detail: "Slightly above 40% threshold", rag: "amber" as const },
  { name: "Sector Exposure", value: "Financials 22%", detail: "Above 20% single-sector limit", rag: "amber" as const },
  { name: "Drawdown Alert", value: "-2.8%", detail: "From 30-day high", rag: "green" as const },
  { name: "Correlation Cluster", value: "0.68", detail: "UK large-cap cluster detected", rag: "red" as const },
];

export const structuralTriggers = [
  { trigger: "Rebalance Due", condition: "Layer drift > 3%", status: "Tactical at +2.1%", rag: "amber" as const },
  { trigger: "Dividend Reinvest", condition: "Cash > £5k", status: "Cash at £4.2k", rag: "green" as const },
  { trigger: "Tax Year ISA", condition: "Allowance remaining", status: "£8,240 unused", rag: "amber" as const },
  { trigger: "Stop Loss", condition: "Any position -20%", status: "No triggers", rag: "green" as const },
  { trigger: "Score Review", condition: "Quarterly review due", status: "Due in 18 days", rag: "amber" as const },
];

export const goldenRules = [
  "Never add to a losing position without a thesis update",
  "No single position > 8% of portfolio",
  "Maintain minimum 3% cash buffer at all times",
  "Review every holding quarterly — no exceptions",
  "Income layer must cover annual drawdown target",
  "Rebalance when any layer drifts > 3% from target",
];

export const portfolioSummary = {
  totalValue: 495181,
  totalCost: 432650,
  totalPnl: 62531,
  totalPnlPercent: 14.45,
  annualIncome: 18420,
  yieldOnCost: 4.26,
  cashBalance: 24300,
  sippValue: 282161,
  isaValue: 212720,
};

export const returnsData = {
  ytd: 8.2,
  oneYear: 14.5,
  threeYear: 32.1,
  fiveYear: 58.4,
  sinceInception: 72.3,
  monthlyReturns: [
    { month: "Jan", return: 2.1 },
    { month: "Feb", return: -0.8 },
    { month: "Mar", return: 1.4 },
    { month: "Apr", return: 3.2 },
    { month: "May", return: -1.1 },
    { month: "Jun", return: 0.9 },
    { month: "Jul", return: 2.8 },
    { month: "Aug", return: -0.3 },
    { month: "Sep", return: 1.6 },
    { month: "Oct", return: -2.1 },
    { month: "Nov", return: 1.8 },
    { month: "Dec", return: 0.6 },
  ],
};

export const scores: { ticker: string; name: string; fundamentals: number; technicals: number; income: number; overall: number; trend: "up" | "down" | "flat" }[] = [
  { ticker: "VWRL", name: "Vanguard FTSE All-World", fundamentals: 95, technicals: 88, income: 72, overall: 92, trend: "up" },
  { ticker: "AZN", name: "AstraZeneca", fundamentals: 91, technicals: 86, income: 68, overall: 90, trend: "up" },
  { ticker: "VUSA", name: "Vanguard S&P 500", fundamentals: 90, technicals: 85, income: 65, overall: 88, trend: "flat" },
  { ticker: "IITU", name: "iShares S&P 500 IT", fundamentals: 88, technicals: 84, income: 30, overall: 86, trend: "up" },
  { ticker: "ULVR", name: "Unilever", fundamentals: 86, technicals: 80, income: 78, overall: 85, trend: "flat" },
  { ticker: "BNZL", name: "Bunzl plc", fundamentals: 85, technicals: 82, income: 70, overall: 84, trend: "up" },
  { ticker: "SHEL", name: "Shell plc", fundamentals: 82, technicals: 84, income: 80, overall: 83, trend: "flat" },
  { ticker: "LGEN", name: "Legal & General", fundamentals: 78, technicals: 76, income: 95, overall: 81, trend: "down" },
  { ticker: "VMID", name: "Vanguard FTSE 250", fundamentals: 80, technicals: 78, income: 74, overall: 80, trend: "flat" },
  { ticker: "HSBA", name: "HSBC Holdings", fundamentals: 76, technicals: 80, income: 88, overall: 79, trend: "up" },
  { ticker: "GSK", name: "GSK plc", fundamentals: 78, technicals: 74, income: 76, overall: 77, trend: "down" },
  { ticker: "RIO", name: "Rio Tinto", fundamentals: 74, technicals: 76, income: 90, overall: 76, trend: "flat" },
  { ticker: "SMT", name: "Scottish Mortgage IT", fundamentals: 72, technicals: 70, income: 20, overall: 74, trend: "up" },
  { ticker: "BATS", name: "British American Tobacco", fundamentals: 68, technicals: 72, income: 96, overall: 72, trend: "down" },
  { ticker: "DGE", name: "Diageo", fundamentals: 70, technicals: 60, income: 72, overall: 68, trend: "down" },
];
