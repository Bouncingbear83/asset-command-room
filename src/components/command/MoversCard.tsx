import { useMemo, useState } from "react";
import { LiveHolding, LiveWatchItem, LiveEarningsCalendarItem } from "@/hooks/usePortfolioData";
import { useDailyPrices, normaliseTicker } from "@/hooks/useDailyPrices";
import { useWatchlistHistory } from "@/hooks/useWatchlistHistory";
import { useLivePrices } from "@/hooks/useLivePrices";
import { Sparkline } from "@/components/Sparkline";
import TickerButton from "@/components/factsheet/TickerButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { shortName } from "@/components/shared/TickerLabel";

type Period = "1D" | "1W" | "1M";
type Scope = "ALL" | "HELD" | "WL";

const IS_NUMERIC = /^\d{3,5}\.[A-Z]{1,2}$/;

interface MoverRow {
  ticker: string;
  name: string;
  price: number;
  change: number | null;
  mv: number;
  currency: string;
  isWatchlist: boolean;
  isBordier: boolean;
  flags: string[];
  sparkPoints: { date: string; priceLocal: number; priceGbp: number }[] | null;
  sparkColor: "green" | "red" | "neutral";
  entry?: string;
}

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
}

function daysUntil(value: string): number {
  if (!value) return Infinity;
  const d = new Date(value);
  if (isNaN(d.getTime())) return Infinity;
  const start = new Date(); start.setHours(0,0,0,0);
  const target = new Date(d); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

const FLAG_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ADD: { label: "ADD", color: "var(--green)", bg: "var(--green-dim)" },
  EXIT: { label: "EXIT", color: "var(--red)", bg: "var(--red-dim)" },
  ERN: { label: "ERN", color: "var(--accent)", bg: "rgba(120,140,200,0.10)" },
  VOL: { label: "⚡", color: "var(--amber)", bg: "var(--amber-dim)" },
};

interface Props {
  holdings: LiveHolding[];
  watchlist: LiveWatchItem[];
  earnings: LiveEarningsCalendarItem[];
}

