import { useState } from "react";
import { RISK_CONTROLS, BUBBLE_FLAGS, GOLDEN_RULES } from "@/data/portfolio";

const PROJECT_ID = "PROJECT_ID"; // User to substitute their actual project ID

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

const RAG: Record<string, React.CSSProperties> = {
  PASS: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(90,191,160,0.2)" },
  WATCH: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  FAIL: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  TRIGGERED: { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  MONITOR: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
};
const chip = (status: string): React.CSSProperties => ({
  ...(RAG[status] ?? RAG.WATCH),
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  padding: "3px 10px",
  borderRadius: 2,
  whiteSpace: "nowrap",
});

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

  const handleGo = () => {
    if (customPrompt.trim()) {
      launchClaude(customPrompt.trim());
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* Left: launch + quick commands */}
      <div style={card}>
        <div style={{ padding: 32, textAlign: "center", borderBottom: "1px solid var(--rim)" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 12,
            }}
          >
            Stellar Intelligence
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 40,
              fontWeight: 300,
              color: "var(--text)",
              lineHeight: 1.1,
              marginBottom: 12,
            }}
          >
            One layer <em>deeper</em>.
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>
            Launch Claude with pre-filled Stellar prompts.
          </div>
          <button
            onClick={() => launchClaude("")}
            style={{
              background: "var(--gold)",
              color: "var(--void)",
              border: "none",
              padding: "12px 32px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Open Stellar Intelligence
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              marginBottom: 12,
            }}
          >
            Quick Commands
          </div>

          {/* 2x3 Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => launchClaude(cmd.prompt)}
                style={{
                  background: "var(--surface, #0D0D1A)",
                  border: "1px solid var(--rim)",
                  color: "var(--text-mid)",
                  padding: "12px 14px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  textAlign: "left",
                  textTransform: "uppercase",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--gold)";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--rim)";
                  e.currentTarget.style.color = "var(--text-mid)";
                }}
              >
                {cmd.label}
              </button>
            ))}
          </div>

          {/* Free text input */}
          <div style={{ display: "flex", gap: 10 }}>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter custom prompt..."
              style={{
                flex: 1,
                background: "var(--surface, #0D0D1A)",
                border: "1px solid var(--rim)",
                color: "var(--text)",
                padding: "10px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                resize: "none",
                minHeight: 44,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGo();
                }
              }}
            />
            <button
              onClick={handleGo}
              style={{
                background: "var(--gold)",
                color: "var(--void)",
                border: "none",
                padding: "10px 24px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              GO →
            </button>
          </div>
        </div>

        {/* Sheet Update Pack */}
        <div style={{ padding: "0 20px 20px" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              marginBottom: 8,
            }}
          >
            Sheet Update Pack
          </div>
          <textarea
            readOnly
            value={`── WEEKLY SHEET UPDATE ──────────────────────\n\nDate: ${new Date().toISOString().slice(0, 10)}\n\nTICKER | NEW ACTION | REASON\n\n[run weekly check and paste changes here]\n\n─────────────────────────────────────────────`}
            style={{
              width: "100%",
              background: "var(--surface, #0D0D1A)",
              border: "1px solid var(--rim)",
              color: "var(--text-mid)",
              padding: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: 1.6,
              resize: "none",
              minHeight: 140,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => {
              const tmpl = `── WEEKLY SHEET UPDATE ──────────────────────\n\nDate: ${new Date().toISOString().slice(0, 10)}\n\nTICKER | NEW ACTION | REASON\n\n[run weekly check and paste changes here]\n\n─────────────────────────────────────────────`;
              navigator.clipboard.writeText(tmpl).catch(() => {});
            }}
            style={{
              marginTop: 8,
              background: "var(--surface, #0D0D1A)",
              border: "1px solid var(--rim)",
              color: "var(--text-mid)",
              padding: "8px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Right: risk + bubble flags + golden rules */}
      <div>
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Risk Controls</span>
          </div>
          <div style={{ padding: "0 20px 8px" }}>
            {RISK_CONTROLS.map((r) => (
              <div key={r.label} style={divRow}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text)" }}>{r.label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                    {r.threshold}
                  </div>
                </div>
                <span style={chip(r.status)}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Bubble Flags</span>
          </div>
          <div style={{ padding: "0 20px 8px" }}>
            {BUBBLE_FLAGS.map((b) => (
              <div key={b.name} style={divRow}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{b.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                    {b.detail}
                  </div>
                </div>
                <span style={chip(b.status)}>{b.status}</span>
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
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--gold)",
                    flexShrink: 0,
                    width: 20,
                  }}
                >
                  {r.n}.
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                    fontStyle: "italic",
                    color: "var(--text-mid)",
                  }}
                >
                  {r.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
