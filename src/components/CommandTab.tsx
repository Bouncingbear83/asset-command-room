import { useState } from "react";
import { RISK_CONTROLS, BUBBLE_FLAGS, GOLDEN_RULES } from "@/data/portfolio";
import { usePortfolioData } from "@/hooks/usePortfolioData";

const PROJECT_ID = "019ca3a9-aefe-77ea-af76-db62fd96f4e1";

const QUICK_COMMANDS = [
  {
    label: "Weekly check",
    prompt:
      "Run a weekly check. Search the web for: S&P 500, Nasdaq, and VIX current levels; uranium spot price; copper spot price; any holdings in my portfolio with >10% move this week. Compare against pause triggers (VIX >35) and Disruption Monitor AMBER/RED thresholds. Flag anything requiring action.",
  },
  {
    label: "Monthly review",
    prompt:
      "Run a monthly review. Start with the weekly check, then: rescore the 3 lowest-scoring holdings, check all layer weights vs targets, verify top-5 concentration is ≤35% AUM, confirm hedge floor is ≥12% AUM, check bio twin-risk (ILMN+TWST combined ≤11% AUM). Recommend any actions required.",
  },
  {
    label: "Quarterly review",
    prompt:
      "Run a quarterly review. Start with the monthly review, then refresh all 5 cost-curve metrics (solar LCOE, battery $/kWh, DNA synthesis $/bp, AI inference $/M tokens, humanoid unit production cost). Check all 6 structural triggers (China EUV access, AI drug Phase 3 trial, SSN(X) programme status, Kazatomprom Western market access, new major uranium mine, fleet closures). Update Disruption Monitor status and validate all thesis statements.",
  },
  {
    label: "Substrate audit",
    prompt:
      "Run a substrate audit across every current holding. For each position apply the substrate test: is this the thing without which the transformation stalls? Return a table: TICKER | PASS/FAIL | ONE-LINE SUBSTRATE ARGUMENT. Flag any that fail or are borderline.",
  },
  {
    label: "Layer gaps",
    prompt:
      "Analyse current layer weights vs targets (Compute 22%, Energy 15.3%, Materials 12.6%, Biological 20.1%, Sovereignty 10.4%, Robotics 9%, Hedge 15%+). Identify gaps, calculate £ required to reach target, and rank priority actions by conviction and current entry conditions.",
  },
  {
    label: "Reclassification risk",
    prompt:
      "Review all current holdings and identify which have had their reclassification premium fully priced in by the market. For each, assess: has the label already changed? Is the multiple already re-rated? Where is the easy money done and capital should rotate to the next unlabelled substrate?",
  },
];

function launchClaude(prompt: string) {
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://claude.ai/new?project=${PROJECT_ID}&q=${encodedPrompt}`;
  window.open(url, "_blank");
}

const statusChip = (status: string): React.CSSProperties => {
  const colors: Record<string, { bg: string; color: string; border: string; pulse?: boolean }> = {
    PASS: { bg: '#00aa66', color: '#fff', border: 'transparent' },
    CLEAR: { bg: '#00aa66', color: '#fff', border: 'transparent' },
    WATCH: { bg: 'transparent', color: '#c9a84c', border: '#c9a84c' },
    MONITOR: { bg: 'transparent', color: '#c9a84c', border: '#c9a84c' },
    TRIGGERED: { bg: '#e74c3c', color: '#fff', border: 'transparent', pulse: true },
    FIRED: { bg: '#e74c3c', color: '#fff', border: 'transparent', pulse: true },
    AMBER: { bg: '#e67e22', color: '#fff', border: 'transparent' },
  };
  const c = colors[status.toUpperCase()] ?? colors.WATCH;
  return {
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    fontFamily: "var(--font-ui)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 2,
    whiteSpace: "nowrap",
    ...(c.pulse ? { animation: 'pulse-alert 2s ease-in-out infinite' } : {}),
  };
};

