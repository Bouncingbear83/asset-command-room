import { useState } from "react";
import { LiveHolding, LiveWatchItem, LiveLayer } from "@/hooks/usePortfolioData";
import { buildPrompt, type PromptTemplateKey } from "@/lib/claudePromptUrl";
import ClaudePromptButton from "@/components/ClaudePromptButton";
import { openClaudeWithPrompt } from "@/lib/claudePromptUrl";
import { triggerWebhook } from "@/lib/webhooks";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

function isEmbedded(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success("Copied to clipboard");
  });
}

const CLAUDE_COMMANDS: { label: string; templateKey: PromptTemplateKey; icon?: string; subtitle?: string }[] = [
  { label: "Substrate audit", templateKey: "substrate_audit" },
  { label: "Layer gaps", templateKey: "layer_gaps" },
  { label: "Reclass risk", templateKey: "reclass_risk" },
  { label: "Log Trades", templateKey: "log_trades", icon: "📝", subtitle: "CSV or screenshot → Claude" },
];

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeaderBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
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

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  layers: LiveLayer[];
}

export default function ToolsCard({ holdings, watchlist, layers }: Props) {
  const isMobile = useIsMobile();
  const [deepDiveTarget, setDeepDiveTarget] = useState("");
  const [webhookTarget, setWebhookTarget] = useState("");
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookFired, setWebhookFired] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [commitStatus, setCommitStatus] = useState("");
  const [commitLoading, setCommitLoading] = useState(false);

  const tickers = holdings.map((h) => h.ticker).filter(Boolean);
  const watchlistTickers = (watchlist || []).map((w) => w.ticker).filter(Boolean);
  const allTickers = [...new Set([...tickers, ...watchlistTickers])].sort();
  const layerNames = layers.map((l) => l.name).filter((n) => n && n.toUpperCase() !== "TOTAL" && n.toUpperCase() !== "CASH");

  const handleDeepDive = async () => {
    if (!deepDiveTarget) return;
    await openClaudeWithPrompt("dropdown_deep_dive", { ticker: deepDiveTarget }, (m) => toast(m));
    setDeepDiveTarget("");
  };

  const handleWebhook = async (endpoint: string, body: object, msg: string) => {
    setWebhookLoading(true);
    setWebhookFired("");
    await triggerWebhook(endpoint, body, msg);
    setWebhookLoading(false);
    setWebhookFired("✓ Fired");
    setWebhookTarget("");
    setTimeout(() => setWebhookFired(""), 3000);
  };

  const handleCommit = async () => {
    if (!jsonText.trim()) return;
    setCommitLoading(true);
    try {
      const payload = JSON.parse(jsonText);
      const response = await fetch(
        "https://bertbroad83.app.n8n.cloud/webhook/stellar-research-commit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-stellar-key": "STELLAR" },
          body: JSON.stringify(payload),
        },
      );
      if (response.ok) {
        setCommitStatus(`✓ Committed ${payload.ticker || "?"} (${payload.action || "unknown"})`);
        setJsonText("");
      } else {
        setCommitStatus(`✗ Error: ${response.statusText}`);
      }
    } catch {
      setCommitStatus("✗ Invalid JSON");
    }
    setCommitLoading(false);
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
  const mp = isMobile ? "10px 12px" : "14px 16px";

  return (
    <details style={card}>
      <summary style={{ ...cardHeaderBase, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
        <span style={cardTitle}>Tools</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>
          ▸ COMMANDS · WEBHOOKS · COMMIT
        </span>
      </summary>
      <div style={{ padding: mp }}>
        {isEmbedded() && (
          <div style={{ marginBottom: 12, padding: "8px 12px", background: "var(--amber-dim)", border: "1px solid rgba(200,146,90,0.2)", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)", letterSpacing: "0.08em" }}>
            External links may be blocked in preview. Use the published site or copy prompts.
          </div>
        )}

        {/* Claude prompt commands */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Claude Prompts</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {CLAUDE_COMMANDS.map((cmd) => {
            const promptText = buildPrompt(cmd.templateKey);
            return (
              <div key={cmd.label} style={{ display: "flex", gap: 0 }}>
                <ClaudePromptButton
                  templateKey={cmd.templateKey}
                  style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--rim)", borderRight: "none", color: "var(--text-mid)", padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textAlign: "left", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, whiteSpace: "normal" }}
                >
                  {cmd.icon && <span style={{ fontSize: 14 }}>{cmd.icon}</span>}
                  <div>
                    <div>{cmd.label}</div>
                    {cmd.subtitle && <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "none", letterSpacing: "0.02em", marginTop: 2 }}>{cmd.subtitle}</div>}
                  </div>
                </ClaudePromptButton>
                <button onClick={() => copyToClipboard(promptText)} title="Copy prompt" style={{ background: "var(--surface)", border: "1px solid var(--rim)", color: "var(--text-dim)", padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer" }}>⧉</button>
              </div>
            );
          })}
        </div>

        {/* Deep Dive */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>🔬 Deep Dive</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <select style={selectStyle} value={deepDiveTarget} onChange={(e) => setDeepDiveTarget(e.target.value)}>
            <option value="">Select ticker…</option>
            <optgroup label="Holdings">
              {tickers.map((t) => <option key={`h-${t}`} value={t}>{t}</option>)}
            </optgroup>
            <optgroup label="Watchlist">
              {watchlistTickers.filter((t) => !tickers.includes(t)).map((t) => <option key={`w-${t}`} value={t}>{t}</option>)}
            </optgroup>
          </select>
          <button disabled={!deepDiveTarget} onClick={handleDeepDive} style={{ ...fireStyle, background: "var(--accent)", opacity: deepDiveTarget ? 1 : 0.4 }}>Open</button>
        </div>

        {/* Webhooks */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Webhook Actions</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: 70, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>📋 Prep</span>
            <select style={selectStyle} value={webhookTarget} onChange={(e) => setWebhookTarget(e.target.value)}>
              <option value="">Select ticker…</option>
              {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-earnings-prep", { ticker: webhookTarget }, `Earnings prep triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>{webhookLoading ? "…" : "Fire"}</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", width: 70, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>🔍 Scan</span>
            <select style={selectStyle} value={webhookTarget} onChange={(e) => setWebhookTarget(e.target.value)}>
              <option value="">Select layer…</option>
              {layerNames.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button disabled={!webhookTarget || webhookLoading} onClick={() => handleWebhook("stellar-layer-scan", { layer: webhookTarget }, `Layer scan triggered for ${webhookTarget}. Check email.`)} style={{ ...fireStyle, opacity: webhookTarget ? 1 : 0.4 }}>{webhookLoading ? "…" : "Fire"}</button>
          </div>
          {webhookFired && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", letterSpacing: "0.1em" }}>{webhookFired}</div>}
        </div>

        {/* Commit Research */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>Commit Research</div>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"ticker":"ASML","action":"RESCORE","substrate":22,...}'
          rows={5}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button
            disabled={commitLoading || !jsonText.trim()}
            onClick={handleCommit}
            style={{
              ...fireStyle,
              cursor: commitLoading || !jsonText.trim() ? "not-allowed" : "pointer",
              opacity: commitLoading || !jsonText.trim() ? 0.4 : 1,
            }}
          >
            {commitLoading ? "Committing…" : "Commit"}
          </button>
          {commitStatus && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: commitStatus.startsWith("✓") ? "var(--green)" : "var(--red)" }}>
              {commitStatus}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
