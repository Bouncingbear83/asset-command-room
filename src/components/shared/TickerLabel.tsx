import type { CSSProperties } from "react";
import TickerButton from "@/components/factsheet/TickerButton";
import { NUMERIC_TICKER, shortName } from "@/lib/tickerName";
import { useTickerNames, warnMissingName, withNames } from "@/hooks/useTickerNames";
import { normaliseTicker } from "@/lib/tickerAlias";

/** @deprecated import NUMERIC_TICKER from "@/lib/tickerName". */
const IS_NUMERIC_TICKER = NUMERIC_TICKER;

interface TickerLabelProps {
  ticker: string;
  name?: string | null;
  /** @deprecated Two-line mode removed. */
  compact?: boolean;
  /** Wrap in TickerButton for factsheet click-through. */
  clickable?: boolean;
  /** Inherit all styling from the parent (used to replace raw {x.ticker} text). */
  plain?: boolean;
  style?: CSSProperties;
}

/**
 * The only way a ticker renders. Numeric tickers show "JEOL (6951.T)";
 * alphabetic tickers show the code. A numeric ticker with no known name
 * shows the code with a small amber "no name" dot.
 */
export function TickerLabel({ ticker, name, clickable, plain, style }: TickerLabelProps) {
  const names = useTickerNames();
  const code = String(ticker ?? "");
  const isNumeric = NUMERIC_TICKER.test(code.trim());
  const resolved = isNumeric ? ((name && String(name).trim()) || names.get(normaliseTicker(code)) || "") : "";
  const baseStyle: CSSProperties = plain ? { ...style } : { fontFamily: "var(--font-mono)", fontWeight: 700, ...style };

  let label: JSX.Element;
  if (!isNumeric) {
    label = plain && !style ? <>{code}</> : <span style={baseStyle}>{code}</span>;
  } else if (!resolved) {
    if (names.size > 0) warnMissingName(code);
    label = (
      <span style={baseStyle}>
        {code}
        <span
          title="No company name found for this code"
          aria-label="no name"
          style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", marginLeft: 4, verticalAlign: "middle" }}
        />
      </span>
    );
  } else {
    label = (
      <span style={baseStyle}>
        {shortName(resolved)}
        <span style={{ fontSize: "0.85em", opacity: 0.7, marginLeft: 4, fontWeight: "inherit" }}>({code})</span>
      </span>
    );
  }
  return clickable ? <TickerButton ticker={code} style={style}>{label}</TickerButton> : label;
}

export { shortName, IS_NUMERIC_TICKER };

/** Free text with every bare numeric code rewritten to "Company (code)". */
export function NamedText({ text }: { text: string | null | undefined }) {
  const names = useTickerNames();
  return <>{withNames(text, names)}</>;
}
