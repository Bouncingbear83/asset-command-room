import { useEffect, useState } from "react";

interface Decision {
  rowIndex: number;
  included: boolean;
  reason: string;
  ticker: string;
  name: string;
}

interface Dropped {
  rowIndex: number;
  ticker: string;
  name: string;
}

interface DebugState {
  rawRows?: any[];
  filteredRows?: any[];
  rowDecisions?: Decision[];
  parsed?: any[];
  droppedByParse?: Dropped[];
  fetchedAt?: string;
  parsedAt?: string;
}

/**
 * Temporary debug panel — shows last 50 raw Watchlist rows from the Google Sheet,
 * their fetch-stage decision (included/excluded + reason), and whether they
 * survived parseWatchlist(). Reads from window.__watchlistDebug populated by
 * usePortfolioData in DEV builds.
 */
export default function WatchlistDebugTable() {
  const [snapshot, setSnapshot] = useState<DebugState | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setSnapshot(((window as any).__watchlistDebug ?? null) as DebugState | null);
  }, [tick]);

  if (!snapshot || !snapshot.rawRows) {
    return (
      <div className="rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        [WL Debug] Waiting for watchlist debug snapshot…
      </div>
    );
  }

  const raw = snapshot.rawRows ?? [];
  const decisions = snapshot.rowDecisions ?? [];
  const parsed = snapshot.parsed ?? [];
  const parsedKey = new Set(parsed.map((p: any) => `${p.ticker}|${p.name}`));

  const start = Math.max(0, raw.length - 50);
  const slice = raw.slice(start).map((row: any, i: number) => {
    const rowIndex = start + i;
    const decision = decisions.find((d) => d.rowIndex === rowIndex);
    const rawTicker = String(row["ticker"] ?? row["TICKER"] ?? row["Ticker"] ?? "").trim();
    const rawName = String(row["name"] ?? row["NAME"] ?? row["Name"] ?? "").trim();
    const parsedHit = parsedKey.has(`${rawTicker}|${rawName}`);
    let status: string;
    let reason: string;
    if (!decision || !decision.included) {
      status = "EXCLUDED (fetch)";
      reason = decision?.reason ?? "not-evaluated";
    } else if (!parsedHit) {
      status = "EXCLUDED (parse)";
      reason = "parseWatchlist dropped: name & ticker both empty";
    } else {
      status = "INCLUDED";
      reason = decision.reason;
    }
    return { rowIndex, rawTicker, rawName, status, reason };
  });

  return (
    <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold text-amber-400">
          [WL Debug] raw={raw.length} filtered={snapshot.filteredRows?.length ?? 0} parsed={parsed.length}
        </div>
        <div className="text-muted-foreground">
          fetched {snapshot.fetchedAt ?? "—"} · parsed {snapshot.parsedAt ?? "—"}
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 bg-background/95">
            <tr className="border-b border-border text-left">
              <th className="p-1 pr-2">#</th>
              <th className="p-1 pr-2">Raw Ticker</th>
              <th className="p-1 pr-2">Raw Name</th>
              <th className="p-1 pr-2">Status</th>
              <th className="p-1 pr-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr
                key={r.rowIndex}
                className={`border-b border-border/40 ${
                  r.status === "INCLUDED"
                    ? "text-foreground"
                    : "text-red-400"
                }`}
              >
                <td className="p-1 pr-2 text-muted-foreground">{r.rowIndex}</td>
                <td className="p-1 pr-2 font-mono">{r.rawTicker || "—"}</td>
                <td className="p-1 pr-2">{r.rawName || "—"}</td>
                <td className="p-1 pr-2">{r.status}</td>
                <td className="p-1 pr-2 text-muted-foreground">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
