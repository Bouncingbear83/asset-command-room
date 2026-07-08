import { useState, useEffect } from "react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useDailyPrices } from "@/hooks/useDailyPrices";
import CommandTab from "@/components/CommandTab";
import HoldingsTab from "@/components/HoldingsTab";
import WatchlistTab from "@/components/WatchlistTab";
import JisasTab from "@/components/JisasTab";
import ReturnsTab from "@/components/ReturnsTab";
import LayersTab from "@/components/LayersTab";
import MonitorTab from "@/components/MonitorTab";
import TransactionsTab from "@/components/TransactionsTab";
import ActionsTab from "@/components/actions/ActionsTab";

import IntelligenceTab from "@/pages/IntelligenceTab";
import DriversTab from "@/components/DriversTab";

import ResearchTab from "@/components/ResearchTab";
import VaultTab from "@/components/VaultTab";
import FactSheetProvider from "@/components/factsheet/FactSheetProvider";

const TABS = [
  "Command", "Holdings", "Watchlist", "JISAs",
  "Signals", "Layers", "Drivers", "Intelligence", "Research", "Vault",
  "Returns", "Actions", "Transactions"
] as const;
type Tab = (typeof TABS)[number];

const TAB_SLUGS: Record<Tab, string> = {
  Command: "command", Signals: "signals", Watchlist: "watchlist", Layers: "layers",
  Drivers: "drivers",
  Intelligence: "intelligence", Research: "research", Vault: "vault", Returns: "returns", Holdings: "holdings",
  Transactions: "transactions", JISAs: "jisas", Actions: "actions",
};
const SLUG_TO_TAB: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([t, s]) => [s, t as Tab]),
);
// Backward-compat: old slugs → new tabs
SLUG_TO_TAB["monitor"] = "Signals";
SLUG_TO_TAB["japan"] = "Holdings";
SLUG_TO_TAB["earnings"] = "Signals";

function tabFromUrl(): Tab {
  if (typeof window === "undefined") return "Command";
  const slug = new URLSearchParams(window.location.search).get("tab");
  return (slug && SLUG_TO_TAB[slug]) || "Command";
}