const actionBadge = (action: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    BUY: { bg: '#00aa66', color: '#fff', border: 'transparent' },
    BOUGHT: { bg: '#00aa66', color: '#fff', border: 'transparent' },
    'TOP-UP': { bg: '#00aa66', color: '#fff', border: 'transparent' },
    'SIZE UP': { bg: '#00aa66', color: '#fff', border: 'transparent' },
    PENDING_BUY: { bg: 'transparent', color: '#c9a84c', border: '#c9a84c' },
    PENDING: { bg: 'transparent', color: '#c9a84c', border: '#c9a84c' },
    HOLD: { bg: 'transparent', color: '#8a8a9a', border: '#8a8a9a' },
    SELL: { bg: '#e74c3c', color: '#fff', border: 'transparent' },
    EXIT: { bg: '#e74c3c', color: '#fff', border: 'transparent' },
    TRIM: { bg: '#e74c3c', color: '#fff', border: 'transparent' },
    TRIMMED: { bg: '#e74c3c', color: '#fff', border: 'transparent' },
    CAP: { bg: '#e67e22', color: '#fff', border: 'transparent' },
    MONITOR: { bg: 'transparent', color: '#8a8a9a', border: '#8a8a9a' },
    REVIEW: { bg: 'transparent', color: '#e67e22', border: '#e67e22' },
    WATCHLIST: { bg: 'transparent', color: '#555', border: '#555' },
  };
  const c = map[action.toUpperCase()] ?? map.MONITOR;
  return {
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    fontFamily: "var(--font-ui)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 2,
    whiteSpace: "nowrap",
  };
};

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "var(--text-mid)",
};
const divRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid rgba(28,28,48,0.4)",
  gap: 16,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function truncateText(text: string, maxLength = 80) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function CommandTab() {
  const [customPrompt, setCustomPrompt] = useState("");
  const { holdings, narrative, loading, error } = usePortfolioData();

  const handleGo = () => {
    if (customPrompt.trim()) launchClaude(customPrompt.trim());
  };

  const priorityNarratives = [
    narrative.week_priority_1,
    narrative.week_priority_2,
    narrative.week_priority_3,
  ].map((item) => item?.trim() ?? "").filter(Boolean);

  const weeklyActions = holdings
    .filter((holding) => holding.alert_status.trim().toUpperCase() !== "CLEAR")
    .map((holding) => {
      const normalizedTicker = normalizeForMatch(holding.ticker);
      const matchedPriority = priorityNarratives.find((item) => normalizeForMatch(item).includes(normalizedTicker));

      return {
        ticker: holding.ticker,
        action: holding.action || "MONITOR",
        sizeContext: `${formatCurrency(holding.mv)} · Add @ ${holding.trigger_price_add || "—"}`,
        rationale: matchedPriority || truncateText(holding.add_trigger || "—"),
      };
    });

  const weeklyWatch = [
    narrative.week_watch_1,
    narrative.week_watch_2,
    narrative.week_watch_3,
  ].map((item) => item?.trim() ?? "").filter(Boolean);

  const riskControls = RISK_CONTROLS.map((r) => ({
    label: r.label,
    threshold: r.threshold,
    status: r.status,
    detail: "",
  }));

  const bubbleFlags = BUBBLE_FLAGS;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div>
          <div style={card}>
            <div style={{ padding: 32, textAlign: "center", borderBottom: "1px solid var(--rim)" }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "var(--gold)", marginBottom: 12,
              }}>Stellar Intelligence</div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 300,
                color: "var(--text)", lineHeight: 1.1, marginBottom: 12,
              }}>One layer <em>deeper</em>.</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>
                Launch Claude with pre-filled Stellar prompts.
              </div>
              <button onClick={() => launchClaude("")} style={{
                background: "var(--gold)", color: "var(--void)", border: "none",
                padding: "12px 32px", fontFamily: "var(--font-mono)", fontSize: 10,
                letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer",
              }}>Open Stellar Intelligence</button>
            </div>

            <div style={{ padding: "20px" }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12,
              }}>Quick Commands</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {QUICK_COMMANDS.map((cmd) => (
                  <button key={cmd.label} onClick={() => launchClaude(cmd.prompt)} style={{
                    background: "var(--surface)", border: "1px solid var(--rim)", color: "var(--text-mid)",
                    padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 10,
                    letterSpacing: "0.1em", cursor: "pointer", textAlign: "left",
                    textTransform: "uppercase", transition: "all 0.2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--text)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--text-mid)"; }}
                  >{cmd.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter custom prompt..."
                  style={{
                    flex: 1, background: "var(--surface)", border: "1px solid var(--rim)",
                    color: "var(--text)", padding: "10px 12px", fontFamily: "var(--font-mono)",
                    fontSize: 11, resize: "none", minHeight: 44, outline: "none",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGo(); } }}
                />
                <button onClick={handleGo} style={{
                  background: "var(--gold)", color: "var(--void)", border: "none",
                  padding: "10px 24px", fontFamily: "var(--font-mono)", fontSize: 10,
                  letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
                }}>GO →</button>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>This Week&apos;s Actions</span>
              {weeklyActions.length > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gold)',
                  letterSpacing: '0.15em',
                }}>{weeklyActions.length} ACTION{weeklyActions.length !== 1 ? 'S' : ''}</span>
              )}
            </div>
            <div style={{ padding: "0 20px 12px" }}>
              {loading && weeklyActions.length === 0 && weeklyWatch.length === 0 ? (
                <div style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  Loading weekly actions…
                </div>
              ) : (
                <>
                  {weeklyActions.map((item, i) => (
                    <div key={`${item.ticker}-${i}`} style={{ padding: '12px 0', borderBottom: '1px solid rgba(28,28,48,0.4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {item.ticker}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={actionBadge(item.action)}>{item.action.replace('_', ' ')}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mid)' }}>
                            {item.sizeContext}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.55 }}>
                        {item.rationale}
                      </div>
                    </div>
                  ))}

                  {weeklyWatch.length > 0 && (
                    <div style={{ paddingTop: weeklyActions.length > 0 ? 16 : 12 }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                        marginBottom: 10,
                      }}>
                        Watch this week
                      </div>
                      {weeklyWatch.map((item, i) => (
                        <div key={`watch-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid rgba(28,28,48,0.4)' }}>
                          <span style={statusChip('MONITOR')}>MONITOR</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.55 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loading && weeklyActions.length === 0 && weeklyWatch.length === 0 && (
                    <div style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                      {error ? 'Weekly actions unavailable' : 'No actions this week'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Risk Controls</span>
            </div>
            <div style={{ padding: "0 20px 8px" }}>
              {riskControls.map((r) => (
                <div key={r.label} style={divRow}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text)" }}>{r.label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      {r.threshold}
                    </div>
                    {r.detail && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                        → {r.detail}
                      </div>
                    )}
                  </div>
                  <span style={statusChip(r.status)}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Bubble Flags</span>
            </div>
            <div style={{ padding: "0 20px 8px" }}>
              {bubbleFlags.map((b) => (
                <div key={b.name} style={divRow}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{b.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                      {b.detail}
                    </div>
                  </div>
                  <span style={statusChip(b.status)}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Golden Rules</span>
            </div>
            <div style={{ padding: "0 20px 8px" }}>
              {GOLDEN_RULES.map((r) => (
                <div key={r.n} style={{ ...divRow, alignItems: "flex-start", gap: 16 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--gold)",
                    flexShrink: 0, width: 20,
                  }}>{r.n}.</span>
                  <span style={{
                    fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic",
                    color: "var(--text-mid)",
                  }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
