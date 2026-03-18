import { useState } from "react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import CommandTab from "@/components/CommandTab";
import MonitorTab from "@/components/MonitorTab";
import WatchlistTab from "@/components/WatchlistTab";
import LayersTab from "@/components/LayersTab";
import ScoresTab from "@/components/ScoresTab";
import ReturnsTab from "@/components/ReturnsTab";
import HoldingsTab from "@/components/HoldingsTab";

const TABS = ["Command", "Monitor", "Watchlist", "Layers", "Scores", "Returns", "Holdings"] as const;
type Tab = (typeof TABS)[number];

function hasMacroBannerContent(macroBanner: ReturnType<typeof usePortfolioData>["macroBanner"]) {
  if (!macroBanner) return false;
  return Object.values(macroBanner).some((value) => value !== null && value !== "");
}

export default function Index() {
  const [active, setActive] = useState<Tab>("Command");
  const [macroBannerOpen, setMacroBannerOpen] = useState(true);
  const portfolio = usePortfolioData();
  const sippTotal = portfolio.sipp.length > 0 ? portfolio.sipp.reduce((sum, holding) => sum + (holding.mv || 0), 0) : 575000;
  const isaTotal = portfolio.isa.length > 0 ? portfolio.isa.reduce((sum, holding) => sum + (holding.mv || 0), 0) : 424000;
  const total = sippTotal + isaTotal;
  const showMacroBanner = hasMacroBannerContent(portfolio.macroBanner);

  const s: Record<string, React.CSSProperties> = {
    app: { minHeight: "100vh", background: "var(--void)" },
    header: {
      background: "rgba(4,4,10,0.96)",
      borderBottom: "1px solid var(--rim)",
      padding: "0 40px",
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    logo: {
      fontFamily: "var(--font-display)",
      fontSize: 22,
      fontStyle: "italic",
      color: "var(--text)",
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    sep: { color: "var(--rim)", fontStyle: "normal", fontFamily: "var(--font-mono)", fontSize: 12 },
    sub: {
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: "0.2em",
      textTransform: "uppercase" as const,
      color: "var(--text-dim)",
      fontStyle: "normal",
    },
    mid: { display: "flex", gap: 28, alignItems: "center" },
    meta: {
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: "0.06em",
      color: "var(--text-dim)",
      lineHeight: 1.6,
    },
    val: { color: "var(--gold)", fontWeight: 700 },
    nav: { display: "flex", borderBottom: "1px solid var(--rim)", padding: "0 40px" },
    tab: {
      background: "transparent",
      border: "none",
      borderBottom: "2px solid transparent",
      color: "var(--text-dim)",
      cursor: "pointer",
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const,
      padding: "20px 20px 18px",
      transition: "color 0.2s",
    },
    tabOn: { color: "var(--gold)", borderBottomColor: "var(--gold)" },
    status: {
      padding: "5px 40px",
      borderBottom: "1px solid var(--rim)",
      display: "flex",
      alignItems: "center",
      gap: 16,
      minHeight: 28,
    },
    page: { maxWidth: 1280, margin: "0 auto", padding: "32px 40px 80px" },
  };

  return (
    <div style={s.app}>
      <header style={s.header}>
        <div style={s.logo}>
          <em>Stellar</em>
          <span style={s.sep}>|</span>
          <span style={s.sub}>Portfolio Command</span>
        </div>
        <div style={s.mid}>
          <div style={s.meta}>AUM<br /><span style={s.val}>£{(total / 1000).toFixed(0)}k</span></div>
          <div style={s.meta}>SIPP<br /><span style={s.val}>£{(sippTotal / 1000).toFixed(0)}k</span></div>
          <div style={s.meta}>ISA<br /><span style={s.val}>£{(isaTotal / 1000).toFixed(0)}k</span></div>
          <div style={s.meta}>TARGET<br /><span style={s.val}>15–20% PA</span></div>
        </div>
      </header>

      <div style={s.status}>
        {portfolio.loading && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", color: "var(--accent)" }}>● SYNCING...</span>}
        {portfolio.lastUpdated && !portfolio.loading && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", color: "var(--green)" }}>● LIVE · {portfolio.lastUpdated}</span>}
        {portfolio.error && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)" }}>⚠ {portfolio.error}</span>}
        {!portfolio.loading && <button onClick={portfolio.refresh} style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", padding: "2px 10px", cursor: "pointer" }}>REFRESH</button>}
      </div>

      <nav style={s.nav}>
        {TABS.map((t) => <button key={t} style={active === t ? { ...s.tab, ...s.tabOn } : s.tab} onClick={() => setActive(t)}>{t}</button>)}
      </nav>

      {showMacroBanner && portfolio.macroBanner && (
        <div style={{ background: "var(--panel)", borderBottom: "1px solid var(--rim)", padding: "0 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", cursor: "pointer" }} onClick={() => setMacroBannerOpen(!macroBannerOpen)}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {portfolio.macroBanner.vix !== null && <span>VIX {portfolio.macroBanner.vix}</span>}
              {portfolio.macroBanner.sp500YtdPct !== null && <><span style={{ color: "var(--text-dim)" }}>·</span><span>S&P YTD {portfolio.macroBanner.sp500YtdPct}%</span></>}
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

      <div style={s.page}>
        {active === "Command" && <CommandTab />}
        {active === "Monitor" && <MonitorTab monitorData={portfolio.monitor} weeklyTriggers={portfolio.weeklyTriggers} />}
        {active === "Watchlist" && <WatchlistTab liveData={portfolio.watchlist} />}
        {active === "Layers" && <LayersTab liveData={portfolio.layers} watchlist={portfolio.watchlist} narrative={portfolio.narrativeData} />}
        {active === "Scores" && <ScoresTab scores={portfolio.scores} scoreLog={portfolio.scoreLog} disruptionData={portfolio.disruption} />}
        {active === "Returns" && <ReturnsTab sipp={portfolio.sipp} isa={portfolio.isa} performance={portfolio.performance} />}
        {active === "Holdings" && <HoldingsTab sipp={portfolio.sipp} isa={portfolio.isa} disruption={portfolio.disruption} />}
      </div>
    </div>
  );
}
