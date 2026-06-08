import React, { useState, useMemo } from "react";
import { GOLDEN_RULES } from "@/data/portfolio";
import { LiveMacroStateRow, LiveWatchItem, usePortfolioData } from "@/hooks/usePortfolioData";
import { triggerWebhook } from "@/lib/webhooks";
import { useIsMobile } from "@/hooks/use-mobile";
import ReviewQueue from "@/components/ReviewQueue";
import ActionInbox from "@/components/ActionInbox";
import NarrativeSignalsCard from "@/components/NarrativeSignalsCard";
import { useResearchSummary, ResearchSummary } from "@/hooks/useResearchSummary";
import { openClaudeWithPrompt, buildPrompt, type PromptTemplateKey } from "@/lib/claudePromptUrl";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import { toast } from "sonner";
import { useDailyPrices, normaliseTicker } from "@/hooks/useDailyPrices";
import { normaliseTicker as normaliseTickerAlias, tickerVariants } from "@/lib/tickerAlias";
import { useWatchlistHistory } from "@/hooks/useWatchlistHistory";
import { Sparkline } from "@/components/Sparkline";
import TickerButton from "@/components/factsheet/TickerButton";
import { useFactSheet } from "@/components/factsheet/FactSheetProvider";
import { computeLiveAsymmetry, formatRatio, type AsymmetryQuartet } from "@/lib/liveAsymmetry";
import { AsymmetryPill } from "@/components/AsymmetryPill";

// Quick Commands now route through buildClaudePromptUrl().

