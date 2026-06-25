import type { CSSProperties, ReactNode } from "react";
import TickerButton from "@/components/factsheet/TickerButton";

/** Regex for numeric-prefix tickers (Japanese: 4175.T, 6268.T, etc.) */
const IS_NUMERIC_TICKER = /^\d{3,5}\.[A-Z]{1,2}$/;

/** Abbreviate a company name to a short label: first word, or first two if first is <4 chars.
 *  Strips common suffixes (Corporation, Corp, Co, Ltd, Inc, Holdings, Group, Industries).
 *  "Stella Chemifa Corporation" → "Stella Chemifa"
 *  "Tokai Carbon Co Ltd" → "Tokai Carbon"
 *  "Shin-Etsu Chemical" → "Shin-Etsu"
 */
function shortName(name: string): string {
  const stripped = name
    .replace(/\b(Corporation|Corp\.?|Co\.?\s*,?\s*Ltd\.?|Ltd\.?|Inc\.?|Holdings|Group|Industries|Incorporated|plc|PLC|AG|SE|SA|NV|KK|Co\.?\s*Ltd\.?)\b/gi, "")
    .replace(/[,.]$/g, "")
    .trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return name.split(/\s+/)[0] || name;
  if (words.length === 1) return words[0];
  // If first word is short (e.g. "NTT", "SGL"), include second word
  if (words[0].length <= 3 && words.length >= 2) return `${words[0]} ${words[1]}`;
  // If second word adds useful context and total is reasonable, include it
  if (words[0].length + words[1].length <= 16) return `${words[0]} ${words[1]}`;
  return words[0];
}

interface TickerLabelProps {
  ticker: string;
  name?: string | null;
  /** @deprecated Two-line mode removed. All numeric tickers now render as "4109.T (Stella)". */
  compact?: boolean;
  /** Wrap in TickerButton for factsheet click-through. */
  clickable?: boolean;
  style?: CSSProperties;
}

/**
 * Smart ticker display that resolves numeric tickers (Japanese stocks)
 * to their company name.
 *
 * Numeric tickers: "4109.T (Stella Chemifa)" — ticker first, short name in parens.
 * Alpha tickers: "NVDA" — just the code.
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

  // Numeric ticker: "4109.T (Stella Chemifa)"
  const abbrev = shortName(name);
  const label = (
    <span style={{ fontFamily: "var(--font-mono)", ...style }}>
      <span style={{ fontWeight: 700 }}>{ticker}</span>
      <span style={{ fontSize: "0.85em", color: "var(--text-dim)", marginLeft: 4 }}>({abbrev})</span>
    </span>
  );
  return clickable
    ? <TickerButton ticker={ticker} style={style}>{label}</TickerButton>
    : label;
}

export { shortName, IS_NUMERIC_TICKER };
