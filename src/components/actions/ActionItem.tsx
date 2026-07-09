import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import type { ActionItem as Item } from "./useActionTracker";

interface Props {
  item: Item;
  onResolve: (item: Item, status: "CONFIRMED" | "DISMISSED", note: string) => Promise<void>;
  onReopen: (item: Item) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
  onUpdateNote?: (item: Item, note: string) => Promise<void>;
  focused?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  EARNINGS_GATE: "var(--amber)",
  PRICE_GATE: "var(--gold)",
  CATALYST_WATCH: "var(--gold)",
  REVIEW_DUE: "var(--text-mid)",
  KILL_CHECK: "var(--red)",
  MANUAL: "var(--text-dim)",
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "var(--red)",
  MEDIUM: "var(--amber)",
  LOW: "var(--text-dim)",
};

function dueBadgeStyle(due: string): { color: string; label: string } {
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  if (diff < 0) return { color: "var(--red)", label: `${label} · ${Math.abs(diff)}d late` };
  if (diff === 0) return { color: "var(--red)", label: `${label} · today` };
  if (diff <= 7) return { color: "var(--amber)", label: `${label} · ${diff}d` };
  return { color: "var(--green)", label };
}

export default function ActionItemRow({ item, onResolve, onReopen, onDelete, onUpdateNote, focused }: Props) {
  const [expanded, setExpanded] = useState(!!focused);
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focused && rowRef.current) {
      setExpanded(true);
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focused]);

  const resolved = item.status === "CONFIRMED" || item.status === "DISMISSED";
  const badge = dueBadgeStyle(item.due_date);

  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: 10,
    padding: "10px 12px",
    borderBottom: "1px solid var(--rim)",
    background: resolved ? "rgba(255,255,255,0.02)" : "transparent",
    opacity: resolved ? 0.55 : 1,
    alignItems: "start",
  };

  const chipStyle = (color: string): CSSProperties => ({
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.1em",
    padding: "2px 6px",
    borderRadius: 2,
    color,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    whiteSpace: "nowrap",
    border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
  });

  return (
    <div style={rowStyle}>
      <input
        type="checkbox"
        checked={resolved}
        onChange={() => {
          if (resolved) onReopen(item);
          else setResolving((r) => !r);
        }}
        style={{ marginTop: 4, cursor: "pointer" }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {item.ticker && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--gold)",
                letterSpacing: "0.05em",
              }}
            >
              {item.ticker}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--text)",
              textDecoration: resolved ? "line-through" : "none",
              flex: 1,
              minWidth: 0,
            }}
          >
            {item.summary}
          </span>
          <span style={chipStyle(badge.color)}>{badge.label}</span>
          <span style={chipStyle(TYPE_COLORS[item.action_type] || "var(--text-dim)")}>
            {item.action_type.replace(/_/g, " ")}
          </span>
          <span
            aria-label={`priority ${item.priority}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: PRIORITY_DOT[item.priority] || "var(--text-dim)",
              display: "inline-block",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.1em",
            color: "var(--text-dim)",
            alignItems: "center",
          }}
        >
          {item.source && <span>SRC: {item.source}{item.source_session ? ` · ${item.source_session}` : ""}</span>}
          {item.context && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                padding: 0,
              }}
            >
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />} WHY
            </button>
          )}
          {resolved && item.resolution_note && (
            <span style={{ color: "var(--text-mid)" }}>· {item.resolution_note}</span>
          )}
        </div>
        {expanded && item.context && (
          <div
            style={{
              marginTop: 6,
              padding: "8px 10px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--rim)",
              borderRadius: 2,
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              lineHeight: 1.5,
              color: "var(--text-mid)",
            }}
          >
            {item.context}
          </div>
        )}
        {resolving && !resolved && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Resolution note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                flex: 1,
                minWidth: 180,
                background: "var(--void)",
                border: "1px solid var(--rim)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: "4px 8px",
              }}
            />
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onResolve(item, "CONFIRMED", note);
                setBusy(false);
                setResolving(false);
                setNote("");
              }}
              style={{
                background: "var(--green-dim)",
                border: "1px solid rgba(90,191,160,0.4)",
                color: "var(--green)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              CONFIRM
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onResolve(item, "DISMISSED", note);
                setBusy(false);
                setResolving(false);
                setNote("");
              }}
              style={{
                background: "transparent",
                border: "1px solid var(--rim)",
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              DISMISS
            </button>
          </div>
        )}
      </div>
      <div>
        {item.persisted && item.source === "MANUAL" && (
          <button
            onClick={() => onDelete(item)}
            title="Delete"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
