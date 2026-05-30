import { type CSSProperties } from "react";

type Flag = string | null | undefined;

const STYLE_MAP: Record<string, CSSProperties> = {
  HIGH:   { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(200,90,90,0.2)" },
  MEDIUM: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  LOW:    { background: "rgba(80,80,120,0.08)", color: "var(--text-dim)", border: "1px solid rgba(80,80,120,0.15)" },
};

const BASE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  padding: "1px 5px",
  borderRadius: 2,
  whiteSpace: "nowrap",
};

interface Props {
  flag: Flag;
}


export function ChinaRiskChip({ flag }: Props) {
  const norm = (flag ?? "").toUpperCase().trim();
  if (!norm || norm === "N/A") return null;
  const style = STYLE_MAP[norm];
  if (!style) return null;
  return (
    <span style={{ ...BASE, ...style }} title={`China exposure: ${norm}`}>
      CN {norm}
    </span>
  );
}
