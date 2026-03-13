import { RISK_CONTROLS, BUBBLE_FLAGS, GOLDEN_RULES } from "@/data/portfolio";

const STELLAR_CTX = `STELLAR HYPOTHESIS — PORTFOLIO COMMAND
AUM: ~£999k (SIPP £575k + ISA £424k) | Target: 15-20% CAGR
Doctrine: Own the substrate. Stay one layer deeper than the narrative.
Framework: Compute 22% | Energy 15.3% | Materials 12.6% | Biological 20.1% | Sovereignty 10.4% | Robotics 9% | Hedge ≥12%`;

function launchClaude(q = "") {
  const text = STELLAR_CTX + (q ? "\n\n" + q : "");
  navigator.clipboard.writeText(text).catch(() => {});
  window.open("https://claude.ai/new", "_blank");
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

const QUICK = [
  { label: "Weekly check", q: "weekly check" },
  { label: "Monthly review", q: "monthly review" },
  { label: "Quarterly review", q: "quarterly review" },
  { label: "Substrate audit", q: "Run the substrate test on all holdings" },
  { label: "Layer gaps", q: "What are the current layer gaps and how do I close them?" },
  { label: "Reclassification risk", q: "Which holdings are at risk of reclassification being complete?" },
];

export default function CommandTab() {
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
            Copies your complete Stellar framework to clipboard and opens Claude.
          </div>
          <button
            onClick={() => launchClaude()}
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
        <div style={{ padding: "12px 20px 4px" }}>
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
            Quick Commands
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {QUICK.map((q) => (
              <button
                key={q.label}
                onClick={() => launchClaude(q.q)}
                style={{
                  background: "var(--surface, #0D0D1A)",
                  border: "1px solid var(--rim)",
                  color: "var(--text-mid)",
                  padding: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", gap: 8 }}>
          <textarea
            placeholder="e.g. ASML dropped 12%, what do I do?"
            style={{
              flex: 1,
              background: "var(--surface, #0D0D1A)",
              border: "1px solid var(--rim)",
              color: "var(--text)",
              padding: 10,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              resize: "vertical",
              minHeight: 60,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                launchClaude((e.target as HTMLTextAreaElement).value.trim());
              }
            }}
          />
          <button
            onClick={(e) => {
              const ta = e.currentTarget.previousSibling as HTMLTextAreaElement;
              launchClaude(ta.value.trim());
            }}
            style={{
              background: "var(--gold)",
              color: "var(--void)",
              border: "none",
              padding: "10px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            GO →
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
