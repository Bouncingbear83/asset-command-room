import type { CSSProperties, ReactNode } from "react";
import TickerButton from "@/components/factsheet/TickerButton";

/** Regex for numeric-prefix tickers (Japanese: 4175.T, 6268.T, etc.) */
const IS_NUMERIC_TICKER = /^\d{3,5}\.[A-Z]{1,2}$/;

interface TickerLabelProps {
  ticker: string;
  name?: string | null;
  /** Single-line compact: "Stella (4175.T)" for numeric, "NVDA" for alpha. */
  compact?: boolean;
  /** Wrap in TickerButton for factsheet click-through. */
  clickable?: boolean;
  style?: CSSProperties;
}

/**
 * Smart ticker display that resolves numeric tickers (Japanese stocks)
 * to their company name. Alpha tickers (NVDA, CCJ, ILMN) display as-is.
 *
 * Two-line mode (default for numeric): name bold on top, ticker code below.
 * Compact mode: "Stella (4175.T)" inline.
 */
export function TickerLabel({ ticker, name, compact, clickable, style }: TickerLabelProps) {
  const isNumeric = IS_NUMERIC_TICKER.test(ticker);
  const showName = isNumeric && name;

  if (!showName) {
    // Alpha ticker: just show the code
    const el = (
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, ...style }}>
        {ticker}
      </span>
    );
    return clickable ? <TickerButton ticker={ticker} style={style}>{ticker}</TickerButton> : el;
  }

  if (compact) {
    // Single-line: "Stella (4175.T)"
    const label = (
      <span style={{ fontFamily: "var(--font-mono)", ...style }}>
        <span style={{ fontWeight: 700 }}>{name}</span>
        <span style={{ fontSize: "0.85em", color: "var(--text-dim)", marginLeft: 4 }}>({ticker})</span>
      </span>
    );
    return clickable
      ? <TickerButton ticker={ticker} style={style}>{label}</TickerButton>
      : label;
  }

  // Two-line: name bold, ticker below
  const el = (
    <div style={style}>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "inherit", lineHeight: 1.2 }}>
        {name}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.06em", lineHeight: 1 }}>
        {ticker}
      </div>
    </div>
  );

  return clickable
    ? <TickerButton ticker={ticker} style={style}>{el}</TickerButton>
    : el;
}
