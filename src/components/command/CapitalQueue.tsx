import { useMemo } from "react";
import { LiveHolding, LiveWatchItem, LiveLayer, LiveMacroStateRow } from "@/hooks/usePortfolioData";
import TickerButton from "@/components/factsheet/TickerButton";
import { useIsMobile } from "@/hooks/use-mobile";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
}

/**
 * Priority logic (doctrinal):
 *
 * 0 = SIZE UP on existing Core (Rule #2: winners deserve more)
 * 1 = TOP-UP existing below target
 * 2 = NEW BUY T1 from watchlist in zone
 * 3 = NEW BUY T2/T3 from watchlist
 * 4 = Watchlist near zone (staged)
 *
 * Within same priority: underweight layer gaps rank higher.
 */

interface QueueItem {
  ticker: string;
  action: string;
  amount: number;
  layer: string;
  context: string;
  price: number;
  priority: number;
  layerGap: number; // negative = underweight (higher priority)
  isWatchlist: boolean;
  tier: number | null;
}

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  "SIZE UP": { color: "var(--green)", bg: "var(--green-dim)" },
  "TOP-UP": { color: "var(--green)", bg: "var(--green-dim)" },
  BUY: { color: "var(--gold)", bg: "rgba(201,168,76,0.10)" },
  "BUY T1": { color: "var(--gold)", bg: "rgba(201,168,76,0.15)" },
  "BUY T2": { color: "var(--gold)", bg: "rgba(201,168,76,0.08)" },
  "BUY T3": { color: "var(--gold)", bg: "rgba(201,168,76,0.05)" },
  STAGE: { color: "var(--text-dim)", bg: "rgba(80,80,120,0.08)" },
};

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  layers: LiveLayer[];
  macroState: Record<string, LiveMacroStateRow>;
}