const CLAUDE_COMMANDS: { label: string; templateKey: PromptTemplateKey; icon?: string; subtitle?: string }[] = [
  { label: "Substrate audit",       templateKey: "substrate_audit" },
  { label: "Layer gaps",            templateKey: "layer_gaps" },
  { label: "Reclassification risk", templateKey: "reclass_risk" },
  { label: "Log Trades",            templateKey: "log_trades", icon: "📝", subtitle: "CSV or screenshot → Claude" },
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

// Claude project base URL — kept locally so the Start Session free-form
// prompt can be appended without having to add a one-off template.
const CLAUDE_PROJECT_BASE_URL = "https://claude.ai/project/be2a318a-707e-4e8d-ae4b-23f3eab50633";

function getClaudeUrl(prompt: string) {
  return prompt ? `${CLAUDE_PROJECT_BASE_URL}?q=${encodeURIComponent(prompt)}` : CLAUDE_PROJECT_BASE_URL;
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

  const handleDeepDive = async () => {
    if (!deepDiveTarget) return;
    await openClaudeWithPrompt("dropdown_deep_dive", { ticker: deepDiveTarget }, (m) => toast(m));
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
        <a href={getClaudeUrl(`New Stellar session.\n\nExecute immediately:\n\n1. Load HOLDINGS + LAYERS + CASH + MACRO_STATE via Sheet Reader\n\n2. Pull review flag summary from HOLDINGS cols AI-AJ — count W_EXIT, W_FACTOR, W_STALE, M_REVIEW, Q_REVIEW\n\n3. Produce one-screen portfolio dashboard:\n\n   - AUM, MV, cash split by account\n\n   - Layer weight vs target table, flag >3% gaps\n\n   - PAUSE_ACTIVE status, hedge floor compliance\n\n   - Flag count by type with priority ranking\n\n   - Top 3 SIZE UP queue items if any\n\n4. End with: "Where do you want to focus?" — offer Layer Gaps / Review Queue / Ad Hoc\n\nNo actions, no commits. Just orientation.`)} target="_blank" rel="noopener noreferrer" style={{ background: "var(--gold)", color: "var(--void)", border: "none", padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none", display: "block", textAlign: "center", width: isMobile ? "100%" : "auto" }}>Start Session</a>
      </div>

      {/* Claude commands */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {CLAUDE_COMMANDS.map((cmd) => {
          const promptText = buildPrompt(cmd.templateKey);
          return (
            <div key={cmd.label} style={{ display: "flex", gap: 0 }}>
              <ClaudePromptButton
                templateKey={cmd.templateKey}
                style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--rim)", borderRight: "none", color: "var(--text-mid)", padding: isMobile ? "10px 12px" : "12px 14px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textAlign: "left", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, whiteSpace: "normal" }}
              >
                {cmd.icon && <span style={{ fontSize: 14 }}>{cmd.icon}</span>}
                <div>
                  <div>{cmd.label}</div>
                  {cmd.subtitle && <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "none", letterSpacing: "0.02em", marginTop: 2 }}>{cmd.subtitle}</div>}
                </div>
              </ClaudePromptButton>
              <button onClick={() => copyToClipboard(promptText)} title="Copy prompt" style={{ background: "var(--surface)", border: "1px solid var(--rim)", color: "var(--text-dim)", padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer", transition: "all 0.2s" }}>⧉</button>
            </div>
          );
        })}
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

interface AsymmetrySnapshotProps {
  scores: any[];
  holdings: any[];
  watchlist: any[];
  card: React.CSSProperties;
  cardHeader: React.CSSProperties;
  cardTitle: React.CSSProperties;
  mp: number | string;
  isMobile: boolean;
}

function AsymmetrySnapshotCard({ scores, holdings, watchlist, card, cardHeader, cardTitle, mp, isMobile }: AsymmetrySnapshotProps) {
  const { open: openFactSheet } = useFactSheet();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"ALL" | "HELD" | "WATCH">("ALL");
  const [sortKey, setSortKey] = useState<"base" | "stretch">("base");
  const toggle = (t: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(t)) next.delete(t); else next.add(t);
    return next;
  });


  const rows = useMemo(() => {
    // Spine = Holdings ∪ Watchlist (one row per real ticker).
    // Scores are joined onto the spine purely as a quartet lookup.
    const nameKey = (s: any): string =>
      String(s ?? "")
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
        .toUpperCase();

    type KeyKind = "exact" | "swap" | "root" | "name";
    const buildKeys = (raw: any, name?: any): Array<{ k: string; kind: KeyKind }> => {
      const out: Array<{ k: string; kind: KeyKind }> = [];
      const seen = new Set<string>();
      const push = (k: string, kind: KeyKind) => {
        if (!k || seen.has(k)) return;
        seen.add(k);
        out.push({ k, kind });
      };
      const rawStr = String(raw ?? "")
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim();
      const alias = normaliseTickerAlias(rawStr);
      const upper = rawStr.toUpperCase();
      if (alias) push(alias, "exact");
      if (upper) push(upper, "exact");
      for (const v of tickerVariants(rawStr || upper || alias || "")) {
        if (v) push(v.toUpperCase(), "swap");
      }
      if (upper.includes(".")) {
        const root = upper.split(".")[0];
        if (root && root.length >= 2) push(`ROOT:${root}`, "root");
      }
      const n = nameKey(name);
      if (n && n.length >= 3) push(`NAME:${n}`, "name");
      return out;
    };

    // Canonical ticker — used as the dedup identity for spine rows.
    const canon = (raw: any): string => {
      const rawStr = String(raw ?? "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
      return normaliseTickerAlias(rawStr) || rawStr.toUpperCase();
    };

    // 1. scoresByKey — lookup quartets by any key variant.
    //    Prefer exact matches over root/name to avoid false joins.
    const scoresByKey: Record<KeyKind, Map<string, any>> = {
      exact: new Map(),
      swap: new Map(),
      root: new Map(),
      name: new Map(),
    };
    for (const s of scores ?? []) {
      for (const { k, kind } of buildKeys(s.ticker, (s as any).name)) {
        if (!scoresByKey[kind].has(k)) scoresByKey[kind].set(k, s);
      }
    }
    const lookupScore = (raw: any, name?: any): any | null => {
      const keys = buildKeys(raw, name);
      for (const kind of ["exact", "swap", "root", "name"] as KeyKind[]) {
        for (const { k, kind: kk } of keys) {
          if (kk !== kind) continue;
          const hit = scoresByKey[kind].get(k);
          if (hit) return hit;
        }
      }
      return null;
    };

    // 2. Build spine: Holdings ∪ Watchlist, deduped by canonical ticker.
    type Spine = { ticker: string; name: string; price: number | null; held: boolean; source: "H" | "W" };
    const spineByCanon = new Map<string, Spine>();

    for (const h of holdings ?? []) {
      const c = canon(h.ticker);
      if (!c) continue;
      const price = typeof h.price === "number" && h.price > 0 ? h.price : null;
      const existing = spineByCanon.get(c);
      if (!existing) {
        spineByCanon.set(c, { ticker: h.ticker || c, name: String((h as any).name ?? ""), price, held: true, source: "H" });
      } else {
        existing.held = true;
        if (existing.price === null && price !== null) existing.price = price;
      }
    }
    for (const w of watchlist ?? []) {
      const c = canon(w.ticker);
      if (!c) continue;
      const price = typeof w.current === "number" && w.current > 0 ? w.current : null;
      const existing = spineByCanon.get(c);
      if (!existing) {
        spineByCanon.set(c, { ticker: w.ticker || c, name: String(w.name ?? ""), price, held: false, source: "W" });
      } else if (existing.price === null && price !== null) {
        existing.price = price;
      }
    }

    // 3. Build rows from spine, joining scores for quartet/score.
    const out: Array<{
      ticker: string;
      score: number | null;
      status: string;
      band: string;
      ratio: number;
      asymmetry: ReturnType<typeof computeLiveAsymmetry>;
      priceAtLastScore: number | null;
      price: number | null;
      reason: string | null;
    }> = [];

    const missingQuartet: string[] = [];
    const missingPrice: string[] = [];

    for (const sp of spineByCanon.values()) {
      const s = lookupScore(sp.ticker, sp.name);
      const quartet: AsymmetryQuartet = {
        bullBase: s?.bullBase ?? null,
        bullStretch: s?.bullStretch ?? null,
        bearThesisWeak: s?.bearThesisWeak ?? null,
        bearSubstrateFail: s?.bearSubstrateFail ?? null,
        bullBearAtDate: s?.bullBearAtDate ?? null,
      };
      const asym = computeLiveAsymmetry(quartet, sp.price);
      let reason: string | null = null;
      if (asym.baseRatio === null) {
        if (sp.price === null) { reason = "No current price"; missingPrice.push(sp.ticker); }
        else if (quartet.bullBase === null && quartet.bearThesisWeak === null) { reason = "Quartet missing (base + bear)"; missingQuartet.push(sp.ticker); }
        else if (quartet.bullBase === null) reason = "Missing BULL_BASE";
        else if (quartet.bearThesisWeak === null) reason = "Missing BEAR_THESIS_WEAK";
        else if (asym.aboveBull) reason = "Price above BULL_BASE";
        else reason = "Quartet incomplete";
      }
      out.push({
        ticker: sp.ticker,
        score: s?.score ?? null,
        status: sp.held ? "HELD" : "WATCH",
        band: asym.band ?? "—",
        ratio: asym.baseRatio ?? -1,
        asymmetry: asym,
        priceAtLastScore: s?.priceAtLastScore ?? null,
        price: sp.price,
        reason,
      });
    }

    if (typeof window !== "undefined") {
      const watchCount = out.filter((r) => r.status === "WATCH").length;
      const heldCount = out.filter((r) => r.status === "HELD").length;
      const dbg = {
        spineCount: spineByCanon.size,
        watchCount,
        heldCount,
        holdingsCount: holdings?.length ?? 0,
        watchlistCount: watchlist?.length ?? 0,
        missingPriceCount: missingPrice.length,
        missingPrice,
        missingQuartetCount: missingQuartet.length,
        missingQuartet,
      };
      (window as any).__asymDebug = dbg;
      try { (window.top as any).__asymDebug = dbg; } catch {}
      // eslint-disable-next-line no-console
      console.info("[asym] spine:", spineByCanon.size, "watch:", watchCount, "held:", heldCount, "missingPrice:", missingPrice.length, "missingQuartet:", missingQuartet.length);
    }

    return out.sort((a, b) => b.ratio - a.ratio);
  }, [scores, holdings, watchlist]);

  const filteredRows = useMemo(() => {
    const f = filter === "ALL"
      ? rows
      : filter === "HELD"
      ? rows.filter((r) => r.status === "HELD")
      : rows.filter((r) => r.status !== "HELD");
    const sorted = [...f].sort((a, b) => {
      const av = sortKey === "base" ? (a.asymmetry.baseRatio ?? -Infinity) : (a.asymmetry.stretchRatio ?? -Infinity);
      const bv = sortKey === "base" ? (b.asymmetry.baseRatio ?? -Infinity) : (b.asymmetry.stretchRatio ?? -Infinity);
      return bv - av;
    });
    return sorted;
  }, [rows, filter, sortKey]);

  if (rows.length === 0) return null;


  const th: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "var(--text-dim)", padding: "8px 10px", textAlign: "left", borderBottom: "1px solid var(--rim)",
  };
  const td: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", padding: "8px 10px",
    borderBottom: "1px solid var(--rim)",
  };

  const segBase: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
    padding: "3px 8px", border: "1px solid var(--rim)", background: "transparent",
    color: "var(--text-dim)", cursor: "pointer", lineHeight: 1.4,
  };
  const segActive: React.CSSProperties = {
    background: "rgba(201,168,76,0.15)", color: "var(--gold)", borderColor: "rgba(201,168,76,0.4)",
  };

  const stretchColor = (v: number | null) =>
    v === null ? "var(--text-dim)" : v >= 3 ? "var(--green)" : v >= 2 ? "var(--amber)" : "var(--text-dim)";

  return (
    <div style={card}>
      <div style={{ ...cardHeader, flexWrap: "wrap", gap: 8, rowGap: 6 }}>
        <span style={cardTitle}>Asymmetry Snapshot</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 8 : 10,
            marginLeft: isMobile ? 0 : "auto",
            width: isMobile ? "100%" : "auto",
            justifyContent: isMobile ? "space-between" : "flex-end",
          }}
        >
          <div role="group" aria-label="Filter" style={{ display: "inline-flex" }}>
            {(["ALL", "HELD", "WATCH"] as const).map((opt, i) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                aria-pressed={filter === opt}
                style={{
                  ...segBase,
                  ...(isMobile ? { padding: "4px 10px", fontSize: 10 } : null),
                  ...(filter === opt ? segActive : null),
                  borderLeftWidth: i === 0 ? 1 : 0,
                  borderTopLeftRadius: i === 0 ? 2 : 0,
                  borderBottomLeftRadius: i === 0 ? 2 : 0,
                  borderTopRightRadius: i === 2 ? 2 : 0,
                  borderBottomRightRadius: i === 2 ? 2 : 0,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
            {filteredRows.length} LIVE
          </span>
        </div>
      </div>
      <div
        style={{
          padding: mp,
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: 520,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 0 : "auto", tableLayout: isMobile ? "fixed" : undefined }}>

          <thead>
            <tr>
              <th style={{ ...th, width: 24, padding: isMobile ? "8px 4px" : th.padding }}></th>
              <th style={{ ...th, padding: isMobile ? "8px 6px" : th.padding }}>Ticker</th>
              {!isMobile && <th style={th}>Score</th>}
              {!isMobile && <th style={th}>Status</th>}
              {!isMobile && <th style={th}>Band</th>}
              <th
                style={{ ...th, textAlign: "right", cursor: "pointer", color: sortKey === "base" ? "var(--gold)" : "var(--text-dim)", padding: isMobile ? "8px 6px" : th.padding }}
                onClick={() => setSortKey("base")}
                title="Sort by base ratio"
              >
                Base{sortKey === "base" ? " ▼" : ""}
              </th>
              <th
                style={{ ...th, textAlign: "right", cursor: "pointer", color: sortKey === "stretch" ? "var(--gold)" : "var(--text-dim)", padding: isMobile ? "8px 6px" : th.padding }}
                onClick={() => setSortKey("stretch")}
                title="Sort by stretch ratio"
              >
                Stretch{sortKey === "stretch" ? " ▼" : ""}
              </th>
              {!isMobile && <th style={{ ...th, textAlign: "center" }}>Trend</th>}
              {!isMobile && <th style={{ ...th, textAlign: "center" }}>Action</th>}
            </tr>
          </thead>


          <tbody>
            {filteredRows.map((r, idx) => {
              const statusColor = r.status === "HELD" ? "var(--gold)" : "var(--text-mid)";
              const trend = r.price !== null && r.priceAtLastScore && r.priceAtLastScore > 0
                ? (r.price < r.priceAtLastScore
                    ? { sym: "▲", color: "var(--green)", title: `Cheaper than at score (${r.priceAtLastScore})`, pct: ((r.price - r.priceAtLastScore) / r.priceAtLastScore) * 100 }
                    : r.price > r.priceAtLastScore
                    ? { sym: "▼", color: "var(--amber)", title: `Richer than at score (${r.priceAtLastScore})`, pct: ((r.price - r.priceAtLastScore) / r.priceAtLastScore) * 100 }
                    : { sym: "·", color: "var(--text-dim)", title: "Flat vs score", pct: 0 })
                : { sym: "·", color: "var(--text-dim)", title: "No prior price", pct: null as number | null };
              const isOpen = expanded.has(r.ticker);
              const q = r.asymmetry.quartet;
              const pctTo = (target: number | null) =>
                target !== null && target > 0 && r.price !== null && r.price > 0
                  ? ((target - r.price) / r.price) * 100
                  : null;
              const fmtPct = (n: number | null) => n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
              const fmtPrice = (n: number | null) => n === null ? "—" : n.toFixed(2);
              const driftBits: string[] = [];
              if (trend.pct !== null) {
                const absPct = Math.abs(trend.pct);
                driftBits.push(
                  trend.pct < 0
                    ? `Price has fallen ${absPct.toFixed(1)}% since scoring — upside has widened, ratio improved.`
                    : trend.pct > 0
                    ? `Price has risen ${absPct.toFixed(1)}% since scoring — upside has compressed, ratio degraded.`
                    : "Price is flat vs scoring."
                );
              }
              if (r.asymmetry.belowBear) driftBits.push("Below BEAR_THESIS_WEAK — thesis under stress.");
              if (r.asymmetry.aboveBull) driftBits.push("Above BULL_BASE — upside already captured.");
              if (r.asymmetry.quartetAgeDays !== null) driftBits.push(`Quartet set ${r.asymmetry.quartetAgeDays}d ago.`);
              const drift = driftBits.join(" ");
              return (
                <React.Fragment key={`${r.ticker}-${idx}`}>
                  <tr
                    onClick={() => toggle(r.ticker)}
                    style={{ cursor: "pointer", background: isOpen ? "rgba(201,168,76,0.06)" : "transparent" }}
                    onMouseEnter={(e) => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(201,168,76,0.04)"; }}
                    onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ ...td, color: "var(--text-dim)", textAlign: "center", padding: isMobile ? "8px 4px" : td.padding }} aria-label={isOpen ? "Collapse" : "Expand"}>
                      {isOpen ? "▾" : "▸"}
                    </td>
                    <td style={{ ...td, padding: isMobile ? "8px 6px" : td.padding }}>
                      <TickerButton ticker={r.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                        {r.ticker}
                      </TickerButton>
                    </td>
                    {!isMobile && <td style={td}>{r.score ?? "—"}</td>}
                    {!isMobile && <td style={{ ...td, color: statusColor, fontSize: 9, letterSpacing: "0.1em" }}>{r.status}</td>}
                    {!isMobile && <td style={{ ...td, fontSize: 9, letterSpacing: "0.1em", color: "var(--text-dim)" }}>{r.band}</td>}
                    <td style={{ ...td, textAlign: "right", padding: isMobile ? "8px 6px" : td.padding }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <AsymmetryPill asymmetry={r.asymmetry} />
                        {r.reason && (
                          <span title={r.reason} style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.04em", whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right", color: stretchColor(r.asymmetry.stretchRatio), fontWeight: r.asymmetry.stretchRatio !== null && r.asymmetry.stretchRatio >= 3 ? 700 : 400, padding: isMobile ? "8px 6px" : td.padding }}>
                      {formatRatio(r.asymmetry.stretchRatio)}
                    </td>
                    {!isMobile && <td style={{ ...td, textAlign: "center", color: trend.color }} title={trend.title}>{trend.sym}</td>}
                    {!isMobile && (
                      <td style={{ ...td, textAlign: "center" }}>
                        <button
                          type="button"
                          title={`Open ${r.ticker} fact sheet`}
                          onClick={(e) => { e.stopPropagation(); openFactSheet(r.ticker); }}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--rim)",
                            color: "var(--gold)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 2,
                            cursor: "pointer",
                            lineHeight: 1,
                          }}
                        >
                          ↗
                        </button>
                      </td>
                    )}
                  </tr>
                  {isOpen && (
                    <tr style={{ background: "rgba(201,168,76,0.03)" }}>
                      <td colSpan={isMobile ? 4 : 9} style={{ padding: isMobile ? "8px 10px 10px" : "10px 14px 14px", borderBottom: "1px solid var(--rim)" }}>

                        {isMobile ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Tier summary — surfaces Base + Stretch prominently so mobile users don't need horizontal scroll */}
                            <div style={{
                              display: "flex",
                              gap: 8,
                              padding: "8px 10px",
                              border: "1px solid var(--rim)",
                              borderRadius: 2,
                              background: "rgba(201,168,76,0.04)",
                            }}>
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", color: "var(--text-dim)" }}>BASE</div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--gold)", fontWeight: 700 }}>{formatRatio(r.asymmetry.baseRatio)}</div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>bullBase vs bearThesisWeak</div>
                              </div>
                              <div style={{ width: 1, background: "var(--rim)" }} />
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", color: "var(--text-dim)" }}>STRETCH</div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: stretchColor(r.asymmetry.stretchRatio), fontWeight: 700 }}>{formatRatio(r.asymmetry.stretchRatio)}</div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>bullStretch vs bearSubstrateFail</div>
                              </div>
                            </div>
                            {/* Inline sort controls for mobile — reorder rows without scrolling to header */}
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", color: "var(--text-dim)" }}>SORT</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSortKey("base"); }}
                                style={{
                                  ...segBase,
                                  ...(sortKey === "base" ? segActive : null),
                                  borderRadius: 2,
                                  padding: "4px 10px",
                                  fontSize: 10,
                                }}
                              >
                                Base{sortKey === "base" ? " ▼" : ""}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSortKey("stretch"); }}
                                style={{
                                  ...segBase,
                                  ...(sortKey === "stretch" ? segActive : null),
                                  borderRadius: 2,
                                  padding: "4px 10px",
                                  fontSize: 10,
                                }}
                              >
                                Stretch{sortKey === "stretch" ? " ▼" : ""}
                              </button>
                            </div>
                            {/* Meta chips: score / status / band / trend (hidden from main row on mobile) */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em" }}>
                              <span style={{ padding: "3px 7px", border: "1px solid var(--rim)", borderRadius: 2, color: "var(--text-dim)" }}>SCORE {r.score ?? "—"}</span>
                              <span style={{ padding: "3px 7px", border: "1px solid var(--rim)", borderRadius: 2, color: statusColor }}>{r.status}</span>
                              <span style={{ padding: "3px 7px", border: "1px solid var(--rim)", borderRadius: 2, color: "var(--text-dim)" }}>{r.band}</span>
                              <span style={{ padding: "3px 7px", border: "1px solid var(--rim)", borderRadius: 2, color: trend.color }} title={trend.title}>{trend.sym} TREND</span>
                            </div>
                            {/* Swipeable horizontal quartet chips, current in the middle */}

                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                overflowX: "auto",
                                scrollSnapType: "x mandatory",
                                WebkitOverflowScrolling: "touch",
                                paddingBottom: 4,
                                margin: "0 -10px",
                                padding: "0 10px 4px",
                              }}
                            >
                              {[
                                { label: "B-FAIL", value: q.bearSubstrateFail, color: "var(--red)" },
                                { label: "B-WEAK", value: q.bearThesisWeak, color: "var(--amber)" },
                                { label: "NOW", value: r.price, color: "var(--gold)", isNow: true },
                                { label: "BULL", value: q.bullBase, color: "var(--green)" },
                                { label: "STRETCH", value: q.bullStretch, color: "var(--green)" },
                              ].map((chip) => {
                                const pct = chip.isNow ? null : pctTo(chip.value);
                                return (
                                  <div
                                    key={chip.label}
                                    style={{
                                      flex: "0 0 auto",
                                      scrollSnapAlign: "center",
                                      minWidth: 78,
                                      border: `1px solid ${chip.isNow ? "var(--gold)" : "var(--rim)"}`,
                                      background: chip.isNow ? "rgba(201,168,76,0.08)" : "transparent",
                                      padding: "6px 8px",
                                      borderRadius: 2,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 2,
                                    }}
                                  >
                                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em", color: chip.color }}>
                                      {chip.label}
                                    </div>
                                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", fontWeight: chip.isNow ? 700 : 400 }}>
                                      {fmtPrice(chip.value)}
                                    </div>
                                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                                      {pct === null ? "—" : fmtPct(pct)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.04em" }}>
                              ← swipe targets →
                            </div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", lineHeight: 1.45 }}>
                              {drift || "No drift signals available."}
                            </div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                              Base {formatRatio(r.asymmetry.baseRatio)} · Stretch {formatRatio(r.asymmetry.stretchRatio)}
                              {r.priceAtLastScore ? ` · @score ${r.priceAtLastScore.toFixed(2)}` : ""}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openFactSheet(r.ticker); }}
                                style={{
                                  flex: 1,
                                  background: "var(--gold)",
                                  border: "1px solid var(--gold)",
                                  color: "var(--bg)",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 10,
                                  letterSpacing: "0.1em",
                                  padding: "8px 10px",
                                  borderRadius: 2,
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                FACT SHEET ↗
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggle(r.ticker); }}
                                style={{
                                  background: "transparent",
                                  border: "1px solid var(--rim)",
                                  color: "var(--text-dim)",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 10,
                                  letterSpacing: "0.1em",
                                  padding: "8px 12px",
                                  borderRadius: 2,
                                  cursor: "pointer",
                                }}
                              >
                                CLOSE
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mid)", letterSpacing: "0.02em" }}>
                              <span style={{ color: "var(--gold)", fontWeight: 700 }}>Base {formatRatio(r.asymmetry.baseRatio)}</span>
                              <span style={{ color: "var(--text-dim)" }}> (bullBase vs bearThesisWeak)</span>
                              <span style={{ color: "var(--text-dim)" }}> · </span>
                              <span style={{ color: stretchColor(r.asymmetry.stretchRatio), fontWeight: 700 }}>Stretch {formatRatio(r.asymmetry.stretchRatio)}</span>
                              <span style={{ color: "var(--text-dim)" }}> (bullStretch vs bearSubstrateFail)</span>
                            </div>
                            {/* Inline sort controls for desktop expansion */}
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", color: "var(--text-dim)" }}>SORT</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSortKey("base"); }}
                                style={{
                                  ...segBase,
                                  ...(sortKey === "base" ? segActive : null),
                                  borderRadius: 2,
                                  padding: "4px 10px",
                                  fontSize: 10,
                                }}
                              >
                                Base{sortKey === "base" ? " ▼" : ""}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSortKey("stretch"); }}
                                style={{
                                  ...segBase,
                                  ...(sortKey === "stretch" ? segActive : null),
                                  borderRadius: 2,
                                  padding: "4px 10px",
                                  fontSize: 10,
                                }}
                              >
                                Stretch{sortKey === "stretch" ? " ▼" : ""}
                              </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6 }}>
                                QUARTET TARGETS
                              </div>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                                <tbody>
                                  <tr>
                                    <td style={{ padding: "3px 0", color: "var(--green)" }}>BULL_STRETCH</td>
                                    <td style={{ padding: "3px 0", textAlign: "right", color: "var(--text)" }}>{fmtPrice(q.bullStretch)}</td>
                                    <td style={{ padding: "3px 0 3px 12px", textAlign: "right", color: "var(--text-dim)" }}>{fmtPct(pctTo(q.bullStretch))}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: "3px 0", color: "var(--green)" }}>BULL_BASE</td>
                                    <td style={{ padding: "3px 0", textAlign: "right", color: "var(--text)" }}>{fmtPrice(q.bullBase)}</td>
                                    <td style={{ padding: "3px 0 3px 12px", textAlign: "right", color: "var(--text-dim)" }}>{fmtPct(pctTo(q.bullBase))}</td>
                                  </tr>
                                  <tr style={{ borderTop: "1px dashed var(--rim)", borderBottom: "1px dashed var(--rim)" }}>
                                    <td style={{ padding: "4px 0", color: "var(--gold)" }}>CURRENT</td>
                                    <td style={{ padding: "4px 0", textAlign: "right", color: "var(--gold)", fontWeight: 700 }}>{fmtPrice(r.price)}</td>
                                    <td style={{ padding: "4px 0 4px 12px", textAlign: "right", color: "var(--text-dim)" }}>—</td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: "3px 0", color: "var(--amber)" }}>BEAR_THESIS_WEAK</td>
                                    <td style={{ padding: "3px 0", textAlign: "right", color: "var(--text)" }}>{fmtPrice(q.bearThesisWeak)}</td>
                                    <td style={{ padding: "3px 0 3px 12px", textAlign: "right", color: "var(--text-dim)" }}>{fmtPct(pctTo(q.bearThesisWeak))}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: "3px 0", color: "var(--red)" }}>BEAR_SUBSTRATE_FAIL</td>
                                    <td style={{ padding: "3px 0", textAlign: "right", color: "var(--text)" }}>{fmtPrice(q.bearSubstrateFail)}</td>
                                    <td style={{ padding: "3px 0 3px 12px", textAlign: "right", color: "var(--text-dim)" }}>{fmtPct(pctTo(q.bearSubstrateFail))}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)", marginBottom: 6 }}>
                                  DRIFT EXPLANATION
                                </div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-mid)", lineHeight: 1.55 }}>
                                  {drift || "No drift signals available."}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                                  Base {formatRatio(r.asymmetry.baseRatio)} · Stretch {formatRatio(r.asymmetry.stretchRatio)}
                                  {r.priceAtLastScore ? ` · Score price ${r.priceAtLastScore.toFixed(2)}` : ""}
                                </div>
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openFactSheet(r.ticker); }}
                                  style={{
                                    background: "var(--gold)",
                                    border: "1px solid var(--gold)",
                                    color: "var(--bg)",
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 10,
                                    letterSpacing: "0.1em",
                                    padding: "6px 12px",
                                    borderRadius: 2,
                                    cursor: "pointer",
                                    fontWeight: 700,
                                  }}
                                >
                                  OPEN FACT SHEET ↗
                                </button>
                              </div>
                            </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default function CommandTab() {

  const isMobile = useIsMobile();
  const [moverSort, setMoverSort] = useState<"abs" | "gainers" | "losers">("abs");
  const { holdings, watchlist, layers, narrativeData, macroState, riskControls, earningsCalendar, scores, loading, error } = usePortfolioData();
  const { recentResearch } = useResearchSummary();
  const { priceData } = useDailyPrices();
  const watchlistTickerList = useMemo(
    () => Array.from(new Set((watchlist || []).map((w) => String(w.ticker || "").toUpperCase()).filter(Boolean))),
    [watchlist],
  );
  const { byTicker: wlHistory } = useWatchlistHistory(watchlistTickerList);

  const priorityNarratives = [narrativeData.week_priority_1, narrativeData.week_priority_2, narrativeData.week_priority_3]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);

  const weeklyWatch = [narrativeData.week_watch_1, narrativeData.week_watch_2, narrativeData.week_watch_3]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);

  // Proximity threshold — only surface alerts when price is within this % of trigger
  const ZONE_PROXIMITY_THRESHOLD = 0.15;

  // Dynamic zone detection: compare live price to trigger price columns
  // IMPORTANT: Never trust sheet alert_status alone — always validate against trigger prices
  const computeZoneStatus = (holding: typeof holdings[0]) => {
    const price = holding.price;
    if (!price || price <= 0) return "CLEAR";

    // Parse trigger prices — must be a real positive number to qualify
    const rawAdd = holding.trigger_price_add;
    const rawExit = holding.trigger_price_exit;
    const triggerAdd = (rawAdd !== null && rawAdd !== undefined && String(rawAdd).trim() !== "")
      ? parseFloat(String(rawAdd)) : NaN;
    const triggerExit = (rawExit !== null && rawExit !== undefined && String(rawExit).trim() !== "")
      ? parseFloat(String(rawExit)) : NaN;

    // EXIT ZONE: TRIGGER_PRICE_EXIT is a stop-loss floor — flag when price drops TO or NEAR the stop
    if (!isNaN(triggerExit) && triggerExit > 0 && price <= triggerExit * (1 + ZONE_PROXIMITY_THRESHOLD)) return "EXIT_ZONE";

    // ADD ZONE: TRIGGER_PRICE_ADD > 0 AND price <= ADD * (1 + threshold)
    if (!isNaN(triggerAdd) && triggerAdd > 0 && price <= triggerAdd * (1 + ZONE_PROXIMITY_THRESHOLD)) return "ADD_ZONE";

    return "CLEAR";
  };

  const alertedHoldings = holdings
    .map(h => ({ ...h, alert_status: computeZoneStatus(h) }))
    .filter(h => h.alert_status !== "CLEAR");

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

  // Sort ADD_ZONE: furthest below trigger first (most negative % from trigger)
  if (zoneGroups["ADD_ZONE"]) {
    zoneGroups["ADD_ZONE"].sort((a, b) => {
      const triggerA = parseFloat(String(a.trigger_price_add));
      const triggerB = parseFloat(String(b.trigger_price_add));
      const pctA = !isNaN(triggerA) && triggerA > 0 ? ((triggerA - a.price) / triggerA * 100) : 0;
      const pctB = !isNaN(triggerB) && triggerB > 0 ? ((triggerB - b.price) / triggerB * 100) : 0;
      return pctB - pctA; // Higher % = further below = more urgent
    });
  }

  // Sort EXIT_ZONE: closest to breach first (least distance above exit, or already below)
  if (zoneGroups["EXIT_ZONE"]) {
    zoneGroups["EXIT_ZONE"].sort((a, b) => {
      const triggerA = parseFloat(String(a.trigger_price_exit));
      const triggerB = parseFloat(String(b.trigger_price_exit));
      const pctA = !isNaN(triggerA) && triggerA > 0 ? ((triggerA - a.price) / triggerA * 100) : 0;
      const pctB = !isNaN(triggerB) && triggerB > 0 ? ((triggerB - b.price) / triggerB * 100) : 0;
      return pctA - pctB; // Lower % = closer to breach = more urgent
    });
  }

  const zoneOrder = ["ADD_ZONE", "EXIT_ZONE"];
  const activeZones = zoneOrder.filter((z) => zoneGroups[z]?.length);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, alignItems: "start" }}>
        {/* Today's Decisions — unified action inbox */}
        <ActionInbox holdings={holdings} watchlist={watchlist} earnings={earningsCalendar} />

        {/* Review Queue Banner (full detail, collapsed by default) */}
        <ReviewQueue holdings={holdings} compact />

        {/* Narrative Signals — realtime intel from ingest pipeline */}
        <NarrativeSignalsCard />

        {/* Asymmetry Snapshot — top 10 live ratios across held + watchlist */}
        <AsymmetrySnapshotCard
          scores={scores}
          holdings={holdings}
          watchlist={watchlist}
          card={card}
          cardHeader={cardHeader}
          cardTitle={cardTitle}
          mp={mp}
          isMobile={isMobile}
        />


        {/* Latest Research Cards */}
        {recentResearch.length > 0 && (
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardTitle}>Latest Research</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>{recentResearch.length} RECENT</span>
            </div>
            <div style={{ padding: mp, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {recentResearch.map((r, i) => {
                const sc = r.total_score;
                const scoreColor = sc >= 80 ? "var(--green)" : sc >= 60 ? "var(--accent)" : sc >= 40 ? "var(--amber)" : "var(--red)";
                const tierUpper = (r.tier || "").toUpperCase();
                const tierColor = tierUpper === "CORE" ? "var(--gold)" : tierUpper === "ANCHOR" ? "var(--accent)" : tierUpper === "SATELLITE" ? "var(--amber)" : "var(--text-dim)";
                const dateStr = (() => { try { return new Date(r.scored_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); } catch { return ""; } })();
                return (
                  <div key={`${r.ticker}-${i}`} style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--rim)", borderRadius: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{r.ticker}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: scoreColor }}>{sc}</span>
                      {r.tier && <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em", padding: "1px 5px", borderRadius: 2, color: tierColor, background: `color-mix(in srgb, ${tierColor} 12%, transparent)` }}>{tierUpper}</span>}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>{r.action}</div>
                    {r.change_note && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.4, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{r.change_note}</div>}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)" }}>{dateStr} · {r.scored_by}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                          ? ((triggerPrice - h.price) / triggerPrice * 100)
                          : null;
                        
                        // Color logic based on position vs trigger
                        let rowColor: string;
                        let rowBg: string;
                        if (zone === "ADD_ZONE") {
                          // ADD ZONE: below trigger = green (actionable), above = amber (approaching)
                          if (pctFromTrigger !== null && pctFromTrigger > 0) {
                            // Price is below trigger (pctFromTrigger > 0 means trigger is above price)
                            rowColor = "var(--green)";
                            rowBg = "var(--green-dim)";
                          } else {
                            // Price is above trigger but within proximity
                            rowColor = "var(--amber)";
                            rowBg = "var(--amber-dim)";
                          }
                        } else {
                          // EXIT ZONE: below trigger = red (breached), above = amber (approaching)
                          if (pctFromTrigger !== null && pctFromTrigger < 0) {
                            // Price is below exit trigger (breached stop-loss)
                            rowColor = "var(--red)";
                            rowBg = "var(--red-dim)";
                          } else {
                            // Price is above exit but within proximity
                            rowColor = "var(--amber)";
                            rowBg = "var(--amber-dim)";
                          }
                        }

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
                            borderLeft: `3px solid ${rowColor}`,
                            background: rowBg,
                            borderRadius: 2,
                          }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 55 }}>{h.ticker}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", minWidth: 70 }}>{currencySymbol}{h.price.toFixed(2)}</span>
                            {pctFromTrigger !== null && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: rowColor, minWidth: 90 }}>
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
          const deduped = new Map<string, { ticker: string; day: number; mv: number; price: number; currency: string; isBordier: boolean }>();
          holdings.forEach((h) => {
            if (h.day == null) return;
            // Stale-price guard: drop rows where today's price equals yesterday's close.
            // Catches Bordier_GIA names whose JPY prices are manually maintained and
            // haven't been refreshed (would otherwise appear as 0% movers or, worse,
            // create a fake spike when several days of drift land in one update).
            if (h.prevClose != null && h.price != null && h.price === h.prevClose) return;
            const isBordier = String(h.account || "").toUpperCase().replace(/[^A-Z]/g, "").startsWith("BORDIER");
            const key = h.ticker.toUpperCase();
            const existing = deduped.get(key);
            if (!existing || Math.abs(h.day) > Math.abs(existing.day)) {
              deduped.set(key, { ticker: h.ticker, day: h.day, mv: h.mv || 0, price: h.price, currency: h.currency, isBordier });
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

          // Compute watchlist movers up-front so the card surfaces even when
          // there are no holdings movers today. Only filter out tickers that
          // are already rendered in topMovers above (avoid duplicate rows);
          // a held ticker that didn't make the top movers cut is still valid
          // to show in the watchlist stripe.
          const topMoverTickers = new Set(topMovers.map((m) => String(m.ticker || "").toUpperCase()));
          const wlList = watchlist ?? [];
          const wlMovers: { ticker: string; day: number; price: number; currency: string; entry: string }[] = [];
          for (const w of wlList) {
            if (!w.ticker) continue;
            const key = w.ticker.toUpperCase();
            if (topMoverTickers.has(key)) continue;
            let last: number | null = null;
            let prev: number | null = null;
            const pd = priceData?.get(normaliseTicker(w.ticker));
            if (pd && pd.points.length >= 2) {
              last = pd.points[pd.points.length - 1].priceLocal;
              prev = pd.points[pd.points.length - 2].priceLocal;
            } else {
              const traj = wlHistory[key];
              if (traj && traj.spark30d.length >= 2) {
                last = traj.spark30d[traj.spark30d.length - 1].close;
                prev = traj.spark30d[traj.spark30d.length - 2].close;
              }
            }
            if (last == null || prev == null || !prev) continue;
            const day = ((last - prev) / prev) * 100;
            wlMovers.push({
              ticker: w.ticker,
              day,
              price: typeof w.current === "number" ? w.current : last,
              currency: w.currency || "USD",
              entry: w.entry || "",
            });
          }
          const wlUp = wlMovers.filter((m) => m.day > 0).length;
          const wlDown = wlMovers.filter((m) => m.day < 0).length;
          const wlSorted = moverSort === "gainers"
            ? wlMovers.filter((m) => m.day > 0).sort((a, b) => b.day - a.day)
            : moverSort === "losers"
            ? wlMovers.filter((m) => m.day < 0).sort((a, b) => a.day - b.day)
            : [...wlMovers].sort((a, b) => Math.abs(b.day) - Math.abs(a.day));
          const wlTop = wlSorted.slice(0, 5);

          // Always render the card — the WATCHLIST stripe is a permanent
          // sub-section, even when both holdings movers and watchlist movers
          // are empty (e.g. pre-market, empty sheet, all held).
          return (
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
              {topMovers.length > 0 && (
              <div style={{ padding: isMobile ? "10px 12px" : "10px 20px" }}>
                {topMovers.map((m) => {
                  const currencySymbol = m.currency === "GBP" || m.currency === "GBX" ? "£" : m.currency === "EUR" ? "€" : m.currency === "SEK" ? "kr" : "$";
                  const pd = priceData?.get(normaliseTicker(m.ticker));
                  const hasSpark = pd && pd.points.length >= 5;
                  const priceStr = typeof m.price === "number" && !isNaN(m.price) ? `${currencySymbol}${m.price.toFixed(2)}` : "—";
                  const dayPctEl = (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.day >= 0 ? "var(--green)" : "var(--red)", minWidth: 60 }}>
                      {m.day >= 0 ? "▲" : "▼"} {m.day >= 0 ? "+" : ""}{m.day.toFixed(2)}%
                    </span>
                  );

                  if (isMobile) {
                    return (
                      <div key={m.ticker} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>{m.ticker}</TickerButton>
                          {m.isBordier && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)", letterSpacing: "0.1em" }}>JPY</span>}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", minWidth: 70 }}>{priceStr}</span>
                          {dayPctEl}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {hasSpark ? (
                            <Sparkline points={pd.points} color={pd.sparklineColor} width={140} height={20} />
                          ) : (
                            <span style={{ width: 140, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.4 }}>—</span>
                          )}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, textAlign: "right" }}>{formatCurrency(m.mv)}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.ticker} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                      <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>{m.ticker}</TickerButton>
                      {m.isBordier && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)", letterSpacing: "0.1em" }}>JPY</span>}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", minWidth: 70 }}>{priceStr}</span>
                      {dayPctEl}
                      {hasSpark ? (
                        <Sparkline points={pd.points} color={pd.sparklineColor} width={90} height={22} />
                      ) : (
                        <span style={{ width: 90, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.4, textAlign: "center" }}>—</span>
                      )}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, textAlign: "right" }}>{formatCurrency(m.mv)}</span>
                    </div>
                  );
                })}
              </div>
              )}
              {(() => {
                // WATCHLIST stripe: render unconditionally with three clear states.
                const headerBorder = topMovers.length > 0 ? "1px solid rgba(28,28,48,0.6)" : "none";
                const watchlistEmpty = wlList.length === 0;
                if (watchlistEmpty || wlTop.length === 0) {
                  const copy = watchlistEmpty
                    ? "Watchlist empty — no tickers being tracked"
                    : "No watchlist price moves today — awaiting next refresh";
                  return (
                    <div style={{ borderTop: headerBorder, marginTop: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "10px 12px 4px" : "10px 20px 4px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)", fontWeight: 700 }}>WATCHLIST</span>
                        {!watchlistEmpty && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>
                            <span style={{ color: "var(--green)" }}>{wlUp} ▲</span>
                            <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
                            <span style={{ color: "var(--red)" }}>{wlDown} ▼</span>
                          </span>
                        )}
                      </div>
                      <div style={{ padding: isMobile ? "6px 12px 12px" : "6px 20px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.7 }}>
                        {copy}
                      </div>
                    </div>
                  );
                }
                return (

                  <div style={{ borderTop: topMovers.length > 0 ? "1px solid rgba(28,28,48,0.6)" : "none", marginTop: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "10px 12px 4px" : "10px 20px 4px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--text-dim)", fontWeight: 700 }}>WATCHLIST</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>
                        <span style={{ color: "var(--green)" }}>{wlUp} ▲</span>
                        <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
                        <span style={{ color: "var(--red)" }}>{wlDown} ▼</span>
                      </span>
                    </div>
                    <div style={{ padding: isMobile ? "4px 12px 10px" : "4px 20px 10px" }}>
                      {wlTop.map((m) => {
                        const currencySymbol = m.currency === "GBP" || m.currency === "GBX" ? "£" : m.currency === "EUR" ? "€" : m.currency === "SEK" ? "kr" : "$";
                        const pd = priceData?.get(normaliseTicker(m.ticker));
                        const traj = wlHistory[m.ticker.toUpperCase()];
                        const sparkPoints = pd && pd.points.length >= 5
                          ? pd.points
                          : traj && traj.spark30d.length >= 5
                          ? traj.spark30d.map((p) => ({ date: p.date, priceLocal: p.close, priceGbp: p.close }))
                          : null;
                        const sparkColor = pd?.sparklineColor ?? (m.day >= 0 ? "green" : "red");
                        const hasSpark = !!sparkPoints;
                        const priceStr = typeof m.price === "number" && !isNaN(m.price) ? `${currencySymbol}${m.price.toFixed(2)}` : "—";
                        const dayPctEl = (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.day >= 0 ? "var(--green)" : "var(--red)", minWidth: 60 }}>
                            {m.day >= 0 ? "▲" : "▼"} {m.day >= 0 ? "+" : ""}{m.day.toFixed(2)}%
                          </span>
                        );
                        const entryEl = (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.entry}>
                            {m.entry ? `@ ${m.entry}` : ""}
                          </span>
                        );

                        if (isMobile) {
                          return (
                            <div key={`wl-${m.ticker}`} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>{m.ticker}</TickerButton>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.1em" }}>WL</span>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", minWidth: 70 }}>{priceStr}</span>
                                {dayPctEl}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {hasSpark ? (
                                  <Sparkline points={sparkPoints!} color={sparkColor} width={140} height={20} />
                                ) : (
                                  <span style={{ width: 140, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.4 }}>—</span>
                                )}
                                {entryEl}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={`wl-${m.ticker}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                            <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>{m.ticker}</TickerButton>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.1em" }}>WL</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)", minWidth: 70 }}>{priceStr}</span>
                            {dayPctEl}
                            {hasSpark ? (
                              <Sparkline points={sparkPoints!} color={sparkColor} width={90} height={22} />
                            ) : (
                              <span style={{ width: 90, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", opacity: 0.4, textAlign: "center" }}>—</span>
                            )}
                            {entryEl}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
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

        {/* Weekly Watch — compact monitor items from narrative */}
        {weeklyWatch.length > 0 && (
          <div style={{ ...card, borderLeft: "3px solid var(--rim)" }}>
            <div style={cardHeader}>
              <span style={cardTitle}>Weekly Watch</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>{weeklyWatch.length} ITEMS</span>
            </div>
            <div style={{ padding: mp }}>
              {weeklyWatch.map((item, index) => {
                const tickerMatch = item.match(/^([A-Z]{2,6})\b/);
                return (
                  <div key={`watch-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: index < weeklyWatch.length - 1 ? "1px solid rgba(28,28,48,0.3)" : "none" }}>
                    {tickerMatch && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", minWidth: 44 }}>{tickerMatch[1]}</span>}
                    <span style={statusChip("MONITOR")}>MONITOR</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{tickerMatch ? item.slice(tickerMatch[0].length).replace(/^[\s:–—-]+/, '') : item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
