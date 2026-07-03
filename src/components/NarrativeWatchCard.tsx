/**
 * NarrativeWatchCard — persistent watch items from vault ## Narrative Watch sections.
 *
 * Replaces the defunct NarrativeSignalsCard (which required an n8n news feeder
 * that was never built). This reads from the narrative_watch Supabase table,
 * populated nightly from vault ticker and layer notes.
 *
 * Shows ticker-level and layer-level watch items grouped and categorised.
 */

import { useState } from "react";
import { useNarrativeWatchAll, CATEGORY_LABELS, CATEGORY_COLORS } from "@/hooks/useNarrativeWatch";
import type { NarrativeWatchItem, WatchCategory } from "@/hooks/useNarrativeWatch";
import TickerButton from "@/components/factsheet/TickerButton";

const card: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  borderRadius: 2,
};
const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-display, var(--font-mono))",
  letterSpacing: "0.18em",
  fontSize: 12,
  textTransform: "uppercase",
  color: "var(--text)",
};

function categoryBadge(cat: string): React.CSSProperties {
  const color = CATEGORY_COLORS[cat as WatchCategory] ?? "var(--text-dim)";
  return {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    padding: "2px 8px",
    borderRadius: 2,
    whiteSpace: "nowrap",
  };
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d < 1) return "today";
    if (d === 1) return "1d";
    if (d < 30) return `${d}d`;
    const m = Math.floor(d / 30);
    return `${m}mo`;
  } catch {
    return "";
  }
}

function WatchItem({ item }: { item: NarrativeWatchItem }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--surface)",
        border: "1px solid var(--rim)",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {item.ticker ? (
          <TickerButton
            ticker={item.ticker}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--gold)",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            {item.ticker}
          </TickerButton>
        ) : item.layer ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgb(96,165,250)",
              background: "rgba(96,165,250,0.1)",
              border: "1px solid rgba(96,165,250,0.25)",
              padding: "2px 8px",
              borderRadius: 2,
            }}
          >
            {item.layer}
          </span>
        ) : null}
        <span style={categoryBadge(item.category)}>
          {CATEGORY_LABELS[item.category as WatchCategory] ?? item.category}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-dim)",
            letterSpacing: "0.08em",
          }}
        >
          {timeAgo(item.updated_at)}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text)",
          lineHeight: 1.45,
          fontFamily: "var(--font-ui)",
        }}
      >
        {item.content}
      </div>
    </div>
  );
}

function GroupedSection({
  title,
  items,
  defaultOpen,
}: {
  title: string;
  items: NarrativeWatchItem[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          padding: "6px 0",
        }}
      >
        <span style={{ fontSize: 8 }}>{open ? "▼" : "▶"}</span>
        {title} ({items.length})
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <WatchItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NarrativeWatchCard() {
  const { tickerItems, layerItems, loading } = useNarrativeWatchAll();
  const total = tickerItems.length + layerItems.length;

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>Narrative Watch</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-dim)",
            letterSpacing: "0.14em",
          }}
        >
          {total} ACTIVE
        </span>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 12, padding: 20 }}>
            Loading…
          </div>
        ) : total === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 12, padding: 20 }}>
            No active watch items. Add ## Narrative Watch sections to vault ticker or layer notes.
          </div>
        ) : (
          <>
            <GroupedSection title="Ticker Watch" items={tickerItems} defaultOpen={true} />
            <GroupedSection title="Layer Watch" items={layerItems} defaultOpen={true} />
          </>
        )}
      </div>
    </div>
  );
}
