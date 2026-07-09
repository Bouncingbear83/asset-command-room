import { useState, type CSSProperties } from "react";
import type { ActionType, ActionPriority } from "./useActionTracker";

interface Props {
  tickerOptions: string[];
  onClose: () => void;
  onSubmit: (payload: {
    ticker?: string | null;
    action_type: ActionType;
    due_date: string;
    summary: string;
    context?: string | null;
    priority?: ActionPriority;
  }) => Promise<void>;
}

const TYPES: ActionType[] = [
  "CATALYST_WATCH",
  "EARNINGS_GATE",
  "PRICE_GATE",
  "KILL_CHECK",
  "DEPLOY_READY",
  "REVIEW_DUE",
  "MANUAL",
];

const TYPE_LABELS: Record<string, string> = {
  CATALYST_WATCH: "Catalyst watch",
  EARNINGS_GATE: "Earnings gate",
  PRICE_GATE: "Price gate",
  KILL_CHECK: "Kill check",
  DEPLOY_READY: "Deploy ready",
  REVIEW_DUE: "Review due",
  MANUAL: "Manual",
};

const PRIORITIES: ActionPriority[] = ["HIGH", "MEDIUM", "LOW"];

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  padding: 20,
};

const modal: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rim)",
  width: "100%",
  maxWidth: 480,
  padding: 20,
};

const label: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  display: "block",
  marginBottom: 4,
};

const input: CSSProperties = {
  width: "100%",
  background: "var(--void)",
  border: "1px solid var(--rim)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  padding: "6px 8px",
  marginBottom: 12,
};

export default function ActionAddModal({ tickerOptions, onClose, onSubmit }: Props) {
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<ActionType>("CATALYST_WATCH");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [context, setContext] = useState("");
  const [priority, setPriority] = useState<ActionPriority>("MEDIUM");
  const [busy, setBusy] = useState(false);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          New Action
        </h3>

        <label style={label}>Ticker (optional)</label>
        <input
          list="ticker-options"
          style={input}
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="e.g. SGL.DE"
        />
        <datalist id="ticker-options">
          {tickerOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <label style={label}>Type</label>
        <select style={input} value={type} onChange={(e) => setType(e.target.value as ActionType)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] || t}
            </option>
          ))}
        </select>

        <label style={label}>Due date</label>
        <input type="date" style={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <label style={label}>What to look for *</label>
        <input
          style={input}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Binding MOUs from KIND/Hyundai"
        />

        <label style={label}>Why it matters</label>
        <textarea
          style={{ ...input, minHeight: 60, fontFamily: "var(--font-ui)" }}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. T2 add gate: needs binding MOUs + score >=67"
        />

        <label style={label}>Priority</label>
        <select style={input} value={priority} onChange={(e) => setPriority(e.target.value as ActionPriority)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--rim)",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            disabled={!summary.trim() || !dueDate || busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit({
                ticker: ticker.trim() || null,
                action_type: type,
                due_date: dueDate,
                summary: summary.trim(),
                context: context.trim() || null,
                priority,
              });
              setBusy(false);
              onClose();
            }}
            style={{
              background: "var(--gold-dim, rgba(201,168,76,0.12))",
              border: "1px solid rgba(201,168,76,0.4)",
              color: "var(--gold)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            ADD
          </button>
        </div>
      </div>
    </div>
  );
}
