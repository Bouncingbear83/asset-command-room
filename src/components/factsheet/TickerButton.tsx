import type { CSSProperties, ReactNode } from "react";
import { useFactSheet } from "./FactSheetProvider";

interface Props {
  ticker: string;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

/**
 * Renders a ticker as a button that opens the universal HoldingFactSheet.
 * Use anywhere a raw ticker string is currently displayed.
 */
export default function TickerButton({ ticker, children, style, className, title }: Props) {
  const { open } = useFactSheet();
  if (!ticker) return <>{children ?? ticker}</>;
  return (
    <button
      type="button"
      title={title ?? `Open ${ticker} fact sheet`}
      onClick={(e) => { e.stopPropagation(); open(ticker); }}
      className={className}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        font: "inherit",
        color: "inherit",
        letterSpacing: "inherit",
        cursor: "pointer",
        textDecoration: "none",
        ...style,
      }}
    >
      {children ?? ticker}
    </button>
  );
}
