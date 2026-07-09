import { type CSSProperties } from "react";

interface Props {
  /** Number of open actions for this ticker */
  count: number;
  /** Ticker to filter to when clicked */
  ticker: string;
  /** Optional: callback when clicked (e.g. navigate to Actions tab) */
  onClick?: (ticker: string) => void;
}

/**
 * Small inline badge showing open action count for a ticker.
 * Renders nothing if count is 0.
 *
 * Usage on Holdings/Watchlist/Intelligence rows:
 *   <ActionBadge count={actionCounts[ticker] || 0} ticker={ticker} onClick={handleActionNav} />
 */
export default function ActionBadge({ count, ticker, onClick }: Props) {
  if (count <= 0) return null;

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.08em",
    padding: "1px 6px",
    borderRadius: 2,
    color: count >= 3 ? "var(--red)" : "var(--amber)",
    background: count >= 3
      ? "color-mix(in srgb, var(--red) 10%, transparent)"
      : "color-mix(in srgb, var(--amber) 8%, transparent)",
    border: `1px solid ${
      count >= 3
        ? "color-mix(in srgb, var(--red) 25%, transparent)"
        : "color-mix(in srgb, var(--amber) 20%, transparent)"
    }`,
    cursor: onClick ? "pointer" : "default",
    whiteSpace: "nowrap",
    lineHeight: 1,
  };

  return (
    <span
      style={style}
      title={`${count} open action${count !== 1 ? "s" : ""} for ${ticker}`}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(ticker);
        }
      }}
    >
      <span style={{ fontSize: 10 }}>⚡</span>
      {count}
    </span>
  );
}