export default function CapitalQueue({ holdings, watchlist, layers, macroState }: Props) {
  const isMobile = useIsMobile();

  // Pause status
  const pauseRow = macroState["PAUSE_ACTIVE"];
  const isPaused = pauseRow && ["YES", "TRUE", "ACTIVE"].includes(pauseRow.currentValue.toUpperCase());

  // Layer gap map: layer name → gap percentage (negative = underweight)
  const layerGapMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of layers) {
      if (l.name.toUpperCase() === "TOTAL" || l.name.toUpperCase() === "CASH") continue;
      const gap = (l.current ?? 0) - (l.target ?? 0);
      m.set(l.name.toUpperCase(), gap);
    }
    return m;
  }, [layers]);

  const holdingsTickers = useMemo(() => new Set(holdings.map((h) => h.ticker.toUpperCase())), [holdings]);

  const queue = useMemo(() => {
    const items: QueueItem[] = [];

    // --- Holdings: SIZE UP / TOP-UP ---
    holdings.forEach((h) => {
      const target = h.deploy_target_gbp;
      if (target <= 0 || target <= h.mv) return;
      const amount = Math.round(target - h.mv);
      const act = h.action.trim().toUpperCase();
      const action = act === "SIZE UP" ? "SIZE UP" : "TOP-UP";
      const priority = action === "SIZE UP" ? 0 : 1;
      const layerGap = layerGapMap.get(h.layer.toUpperCase()) ?? 0;
      const context = h.deploy_note || `${h.action} · ${h.notes}`.trim() || `Deploy to ${formatCurrency(target)} target`;
      items.push({
        ticker: h.ticker,
        action,
        amount,
        layer: h.layer,
        context,
        price: h.price,
        priority,
        layerGap,
        isWatchlist: false,
        tier: null,
      });
    });

    // --- Watchlist: BUY ---
    watchlist.forEach((w) => {
      if (!w.status.toUpperCase().startsWith("BUY")) return;
      if (holdingsTickers.has(w.ticker.toUpperCase())) return;
      const amount = w.deploy_amount_gbp;
      if (amount <= 0) return;

      // Extract tier
      const tierMatch = w.status.match(/T(\d)/i);
      const tier = tierMatch ? parseInt(tierMatch[1], 10) : 9;
      const priority = tier <= 1 ? 2 : 3;
      const layerGap = layerGapMap.get(w.layer.toUpperCase()) ?? 0;
      const action = tier <= 3 ? `BUY T${tier}` : "BUY";
      const context = w.trigger || `Entry at ${w.entry}`;
      items.push({
        ticker: w.ticker,
        action,
        amount,
        layer: w.layer,
        context,
        price: typeof w.current === "number" ? w.current : 0,
        priority,
        layerGap,
        isWatchlist: true,
        tier,
      });
    });

    // Sort: priority first, then by layer gap (most underweight first), then by amount
    items.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      // More negative layerGap = more underweight = higher priority
      if (a.layerGap !== b.layerGap) return a.layerGap - b.layerGap;
      return b.amount - a.amount;
    });

    return items;
  }, [holdings, watchlist, layerGapMap, holdingsTickers]);

  const deployTotal = queue.reduce((sum, d) => sum + d.amount, 0);
  const mp = isMobile ? "10px 12px" : "10px 16px";

  return (
    <div style={{ ...card, borderLeft: `3px solid ${isPaused ? "var(--amber)" : "var(--green)"}` }}>
      <div style={cardHeader}>
        <span style={cardTitle}>Capital Queue {isPaused ? "(paused)" : ""}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
          {queue.length > 0 ? `${queue.length} items · ${formatCurrency(deployTotal)}` : "—"}
        </span>
      </div>
      <div style={{ padding: mp }}>
        {isPaused && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--amber)",
            marginBottom: 10,
            padding: "6px 8px",
            background: "var(--amber-dim)",
            border: "1px solid rgba(200,146,90,0.2)",
            borderRadius: 2,
          }}>
            Deploy pause active. Queue shows priority order for when pause lifts.
          </div>
        )}
        {queue.length === 0 ? (
          <div style={{ padding: "12px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            No deployments queued
          </div>
        ) : (
          queue.map((d, i) => {
            const actionStyle = ACTION_STYLE[d.action] ?? ACTION_STYLE.BUY;
            const isUnderweight = d.layerGap < -1.5;

            if (isMobile) {
              return (
                <div key={`${d.ticker}-${i}`} style={{ padding: "8px 0", borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", width: 14 }}>{i + 1}.</span>
                    <TickerButton ticker={d.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      {d.ticker}
                    </TickerButton>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      letterSpacing: "0.08em",
                      padding: "1px 5px",
                      borderRadius: 2,
                      color: actionStyle.color,
                      background: actionStyle.bg,
                    }}>
                      {d.action}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", marginLeft: "auto" }}>
                      {formatCurrency(d.amount)}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", paddingLeft: 22, display: "flex", gap: 6, alignItems: "center" }}>
                    <span>{d.layer}</span>
                    {isUnderweight && <span style={{ color: "var(--amber)", fontSize: 8 }}>({d.layerGap.toFixed(1)}pp)</span>}
                    <span style={{ color: "var(--text-dim)" }}>·</span>
                    <span style={{ color: "var(--text-mid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.context}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={`${d.ticker}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(28,28,48,0.3)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", width: 14 }}>{i + 1}.</span>
                <TickerButton ticker={d.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>
                  {d.ticker}
                </TickerButton>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  letterSpacing: "0.08em",
                  padding: "1px 5px",
                  borderRadius: 2,
                  color: actionStyle.color,
                  background: actionStyle.bg,
                  flexShrink: 0,
                }}>
                  {d.action}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", minWidth: 60 }}>
                  {formatCurrency(d.amount)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", minWidth: 60 }}>{d.layer}</span>
                {isUnderweight && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--amber)" }}>({d.layerGap.toFixed(1)}pp)</span>}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.context}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
