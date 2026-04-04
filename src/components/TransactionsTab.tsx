import { useState, useMemo } from "react";
import { LiveTransaction, LiveScore, LiveLayer } from "@/hooks/usePortfolioData";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  transactions: LiveTransaction[];
  scores: LiveScore[];
  layers: LiveLayer[];
}

const BUY_ACTIONS = ["BUY", "SIZE_UP"];
const SELL_ACTIONS = ["SELL", "TRIM", "EXIT"];
const DIV_ACTIONS = ["DIVIDEND"];

function actionBadgeStyle(action: string): React.CSSProperties {
  if (BUY_ACTIONS.includes(action)) return { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" };
  if (SELL_ACTIONS.includes(action)) return { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" };
  if (DIV_ACTIONS.includes(action)) return { background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" };
  return { background: "rgba(255,255,255,0.05)", color: "var(--text-dim)" };
}

function trancheBadge(tranche: string): React.CSSProperties {
  return { background: "rgba(255,255,255,0.06)", color: "var(--text-dim)", border: "1px solid var(--rim)" };
}

function formatCurrency(val: number | null, prefix = "£"): string {
  if (val === null || val === undefined) return "—";
  return `${prefix}${Math.abs(val).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function formatPrice(val: number | null, ccy: string): string {
  if (val === null) return "—";
  const sym = ccy === "GBP" ? "£" : ccy === "EUR" ? "€" : "$";
  return `${sym}${val.toFixed(2)}`;
}

const currentYear = new Date().getFullYear();

const ACCOUNT_OPTIONS = ["All", "SIPP", "ISA", "JISA-Bear", "JISA-Alfie", "JISA-Edie"];
const ACTION_OPTIONS = ["All", "BUY", "SELL", "DIVIDEND"];

const badge: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
  padding: "2px 8px", borderRadius: 4, display: "inline-block",
};

const cardStyle: React.CSSProperties = {
  background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 6,
  padding: "12px 16px", flex: "1 1 0",
};

const metaLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em",
  textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4,
};

const metaVal: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--gold)",
};

type SortKey = "date" | "ticker" | "action" | "shares" | "price" | "currency" | "valueGbp" | "tranche" | "layer" | "account" | "scoreAtEntry";
type SortDir = "asc" | "desc";

export default function TransactionsTab({ transactions, scores, layers }: Props) {
  const isMobile = useIsMobile();
  const [accountFilter, setAccountFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [layerFilter, setLayerFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [drillTicker, setDrillTicker] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const layerHexMap = useMemo(() => {
    const map: Record<string, string> = {};
    layers.forEach(l => { if (l.hexColor) map[l.name.toLowerCase()] = l.hexColor; });
    return map;
  }, [layers]);

  const uniqueLayers = useMemo(() => {
    const set = new Set(transactions.map(t => t.layer).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [transactions]);

  const filtered = useMemo(() => {
    const base = transactions.filter(t => {
      if (accountFilter !== "All" && t.account.toUpperCase() !== accountFilter) return false;
      if (actionFilter !== "All") {
        if (actionFilter === "BUY" && !BUY_ACTIONS.includes(t.action)) return false;
        if (actionFilter === "SELL" && !SELL_ACTIONS.includes(t.action)) return false;
        if (actionFilter === "DIVIDEND" && !DIV_ACTIONS.includes(t.action)) return false;
      }
      if (layerFilter !== "All" && t.layer !== layerFilter) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
    const mul = sortDir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv)) * mul;
    });
  }, [transactions, accountFilter, actionFilter, layerFilter, dateFrom, dateTo, sortKey, sortDir]);

  // YTD summary
  const ytd = useMemo(() => filtered.filter(t => t.date >= `${currentYear}-01-01`), [filtered]);
  const deployed = useMemo(() => ytd.filter(t => BUY_ACTIONS.includes(t.action)).reduce((s, t) => s + (t.valueGbp || 0), 0), [ytd]);
  const exited = useMemo(() => ytd.filter(t => SELL_ACTIONS.includes(t.action)).reduce((s, t) => s + Math.abs(t.valueGbp || 0), 0), [ytd]);
  const tradeCount = useMemo(() => ytd.filter(t => !DIV_ACTIONS.includes(t.action)).length, [ytd]);

  // Drill-down
  if (drillTicker) {
    return <TickerDrillDown
      ticker={drillTicker}
      transactions={transactions}
      scores={scores}
      layerHexMap={layerHexMap}
      onBack={() => setDrillTicker(null)}
      isMobile={isMobile}
    />;
  }

  const toggleBtn = (label: string, active: boolean, onClick: () => void): React.CSSProperties => ({
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
    padding: "4px 12px", cursor: "pointer", borderRadius: 4,
    border: active ? "1px solid var(--gold)" : "1px solid var(--rim)",
    background: active ? "rgba(200,169,110,0.12)" : "transparent",
    color: active ? "var(--gold)" : "var(--text-dim)",
  });

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={cardStyle}><div style={metaLabel}>DEPLOYED YTD</div><div style={metaVal}>{formatCurrency(deployed)}</div></div>
        <div style={cardStyle}><div style={metaLabel}>EXITED YTD</div><div style={metaVal}>{formatCurrency(exited)}</div></div>
        <div style={cardStyle}><div style={metaLabel}>NET DEPLOYED</div><div style={{ ...metaVal, color: deployed - exited >= 0 ? "var(--green)" : "var(--red)" }}>{formatCurrency(deployed - exited)}</div></div>
        <div style={cardStyle}><div style={metaLabel}>TRADES YTD</div><div style={metaVal}>{tradeCount}</div></div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {ACCOUNT_OPTIONS.map(a => (
          <button key={a} style={toggleBtn(a, accountFilter === a, () => setAccountFilter(a))} onClick={() => setAccountFilter(a)}>{a}</button>
        ))}
        <span style={{ color: "var(--rim)", margin: "0 4px" }}>|</span>
        {ACTION_OPTIONS.map(a => (
          <button key={a} style={toggleBtn(a, actionFilter === a, () => setActionFilter(a))} onClick={() => setActionFilter(a)}>{a}</button>
        ))}
        <span style={{ color: "var(--rim)", margin: "0 4px" }}>|</span>
        <select
          value={layerFilter}
          onChange={e => setLayerFilter(e.target.value)}
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--panel)", color: "var(--text-dim)", border: "1px solid var(--rim)", borderRadius: 4, padding: "4px 8px" }}
        >
          {uniqueLayers.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--panel)", color: "var(--text-dim)", border: "1px solid var(--rim)", borderRadius: 4, padding: "4px 8px" }} />
        <span style={{ color: "var(--text-dim)", fontSize: 10 }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--panel)", color: "var(--text-dim)", border: "1px solid var(--rim)", borderRadius: 4, padding: "4px 8px" }} />
      </div>

      {/* Transaction Table / Cards */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((t, i) => (
            <div key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)", border: "1px solid var(--rim)", borderRadius: 6, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--gold)", cursor: "pointer" }} onClick={() => setDrillTicker(t.ticker)}>{t.ticker}</span>
                <span style={{ ...badge, ...actionBadgeStyle(t.action) }}>{t.action}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span>{t.date}</span>
                <span>{t.shares ?? "—"} @ {formatPrice(t.price, t.currency)}</span>
                <span>{formatCurrency(t.valueGbp)}</span>
                {t.tranche && <span style={{ ...badge, ...trancheBadge(t.tranche) }}>{t.tranche}</span>}
                <span>{t.account}</span>
              </div>
              {(t.rationale || t.trigger) && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 6, opacity: 0.7 }}>
                  {t.trigger && <div><span style={{ color: "var(--gold)" }}>Trigger:</span> {t.trigger}</div>}
                  {t.rationale && <div><span style={{ color: "var(--gold)" }}>Rationale:</span> {t.rationale}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--rim)", color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {([
                  ["date", "Date", "left"],
                  ["ticker", "Ticker", "left"],
                  ["action", "Action", "left"],
                  ["shares", "Shares", "right"],
                  ["price", "Price", "right"],
                  ["currency", "Ccy", "center"],
                  ["valueGbp", "Value £", "right"],
                  ["tranche", "Tranche", "center"],
                  ["layer", "Layer", "left"],
                  ["account", "Account", "center"],
                  ["scoreAtEntry", "Score", "right"],
                ] as [SortKey, string, string][]).map(([key, label, align]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{ textAlign: align as any, padding: "8px 6px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                  >
                    {label} {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const hexColor = layerHexMap[t.layer.toLowerCase()] || "var(--text-dim)";
                const hasTooltip = t.trigger || t.rationale;
                return (
                  <tr
                    key={i}
                    className="txn-row"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)", position: "relative" }}
                  >
                    <td style={{ padding: "7px 6px", color: "var(--text-dim)" }}>{t.date}</td>
                    <td style={{ padding: "7px 6px", fontWeight: 700, color: "var(--gold)", cursor: "pointer" }} onClick={() => setDrillTicker(t.ticker)}>{t.ticker}</td>
                    <td style={{ padding: "7px 6px" }}><span style={{ ...badge, ...actionBadgeStyle(t.action) }}>{t.action}</span></td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: t.shares !== null && t.shares < 0 ? "var(--red)" : "var(--text)" }}>{t.shares ?? "—"}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{formatPrice(t.price, t.currency)}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center", color: "var(--text-dim)", fontSize: 9 }}>{t.currency}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{formatCurrency(t.valueGbp)}</td>
                    <td style={{ padding: "7px 6px", textAlign: "center" }}>{t.tranche ? <span style={{ ...badge, ...trancheBadge(t.tranche) }}>{t.tranche}</span> : "—"}</td>
                    <td style={{ padding: "7px 6px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: hexColor, display: "inline-block" }} />
                        <span style={{ color: "var(--text-dim)" }}>{t.layer}</span>
                      </span>
                    </td>
                    <td style={{ padding: "7px 6px", textAlign: "center" }}>
                      <span style={{ ...badge, background: "rgba(255,255,255,0.06)", color: "var(--text-dim)", border: "1px solid var(--rim)" }}>{t.account}</span>
                    </td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text)" }}>{t.scoreAtEntry ?? "—"}</td>
                    {hasTooltip && (
                      <td className="txn-tooltip" style={{
                        position: "absolute", left: 0, top: "100%", zIndex: 20,
                        background: "var(--panel)", border: "1px solid var(--rim)", borderRadius: 4,
                        padding: "6px 10px", maxWidth: 500, whiteSpace: "normal",
                        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)",
                        pointerEvents: "none", display: "none",
                      }}>
                        {t.trigger && <div style={{ marginBottom: 2 }}><span style={{ color: "var(--gold)" }}>Trigger:</span> {t.trigger}</div>}
                        {t.rationale && <div><span style={{ color: "var(--gold)" }}>Rationale:</span> {t.rationale}</div>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No transactions match filters</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Ticker Drill-Down ── */
interface DrillProps {
  ticker: string;
  transactions: LiveTransaction[];
  scores: LiveScore[];
  layerHexMap: Record<string, string>;
  onBack: () => void;
  isMobile: boolean;
}

type DrillSortKey = "date" | "action" | "shares" | "price" | "valueGbp" | "tranche" | "account";

function TickerDrillDown({ ticker, transactions, scores, layerHexMap, onBack, isMobile }: DrillProps) {
  const [accountFilter, setAccountFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<DrillSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: DrillSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const tickerTxns = useMemo(() => transactions.filter(t => t.ticker === ticker), [transactions, ticker]);

  const drillAccountOptions = useMemo(() => {
    const set = new Set(tickerTxns.map(t => t.account));
    return ["All", ...Array.from(set).sort()];
  }, [tickerTxns]);

  const filtered = useMemo(() => {
    const base = tickerTxns.filter(t => {
      if (accountFilter !== "All" && t.account !== accountFilter) return false;
      if (actionFilter !== "All") {
        if (actionFilter === "BUY" && !BUY_ACTIONS.includes(t.action)) return false;
        if (actionFilter === "SELL" && !SELL_ACTIONS.includes(t.action)) return false;
        if (actionFilter === "DIVIDEND" && !DIV_ACTIONS.includes(t.action)) return false;
      }
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
    const mul = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv)) * mul;
    });
  }, [tickerTxns, accountFilter, actionFilter, dateFrom, dateTo, sortKey, sortDir]);

  const trades = useMemo(() => filtered.filter(t => !DIV_ACTIONS.includes(t.action)), [filtered]);
  const dividends = useMemo(() => filtered.filter(t => DIV_ACTIONS.includes(t.action)), [filtered]);

  const currentScore = scores.find(s => s.ticker === ticker);
  const firstTxn = tickerTxns[tickerTxns.length - 1];
  const name = currentScore?.name || firstTxn?.ticker || "";
  const layer = firstTxn?.layer || currentScore?.layer || "";
  const tier = currentScore?.tier || "";

  // Position summary (always from unfiltered data)
  const allTrades = useMemo(() => tickerTxns.filter(t => !DIV_ACTIONS.includes(t.action)), [tickerTxns]);
  const sharesByAccount: Record<string, number> = {};
  allTrades.forEach(t => {
    const acct = t.account;
    sharesByAccount[acct] = (sharesByAccount[acct] || 0) + (t.shares || 0);
  });

  const buys = allTrades.filter(t => (t.shares || 0) > 0);
  const totalCost = buys.reduce((s, t) => s + (t.valueGbp || 0), 0);
  const totalSharesBought = buys.reduce((s, t) => s + (t.shares || 0), 0);
  const avgPrice = totalSharesBought > 0 ? totalCost / totalSharesBought : 0;

  const hexColor = layerHexMap[layer.toLowerCase()] || "var(--text-dim)";

  const toggleBtn = (label: string, active: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
    padding: "4px 12px", cursor: "pointer", borderRadius: 4,
    border: active ? "1px solid var(--gold)" : "1px solid var(--rim)",
    background: active ? "rgba(200,169,110,0.12)" : "transparent",
    color: active ? "var(--gold)" : "var(--text-dim)",
  });

  return (
    <div>
      <button
        onClick={onBack}
        style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", marginBottom: 16, letterSpacing: "0.1em" }}
      >
        ← Back to all transactions
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>
          {ticker} {name && <span style={{ fontWeight: 400, fontSize: 13, color: "var(--text-dim)" }}>— {name}</span>}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: hexColor, display: "inline-block" }} />
            Layer: {layer}
          </span>
          {currentScore?.score !== null && currentScore?.score !== undefined && <span>Current Score: {currentScore.score}</span>}
          {tier && <span>Tier: {tier}</span>}
        </div>
      </div>

      {/* Position Summary Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={metaLabel}>NET SHARES</div>
          <div style={metaVal}>
            {Object.entries(sharesByAccount).map(([acct, sh]) => (
              <div key={acct} style={{ fontSize: 14 }}>{sh} <span style={{ fontSize: 9, color: "var(--text-dim)", fontWeight: 400 }}>({acct})</span></div>
            ))}
          </div>
        </div>
        <div style={cardStyle}><div style={metaLabel}>TOTAL COST</div><div style={metaVal}>{formatCurrency(totalCost)}</div></div>
        <div style={cardStyle}>
          <div style={metaLabel}>AVG PRICE</div>
          <div style={metaVal}>{avgPrice > 0 ? formatPrice(avgPrice, firstTxn?.currency || "USD") : "—"}</div>
        </div>
      </div>

      {/* Score delta */}
      {firstTxn?.scoreAtEntry !== null && currentScore?.score !== null && currentScore?.score !== undefined && firstTxn?.scoreAtEntry !== undefined && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>
          Score at entry: {firstTxn.scoreAtEntry} → Current: {currentScore.score}
          <span style={{ color: (currentScore.score - firstTxn.scoreAtEntry) >= 0 ? "var(--green)" : "var(--red)", marginLeft: 8 }}>
            ({(currentScore.score - firstTxn.scoreAtEntry) >= 0 ? "+" : ""}{currentScore.score - firstTxn.scoreAtEntry})
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {drillAccountOptions.map(a => (
          <button key={a} style={toggleBtn(a, accountFilter === a)} onClick={() => setAccountFilter(a)}>{a}</button>
        ))}
        <span style={{ color: "var(--rim)", margin: "0 4px" }}>|</span>
        {ACTION_OPTIONS.map(a => (
          <button key={a} style={toggleBtn(a, actionFilter === a)} onClick={() => setActionFilter(a)}>{a}</button>
        ))}
        <span style={{ color: "var(--rim)", margin: "0 4px" }}>|</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--panel)", color: "var(--text-dim)", border: "1px solid var(--rim)", borderRadius: 4, padding: "4px 8px" }} />
        <span style={{ color: "var(--text-dim)", fontSize: 10 }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--panel)", color: "var(--text-dim)", border: "1px solid var(--rim)", borderRadius: 4, padding: "4px 8px" }} />
      </div>

      {/* Transaction History */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>Transaction History</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11, marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--rim)", color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            {([
              ["date", "Date", "left"],
              ["action", "Action", "left"],
              ["shares", "Shares", "right"],
              ["price", "Price", "right"],
              ["valueGbp", "Value £", "right"],
              ["tranche", "Tranche", "center"],
              ["account", "Account", "center"],
            ] as [DrillSortKey, string, string][]).map(([key, label, align]) => (
              <th
                key={key}
                onClick={() => handleSort(key)}
                style={{ textAlign: align as any, padding: "8px 6px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
              >
                {label} {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)" }}>
              <td style={{ padding: "7px 6px", color: "var(--text-dim)" }}>{t.date}</td>
              <td style={{ padding: "7px 6px" }}><span style={{ ...badge, ...actionBadgeStyle(t.action) }}>{t.action}</span></td>
              <td style={{ padding: "7px 6px", textAlign: "right", color: t.shares !== null && t.shares < 0 ? "var(--red)" : "var(--text)" }}>{t.shares ?? "—"}</td>
              <td style={{ padding: "7px 6px", textAlign: "right" }}>{formatPrice(t.price, t.currency)}</td>
              <td style={{ padding: "7px 6px", textAlign: "right" }}>{formatCurrency(t.valueGbp)}</td>
              <td style={{ padding: "7px 6px", textAlign: "center" }}>{t.tranche ? <span style={{ ...badge, ...trancheBadge(t.tranche) }}>{t.tranche}</span> : "—"}</td>
              <td style={{ padding: "7px 6px", textAlign: "center" }}><span style={{ ...badge, background: "rgba(255,255,255,0.06)", color: "var(--text-dim)", border: "1px solid var(--rim)" }}>{t.account}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dividends */}
      {dividends.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>Dividends</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--rim)", color: "var(--text-dim)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                <th style={{ textAlign: "left", padding: "8px 6px" }}>Date</th>
                <th style={{ textAlign: "right", padding: "8px 6px" }}>Amount</th>
                <th style={{ textAlign: "center", padding: "8px 6px" }}>Account</th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((t, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "7px 6px", color: "var(--text-dim)" }}>{t.date}</td>
                  <td style={{ padding: "7px 6px", textAlign: "right" }}>{formatCurrency(t.valueGbp)}</td>
                  <td style={{ padding: "7px 6px", textAlign: "center" }}><span style={{ ...badge, background: "rgba(255,255,255,0.06)", color: "var(--text-dim)", border: "1px solid var(--rim)" }}>{t.account}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No transactions match filters</div>
      )}
    </div>
  );
}
