import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useActionTracker, type ActionItem } from "./useActionTracker";
import ActionItemRow from "./ActionItem";
import ActionAddModal from "./ActionAddModal";

type FilterMode = "ALL" | "OPEN" | "RESOLVED";

function daysUntil(due: string): number {
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

interface Group {
  label: string;
  items: ActionItem[];
  accent?: string;
}

export default function ActionsTab() {
  const { watchlist, holdings, earningsCalendar } = usePortfolioData();
  const { items, loading, resolve, reopen, addManual, remove } = useActionTracker({
    watchlist,
    holdings,
    earnings: earningsCalendar,
  });
  const [filter, setFilter] = useState<FilterMode>("OPEN");
  const [showAdd, setShowAdd] = useState(false);

  const tickerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const h of holdings) if (h.ticker) set.add(h.ticker.toUpperCase());
    for (const w of watchlist) if (w.ticker) set.add(w.ticker.toUpperCase());
    return Array.from(set).sort();
  }, [holdings, watchlist]);

  const groups: Group[] = useMemo(() => {
    const visible = items.filter((i) => {
      if (filter === "OPEN") return i.status === "OPEN";
      if (filter === "RESOLVED") return i.status === "CONFIRMED" || i.status === "DISMISSED";
      return true;
    });
    const overdue: ActionItem[] = [];
    const week: ActionItem[] = [];
    const month: ActionItem[] = [];
    const later: ActionItem[] = [];
    for (const it of visible) {
      const diff = daysUntil(it.due_date);
      const isOpen = it.status === "OPEN";
      if (diff < 0 && isOpen) overdue.push(it);
      else if (diff <= 7) week.push(it);
      else if (diff <= 30) month.push(it);
      else later.push(it);
    }
    const sortFn = (a: ActionItem, b: ActionItem) => {
      const ra = a.status === "OPEN" ? 0 : 1;
      const rb = b.status === "OPEN" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.due_date.localeCompare(b.due_date);
    };
    [overdue, week, month, later].forEach((g) => g.sort(sortFn));
    return [
      { label: "Overdue", items: overdue, accent: "var(--red)" },
      { label: "This Week", items: week },
      { label: "This Month", items: month },
      { label: "Later", items: later },
    ].filter((g) => g.items.length > 0);
  }, [items, filter]);

  const chipStyle = (active: boolean): CSSProperties => ({
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.15em",
    padding: "5px 12px",
    border: `1px solid ${active ? "rgba(201,168,76,0.4)" : "var(--rim)"}`,
    background: active ? "var(--gold-dim, rgba(201,168,76,0.12))" : "transparent",
    color: active ? "var(--gold)" : "var(--text-dim)",
    cursor: "pointer",
    borderRadius: 2,
    textTransform: "uppercase",
  });

  return (
    <div style={{ padding: "16px var(--app-px, 40px) 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={chipStyle(filter === "ALL")} onClick={() => setFilter("ALL")}>ALL</button>
          <button style={chipStyle(filter === "OPEN")} onClick={() => setFilter("OPEN")}>OPEN</button>
          <button style={chipStyle(filter === "RESOLVED")} onClick={() => setFilter("RESOLVED")}>RESOLVED</button>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.15em",
            padding: "5px 12px",
            border: "1px solid rgba(201,168,76,0.4)",
            background: "var(--gold-dim, rgba(201,168,76,0.12))",
            color: "var(--gold)",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          + ADD
        </button>
      </div>

      {loading && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading…</div>
      )}

      {!loading && groups.length === 0 && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", padding: 20, textAlign: "center", border: "1px solid var(--rim)" }}>
          No actions {filter === "OPEN" ? "open" : filter.toLowerCase()}.
        </div>
      )}

      {groups.map((g) => {
        const openCount = g.items.filter((i) => i.status === "OPEN").length;
        return (
          <div key={g.label} style={{ marginBottom: 20, borderLeft: g.accent ? `2px solid ${g.accent}` : "none", paddingLeft: g.accent ? 10 : 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: g.accent || "var(--text-mid)",
                padding: "6px 0",
                marginBottom: 4,
              }}
            >
              <span>{g.label}</span>
              <span>{openCount} OPEN · {g.items.length} TOTAL</span>
            </div>
            <div style={{ border: "1px solid var(--rim)", background: "var(--panel)" }}>
              {g.items.map((it) => (
                <ActionItemRow key={it.id} item={it} onResolve={resolve} onReopen={reopen} onDelete={remove} />
              ))}
            </div>
          </div>
        );
      })}

      {showAdd && (
        <ActionAddModal
          tickerOptions={tickerOptions}
          onClose={() => setShowAdd(false)}
          onSubmit={addManual}
        />
      )}
    </div>
  );
}
