import { LiveLayer, LiveRiskControl, LiveMacroStateRow } from "@/hooks/usePortfolioData";

const CLAUDE_PROJECT_BASE_URL = "https://claude.ai/project/be2a318a-707e-4e8d-ae4b-23f3eab50633";

const SESSION_PROMPT = `New Stellar session.

Execute immediately:

1. Load HOLDINGS + LAYERS + CASH + MACRO_STATE via Sheet Reader

2. Pull review flag summary from HOLDINGS cols AI-AJ — count W_EXIT, W_FACTOR, W_STALE, M_REVIEW, Q_REVIEW

3. Produce one-screen portfolio dashboard:

   - AUM, MV, cash split by account

   - Layer weight vs target table, flag >3% gaps

   - PAUSE_ACTIVE status, hedge floor compliance

   - Flag count by type with priority ranking

   - Top 3 SIZE UP queue items if any

4. End with: "Where do you want to focus?" — offer Layer Gaps / Review Queue / Ad Hoc

No actions, no commits. Just orientation.`;

interface Props {
  layers: LiveLayer[];
  riskControls: LiveRiskControl[];
  macroState: Record<string, LiveMacroStateRow>;
  cashGbp: number;
  isMobile: boolean;
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(0)}k`;
  return `£${value.toFixed(0)}`;
}

function deriveRiskCounts(controls: LiveRiskControl[]) {
  let safe = 0, watch = 0, breach = 0;
  for (const r of controls) {
    const s = (r.status || "").toUpperCase();
    if (s === "BREACH" || s === "RED") breach++;
    else if (s === "WATCH" || s === "AMBER" || s === "WARNING") watch++;
    else safe++;
  }
  return { safe, watch, breach };
}

function deriveMacroCounts(state: Record<string, LiveMacroStateRow>) {
  let green = 0, amber = 0, red = 0;
  const keys = ["VIX", "SP500_YTD_PCT", "GOLD_USD", "PAUSE_ACTIVE", "EARNINGS_BLACKOUT"];
  for (const k of keys) {
    const row = state[k];
    if (!row) continue;
    const current = row.currentValue.toUpperCase();
    if (current === "YES" || current === "TRUE" || current === "ACTIVE") red++;
    else if (current === "NO" || current === "FALSE" || current === "INACTIVE" || current === "CLEAR") green++;
    else if ((row.status || "").toUpperCase() === "AMBER") amber++;
    else green++;
  }
  return { green, amber, red };
}

export default function CommandHeader({ layers, riskControls, macroState, cashGbp, isMobile }: Props) {
  const totalRow = layers.find((l) => l.name.toUpperCase() === "TOTAL");
  const aum = totalRow?.mv ?? layers.reduce((s, l) => s + l.mv, 0);
  const risk = deriveRiskCounts(riskControls);
  const macro = deriveMacroCounts(macroState);

  const chipBase: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.08em",
    padding: "2px 6px",
    borderRadius: 2,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? 8 : 12,
      padding: isMobile ? "10px 12px" : "10px 16px",
      background: "var(--panel)",
      border: "1px solid var(--rim)",
      borderBottom: "2px solid var(--gold)",
      marginBottom: 16,
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      {/* Start Session CTA */}
      <a
        href={`${CLAUDE_PROJECT_BASE_URL}?q=${encodeURIComponent(SESSION_PROMPT)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: "var(--gold)",
          color: "var(--void)",
          border: "none",
          padding: isMobile ? "8px 16px" : "6px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          textDecoration: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Start Session
      </a>

      {/* Status chips */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        flex: 1,
      }}>
        {/* Risk */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ ...chipBase, color: "var(--text-dim)" }}>RISK</span>
          {risk.safe > 0 && <span style={{ ...chipBase, color: "var(--green)", background: "var(--green-dim)" }}>{risk.safe}✓</span>}
          {risk.watch > 0 && <span style={{ ...chipBase, color: "var(--amber)", background: "var(--amber-dim)" }}>{risk.watch}⚠</span>}
          {risk.breach > 0 && <span style={{ ...chipBase, color: "var(--red)", background: "var(--red-dim)", fontWeight: 700 }}>{risk.breach}✗</span>}
        </div>

        {/* Macro */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ ...chipBase, color: "var(--text-dim)" }}>MACRO</span>
          {macro.green > 0 && <span style={{ ...chipBase, color: "var(--green)", background: "var(--green-dim)" }}>{macro.green}✓</span>}
          {macro.amber > 0 && <span style={{ ...chipBase, color: "var(--amber)", background: "var(--amber-dim)" }}>{macro.amber}⚠</span>}
          {macro.red > 0 && <span style={{ ...chipBase, color: "var(--red)", background: "var(--red-dim)", fontWeight: 700 }}>{macro.red}✗</span>}
        </div>

        {/* AUM + Cash */}
        <span style={{ ...chipBase, color: "var(--text-mid)", marginLeft: "auto" }}>
          {formatCurrency(aum)} AUM
        </span>
        <span style={{ ...chipBase, color: cashGbp > 20_000 ? "var(--green)" : "var(--amber)" }}>
          {formatCurrency(cashGbp)} cash
        </span>
      </div>
    </div>
  );
}
