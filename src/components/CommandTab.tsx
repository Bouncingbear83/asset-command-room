import { useState } from "react";
import { GOLDEN_RULES } from "@/data/portfolio";
import { LiveMacroStateRow, LiveWatchItem, usePortfolioData } from "@/hooks/usePortfolioData";
import { triggerWebhook } from "@/lib/webhooks";

const PROJECT_ID = "019ca3a9-aefe-77ea-af76-db62fd96f4e1";

const CLAUDE_COMMANDS = [
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

const SIGNAL_KEYS = ["VIX", "SP500_YTD_PCT", "GOLD_USD", "PAUSE_ACTIVE", "EARNINGS_BLACKOUT"] as const;
const SIGNAL_LABELS: Record<(typeof SIGNAL_KEYS)[number], string> = {
  VIX: "VIX",
  SP500_YTD_PCT: "S&P 500 YTD",
  GOLD_USD: "Gold USD",
  PAUSE_ACTIVE: "Pause Active",
  EARNINGS_BLACKOUT: "Earnings Blackout",
};

const HOLDING_ALERT_STYLE: Record<string, React.CSSProperties> = {
  ADD_ZONE: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  EXIT_ZONE: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  REVIEW: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
};

function getClaudeUrl(prompt: string) {
  if (!prompt) {
    return `https://claude.ai/project/${PROJECT_ID}`;
  }
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}&project_uuid=${PROJECT_ID}`;
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    const el = document.getElementById("copy-toast");
    if (el) {
      el.textContent = "Copied!";
      el.style.opacity = "1";
      setTimeout(() => { el.style.opacity = "0"; }, 1500);
    }
  });
}

const statusChip = (status: string): React.CSSProperties => {
  const colors: Record<string, { bg: string; color: string; border: string; pulse?: boolean }> = {
    PASS: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    CLEAR: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    WATCH: { bg: "transparent", color: "var(--amber)", border: "var(--amber)" },
    MONITOR: { bg: "transparent", color: "var(--amber)", border: "var(--amber)" },
    TRIGGERED: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)", pulse: true },
    FIRED: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)", pulse: true },
    AMBER: { bg: "var(--amber-dim)", color: "var(--amber)", border: "rgba(200,146,90,0.2)" },
    GREEN: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
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
    ...(c.pulse ? { animation: "pulse-alert 2s ease-in-out infinite" } : {}),
  };
};

const actionBadge = (action: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    BUY: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    BOUGHT: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    "TOP-UP": { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    "SIZE UP": { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(90,191,160,0.2)" },
    PENDING_BUY: { bg: "transparent", color: "var(--amber)", border: "var(--amber)" },
    PENDING: { bg: "transparent", color: "var(--amber)", border: "var(--amber)" },
    HOLD: { bg: "transparent", color: "var(--text-dim)", border: "var(--text-dim)" },
    SELL: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)" },
    EXIT: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)" },
    TRIM: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)" },
    TRIMMED: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(200,90,90,0.2)" },
    CAP: { bg: "var(--amber-dim)", color: "var(--amber)", border: "rgba(200,146,90,0.2)" },
    MONITOR: { bg: "transparent", color: "var(--text-dim)", border: "var(--text-dim)" },
    REVIEW: { bg: "transparent", color: "var(--amber)", border: "var(--amber)" },
    WATCHLIST: { bg: "transparent", color: "var(--text-dim)", border: "var(--text-dim)" },
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
  textTransform: "uppercase",
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
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deriveSignalStatus(row?: LiveMacroStateRow) {
  if (!row) return "MONITOR";
  const current = row.currentValue.toUpperCase();
  if (current === "YES" || current === "TRUE" || current === "ACTIVE") return "TRIGGERED";
  if (current === "NO" || current === "FALSE" || current === "INACTIVE" || current === "CLEAR") return "CLEAR";
  return row.status || "MONITOR";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getDaysUntil(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function HoldingAlertBadge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const style = HOLDING_ALERT_STYLE[normalized];
  if (!style || normalized === "CLEAR") return null;
  return (
    <span style={{ ...style, padding: "2px 8px", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
      {normalized.replace("_", " ")}
    </span>
  );
}

function QuickCommandsSection({ holdings, layers }: { holdings: { ticker: string }[]; layers: { name: string }[] }) {
  const [webhookTarget, setWebhookTarget] = useState("");
  const [webhookLoading, setWebhookLoading] = useState(false);

  const tickers = holdings.map(h => h.ticker).filter(Boolean);
  const layerNames = layers.map(l => l.name).filter(n => n && n.toUpperCase() !== "TOTAL" && n.toUpperCase() !== "CASH");

  const handleWebhook = async (endpoint: string, body: object, msg: string) => {
    setWebhookLoading(true);
    await triggerWebhook(endpoint, body, msg);
    setWebhookLoading(false);
    setWebhookTarget("");
  };

  const selectStyle: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--rim)", color: "var(--text-mid)",
    padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 10, flex: 1, minWidth: 80,
  };
  const fireStyle: React.CSSProperties = {
    background: "var(--gold)", color: "var(--void)", border: "none", padding: "8px 14px",
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
    cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: "20px" }}>
      {isEmbedded() && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--amber-dim)", border: "1px solid rgba(200,146,90,0.2)", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)", letterSpacing: "0.08em" }}>
          External links may be blocked in preview. Use the published site or copy prompts below.
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)" }}>Quick Commands</div>
        <a href={getClaudeUrl("")} target="_blank" rel="noopener noreferrer" style={{ background: "var(--gold)", color: "var(--void)", border: "none", padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>Open Stellar Intelligence</a>
      </div>

      {/* Claude commands */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {CLAUDE_COMMANDS.map((cmd) => (
          <div key={cmd.label} style={{ display: "flex", gap: 0 }}>
            <a href={getClaudeUrl(cmd.prompt)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--rim)", borderRight: "none", color: "var(--text-mid)", padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", textAlign: "left", textTransform: "uppercase", transition: "all 0.2s", textDecoration: "none", display: "block" }}>
              {cmd.label}
            </a>
            <button onClick={() => copyToClipboard(cmd.prompt)} title="Copy prompt" style={{ background: "var(--surface)", border: "1px solid var(--rim)", color: "var(--text-dim)", padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer", transition: "all 0.2s" }}>⧉</button>
          </div>
        ))}
      </div>

      {/* Webhook commands */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Webhook Actions</div>
      <div style={{ display: "grid", gap: 10 }}>
        {/* Rescore */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: 90, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>🔄 Rescore</span>
          <select style={selectStyle} value={webhookTarget} onChange={e => setWebhookTarget(e.target.value)}>
            <option value="">Select ticker…</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-rescore", { ticker: webhookTarget }, `Rescore triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>Fire</button>
        </div>
        {/* Earnings Prep */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: 90, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>📋 Prep</span>
          <select style={selectStyle} value={webhookTarget} onChange={e => setWebhookTarget(e.target.value)}>
            <option value="">Select ticker…</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-earnings-prep", { ticker: webhookTarget }, `Earnings prep triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>Fire</button>
        </div>
        {/* Layer Scan */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: 90, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>🔍 Scan</span>
          <select style={selectStyle} value={webhookTarget} onChange={e => setWebhookTarget(e.target.value)}>
            <option value="">Select layer…</option>
            {layerNames.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-layer-scan", { layer: webhookTarget }, `Layer scan triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>Fire</button>
        </div>
      </div>
    </div>
  );
}

export default function CommandTab() {
  const { holdings, watchlist, layers, narrativeData, macroState, riskControls, earningsCalendar, loading, error } = usePortfolioData();

  const priorityNarratives = [narrativeData.week_priority_1, narrativeData.week_priority_2, narrativeData.week_priority_3]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);

  const weeklyWatch = [narrativeData.week_watch_1, narrativeData.week_watch_2, narrativeData.week_watch_3]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);

  const alertedHoldings = holdings.filter((holding) => holding.alert_status.trim().toUpperCase() !== "CLEAR");
  const weeklyActions = alertedHoldings.map((holding) => {
    const normalizedTicker = normalizeForMatch(holding.ticker);
    const matchedPriority = priorityNarratives.find((item) => normalizeForMatch(item).includes(normalizedTicker));
    return {
      ticker: holding.ticker,
      action: holding.action || "MONITOR",
      alertStatus: holding.alert_status,
      sizeContext: `${formatCurrency(holding.mv)} · Add @ ${holding.trigger_price_add || "—"}`,
      rationale: matchedPriority || holding.add_trigger || holding.notes || "—",
    };
  });

  const macroSignals = SIGNAL_KEYS
    .map((key) => ({ key, row: macroState[key] }))
    .filter((entry) => Boolean(entry.row))
    .map(({ key, row }) => ({
      name: SIGNAL_LABELS[key],
      status: deriveSignalStatus(row),
      detail: [
        row?.currentValue ? `Current ${row.currentValue}` : "",
        row?.thresholdAmber ? `Amber ${row.thresholdAmber}` : "",
        row?.thresholdRed ? `Red ${row.thresholdRed}` : "",
        row?.note || "",
      ].filter(Boolean).join(" · "),
    }));

  const hasNarrative = Boolean(
    narrativeData.macro_regime ||
      narrativeData.posture_rationale ||
      priorityNarratives.length ||
      narrativeData.key_risk_this_week ||
      narrativeData.layer_narrative,
  );

  const earningsSummary = [...earningsCalendar]
    .sort((a, b) => new Date(a.nextEarningsDate).getTime() - new Date(b.nextEarningsDate).getTime())
    .slice(0, 3)
    .map((item) => ({ ...item, daysUntil: getDaysUntil(item.nextEarningsDate) }));

  // Earnings this week: within 7 days
  const earningsThisWeek = [...earningsCalendar]
    .map((item) => ({ ...item, daysUntil: getDaysUntil(item.nextEarningsDate) }))
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // --- Next Actions: holdings SIZE UP/TOP-UP + watchlist BUY at/below target ---
  const nextActions: { ticker: string; action: string; context: string }[] = [];

  holdings.forEach((h) => {
    const act = h.action.trim().toUpperCase();
    if (act === "SIZE UP" || act === "TOP-UP") {
      const context = h.notes || h.add_trigger || `${formatCurrency(h.mv)} current`;
      nextActions.push({ ticker: h.ticker, action: act === "SIZE UP" ? `SIZE UP` : `TOP-UP`, context });
    }
  });

  watchlist.forEach((w) => {
    if (!w.status.toUpperCase().startsWith("BUY")) return;
    const current = typeof w.current === "number" ? w.current : null;
    const entryStr = w.entry;
    const parts = entryStr.split(/\s*[-–]\s*|\s+to\s+/i);
    const nums = parts.map((p) => parseFloat(p.replace(/[^0-9.]/g, ""))).filter((n) => !isNaN(n) && n > 0);
    const midpoint = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0] ?? null;
    if (current == null || midpoint == null || current > midpoint) return;
    const pct = ((current - midpoint) / midpoint * 100).toFixed(1);
    nextActions.push({ ticker: w.ticker, action: "BUY", context: `${pct}% below ${entryStr} target` });
  });

  const displayActions = nextActions.slice(0, 4);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      <div>
        {/* Next Actions card */}
        <div style={{ ...card, borderLeft: "3px solid var(--gold)" }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Next Actions</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{displayActions.length} pending</span>
          </div>
          <div style={{ padding: "14px 20px" }}>
            {displayActions.length === 0 ? (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>No actions required</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {displayActions.map((a, i) => (
                  <div key={`${a.ticker}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>{a.ticker}</span>
                    <span style={{ ...actionBadge(a.action), flexShrink: 0 }}>{a.action}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.context}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ padding: 32, borderBottom: "1px solid var(--rim)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)" }}>Narrative</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)" }}>Updated {formatDate(narrativeData.last_updated)}</div>
            </div>

            {hasNarrative ? (
              <div style={{ display: "grid", gap: 18 }}>
                {/* Weekly Priorities — scanned most often, shown first */}
                {priorityNarratives.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Weekly Priorities</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {priorityNarratives.map((item, index) => (
                        <div key={`${item}-${index}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", marginTop: 2 }}>{String(index + 1).padStart(2, "0")}</span>
                          <span style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.6 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Narrative regime — reduced size, posture_rationale as subtitle */}
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 300, color: "var(--text)", lineHeight: 1.3, marginBottom: 4 }}>{narrativeData.macro_regime || "Macro regime pending"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>{narrativeData.posture_rationale || "Awaiting live posture rationale."}</div>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Key Risk</div>
                    <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.6 }}>{narrativeData.key_risk_this_week || "No key risk supplied."}</div>
                  </div>

                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Layer Narrative</div>
                    <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.6 }}>{narrativeData.layer_narrative || "No layer commentary supplied."}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>Awaiting first n8n run</div>
            )}
          </div>

          <QuickCommandsSection holdings={holdings} layers={layers} />
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>This Week&apos;s Actions</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {alertedHoldings.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", letterSpacing: "0.15em" }}>{alertedHoldings.length} ALERT{alertedHoldings.length !== 1 ? "S" : ""}</span>}
            </div>
          </div>
          <div style={{ padding: "0 20px 12px" }}>
            {loading && weeklyActions.length === 0 && weeklyWatch.length === 0 ? (
              <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading weekly actions…</div>
            ) : (
              <>
                {weeklyActions.map((item, index) => (
                  <div key={`${item.ticker}-${index}`} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{item.ticker}</span>
                        <HoldingAlertBadge status={item.alertStatus} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={actionBadge(item.action)}>{item.action.replace("_", " ")}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)" }}>{item.sizeContext}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.55 }}>{item.rationale}</div>
                  </div>
                ))}

                {weeklyWatch.length > 0 && (
                  <div style={{ paddingTop: weeklyActions.length > 0 ? 16 : 12 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 10 }}>Watch this week</div>
                    {weeklyWatch.map((item, index) => {
                      const tickerMatch = item.match(/^([A-Z]{2,6})\b/);
                      return (
                        <div key={`watch-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(28,28,48,0.4)" }}>
                          <span style={statusChip("MONITOR")}>MONITOR</span>
                          <div>
                            {tickerMatch && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", marginRight: 6 }}>{tickerMatch[1]}</span>}
                            <span style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.55 }}>{tickerMatch ? item.slice(tickerMatch[0].length).replace(/^[\s:–—-]+/, '') : item}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!loading && weeklyActions.length === 0 && weeklyWatch.length === 0 && <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>{error ? "Weekly actions unavailable" : "No actions this week"}</div>}
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Upcoming Earnings</span>
            {earningsSummary.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>NEXT 3</span>}
          </div>
          <div style={{ padding: "0 20px 8px" }}>
            {earningsSummary.map((item) => {
              const urgency = item.daysUntil <= 2 ? "TRIGGERED" : item.daysUntil <= 7 ? "AMBER" : item.confirmed ? "GREEN" : "MONITOR";
              return (
                <div key={`${item.ticker}-${item.nextEarningsDate}`} style={divRow}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{item.ticker}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{formatDate(item.nextEarningsDate)} · {item.fiscalPeriod || "Period tbc"}</div>
                  </div>
                  <span style={statusChip(urgency)}>{item.daysUntil === Number.POSITIVE_INFINITY ? "TBC" : `${item.daysUntil}D`}</span>
                </div>
              );
            })}
            {earningsSummary.length === 0 && <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No earnings events available</div>}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}><span style={cardTitle}>Risk Controls</span></div>
          <div style={{ padding: "0 20px 8px" }}>
            {riskControls.map((r) => (
              <div key={r.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(28,28,48,0.4)", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--text)" }}>{r.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)" }}>{r.current || "—"}</span>
                  <span style={statusChip(r.status)}>{r.status}</span>
                </div>
              </div>
            ))}
            {riskControls.length === 0 && <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Risk controls unavailable</div>}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}><span style={cardTitle}>Macro Signals</span></div>
          <div style={{ padding: "0 20px 8px" }}>
            {macroSignals.map((signal) => (
              <div key={signal.name} style={divRow}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{signal.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{signal.detail || "No note"}</div>
                </div>
                <span style={statusChip(signal.status)}>{signal.status}</span>
              </div>
            ))}
            {macroSignals.length === 0 && <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Macro signals unavailable</div>}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}><span style={cardTitle}>Golden Rules</span></div>
          <div style={{ padding: "0 20px 8px" }}>
            {GOLDEN_RULES.map((r) => (
              <div key={r.n} style={{ ...divRow, alignItems: "flex-start", gap: 16 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--gold)", flexShrink: 0, width: 20 }}>{r.n}.</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic", color: "var(--text-mid)" }}>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
