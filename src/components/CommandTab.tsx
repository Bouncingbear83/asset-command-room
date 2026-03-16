import { useState, useEffect } from "react";
import { RISK_CONTROLS, BUBBLE_FLAGS, GOLDEN_RULES } from "@/data/portfolio";
import { useIntelligence } from "@/data/intelligenceState";

const PROJECT_ID = "PROJECT_ID";

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
    PENDING_BUY: { bg: 'transparent', color: '#c9a84c', border: '#c9a84c' },
    SELL: { bg: '#e74c3c', color: '#fff', border: 'transparent' },
    EXIT: { bg: '#e74c3c', color: '#fff', border: 'transparent' },
    TRIM: { bg: '#e74c3c', color: '#fff', border: 'transparent' },
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

const priorityBadge = (priority: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string }> = {
    URGENT: { bg: '#e74c3c', color: '#fff' },
    HIGH: { bg: '#e67e22', color: '#fff' },
    MEDIUM: { bg: 'rgba(201,168,76,0.15)', color: '#c9a84c' },
    LOW: { bg: 'rgba(85,85,85,0.2)', color: '#555' },
  };
  const c = map[priority] ?? map.LOW;
  return {
    background: c.bg,
    color: c.color,
    fontFamily: "var(--font-ui)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "2px 10px",
    borderRadius: 2,
    whiteSpace: "nowrap",
  };
};

const ipoStatusBadge = (status: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    'PRE-IPO': { bg: 'transparent', color: '#c9a84c', border: '#c9a84c' },
    'IPO-WATCH': { bg: 'rgba(201,168,76,0.2)', color: '#c9a84c', border: 'transparent' },
    FILED: { bg: '#e67e22', color: '#fff', border: 'transparent' },
    LISTED: { bg: '#00aa66', color: '#fff', border: 'transparent' },
  };
  const c = map[status] ?? map['PRE-IPO'];
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

export default function CommandTab() {
  const [customPrompt, setCustomPrompt] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [toast, setToast] = useState(false);
  const { state, applyUpdate, validate } = useIntelligence();

  // Last applied info
  const lastApplied = state.lastUpdated
    ? `Last applied: ${state.lastUpdated} · ${state.reviewType || 'update'}`
    : "No update applied";

  const handleGo = () => {
    if (customPrompt.trim()) launchClaude(customPrompt.trim());
  };

  const handleValidate = () => {
    if (!jsonInput.trim()) {
      setValidationResult({ valid: false, message: "Paste JSON first" });
      return;
    }
    const result = validate(jsonInput);
    setValidationResult({
      valid: result.valid,
      message: result.valid ? `✅ ${result.summary}` : `❌ ${result.error}`,
    });
  };

  const handleApply = () => {
    const result = applyUpdate(jsonInput);
    if (result.valid) {
      setJsonInput("");
      setValidationResult(null);
      setToast(true);
    }
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Determine data sources with fallbacks
  const riskControls = Object.keys(state.riskControls).length > 0
    ? Object.entries(state.riskControls).map(([key, v]) => ({ label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ...v }))
    : RISK_CONTROLS.map(r => ({ label: r.label, threshold: r.threshold, status: r.status, detail: '' }));

  const bubbleFlags = Object.keys(state.bubbleFlags).length > 0
    ? Object.entries(state.bubbleFlags).map(([key, v]) => ({ name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), ...v }))
    : BUBBLE_FLAGS;

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: '#c9a84c', color: '#04040a', padding: '12px 24px',
          fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
          letterSpacing: '0.05em',
        }}>
          ✅ Intelligence update applied
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div>
          {/* Stellar Intelligence header card */}
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

          {/* Ticker Actions */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>This Week's Actions</span>
              {state.tickerActions.length > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gold)',
                  letterSpacing: '0.15em',
                }}>{state.tickerActions.length} ACTION{state.tickerActions.length !== 1 ? 'S' : ''}</span>
              )}
            </div>
            <div style={{ padding: "0 20px 12px" }}>
              {state.tickerActions.length === 0 ? (
                <div style={{ padding: '16px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  No actions this week
                </div>
              ) : (
                state.tickerActions.map((ta, i) => (
                  <div key={`${ta.ticker}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: '1px solid rgba(28,28,48,0.4)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 50 }}>
                      {ta.ticker}
                    </span>
                    <span style={actionBadge(ta.action)}>{ta.action.replace('_', ' ')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mid)', minWidth: 50 }}>
                      {ta.amount || '—'}
                    </span>
                    <span style={{
                      fontSize: 11, color: 'var(--text-dim)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{ta.reason}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Intelligence Update */}
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Intelligence Update</span>
            </div>
            <div style={{ padding: "20px" }}>
              <textarea
                value={jsonInput}
                onChange={(e) => { setJsonInput(e.target.value); setValidationResult(null); }}
                placeholder="Paste weekly intelligence update JSON here..."
                style={{
                  width: "100%", background: "#0d0d1f", border: "1px solid var(--rim)",
                  color: "var(--text)", padding: 12, fontFamily: "var(--font-mono)",
                  fontSize: 10, lineHeight: 1.6, resize: "vertical", minHeight: 300,
                  boxSizing: "border-box", outline: "none",
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#c9a84c'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--rim)'; }}
              />

              {validationResult && (
                <div style={{
                  marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: validationResult.valid ? '#00aa66' : '#e74c3c',
                  lineHeight: 1.5,
                }}>{validationResult.message}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={handleValidate} style={{
                  background: 'transparent', border: '1px solid #c9a84c', color: '#c9a84c',
                  padding: '8px 20px', fontFamily: 'var(--font-ui)', fontSize: 10,
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                }}>Validate</button>
                <button onClick={handleApply} disabled={!validationResult?.valid}
                  style={{
                    background: validationResult?.valid ? '#c9a84c' : 'rgba(201,168,76,0.2)',
                    color: validationResult?.valid ? '#04040a' : 'rgba(201,168,76,0.4)',
                    border: 'none', padding: '8px 20px', fontFamily: 'var(--font-ui)',
                    fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: validationResult?.valid ? 'pointer' : 'not-allowed',
                  }}>Apply Update</button>
              </div>

              <div style={{
                marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text-dim)', letterSpacing: '0.1em',
              }}>{lastApplied}</div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Risk Controls */}
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

          {/* Bubble Flags */}
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

          {/* Golden Rules */}
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
