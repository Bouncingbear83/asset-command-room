import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import type { ActionItem as Item } from "./useActionTracker";

interface Props {
  item: Item;
  onResolve: (item: Item, status: "CONFIRMED" | "DISMISSED", note: string) => Promise<void>;
  onSnooze: (item: Item, days?: number) => Promise<void>;
  onReopen: (item: Item) => Promise<void>;
  onDelete: (item: Item) => Promise<void>;
  onUpdateNote?: (item: Item, note: string) => Promise<void>;
  focused?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  EARNINGS_GATE: "#5b8def",
  PRICE_GATE: "#5abfa0",
  CATALYST_WATCH: "#a07de8",
  REVIEW_DUE: "var(--amber)",
  KILL_CHECK: "var(--red)",
  DEPLOY_READY: "#36bfb1",
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
  if (diff <= 14) return { color: "var(--amber)", label };
  return { color: "var(--green)", label };
}

export default function ActionItemRow({ item, onResolve, onSnooze, onReopen, onDelete, onUpdateNote, focused }: Props) {
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
    background: focused
      ? "color-mix(in srgb, var(--gold) 8%, transparent)"
      : resolved
        ? "rgba(255,255,255,0.02)"
        : "transparent",
    opacity: resolved && !focused ? 0.55 : 1,
    alignItems: "start",
    outline: focused ? "1px solid rgba(201,168,76,0.5)" : "none",
    transition: "background 0.3s",
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

  const actionBtnStyle = (color: string, bg: string): CSSProperties => ({
    background: bg,
    border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
    color,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.12em",
    padding: "4px 10px",
    cursor: "pointer",
    borderRadius: 2,
  });

  return (
    <div ref={rowRef} style={rowStyle}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={resolved}
        onChange={() => {
          if (resolved) onReopen(item);
          else setResolving((r) => !r);
        }}
        style={{ marginTop: 4, cursor: "pointer" }}
      />

      {/* Main content */}
      <div style={{ minWidth: 0 }}>
        {/* Row 1: ticker + summary + badges */}
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

        {/* Row 2: source + WHY toggle + resolution note */}
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
          {item.source && (
            <span>
              SRC: {item.source}
              {item.source_ref ? ` · ${item.source_ref}` : ""}
            </span>
          )}
          {item.layer && (
            <span style={{ color: "var(--text-dim)", opacity: 0.7 }}>· {item.layer}</span>
          )}
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
          {resolved && !editingNote && (
            <span
              style={{
                color: "var(--text-mid)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {item.resolution_note ? `· ${item.resolution_note}` : "· (no note)"}
              {item.persisted && onUpdateNote && (
                <button
                  type="button"
                  title="Edit note"
                  onClick={() => {
                    setNoteDraft(item.resolution_note || "");
                    setEditingNote(true);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                  }}
                >
                  <Pencil size={10} />
                </button>
              )}
            </span>
          )}
        </div>

        {/* Edit resolution note */}
        {resolved && editingNote && (
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Resolution note"
              value={noteDraft}
              autoFocus
              onChange={(e) => setNoteDraft(e.target.value)}
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
                if (!onUpdateNote) return;
                setBusy(true);
                await onUpdateNote(item, noteDraft);
                setBusy(false);
                setEditingNote(false);
              }}
              style={actionBtnStyle("var(--green)", "var(--green-dim)")}
            >
              SAVE
            </button>
            <button onClick={() => setEditingNote(false)} style={actionBtnStyle("var(--text-dim)", "transparent")}>
              CANCEL
            </button>
          </div>
        )}

        {/* Expanded context */}
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

        {/* Resolution strip */}
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
              style={actionBtnStyle("var(--green)", "var(--green-dim, rgba(90,191,160,0.1))")}
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
              style={actionBtnStyle("var(--text-dim)", "transparent")}
            >
              DISMISS
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onSnooze(item, 7);
                setBusy(false);
                setResolving(false);
              }}
              style={actionBtnStyle("var(--amber)", "transparent")}
            >
              SNOOZE 7D
            </button>
          </div>
        )}
      </div>

      {/* Right column: delete button */}
      <div>
        {item.persisted && (item.source === "MANUAL" || item.source === "SESSION") && (
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
