export default function ScoresTab() {
  const card: React.CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--rim)",
    padding: 24,
    marginBottom: 16,
  };
  return (
    <div style={card}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 16,
        }}
      >
        Stellar Alignment Scores
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-mid)", lineHeight: 2 }}>
        <p>Scoring framework: 5 dimensions, weighted 0–100.</p>
        <br />
        <p style={{ color: "var(--gold)" }}>Substrate / Bottleneck Fit — 30%</p>
        <p style={{ color: "var(--accent)" }}>Civilisational Demand Vector — 25%</p>
        <p style={{ color: "var(--green)" }}>Moat Durability — 20%</p>
        <p style={{ color: "var(--amber)" }}>Valuation Discipline — 15%</p>
        <p style={{ color: "var(--text-mid)" }}>Management / Execution — 10%</p>
        <br />
        <p style={{ color: "var(--text-dim)" }}>
          80–100: Core conviction (4–7% AUM) · 60–79: Hold/Monitor · 40–59: Reduce · &lt;40: Exit
        </p>
        <br />
        <p style={{ color: "var(--text-dim)", fontSize: 10 }}>
          Add a SCORES tab to your Google Sheet to populate live scoring data here.
          <br />
          Columns: ticker | score | score_date | substrate | demand | moat | valuation | mgmt | tier | notes
        </p>
      </div>
    </div>
  );
}