export default function MoversCard({ holdings, watchlist, earnings }: Props) {
  const [period, setPeriod] = useState<Period>("1D");
  const [scope, setScope] = useState<Scope>("ALL");
  const isMobile = useIsMobile();
  const { priceData } = useDailyPrices();
  const watchlistTickerList = useMemo(
    () => Array.from(new Set(watchlist.map((w) => String(w.ticker || "").toUpperCase()).filter(Boolean))),
    [watchlist],
  );
  const { byTicker: wlHistory } = useWatchlistHistory(watchlistTickerList);

  // Live Yahoo prices for both holdings and watchlist
  const allTickerList = useMemo(
    () => Array.from(new Set([
      ...holdings.map((h) => normaliseTicker(h.ticker)),
      ...watchlistTickerList,
    ].filter(Boolean))),
    [holdings, watchlistTickerList],
  );
  const { prices: livePrices } = useLivePrices(allTickerList);

  const earningsTickers = useMemo(() => {
    const set = new Set<string>();
    earnings.forEach((e) => { const d = daysUntil(e.nextEarningsDate); if (d >= 0 && d <= 1) set.add(e.ticker.toUpperCase()); });
    return set;
  }, [earnings]);

  const ZONE_THRESHOLD = 0.15;

  const rows = useMemo(() => {
    const out: MoverRow[] = [];
    const seen = new Set<string>();

    holdings.forEach((h) => {
      if (!h.ticker || h.price <= 0) return;
      const key = h.ticker.toUpperCase();
      if (seen.has(key)) {
        const existing = out.find((r) => r.ticker.toUpperCase() === key);
        if (existing && Math.abs(existing.change) >= Math.abs(h.day ?? 0)) return;
        const idx = out.findIndex((r) => r.ticker.toUpperCase() === key);
        if (idx >= 0) out.splice(idx, 1);
      }
      seen.add(key);
      const lp = livePrices[normaliseTicker(h.ticker)];
      const displayPrice = lp?.price ?? h.price;
      if (lp == null && h.prevClose != null && h.price === h.prevClose) return;

      const isBordier = String(h.account || "").toUpperCase().replace(/[^A-Z]/g, "").startsWith("BORDIER");
      const pd = priceData?.get(normaliseTicker(h.ticker));

      let change = lp?.changePercent ?? h.day ?? 0;
      if (period === "1W" && pd && pd.points.length >= 5) {
        const prev = pd.points[Math.max(0, pd.points.length - 6)]?.priceLocal;
        const latest = pd.points[pd.points.length - 1]?.priceLocal;
        if (prev && latest) change = ((latest - prev) / prev) * 100;
      } else if (period === "1M" && pd && pd.points.length >= 20) {
        const prev = pd.points[Math.max(0, pd.points.length - 22)]?.priceLocal;
        const latest = pd.points[pd.points.length - 1]?.priceLocal;
        if (prev && latest) change = ((latest - prev) / prev) * 100;
      }

      const flags: string[] = [];
      const triggerAdd = parseFloat(String(h.trigger_price_add ?? ""));
      const triggerExit = parseFloat(String(h.trigger_price_exit ?? ""));
      if (!isNaN(triggerExit) && triggerExit > 0 && h.price <= triggerExit * (1 + ZONE_THRESHOLD)) flags.push("EXIT");
      else if (!isNaN(triggerAdd) && triggerAdd > 0 && h.price <= triggerAdd * (1 + ZONE_THRESHOLD)) flags.push("ADD");
      if (earningsTickers.has(key)) flags.push("ERN");

      out.push({
        ticker: h.ticker, name: h.name || "", price: displayPrice, change, mv: h.mv || 0, currency: h.currency,
        isWatchlist: false, isBordier, flags,
        sparkPoints: pd && pd.points.length >= 5 ? pd.points : null,
        sparkColor: pd?.sparklineColor ?? (change >= 0 ? "green" : "red"),
      });
    });

    watchlist.forEach((w) => {
      if (!w.ticker) return;
      const key = w.ticker.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);

      const pd = priceData?.get(normaliseTicker(w.ticker));
      const traj = wlHistory[key];

      const sheetPrice = typeof w.current === "number" && w.current > 0 ? w.current : null;
      const lp = livePrices[key];

      // Latest history close: for WL items prefer watchlist_price_history (traj)
      // over daily_prices (pd), since pd may contain stale entries from when
      // the ticker was formerly held or scored.
      const histLast: number | null =
        traj && traj.spark30d.length >= 1 ? traj.spark30d[traj.spark30d.length - 1].close :
        pd && pd.points.length >= 1 ? pd.points[pd.points.length - 1].priceLocal :
        null;

      // "Now": prefer live sheet price, fall back to last history
      const last: number | null = lp?.price ?? sheetPrice ?? histLast;

      // "Then" anchor depending on period
      let prev: number | null = null;
      if (period === "1D") {
        // Best 1D anchor: Yahoo previousClose > WL history last > daily_prices last
        prev = lp?.previousClose ?? histLast;
      } else if (period === "1W") {
        if (traj?.price7dAgo) prev = traj.price7dAgo;
        else if (pd && pd.points.length >= 6) prev = pd.points[pd.points.length - 6].priceLocal;
        else prev = histLast;
      } else if (period === "1M") {
        if (traj?.price30dAgo) prev = traj.price30dAgo;
        else if (pd && pd.points.length >= 22) prev = pd.points[pd.points.length - 22].priceLocal;
        else prev = histLast;
      }

      // Drop entirely if no price at all
      if (last == null) return;

      let change: number | null = null;
      if (period === "1D" && lp?.changePercent != null) {
        change = lp.changePercent;
      } else if (period === "1D" && lp?.previousClose != null && lp.previousClose > 0 && last != null) {
        // Fallback: compute from Yahoo previousClose when changePercent is absent
        change = ((last - lp.previousClose) / lp.previousClose) * 100;
      } else if (prev != null && prev > 0 && last !== prev) {
        change = ((last - prev) / prev) * 100;
      } else if (prev != null && prev > 0 && last === prev) {
        change = 0;
      }

      const flags: string[] = [];
      if (earningsTickers.has(key)) flags.push("ERN");

      const sparkPoints = pd && pd.points.length >= 5
        ? pd.points
        : traj && traj.spark30d.length >= 5
        ? traj.spark30d.map((p) => ({ date: p.date, priceLocal: p.close, priceGbp: p.close }))
        : null;

      out.push({
        ticker: w.ticker,
        name: w.name || "",
        price: last,
        change,
        mv: 0, currency: w.currency || "USD",
        isWatchlist: true, isBordier: false, flags, sparkPoints,
        sparkColor: pd?.sparklineColor ?? (change == null ? "neutral" : change >= 0 ? "green" : "red"),
        entry: w.entry,
      });
    });

    return out;
  }, [holdings, watchlist, priceData, wlHistory, livePrices, earningsTickers, period, ZONE_THRESHOLD]);

  // Apply scope filter
  const filtered = useMemo(() => {
    let list = rows;
    if (scope === "HELD") list = list.filter((r) => !r.isWatchlist);
    if (scope === "WL") list = list.filter((r) => r.isWatchlist);
    return list;
  }, [rows, scope]);

  // Split into winners/losers/no-data, each sorted by absolute change desc
  const winners = useMemo(() => filtered.filter((r) => r.change != null && r.change > 0).sort((a, b) => (b.change as number) - (a.change as number)), [filtered]);
  const losers = useMemo(() => filtered.filter((r) => r.change != null && r.change <= 0).sort((a, b) => (a.change as number) - (b.change as number)), [filtered]);
  const noData = useMemo(() => filtered.filter((r) => r.change == null), [filtered]);

  const upCount = rows.filter((r) => r.change != null && r.change > 0).length;
  const downCount = rows.filter((r) => r.change != null && r.change <= 0).length;

  const segBase: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
    padding: "3px 8px", border: "1px solid var(--rim)", background: "transparent",
    color: "var(--text-dim)", cursor: "pointer", lineHeight: 1.4,
  };
  const segActive: React.CSSProperties = {
    background: "rgba(201,168,76,0.15)", color: "var(--gold)", borderColor: "rgba(201,168,76,0.4)",
  };

