import { AssetExpansion } from "@/components/intelligence/AssetExpansion";
import { useAssetIntelligence } from "@/hooks/useAssetIntelligence";

interface Props {
  ticker: string;
  colSpan: number;
}

/**
 * Holdings expansion row — renders the shared <AssetExpansion> for a single
 * held ticker, looked up from useAssetIntelligence(). Wrapped in a full-width
 * <td colSpan> so it slots into the Holdings <table> layout.
 *
 * If the ticker has no SCORES record, render a minimal placeholder rather
 * than crashing. Loading is silent (the parent already shows row data).
 */
export function HoldingsExpansionRow({ ticker, colSpan }: Props) {
  const { data, loading } = useAssetIntelligence();

  if (loading && data.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ padding: 0 }}>
          <div style={{
            padding: "16px 20px",
            background: "rgba(0,0,0,0.25)",
            borderTop: "1px solid var(--rim)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
          }}>
            Loading research record…
          </div>
        </td>
      </tr>
    );
  }

  const tickerCanon = ticker.trim();
  const asset = data.find((a) => a.ticker === tickerCanon);

  if (!asset) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ padding: 0 }}>
          <div style={{
            padding: "16px 20px",
            background: "rgba(0,0,0,0.25)",
            borderTop: "1px solid var(--rim)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
            lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--amber)", letterSpacing: "0.14em" }}>NO RESEARCH RECORD</strong>
            <div style={{ marginTop: 6 }}>
              {ticker} has no entry in SCORES. Open a Research Commit to add it.
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <AssetExpansion asset={asset} />
      </td>
    </tr>
  );
}

export default HoldingsExpansionRow;
