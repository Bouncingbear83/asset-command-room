import { useState } from "react";
import { GOLDEN_RULES } from "@/data/portfolio";
import { LiveMacroStateRow, LiveWatchItem, usePortfolioData } from "@/hooks/usePortfolioData";
import { triggerWebhook } from "@/lib/webhooks";
import { useIsMobile } from "@/hooks/use-mobile";

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
  {
    label: "Log Trades",
    prompt:
      "I have new trades to log. Ready for CSV or screenshot.",
    icon: "📝",
    subtitle: "CSV or screenshot → Claude",
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
const cardHeaderBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
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

function QuickCommandsSection({ holdings, layers, watchlist, isMobile }: { holdings: { ticker: string }[]; layers: { name: string }[]; watchlist?: { ticker: string }[]; isMobile: boolean }) {
  const [webhookTarget, setWebhookTarget] = useState("");
  const [deepDiveTarget, setDeepDiveTarget] = useState("");
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookFired, setWebhookFired] = useState("");

  const tickers = holdings.map(h => h.ticker).filter(Boolean);
  const watchlistTickers = (watchlist || []).map(w => w.ticker).filter(Boolean);
  const allTickers = [...new Set([...tickers, ...watchlistTickers])].sort();
  const layerNames = layers.map(l => l.name).filter(n => n && n.toUpperCase() !== "TOTAL" && n.toUpperCase() !== "CASH");

  const handleWebhook = async (endpoint: string, body: object, msg: string) => {
    setWebhookLoading(true);
    setWebhookFired("");
    await triggerWebhook(endpoint, body, msg);
    setWebhookLoading(false);
    setWebhookFired("✓ Fired");
    setWebhookTarget("");
    setTimeout(() => setWebhookFired(""), 3000);
  };

  const handleDeepDive = () => {
    if (!deepDiveTarget) return;
    const isHolding = tickers.includes(deepDiveTarget);
    const prompt = isHolding
      ? `Deep dive on ${deepDiveTarget}. Search for latest news, earnings, and developments. Reassess all 6 scoring dimensions. Produce research commit JSON at the end.`
      : `Watchlist review for ${deepDiveTarget}. Search for latest developments. Reassess entry target, trigger condition, and thesis. Produce research commit JSON at the end.`;
    const url = getClaudeUrl(prompt);
    (window.top || window).open(url, '_blank');
    setDeepDiveTarget("");
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
    <div style={{ padding: isMobile ? "14px 12px" : "20px" }}>
      {isEmbedded() && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--amber-dim)", border: "1px solid rgba(200,146,90,0.2)", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)", letterSpacing: "0.08em" }}>
          External links may be blocked in preview. Use the published site or copy prompts below.
        </div>
      )}
      <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)" }}>Quick Commands</div>
        <a href={getClaudeUrl("")} target="_blank" rel="noopener noreferrer" style={{ background: "var(--gold)", color: "var(--void)", border: "none", padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", display: "block", textAlign: "center", width: isMobile ? "100%" : "auto" }}>Open Stellar Intelligence</a>
      </div>

      {/* Claude commands */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {CLAUDE_COMMANDS.map((cmd) => (
          <div key={cmd.label} style={{ display: "flex", gap: 0 }}>
            <a href={getClaudeUrl(cmd.prompt)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--rim)", borderRight: "none", color: "var(--text-mid)", padding: isMobile ? "10px 12px" : "12px 14px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", textAlign: "left", textTransform: "uppercase", transition: "all 0.2s", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
              {(cmd as any).icon && <span style={{ fontSize: 14 }}>{(cmd as any).icon}</span>}
              <div>
                <div>{cmd.label}</div>
                {(cmd as any).subtitle && <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "none", letterSpacing: "0.02em", marginTop: 2 }}>{(cmd as any).subtitle}</div>}
              </div>
            </a>
            <button onClick={() => copyToClipboard(cmd.prompt)} title="Copy prompt" style={{ background: "var(--surface)", border: "1px solid var(--rim)", color: "var(--text-dim)", padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer", transition: "all 0.2s" }}>⧉</button>
          </div>
        ))}
      </div>

      {/* Deep Dive command */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>🔬 Deep Dive (Claude Project — free on Max)</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <select style={selectStyle} value={deepDiveTarget} onChange={e => setDeepDiveTarget(e.target.value)}>
          <option value="">Select ticker…</option>
          <optgroup label="Holdings">
            {tickers.map(t => <option key={`h-${t}`} value={t}>{t}</option>)}
          </optgroup>
          <optgroup label="Watchlist">
            {watchlistTickers.filter(t => !tickers.includes(t)).map(t => <option key={`w-${t}`} value={t}>{t}</option>)}
          </optgroup>
        </select>
        <button disabled={!deepDiveTarget} onClick={handleDeepDive} style={{ ...fireStyle, background: "var(--accent)", opacity: deepDiveTarget ? 1 : 0.4 }}>Open</button>
      </div>

      {/* Webhook commands */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Webhook Actions</div>
      <div style={{ display: "grid", gap: 10 }}>
        {/* Rescore */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: isMobile ? 70 : 90, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>🔄 Rescore</span>
          <select style={selectStyle} value={webhookTarget} onChange={e => setWebhookTarget(e.target.value)}>
            <option value="">Select ticker…</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-rescore", { ticker: webhookTarget }, `Rescore triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>{webhookLoading ? "…" : "Fire"}</button>
        </div>
        {/* Earnings Prep */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: isMobile ? 70 : 90, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>📋 Prep</span>
          <select style={selectStyle} value={webhookTarget} onChange={e => setWebhookTarget(e.target.value)}>
            <option value="">Select ticker…</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-earnings-prep", { ticker: webhookTarget }, `Earnings prep triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>{webhookLoading ? "…" : "Fire"}</button>
        </div>
        {/* Layer Scan */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: isMobile ? 70 : 90, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>🔍 Scan</span>
          <select style={selectStyle} value={webhookTarget} onChange={e => setWebhookTarget(e.target.value)}>
            <option value="">Select layer…</option>
            {layerNames.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-layer-scan", { layer: webhookTarget }, `Layer scan triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>{webhookLoading ? "…" : "Fire"}</button>
        </div>
        {webhookFired && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", marginTop: 6, letterSpacing: "0.1em" }}>{webhookFired}</div>}
      </div>
    </div>
  );
}

function CommitResearchPanel() {
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCommit = async () => {
    if (!jsonText.trim()) return;
    setLoading(true);
    try {
      const payload = JSON.parse(jsonText);
      const response = await fetch(
        "https://bertbroad83.app.n8n.cloud/webhook/stellar-research-commit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stellar-key": "STELLAR",
          },
          body: JSON.stringify(payload),
        }
      );
      if (response.ok) {
        setStatus(`✓ Committed ${payload.ticker || "?"} (${payload.action || "unknown"})`);
        setJsonText("");
      } else {
        setStatus(`✗ Error: ${response.statusText}`);
      }
    } catch {
      setStatus("✗ Invalid JSON");
    }
    setLoading(false);
  };

  return (
    <details style={{ ...card, borderLeft: "3px solid transparent", marginBottom: 16 }}
      onToggle={(e) => {
        const el = e.currentTarget;
        el.style.borderLeftColor = el.open ? "var(--gold)" : "transparent";
      }}
    >
      <summary style={{ ...cardHeaderBase, padding: "10px 12px", cursor: "pointer", userSelect: "none", listStyle: "none" }}>
        <span style={cardTitle}>Commit Research</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>▸ PASTE JSON</span>
      </summary>
      <div style={{ padding: "10px 12px" }}>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"ticker":"ASML","action":"RESCORE","substrate":22,...}'
          rows={6}
          style={{
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--rim)",
            color: "var(--text)",
            fontFamily: "'DM Mono', var(--font-mono)",
            fontSize: 11,
            padding: "10px 12px",
            resize: "vertical",
            borderRadius: 2,
            lineHeight: 1.5,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button
            disabled={loading || !jsonText.trim()}
            onClick={handleCommit}
            style={{
              background: "var(--gold)",
              color: "var(--void)",
              border: "none",
              padding: "8px 18px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: loading || !jsonText.trim() ? "not-allowed" : "pointer",
              opacity: loading || !jsonText.trim() ? 0.4 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Committing…" : "Commit to Sheet"}
          </button>
          {status && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: status.startsWith("✓") ? "var(--green)" : "var(--red)",
            }}>
              {status}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}

export default function CommandTab() {
  const isMobile = useIsMobile();
  const [moverSort, setMoverSort] = useState<"abs" | "gainers" | "losers">("abs");
  const { holdings, watchlist, layers, narrativeData, macroState, riskControls, earningsCalendar, scores, loading, error } = usePortfolioData();

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

  // --- Deploy Queue: HOLDINGS with DEPLOY_TARGET_GBP > MV, plus WATCHLIST BUY not in holdings ---
  const LAYER_PRIORITY = ["materials", "robotics", "compute", "biological", "sovereignty", "energy", "hedge"];
  const deployQueue: { ticker: string; amount: number; layer: string; context: string; price: number; tier: number }[] = [];
  const holdingsTickers = new Set(holdings.map((h) => h.ticker.toUpperCase()));

  holdings.forEach((h) => {
    const target = h.deploy_target_gbp;
    if (target > 0 && target > h.mv) {
      const amount = Math.round(target - h.mv);
      const instruction = h.deploy_note || `${h.action} · ${h.notes}`.trim();
      deployQueue.push({ ticker: h.ticker, amount, layer: h.layer, context: instruction || `Deploy to £${(target / 1000).toFixed(0)}k target`, price: h.price, tier: 0 });
    }
  });

  watchlist.forEach((w) => {
    if (!w.status.toUpperCase().startsWith("BUY")) return;
    if (holdingsTickers.has(w.ticker.toUpperCase())) return;
    const amount = w.deploy_amount_gbp;
    if (amount <= 0) return;
    // Extract tier from status: "BUY T1", "BUY T2", "BUY T3" etc.
    const tierMatch = w.status.match(/T(\d)/i);
    const tier = tierMatch ? parseInt(tierMatch[1], 10) : 9;
    const instruction = w.trigger || `Entry at ${w.entry}`;
    deployQueue.push({ ticker: w.ticker, amount, layer: w.layer, context: instruction, price: w.current, tier });
  });

  // Sort: holdings (tier=0) first, then watchlist by tier (T1→T2→T3), then by layer priority
  deployQueue.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const ai = LAYER_PRIORITY.indexOf(a.layer.toLowerCase());
    const bi = LAYER_PRIORITY.indexOf(b.layer.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const deployTotal = deployQueue.reduce((sum, d) => sum + d.amount, 0);

  // Check pause status
  const pauseRow = macroState["PAUSE_ACTIVE"];
  const isPaused = pauseRow ? ["YES", "TRUE", "ACTIVE"].includes(pauseRow.currentValue.toUpperCase()) : false;

  // --- RAG summary helpers ---
  const riskStatusCounts = riskControls.reduce((acc, r) => {
    let currentNum = parseFloat(String(r.current).replace(/[^0-9.\-]/g, ""));
    if (!isNaN(currentNum) && Math.abs(currentNum) <= 1) currentNum = currentNum * 100;
    const isFloor = r.key.toLowerCase().includes("floor");
    const redMatch = r.threshold.match(/RED\s+([\d.]+)/i);
    const amberMatch = r.threshold.match(/AMBER\s+([\d.]+)/i);
    let limit = redMatch ? parseFloat(redMatch[1]) : (amberMatch ? parseFloat(amberMatch[1]) : 100);
    if (limit <= 1) limit = limit * 100;
    const amberLimit = amberMatch ? parseFloat(amberMatch[1]) : null;
    let status = "SAFE";
    if (isFloor) {
      if (currentNum < limit) status = "BREACH";
      else if (amberLimit != null && currentNum < (amberLimit <= 1 ? amberLimit * 100 : amberLimit) * 1.1) status = "WATCH";
    } else {
      if (currentNum > limit) status = "BREACH";
      else if (currentNum > limit - 1) status = "WATCH";
    }
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const macroStatusCounts = macroSignals.reduce((acc, s) => {
    const key = s.status.toUpperCase();
    const bucket = (key === "CLEAR" || key === "GREEN") ? "GREEN" : (key === "TRIGGERED" || key === "FIRED") ? "RED" : "AMBER";
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const ragChipStyle = (color: string): React.CSSProperties => ({
    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", color,
  });

  const mp = isMobile ? "10px 12px" : "14px 20px";
  const cardHeader: React.CSSProperties = { ...cardHeaderBase, padding: mp };

  // --- Zone Alert Banner ---
  const zoneGroups: Record<string, typeof holdings> = {};
  alertedHoldings.forEach((h) => {
    const status = h.alert_status.trim().toUpperCase();
    if (!zoneGroups[status]) zoneGroups[status] = [];
    zoneGroups[status].push(h);
  });
  const zoneOrder = ["ADD_ZONE", "EXIT_ZONE", "REVIEW"];
  const activeZones = zoneOrder.filter((z) => zoneGroups[z]?.length);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, alignItems: "start" }}>
        {/* Zone Alert Banner */}
        {activeZones.length > 0 && (
          <div style={{ ...card, borderLeft: "3px solid var(--gold)", overflow: "hidden" }}>
            <div style={cardHeader}>
              <span style={cardTitle}>⚡ Zone Alerts</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{alertedHoldings.length} active</span>
            </div>
            <div style={{ padding: mp }}>
              {activeZones.map((zone) => {
                const items = zoneGroups[zone];
                const zoneColor = zone === "ADD_ZONE" ? "var(--green)" : zone === "EXIT_ZONE" ? "var(--red)" : "var(--amber)";
                const zoneBg = zone === "ADD_ZONE" ? "var(--green-dim)" : zone === "EXIT_ZONE" ? "var(--red-dim)" : "var(--amber-dim)";
                const zoneLabel = zone === "ADD_ZONE" ? "🟢 ADD ZONE" : zone === "EXIT_ZONE" ? "🔴 EXIT ZONE" : "🟡 REVIEW";
                return (
                  <div key={zone} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: zoneColor, animation: "pulse-alert 2s ease-in-out infinite", flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: zoneColor }}>{zoneLabel}</span>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {items.map((h) => {
                        const triggerRaw = zone === "EXIT_ZONE" ? h.trigger_price_exit : h.trigger_price_add;
                        const triggerPrice = typeof triggerRaw === "number" ? triggerRaw : parseFloat(String(triggerRaw));
                        const pctFromTrigger = !isNaN(triggerPrice) && triggerPrice > 0
                          ? ((h.price - triggerPrice) / triggerPrice * 100)
                          : null;
                        const currencySymbol = h.currency === "GBP" || h.currency === "GBX" ? "£" : h.currency === "EUR" ? "€" : h.currency === "SEK" ? "kr" : "$";
                        const triggerNote = zone === "EXIT_ZONE"
                          ? (h.exit_trigger || (triggerPrice ? `Exit @ ${currencySymbol}${triggerPrice}` : "—"))
                          : (h.add_trigger || (triggerPrice ? `Add @ ${currencySymbol}${triggerPrice}` : "—"));
                        return (
                          <div key={h.ticker} style={{
                            display: "flex",
                            alignItems: isMobile ? "flex-start" : "center",
                            flexDirection: isMobile ? "column" : "row",
                            gap: isMobile ? 4 : 12,
                            padding: "8px 12px",
                            borderLeft: `3px solid ${zoneColor}`,
                            background: zoneBg,
                            borderRadius: 2,
                          }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 55 }}>{h.ticker}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", minWidth: 70 }}>{currencySymbol}{h.price.toFixed(2)}</span>
                            {pctFromTrigger !== null && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: zoneColor, minWidth: 90 }}>
                                {pctFromTrigger > 0 ? "↑" : "↓"}{Math.abs(pctFromTrigger).toFixed(1)}% from trigger
                              </span>
                            )}
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{triggerNote}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Next Actions card */}
        <div style={{ ...card, borderLeft: "3px solid var(--gold)" }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Next Actions</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{displayActions.length} pending</span>
          </div>
          <div style={{ padding: mp }}>
            {displayActions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">✓</span>
                <span className="empty-state-text">No actions required</span>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {displayActions.map((a, i) => (
                  <div key={`${a.ticker}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>{a.ticker}</span>
                    <span style={{ ...actionBadge(a.action), flexShrink: 0 }}>{a.action}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", flex: 1, overflow: "hidden", textOverflow: isMobile ? undefined : "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{a.context}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Today's Movers card */}
        {(() => {
          const deduped = new Map<string, { ticker: string; day: number; mv: number }>();
          holdings.forEach((h) => {
            if (h.day == null) return;
            const key = h.ticker.toUpperCase();
            const existing = deduped.get(key);
            if (!existing || Math.abs(h.day) > Math.abs(existing.day)) {
              deduped.set(key, { ticker: h.ticker, day: h.day, mv: h.mv || 0 });
            }
          });
          const all = Array.from(deduped.values());
          const up = all.filter(m => m.day > 0).length;
          const down = all.filter(m => m.day < 0).length;
          const sorted = moverSort === "gainers"
            ? [...all].filter(m => m.day > 0).sort((a, b) => b.day - a.day)
            : moverSort === "losers"
            ? [...all].filter(m => m.day < 0).sort((a, b) => a.day - b.day)
            : [...all].sort((a, b) => Math.abs(b.day) - Math.abs(a.day));
          const topMovers = sorted.slice(0, 5);

          const toggleBtn = (label: string, value: "abs" | "gainers" | "losers") => ({
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: moverSort === value ? 700 : 400,
            color: moverSort === value ? "var(--text)" : "var(--text-dim)",
            background: moverSort === value ? "rgba(255,255,255,0.08)" : "transparent",
            border: "1px solid",
            borderColor: moverSort === value ? "rgba(255,255,255,0.15)" : "transparent",
            borderRadius: 4,
            padding: "2px 8px",
            cursor: "pointer",
            letterSpacing: "0.05em",
          } as React.CSSProperties);

          return topMovers.length > 0 ? (
            <div style={card}>
              <div style={cardHeader}>
                <span style={cardTitle}>Today's Movers</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>
                  <span style={{ color: "var(--green)" }}>{up} ▲</span>
                  <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
                  <span style={{ color: "var(--red)" }}>{down} ▼</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 4, padding: isMobile ? "6px 12px 0" : "6px 20px 0" }}>
                <button style={toggleBtn("ALL", "abs")} onClick={() => setMoverSort("abs")}>ALL</button>
                <button style={toggleBtn("▲ GAIN", "gainers")} onClick={() => setMoverSort("gainers")}>▲ GAIN</button>
                <button style={toggleBtn("▼ LOSS", "losers")} onClick={() => setMoverSort("losers")}>▼ LOSS</button>
              </div>
              <div style={{ padding: isMobile ? "10px 12px" : "10px 20px" }}>
                {topMovers.map((m) => (
                  <div key={m.ticker} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>{m.ticker}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.day >= 0 ? "var(--green)" : "var(--red)", minWidth: 60 }}>
                      {m.day >= 0 ? "▲" : "▼"} {m.day >= 0 ? "+" : ""}{m.day.toFixed(2)}%
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, textAlign: "right" }}>{formatCurrency(m.mv)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Deploy Queue card */}
        <div style={{ ...card, borderLeft: `3px solid ${isPaused ? "var(--amber)" : "var(--green)"}` }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Deploy Queue {isPaused ? "(paused)" : "(ready)"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{deployTotal > 0 ? formatCurrency(deployTotal) + " staged" : "—"}</span>
          </div>
          <div style={{ padding: mp }}>
            {isPaused && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", marginBottom: 12, lineHeight: 1.5 }}>When pause lifts, deploy in this order:</div>
            )}
            {deployQueue.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📦</span>
                <span className="empty-state-text">No deployments queued</span>
              </div>
            ) : (
              <div style={{ display: "grid", gap: isMobile ? 0 : 8 }}>
                {deployQueue.map((d, i) => {
                  const tierColor = d.tier === 1 ? "#00cc66" : d.tier === 2 ? "#66bb6a" : d.tier === 3 ? "#a5d6a7" : "var(--text-mid)";
                  const tierLabel = d.tier >= 1 && d.tier <= 3 ? `T${d.tier}` : null;

                  if (isMobile) {
                    return (
                      <div key={`${d.ticker}-${i}`} style={{ padding: "10px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", width: 16 }}>{i + 1}.</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: tierLabel ? tierColor : "var(--text)" }}>{d.ticker}</span>
                          {tierLabel && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: tierColor, background: `${tierColor}18`, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.1em" }}>{tierLabel}</span>}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>{d.amount > 0 ? formatCurrency(d.amount) : "—"}</span>
                          {d.price > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>@{d.price.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", paddingLeft: 24, lineHeight: 1.5 }}>
                          <span style={{ color: "var(--text-dim)" }}>{d.layer}</span>
                          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
                          <span style={{ color: "var(--text-mid)" }}>{d.context}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`${d.ticker}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", width: 16 }}>{i + 1}.</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: tierLabel ? tierColor : "var(--text)", minWidth: 50 }}>{d.ticker}</span>
                      {tierLabel && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: tierColor, background: `${tierColor}18`, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.1em" }}>{tierLabel}</span>}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", minWidth: 60 }}>{d.amount > 0 ? formatCurrency(d.amount) : "—"}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", minWidth: 50 }}>{d.price > 0 ? `@${d.price.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : ""}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", minWidth: 60 }}>{d.layer}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.context}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Earnings This Week card */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Earnings This Week</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>{earningsThisWeek.length} REPORTING</span>
          </div>
          <div style={{ padding: isMobile ? "0 12px 8px" : "0 20px 8px" }}>
            {earningsThisWeek.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📅</span>
                <span className="empty-state-text">No earnings this week</span>
              </div>
            ) : (
              earningsThisWeek.map((item) => {
                const isUrgent = item.daysUntil <= 2;
                return (
                  <div key={`${item.ticker}-${item.nextEarningsDate}`} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(28,28,48,0.4)", gap: isMobile ? 6 : 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: isUrgent ? "var(--red)" : "var(--text)", minWidth: 44 }}>{item.ticker}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: isUrgent ? "var(--red)" : "var(--text-dim)" }}>{formatDate(item.nextEarningsDate)}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{item.fiscalPeriod || ""}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={statusChip(isUrgent ? "TRIGGERED" : "AMBER")}>{item.daysUntil === 0 ? "TODAY" : `${item.daysUntil}D`}</span>
                      <button
                        onClick={() => triggerWebhook("stellar-earnings-prep", { ticker: item.ticker }, `Earnings prep triggered for ${item.ticker}. Check email.`)}
                        style={{ background: "none", border: "1px solid var(--rim)", color: "var(--text-mid)", padding: "3px 8px", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase", whiteSpace: "nowrap" }}
                      >📋 Prep</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Narrative — collapsible */}
        <details style={{ ...card, borderLeft: "3px solid transparent" }} open={!isMobile}
          onToggle={(e) => {
            const el = e.currentTarget;
            el.style.borderLeftColor = el.open ? "var(--gold)" : "transparent";
          }}
        >
          <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <span style={cardTitle}>Narrative</span>
              {narrativeData.macro_regime && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{narrativeData.macro_regime}</span>
              )}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", flexShrink: 0 }}>▸ {formatDate(narrativeData.last_updated)}</span>
          </summary>
          <div style={{ padding: isMobile ? 16 : 32 }}>
            {hasNarrative ? (
              <div style={{ display: "grid", gap: 18 }}>
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
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 15 : 18, fontWeight: 300, color: "var(--text)", lineHeight: 1.3, marginBottom: 4 }}>{narrativeData.macro_regime || "Macro regime pending"}</div>
                  {narrativeData.posture_rationale && <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>{narrativeData.posture_rationale}</div>}
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
        </details>

        {/* Quick Commands — separate card */}
        <div style={card}>
          <QuickCommandsSection holdings={holdings} layers={layers} watchlist={watchlist} isMobile={isMobile} />
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>This Week&apos;s Actions</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {alertedHoldings.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", letterSpacing: "0.15em" }}>{alertedHoldings.length} ALERT{alertedHoldings.length !== 1 ? "S" : ""}</span>}
            </div>
          </div>
          <div style={{ padding: isMobile ? "0 12px 12px" : "0 20px 12px" }}>
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

                {/* Active Monitoring sub-section */}
                {(() => {
                  const monitorItems = watchlist.filter(w => w.status.trim().toUpperCase() === "ACTIVE_MONITORING");
                  if (monitorItems.length === 0) return null;
                  return (
                    <div style={{ paddingTop: weeklyActions.length > 0 ? 16 : 12 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 10 }}>Active Monitoring</div>
                      {monitorItems.map((item, index) => {
                        const current = typeof item.current === "number" ? item.current : null;
                        const entryStr = item.entry;
                        const parts = entryStr ? entryStr.split(/\s*[-–]\s*|\s+to\s+/i) : [];
                        const nums = parts.map(p => parseFloat(p.replace(/[^0-9.]/g, ""))).filter(n => !isNaN(n) && n > 0);
                        const midpoint = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0] ?? null;
                        const pctDist = current != null && midpoint != null && midpoint > 0 ? ((current - midpoint) / midpoint * 100) : null;
                        const distLabel = pctDist !== null ? (pctDist <= 0 ? `${pctDist.toFixed(1)}%` : `+${pctDist.toFixed(1)}%`) : "";
                        const distColor = pctDist !== null ? (pctDist <= 0 ? "var(--green)" : "var(--red)") : "var(--text-dim)";
                        return (
                          <div key={`monitor-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(28,28,48,0.4)", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 44 }}>{item.ticker}</span>
                            <span style={{ ...statusChip("MONITOR") }}>MONITOR</span>
                            {current != null && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)" }}>{current.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</span>}
                            {distLabel && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: distColor }}>{distLabel}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}


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
        {/* Risk Controls — collapsible with RAG summary */}
        <details style={card}>
          <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
            <span style={cardTitle}>Risk Controls</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {riskStatusCounts.SAFE && <span style={ragChipStyle("var(--green)")}>{riskStatusCounts.SAFE} SAFE</span>}
              {riskStatusCounts.WATCH && <span style={ragChipStyle("var(--amber)")}>{riskStatusCounts.WATCH} WATCH</span>}
              {riskStatusCounts.BREACH && <span style={ragChipStyle("var(--red)")}>{riskStatusCounts.BREACH} BREACH</span>}
              {riskControls.length === 0 && <span style={ragChipStyle("var(--text-dim)")}>—</span>}
            </div>
          </summary>
          <div style={{ padding: isMobile ? "0 12px 12px" : "0 20px 12px" }}>
            {riskControls.length === 0 ? (
              <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Risk controls unavailable</div>
            ) : (
              riskControls.map((r) => {
                let currentNum = parseFloat(String(r.current).replace(/[^0-9.\-]/g, ""));
                if (!isNaN(currentNum) && Math.abs(currentNum) <= 1) currentNum = currentNum * 100;
                const isFloor = r.key.toLowerCase().includes("floor");
                const thresholdRaw = r.threshold;
                const redMatch = thresholdRaw.match(/RED\s+([\d.]+)/i);
                const amberMatch = thresholdRaw.match(/AMBER\s+([\d.]+)/i);
                let limit = redMatch ? parseFloat(redMatch[1]) : (amberMatch ? parseFloat(amberMatch[1]) : 100);
                let amberLimit = amberMatch ? parseFloat(amberMatch[1]) : null;
                if (limit <= 1) limit = limit * 100;
                if (amberLimit != null && amberLimit <= 1) amberLimit = amberLimit * 100;
                const maxBar = Math.max(limit * 1.3, currentNum * 1.2, 20);
                const fillPct = Math.min((currentNum / maxBar) * 100, 100);
                const thresholdPct = Math.min((limit / maxBar) * 100, 100);
                let barColor = "var(--green)";
                if (isFloor) {
                  if (currentNum < limit) barColor = "var(--red)";
                  else if (amberLimit != null && currentNum < amberLimit * 1.1) barColor = "var(--amber)";
                } else {
                  if (currentNum > limit) barColor = "var(--red)";
                  else if (currentNum > limit - 1) barColor = "var(--amber)";
                }
                const label = r.key === "SGLD_AUM_PCT" ? "SGLD" : r.key === "TOP5_CONCENTRATION" ? "Top-5" : r.key === "HEDGE_FLOOR_PCT" ? "Hedge" : r.key === "BIO_TWIN_RISK_PCT" ? "BioTwin" : r.label;
                return (
                  <div key={r.key} style={{ padding: "10px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text)", minWidth: 60 }}>{label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: barColor }}>
                        {isNaN(currentNum) ? r.current : `${currentNum.toFixed(1)}%`} / {limit.toFixed(1)}% {isFloor ? "floor" : "cap"}
                      </span>
                    </div>
                    <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "visible" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${fillPct}%`, background: barColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                      <div style={{ position: "absolute", top: -2, left: `${thresholdPct}%`, width: 1, height: 12, background: "var(--text-dim)", opacity: 0.6 }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </details>

        {/* Macro Signals — collapsible with RAG summary */}
        <details style={card}>
          <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
            <span style={cardTitle}>Macro Signals</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {macroStatusCounts.GREEN && <span style={ragChipStyle("var(--green)")}>{macroStatusCounts.GREEN} GREEN</span>}
              {macroStatusCounts.AMBER && <span style={ragChipStyle("var(--amber)")}>{macroStatusCounts.AMBER} AMBER</span>}
              {macroStatusCounts.RED && <span style={ragChipStyle("var(--red)")}>{macroStatusCounts.RED} RED</span>}
              {macroSignals.length === 0 && <span style={ragChipStyle("var(--text-dim)")}>—</span>}
            </div>
          </summary>
          <div style={{ padding: isMobile ? "0 12px 8px" : "0 20px 8px" }}>
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
        </details>

        {/* Commit Research */}
        <CommitResearchPanel />

        {/* Golden Rules */}
        <details style={{ ...card, marginBottom: 0 }}>
          <summary style={{ ...cardHeader, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
            <span style={cardTitle}>Golden Rules</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>▸ {GOLDEN_RULES.length} RULES</span>
          </summary>
          <div style={{ padding: isMobile ? "0 12px 8px" : "0 20px 8px" }}>
            {GOLDEN_RULES.map((r) => (
              <div key={r.n} style={{ ...divRow, alignItems: "flex-start", gap: 16 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--gold)", flexShrink: 0, width: 20 }}>{r.n}.</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontStyle: "italic", color: "var(--text-mid)" }}>{r.text}</span>
              </div>
            ))}
          </div>
        </details>
    </div>
  );
}
