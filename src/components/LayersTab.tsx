import { LAYER_TARGETS } from "@/data/portfolio";
import { LiveLayer } from "@/hooks/usePortfolioData";
import { useIntelligence } from "@/data/intelligenceState";

interface Props {
  liveData: LiveLayer[];
}

const priorityBadge = (priority: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string }> = {
    URGENT: { bg: '#e74c3c', color: '#fff' },
    HIGH: { bg: '#e67e22', color: '#fff' },
    MEDIUM: { bg: 'rgba(201,168,76,0.15)', color: '#c9a84c' },
    LOW: { bg: 'rgba(85,85,85,0.2)', color: '#555' },
  };
  const c = map[priority] ?? map.LOW;
  return {
    background: c.bg, color: c.color, fontFamily: "var(--font-ui)", fontSize: 10,
    letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 10px",
    borderRadius: 2, whiteSpace: "nowrap",
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
    background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    fontFamily: "var(--font-ui)", fontSize: 10, letterSpacing: "0.1em",
    textTransform: "uppercase", padding: "2px 10px", borderRadius: 2, whiteSpace: "nowrap",
  };
};

export default function LayersTab({ liveData }: Props) {
  const { state } = useIntelligence();

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

  // Layer gaps — from intelligence state or fallback
  const hasLayerGaps = Object.keys(state.layerGaps).length > 0;
  const layerGapEntries = hasLayerGaps
    ? Object.entries(state.layerGaps)
    : [
        ['Robotics', { priority: 'URGENT' as const, note: 'Zero position — new layer. Renishaw T1 NOW · Hexagon T1 NOW · ROBG ETF £15k', filled: [] as string[], pending: ['RSW', 'HEXA-B', 'ROBG'] }],
        ['Biological', { priority: 'HIGH' as const, note: '~5% below 20.1% target. DHR at ~$200 · RGEN at $110–120', filled: [] as string[], pending: ['DHR', 'RGEN'] }],
        ['Compute', { priority: 'MEDIUM' as const, note: 'NVDA undersized at ~3% AUM. Size NVDA to £60k target. MU on watchlist.', filled: [] as string[], pending: ['NVDA'] }],
        ['Energy', { priority: 'MEDIUM' as const, note: 'HVDC/cable infra uncovered. Prysmian or NKT — deep research pending', filled: [] as string[], pending: ['PRS', 'NKT'] }],
        ['Sovereignty', { priority: 'LOW' as const, note: 'KTOS pending at $60–70', filled: [] as string[], pending: ['KTOS'] }],
      ] as [string, { priority: string; note: string; filled: string[]; pending: string[] }][];

  // IPO watch — from intelligence state or fallback
  const hasIpo = Object.keys(state.ipoWatch).length > 0;
  const ipoEntries = hasIpo
    ? Object.entries(state.ipoWatch)
    : [
        ['Anduril Industries', { status: 'PRE-IPO', layer: 'Sovereignty', note: 'Defence AI hardware. HIGH alignment.' }],
        ['Shield AI', { status: 'PRE-IPO', layer: 'Sovereignty', note: 'Autonomous military systems.' }],
        ['SpaceX / Starlink', { status: 'PRE-IPO', layer: 'Sovereignty', note: 'Orbital substrate — re-rates RKLB on filing.' }],
        ['Figure AI', { status: 'PRE-IPO', layer: 'Robotics', note: '$39B private. Wait for post-IPO price discovery.' }],
        ['PsiQuantum', { status: 'PRE-IPO', layer: 'Compute', note: 'Wait for hardware milestone proof.' }],
      ] as [string, { status: string; layer: string; note: string }][];

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
            {layerGapEntries.map(([name, g]) => (
              <div key={name} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                    {name}
                  </span>
                  <span style={priorityBadge(g.priority)}>{g.priority}</span>
                </div>
                <div
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}
                >
                  {g.note}
                </div>
                {g.filled && g.filled.length > 0 && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#00aa66", marginBottom: 2 }}>
                    ✓ {g.filled.join(', ')}
                  </div>
                )}
                {g.pending && g.pending.length > 0 && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#c9a84c" }}>
                    ◆ {g.pending.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Pre-IPO Watch</span>
          </div>
          <div style={{ padding: "0 20px 12px" }}>
            {ipoEntries.map(([name, p]) => (
              <div key={name} style={{ padding: "12px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
                    {name}
                  </span>
                  <span style={ipoStatusBadge(p.status)}>{p.status}</span>
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
