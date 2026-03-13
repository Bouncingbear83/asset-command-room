import { useState } from "react";
import CommandTab from "@/components/CommandTab";
import MonitorTab from "@/components/MonitorTab";
import WatchlistTab from "@/components/WatchlistTab";
import LayersTab from "@/components/LayersTab";
import ScoresTab from "@/components/ScoresTab";
import ReturnsTab from "@/components/ReturnsTab";
import HoldingsTab from "@/components/HoldingsTab";
import { usePortfolioData } from "@/hooks/usePortfolioData";

const TABS = ["Command", "Monitor", "Watchlist", "Layers", "Scores", "Returns", "Holdings"] as const;
type Tab = (typeof TABS)[number];

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
  logoSep: { color: "var(--rim)", fontStyle: "normal", fontFamily: "var(--font-mono)", fontSize: 12 },
  logoSub: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "var(--text-dim)",
    fontStyle: "normal",
  },
  headerMid: { display: "flex", gap: 32 },
  metaBlock: { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", color: "var(--text-dim)" },
  metaVal: { color: "var(--gold)", fontWeight: 700 },
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
  tabActive: { color: "var(--gold)", borderBottomColor: "var(--gold)" },
  container: { maxWidth: 1280, margin: "0 auto", padding: "32px 40px 80px" },
};

export default function Index() {
  const [active, setActive] = useState<Tab>("Command");
  const { holdings, watchlist, layers, scores, lastUpdated, loading, error } = usePortfolioData();

  return (
    <div style={s.app}>
      <header style={s.header}>
        <div style={s.logo}>
          <em>Stellar</em>
          <span style={s.logoSep}>|</span>
          <span style={s.logoSub}>Portfolio Command</span>
        </div>
        <div style={s.headerMid}>
          <div style={s.metaBlock}>
            AUM
            <br />
            <span style={s.metaVal}>~£1000K</span>
          </div>
          <div style={s.metaBlock}>
            TARGET
            <br />
            <span style={s.metaVal}>15–20% PA</span>
          </div>
          <div style={s.metaBlock}>
            ACCOUNTS
            <br />
            <span style={s.metaVal}>SIPP + ISA</span>
          </div>
        </div>
      </header>

      <nav style={s.nav}>
        {TABS.map((t) => (
          <button key={t} style={active === t ? { ...s.tab, ...s.tabActive } : s.tab} onClick={() => setActive(t)}>
            {t}
          </button>
        ))}
      </nav>

      {/* Status bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "6px 40px",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.1em",
        borderBottom: "1px solid var(--rim)",
        background: "rgba(4,4,10,0.6)",
      }}>
        {loading && (
          <span style={{ color: "var(--gold)", animation: "pulse 1.5s infinite" }}>● REFRESHING…</span>
        )}
        {lastUpdated && !loading && (
          <span style={{ color: "var(--text-dim)" }}>SHEET SYNC: {lastUpdated}</span>
        )}
        {error && (
          <span style={{ color: "var(--red)" }}>ERROR: {error} — using fallback data</span>
        )}
        {!loading && !error && lastUpdated && (
          <span style={{ color: "var(--green)" }}>● LIVE</span>
        )}
      </div>

      <div style={s.container}>
        {active === "Command" && <CommandTab />}
        {active === "Monitor" && <MonitorTab />}
        {active === "Watchlist" && <WatchlistTab liveData={watchlist.length > 0 ? watchlist : undefined} />}
        {active === "Layers" && <LayersTab liveData={layers.length > 0 ? layers : undefined} />}
        {active === "Scores" && <ScoresTab />}
        {active === "Returns" && <ReturnsTab />}
        {active === "Holdings" && <HoldingsTab liveData={holdings.length > 0 ? holdings : undefined} />}
      </div>
    </div>
  );
}