function hasMacroBannerContent(macroBanner: ReturnType<typeof usePortfolioData>["macroBanner"]) {
  if (!macroBanner) return false;
  return Object.values(macroBanner).some((value) => value !== null && value !== "");
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export default function Index() {
  const [active, setActive] = useState<Tab>(tabFromUrl);
  const [macroBannerOpen, setMacroBannerOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const portfolio = usePortfolioData();
  const { priceData } = useDailyPrices();
  const sippTotal = (portfolio.sipp.length > 0 ? portfolio.sipp.reduce((sum, holding) => sum + (holding.mv || 0), 0) : 575000) + portfolio.cashSipp;
  const isaTotal = (portfolio.isa.length > 0 ? portfolio.isa.reduce((sum, holding) => sum + (holding.mv || 0), 0) : 424000) + portfolio.cashIsa;
  const total = sippTotal + isaTotal;
  const showMacroBanner = hasMacroBannerContent(portfolio.macroBanner);

  const perf = portfolio.performance;
  const latestPerf = perf.length > 0 ? perf[perf.length - 1] : null;
  const prevPerf = perf.length > 1 ? perf[perf.length - 2] : null;
  const dailyChangePct = latestPerf && prevPerf && prevPerf.totalValue > 0
    ? ((latestPerf.totalValue - prevPerf.totalValue) / prevPerf.totalValue * 100)
    : null;

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sync active tab → URL (?tab=slug); default Command emits no param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = TAB_SLUGS[active];
    if (active === "Command") params.delete("tab");
    else params.set("tab", slug);
    const next = params.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [active]);

  // Sync URL → active tab on browser back/forward.
  useEffect(() => {
    const onPop = () => setActive(tabFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const s: Record<string, React.CSSProperties> = {
    app: { minHeight: "100vh", background: "var(--void)" },
    sep: { color: "var(--rim)", fontStyle: "normal", fontFamily: "var(--font-mono)", fontSize: 12 },
    sub: {
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--text-dim)",
      fontStyle: "normal",
    },
    meta: {
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: "0.06em",
      color: "var(--text-dim)",
      lineHeight: 1.6,
    },
    val: { color: "var(--gold)", fontWeight: 700 },
  };

  const changeArrow = dailyChangePct !== null
    ? dailyChangePct >= 0 ? "▲" : "▼"
    : null;
  const changeColor = dailyChangePct !== null
    ? dailyChangePct >= 0 ? "var(--green)" : "var(--red)"
    : "var(--text-dim)";

  return (
    <FactSheetProvider portfolio={portfolio} priceData={priceData}>
    <div style={s.app}>
      <header className="stellar-header">
        <div className="stellar-logo">
          <em>Stellar</em>
          <span style={s.sep}>|</span>
          <span style={s.sub}>Portfolio Command</span>
        </div>
        <div className="stellar-header-stats">
          <div style={s.meta}>AUM<br /><span style={s.val}>£{(total / 1000).toFixed(0)}k</span>{dailyChangePct !== null && <span style={{ fontSize: 9, color: changeColor, marginLeft: 4 }}>{changeArrow} {dailyChangePct >= 0 ? "+" : ""}{dailyChangePct.toFixed(1)}%</span>}</div>
          <div style={s.meta}>SIPP<br /><span style={s.val}>£{(sippTotal / 1000).toFixed(0)}k</span></div>
          <div style={s.meta}>ISA<br /><span style={s.val}>£{(isaTotal / 1000).toFixed(0)}k</span></div>
          <div style={s.meta}>TARGET<br /><span style={s.val}>15–20% PA</span></div>
        </div>
      </header>

      <div className="stellar-status">
        {portfolio.loading && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", color: "var(--accent)" }}>● SYNCING...</span>}
        {portfolio.lastUpdated && !portfolio.loading && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", color: "var(--green)" }}>● LIVE · {portfolio.lastUpdated}</span>}
        {portfolio.error && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)" }}>⚠ {portfolio.error}</span>}
        {!portfolio.loading && <button onClick={portfolio.refresh} style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", padding: "2px 10px", cursor: "pointer" }}>REFRESH</button>}
      </div>

      <nav className="stellar-nav">
        {TABS.map((t) => (
          <button
            key={t}
            className={`stellar-tab${active === t ? " stellar-tab-active" : ""}`}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      {showMacroBanner && portfolio.macroBanner && (
        <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--rim)", padding: "0 var(--app-px, 40px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", cursor: "pointer" }} onClick={() => setMacroBannerOpen(!macroBannerOpen)}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {portfolio.macroBanner.vix !== null && <span>VIX {portfolio.macroBanner.vix}</span>}
              {portfolio.macroBanner.sp500YtdPct !== null && <><span style={{ color: "var(--text-dim)" }}>·</span><span>S&P YTD {formatPercent(portfolio.macroBanner.sp500YtdPct)}</span></>}
              {portfolio.macroBanner.goldUsd !== null && <><span style={{ color: "var(--text-dim)" }}>·</span><span>Gold ${portfolio.macroBanner.goldUsd.toLocaleString()}</span></>}
              {portfolio.macroBanner.pauseActive && <><span style={{ color: "var(--text-dim)" }}>·</span><span>Pause {portfolio.macroBanner.pauseActive}</span></>}
              {portfolio.macroBanner.earningsBlackout && <><span style={{ color: "var(--text-dim)" }}>·</span><span>Earnings {portfolio.macroBanner.earningsBlackout}</span></>}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", transform: macroBannerOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
          </div>
          {macroBannerOpen && (
            <div style={{ paddingBottom: 10, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.03em" }}>
              {portfolio.macroBanner.posture && <>REGIME: {portfolio.macroBanner.posture}</>}
              {portfolio.macroBanner.headline && <span style={{ display: "block", marginTop: 2, fontSize: 10, opacity: 0.7 }}>{portfolio.macroBanner.headline}</span>}
            </div>
          )}
        </div>
      )}

      <div className="stellar-page">
        {active === "Command" && <CommandTab />}
        {active === "Signals" && <MonitorTab monitorData={portfolio.monitor} weeklyTriggers={portfolio.weeklyTriggers} earningsCalendar={portfolio.earningsCalendar} />}
        {active === "Watchlist" && <WatchlistTab liveData={portfolio.watchlist} macroState={portfolio.macroState} scores={portfolio.scores} holdings={[...portfolio.sipp, ...portfolio.isa, ...portfolio.bordier]} />}        
        {active === "Layers" && (
          <LayersTab
            liveData={portfolio.layers}
            watchlist={portfolio.watchlist}
            narrative={portfolio.narrativeData}
            holdings={[...portfolio.sipp, ...portfolio.isa, ...portfolio.bordier]}
            scores={portfolio.scores}
            onNavigateToHoldings={(tickers) => {
              const params = new URLSearchParams(window.location.search);
              params.set("tab", "holdings");
              if (tickers.length > 0) params.set("tickers", tickers.join(","));
              else params.delete("tickers");
              window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
              setActive("Holdings");
            }}
          />
        )}
        {active === "Intelligence" && <IntelligenceTab />}
        {active === "Research" && <ResearchTab />}
        {active === "Vault" && <VaultTab />}
        {active === "Drivers" && <DriversTab holdings={[...portfolio.sipp, ...portfolio.isa, ...portfolio.bordier]} />}
        
        {active === "Returns" && <ReturnsTab sipp={portfolio.sipp} isa={portfolio.isa} bordier={portfolio.bordier} performance={portfolio.performance} cashSipp={portfolio.cashSipp} cashIsa={portfolio.cashIsa} />}
        {active === "Holdings" && <HoldingsTab sipp={portfolio.sipp} isa={portfolio.isa} bordier={portfolio.bordier} disruption={portfolio.disruption} transactions={portfolio.transactions} scores={portfolio.scores} priceData={priceData} />}
        {active === "Transactions" && <TransactionsTab transactions={portfolio.transactions} scores={portfolio.scores} layers={portfolio.layers} holdings={[...portfolio.sipp, ...portfolio.isa, ...portfolio.bordier, ...portfolio.jisaHoldings.map((j) => ({ ticker: j.ticker, name: j.name, layer: j.layer, account: `JISA-${j.child}`, mv: j.mvGbp || 0, gl: j.glPct || 0, day: 0, aum_pct: 0, pct_below_52w_high: 0, pct_above_52w_low: 0, notes: "", action: "HOLD", price: j.priceLocal, prevClose: null, currency: j.currency, costGbp: j.costGbp, costLocal: null, shares: j.shares, add_trigger: "", exit_trigger: "", trigger_type: "", trigger_price_add: "", trigger_price_exit: "", alert_status: "CLEAR", alert_fired_date: "", ma60: null, high_52w: null, low_52w: null, deploy_target_gbp: null, deploy_note: "", trigger_review_date: "", trigger_review_note: "", factor_primary: "", factor_group: "", stack_layer: "", priceAtFirstAdd: null, firstAddDate: "", priceAtLastScore: null }))]} />}
        {active === "JISAs" && <JisasTab jisaHoldings={portfolio.jisaHoldings} jisaTotals={portfolio.jisaTotals} transactions={portfolio.transactions} layers={portfolio.layers} performance={portfolio.performance} />}
        {active === "Actions" && <ActionsTab />}
      </div>

      <button
        className={`back-to-top${showBackToTop ? " visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
      >↑</button>
    </div>
    </FactSheetProvider>
  );
}