const renderRow = (m: MoverRow) => {
    const sym = m.currency === "GBP" || m.currency === "GBX" ? "£" : m.currency === "EUR" ? "€" : m.currency === "SEK" ? "kr" : m.currency === "JPY" ? "¥" : "$";
    const priceStr = `${sym}${m.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    const hasSpark = !!m.sparkPoints;
    const isJpn = IS_NUMERIC.test(m.ticker) && m.name;

    return (
      <div key={m.ticker} style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "minmax(50px, auto) 1fr" : "minmax(100px, auto) 80px 76px 100px 1fr",
        alignItems: "center",
        gap: isMobile ? 6 : 0,
        padding: isMobile ? "8px 0" : "5px 0",
        borderBottom: "1px solid rgba(28,28,48,0.3)",
      }}>
        {isMobile ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                {m.ticker}
              </TickerButton>
              {IS_NUMERIC.test(m.ticker) && m.name && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  {shortName(m.name)}
                </span>
              )}
              {m.isWatchlist && <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", border: "1px solid var(--rim)", padding: "0 3px", borderRadius: 1 }}>WL</span>}
              {m.flags.map((f) => { const s = FLAG_STYLE[f]; return s ? <span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 7, padding: "1px 4px", borderRadius: 2, color: s.color, background: s.bg, marginLeft: 2 }}>{s.label}</span> : null; })}
            </div>
              )}
              {m.isWatchlist && <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", border: "1px solid var(--rim)", padding: "0 3px", borderRadius: 1 }}>WL</span>}
              {m.flags.map((f) => { const s = FLAG_STYLE[f]; return s ? <span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 7, padding: "1px 4px", borderRadius: 2, color: s.color, background: s.bg }}>{s.label}</span> : null; })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-mid)" }}>{priceStr}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: m.change == null ? "var(--text-dim)" : m.change >= 0 ? "var(--green)" : "var(--red)", minWidth: 60, textAlign: "right" }}>
                {m.change == null ? "—" : `${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}%`}
              </span>
              {hasSpark && <Sparkline points={m.sparkPoints!} color={m.sparkColor} width={80} height={18} />}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TickerButton ticker={m.ticker} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                {m.ticker}
              </TickerButton>
              {isJpn && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  {shortName(m.name)}
                </span>
              )}
              {m.isWatchlist && <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--text-dim)", border: "1px solid var(--rim)", padding: "0 3px", borderRadius: 1 }}>WL</span>}
              {m.flags.map((f) => { const s = FLAG_STYLE[f]; return s ? <span key={f} style={{ fontFamily: "var(--font-mono)", fontSize: 7, padding: "1px 4px", borderRadius: 2, color: s.color, background: s.bg, marginLeft: 2 }}>{s.label}</span> : null; })}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mid)" }}>{priceStr}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: m.change == null ? "var(--text-dim)" : m.change >= 0 ? "var(--green)" : "var(--red)", textAlign: "right", paddingRight: 10 }}>
              {m.change == null ? "—" : `${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}%`}
            </span>
            {hasSpark ? <Sparkline points={m.sparkPoints!} color={m.sparkColor} width={90} height={22} /> : <span />}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.isWatchlist && m.entry ? `@ ${m.entry}` : m.mv > 0 ? formatCurrency(m.mv) : ""}
            </span>
          </>
        )}
      </div>
    );
  };

  const sectionLabel = (label: string, count: number, color: string): React.ReactNode => (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
      color, padding: "10px 0 4px", borderBottom: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      display: "flex", justifyContent: "space-between",
    }}>
      <span>{label}</span>
      <span style={{ opacity: 0.6 }}>{count}</span>
    </div>
  );

  const segGroup = (opts: readonly string[], value: string, onChange: (v: any) => void) => (
    <div role="group" style={{ display: "inline-flex" }}>
      {opts.map((opt, i) => (
        <button key={opt} type="button" onClick={() => onChange(opt)} aria-pressed={value === opt}
          style={{
            ...segBase, ...(value === opt ? segActive : null),
            borderLeftWidth: i === 0 ? 1 : 0,
            borderTopLeftRadius: i === 0 ? 2 : 0, borderBottomLeftRadius: i === 0 ? 2 : 0,
            borderTopRightRadius: i === opts.length - 1 ? 2 : 0, borderBottomRightRadius: i === opts.length - 1 ? 2 : 0,
          }}
        >{opt}</button>
      ))}
    </div>
  );

  return (
    <div style={card}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: "1px solid var(--rim)", flexWrap: "wrap", gap: 8,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)" }}>Movers</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          {segGroup(["ALL", "HELD", "WL"] as const, scope, setScope)}
          {segGroup(["1D", "1W", "1M"] as const, period, setPeriod)}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>
            <span style={{ color: "var(--green)" }}>{upCount} ▲</span>
            <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--red)" }}>{downCount} ▼</span>
          </span>
        </div>
      </div>

      <div style={{ padding: isMobile ? "0 12px 8px" : "0 16px 8px", maxHeight: 420, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>No price data available</div>
        ) : (
          <>
            {winners.length > 0 && (
              <>
                {sectionLabel("Winners", winners.length, "var(--green)")}
                {winners.map(renderRow)}
              </>
            )}
            {losers.length > 0 && (
              <>
                {sectionLabel("Losers", losers.length, "var(--red)")}
                {losers.map(renderRow)}
              </>
            )}
            {noData.length > 0 && (
              <>
                {sectionLabel("No Δ data", noData.length, "var(--text-dim)")}
                {noData.map(renderRow)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
