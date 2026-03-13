import { LAYER_TARGETS } from "@/data/portfolio";
import { LiveLayer } from "@/hooks/usePortfolioData";

interface Props {
  liveData: LiveLayer[];
}

export default function LayersTab({ liveData }: Props) {
  // Use live data if available, else static
  const layers =
    liveData.length > 0
      ? liveData
      : LAYER_TARGETS.map((l) => ({ name: l.name, target: l.target, current: l.current, mv: 0 }));

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

  return (
    <div>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Layer Weights vs Target</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: liveData.length > 0 ? "var(--green)" : "var(--text-dim)",
            }}
          >
            {liveData.length > 0 ? "● LIVE" : "● STATIC"}
          </span>
        </div>
        <div style={{ padding: "16px 24px" }}>
          {layers.map((l) => {
            const diff = l.current - l.target;
            const pct = l.target > 0 ? Math.min((l.current / l.target) * 100, 130) : 0;
            const diffColor = Math.abs(diff) < 1 ? "var(--green)" : Math.abs(diff) < 3 ? "var(--amber)" : "var(--red)";
            const fillColor =
              l.current === 0 ? "var(--muted)" : l.current >= l.target ? "var(--gold)" : "var(--accent)";
            return (
              <div
                key={l.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 48px 44px 52px",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(28,28,48,0.4)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--text-mid)",
                  }}
                >
                  {l.name}
                </div>
                <div style={{ height: 2, background: "var(--muted)", position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: 2,
                      background: fillColor,
                      width: `${pct}%`,
                      maxWidth: "100%",
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", textAlign: "right" }}>
                  {l.current.toFixed(1)}%
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  /{l.target}%
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: diffColor,
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {diff >= 0 ? "+" : ""}
                  {diff.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Layer Gap Actions</span>
          </div>
          <div style={{ padding: "0 20px 12px" }}>
            {[
              {
                layer: "Robotics",
                gap: "Zero position — new layer",
                priority: "URGENT",
                action: "Renishaw T1 NOW · Hexagon T1 NOW · ROBG ETF £15k",
              },
              {
                layer: "Biological",
                gap: "~5% below 20.1% target",
                priority: "HIGH",
                action: "DHR at ~$200 · RGEN at $110–120",
              },
              {
                layer: "Compute",
                gap: "NVDA undersized at ~3% AUM",
                priority: "MEDIUM",
                action: "Size NVDA to £60k target. MU on watchlist.",
              },
              {
                layer: "Energy",
                gap: "HVDC/cable infra uncovered",
                priority: "MEDIUM",
                action: "Prysmian or NKT — deep research pending",
              },
              { layer: "Sovereignty", gap: "KTOS pending", priority: "LOW", action: "KTOS at $60–70" },
            ].map((g) => (
              <div key={g.layer} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                    {g.layer}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      padding: "2px 8px",
                      borderRadius: 2,
                      background:
                        g.priority === "URGENT"
                          ? "var(--red-dim)"
                          : g.priority === "HIGH"
                            ? "var(--amber-dim)"
                            : "rgba(28,28,48,0.5)",
                      color:
                        g.priority === "URGENT"
                          ? "var(--red)"
                          : g.priority === "HIGH"
                            ? "var(--amber)"
                            : "var(--text-dim)",
                      border: `1px solid ${g.priority === "URGENT" ? "rgba(200,90,90,0.2)" : g.priority === "HIGH" ? "rgba(200,146,90,0.2)" : "var(--rim)"}`,
                    }}
                  >
                    {g.priority}
                  </span>
                </div>
                <div
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 2 }}
                >
                  {g.gap}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)" }}>{g.action}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Pre-IPO Watch</span>
          </div>
          <div style={{ padding: "0 20px 12px" }}>
            {[
              { name: "Anduril Industries", layer: "Sovereignty", note: "Defence AI hardware. HIGH alignment." },
              { name: "Shield AI", layer: "Sovereignty", note: "Autonomous military systems." },
              { name: "SpaceX / Starlink", layer: "Sovereignty", note: "Orbital substrate — re-rates RKLB on filing." },
              { name: "Figure AI", layer: "Robotics", note: "$39B private. Wait for post-IPO price discovery." },
              { name: "PsiQuantum", layer: "Compute", note: "Wait for hardware milestone proof." },
            ].map((p) => (
              <div key={p.name} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--accent)",
                      background: "var(--accent-dim)",
                      border: "1px solid rgba(110,142,200,0.2)",
                      padding: "2px 8px",
                      borderRadius: 2,
                      letterSpacing: "0.12em",
                    }}
                  >
                    PRE-IPO
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                  {p.layer} · {p.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
