import { type CSSProperties } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type LiveAsymmetryResult, formatRatio } from "@/lib/liveAsymmetry";

const BAND_STYLE: Record<string, CSSProperties> = {
  FULL:      { background: "rgba(200,169,110,0.15)", color: "var(--gold)",  border: "1px solid rgba(200,169,110,0.3)" },
  HIGH:      { background: "var(--amber-dim)",       color: "var(--amber)", border: "1px solid rgba(200,146,90,0.2)" },
  PARTIAL:   { background: "rgba(80,80,120,0.12)",   color: "var(--text-dim)", border: "1px solid rgba(80,80,120,0.2)" },
  NO_DEPLOY: { background: "rgba(80,80,120,0.06)",   color: "var(--text-dim)", border: "1px solid rgba(80,80,120,0.1)" },
};

const BASE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.05em",
  padding: "2px 6px",
  borderRadius: 3,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  whiteSpace: "nowrap",
};

interface Props {
  asymmetry: LiveAsymmetryResult;
  showStretch?: boolean;
}

export function AsymmetryPill({ asymmetry, showStretch }: Props) {
  const { baseRatio, stretchRatio, probWeightedRatio, divergence, band, quartet, quartetAgeDays, belowBear, aboveBull } = asymmetry;

  if (baseRatio === null) {
    return <span style={{ ...BASE, color: "var(--text-dim)", opacity: 0.4 }}>—</span>;
  }

  const style: CSSProperties = {
    ...BASE,
    ...(BAND_STYLE[band ?? "NO_DEPLOY"]),
  };

  // Thin-tail flag: divergence > 0.5 means substrate-fail risk pulls
  // the probability-weighted ratio materially below the simple ratio.
  const hasThinTail = divergence !== null && divergence > 0.5;

  const warningDot = belowBear
    ? <span style={{ color: "var(--red)", fontSize: 8 }} title="Price below bear case">●</span>
    : aboveBull
    ? <span style={{ color: "var(--green)", fontSize: 8 }} title="Price above bull base">●</span>
    : hasThinTail
    ? <span style={{ color: "var(--red)", fontSize: 7 }} title={`Thin-tail: pwt ${formatRatio(probWeightedRatio)} vs simple ${formatRatio(baseRatio)}`}>◆</span>
    : quartetAgeDays !== null && quartetAgeDays > 90
    ? <span style={{ color: "var(--amber)", fontSize: 7 }} title={`Quartet ${quartetAgeDays}d old`}>◦</span>
    : null;

  const tooltipLines = [
    `Simple ratio: ${formatRatio(baseRatio)}`,
    probWeightedRatio !== null ? `Prob-wgt (Alt B): ${formatRatio(probWeightedRatio)}` : null,
    stretchRatio !== null ? `Stretch ratio: ${formatRatio(stretchRatio)}` : null,
    hasThinTail ? `⚠ Divergence: ${divergence!.toFixed(1)} (thin-tail)` : (divergence !== null ? `Divergence: ${divergence.toFixed(1)}` : null),
    "",
    quartet.bullStretch !== null ? `Bull stretch: ${quartet.bullStretch}` : null,
    quartet.bullBase !== null ? `Bull base: ${quartet.bullBase}` : null,
    `Current: ${asymmetry.price}`,
    quartet.bearThesisWeak !== null ? `Bear (thesis): ${quartet.bearThesisWeak}` : null,
    quartet.bearSubstrateFail !== null ? `Bear (substrate): ${quartet.bearSubstrateFail}` : null,
    "",
    quartetAgeDays !== null ? `Quartet set ${quartetAgeDays}d ago` : null,
    band ? `Band: ${band}` : null,
  ].filter(Boolean).join("\n");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span style={style}>
          {warningDot}
          {formatRatio(baseRatio)}
          {showStretch && stretchRatio !== null && (
            <span style={{ opacity: 0.5, fontSize: 9 }}>/ {formatRatio(stretchRatio)}</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        whiteSpace: "pre-line",
        background: "var(--panel)",
        border: "1px solid var(--rim)",
        color: "var(--text)",
        padding: "8px 10px",
        lineHeight: 1.6,
        maxWidth: 220,
      }}>
        {tooltipLines}
      </TooltipContent>
    </Tooltip>
  );
}
