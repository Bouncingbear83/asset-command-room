import { hasStalePrice } from "@/lib/canonical";
import type { LiveHolding } from "@/hooks/usePortfolioData";

export default function StalePriceBadge({ holding }: { holding: LiveHolding }) {
  if (!hasStalePrice(holding)) return null;
  return <span style={{ color: "var(--amber)", border: "1px solid var(--amber)", fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 4px", whiteSpace: "nowrap", lineHeight: 1.3 }}>STALE PRICE</span>;
}