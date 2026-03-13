import { LAYER_TARGETS } from "@/data/portfolio";

export default function LayersTab() {
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
        </div>
        <div style={{ padding: "16px 20px" }}>
          {LAYER_TARGETS.map((l) => {
            const diff = l.current - l.target;
            const pct = l.target > 0 ? Math.min((l.current / l.target) * 100, 130) : 0;
            const diffColor = Math.abs(diff) < 1 ? "var(--green)" : Math.abs(diff) < 3 ? "var(--amber)" : "var(--red)";
            const fillColor =
              l.current === 0 ? "var(--muted)" : l.current >= l.target ? "var(--gold)" : "var(--accent)";
            return (
              <div
                key={l.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(28,28,48,0.5)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--text-mid)",
                    width: 110,
                    flexShrink: 0,
                  }}
                >
                  {l.name}
                </div>
                <div style={{ flex: 1, height: 2, background: "var(--muted)", position: "relative" }}>
                  <div
                    style={{
                      height: 2,
                      background: fillColor,
                      width: `${pct}%`,
                      maxWidth: "100%",
                      transition: "width 1s",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text)",
                    width: 40,
                    textAlign: "right",
                  }}
                >
                  {l.current.toFixed(1)}%
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", width: 44 }}>
                  /{l.target}%
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: diffColor,
                    width: 48,
                    textAlign: "right",
                  }}
                >
                  {diff >= 0 ? "+" : ""}
                  {diff.toFixed(1)}%
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--text-dim)",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.key}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Layer Gap Analysis</span>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            {[
              {
                layer: "Robotics",
                gap: "New layer — zero position",
                priority: "URGENT",
                candidates: "Renishaw (T1 NOW), Hexagon (T1 NOW)",
              },
              { layer: "Biological", gap: "~15% vs 20.1% target", priority: "HIGH", candidates: "DHR, RGEN at $110" },
              {
                layer: "Compute",
                gap: "NVDA undersized at 2.9%",
                priority: "MEDIUM",
                candidates: "NVDA size-up to £60k. MU scoring.",
              },
              {
                layer: "Energy",
                gap: "GEV + HVDC uncovered",
                priority: "MEDIUM",
                candidates: "GEV ($600-650), Prysmian, ABB",
              },
              {
                layer: "Sovereignty",
                gap: "KTOS pending",
                priority: "LOW",
                candidates: "KTOS ($60-70), Shield AI (pre-IPO)",
              },
            ].map((g) => (
              <div key={g.layer} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.5)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{g.layer}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.15em",
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
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)" }}>
                  {g.candidates}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Pre-IPO Watch</span>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            {[
              { name: "Anduril Industries", layer: "Sovereignty", note: "Defence AI hardware. HIGH alignment." },
              { name: "Shield AI", layer: "Sovereignty", note: "Autonomous military systems." },
              { name: "SpaceX / Starlink", layer: "Sovereignty", note: "Orbital substrate. Re-rates RKLB." },
              { name: "Figure AI", layer: "Robotics", note: "$39B private. Wait post-IPO." },
              { name: "PsiQuantum", layer: "Compute", note: "Wait for hardware milestone proof." },
            ].map((p) => (
              <div key={p.name} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.5)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
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
