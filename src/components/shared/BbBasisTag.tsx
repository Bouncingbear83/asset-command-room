import { useBbBasis } from "@/hooks/useBbBasis";
import { basisTagText, type BbBasis } from "@/lib/bbBasis";

const COLOR: Record<BbBasis, string> = {
  V3A: "var(--green)", "V3A-NAV": "var(--green)", "PINNED-V1": "var(--amber)", LEGACY: "var(--amber)", UNKNOWN: "var(--text-dim)",
};

/** Sprint A · A2 — BB basis tag beside any BB, IRR-BB, buy_high or buy_low (OB §3.4.5i). */
export function BbBasisTag({ ticker }: { ticker: string | null | undefined }) {
  const { byTicker } = useBbBasis();
  const r = ticker ? byTicker[String(ticker).trim().toUpperCase()] : undefined;
  if (!r) return null;
  const c = COLOR[r.cls];
  return (
    <span
      data-testid="bb-basis-tag"
      title={`BB basis ${r.cls} (${r.test}, ${r.source}) · OB §3.4.5i`}
      style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.06em", padding: "0 3px", marginLeft: 3, borderRadius: 2,
        border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`, color: c, lineHeight: 1.4, whiteSpace: "nowrap", verticalAlign: "middle" }}
    >
      {basisTagText(r.cls)}
    </span>
  );
}
export default BbBasisTag;
