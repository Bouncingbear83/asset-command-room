import { useState } from "react";
import { toast } from "sonner";
import { useNarrativeSignals, NarrativeSignal } from "@/hooks/useNarrativeSignals";

const RESEARCH_COMMIT_URL =
  "https://bertbroad83.app.n8n.cloud/workflow/Qh4BzSYdf7jkZId5";

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

function strengthStyle(s: string): React.CSSProperties {
  const upper = (s || "").toUpperCase();
  if (upper === "HIGH") {
    return {
      background: "var(--red-dim)",
      color: "var(--red)",
      border: "1px solid rgba(200,90,90,0.3)",
    };
  }
  if (upper === "MEDIUM") {
    return {
      background: "var(--amber-dim)",
      color: "var(--amber)",
      border: "1px solid rgba(200,146,90,0.3)",
    };
  }
  return {
    background: "rgba(138,138,154,0.1)",
    color: "var(--text-dim)",
    border: "1px solid var(--rim)",
  };
}

function timeAgo(iso: string): string {
  try {
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    return `${days}d`;
  } catch {
    return "";
  }
}

function openExternal(url: string) {
  (window.top || window).open(url, "_blank", "noopener,noreferrer");
}

function SignalRow({
  signal,
  onMarkReviewed,
}: {
  signal: NarrativeSignal;
  onMarkReviewed: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleReview = async () => {
    setBusy(true);
    try {
      await onMarkReviewed(signal.id);
      toast.success(`Marked ${signal.ticker} reviewed`);
    } catch (e: any) {
      toast.error(`Failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const handleResearch = () => {
    openExternal(RESEARCH_COMMIT_URL);
    toast.message(`Opening Research Commit for ${signal.ticker}`, {
      description: "n8n workflow opened in a new tab.",
    });
  };

  const tag: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
    border: "1px solid var(--rim)",
    padding: "2px 6px",
    borderRadius: 2,
  };

  const pill: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--accent, #c9a84c)",
    background: "rgba(201,168,76,0.08)",
    border: "1px solid rgba(201,168,76,0.25)",
    padding: "2px 8px",
    borderRadius: 999,
  };

  const badge: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    padding: "2px 8px",
    borderRadius: 2,
    fontWeight: 600,
    ...strengthStyle(signal.strength),
  };

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 2,
    cursor: "pointer",
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--rim)",
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--rim)",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            color: "#C8A96E",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          {signal.ticker}
        </span>
        <span style={badge}>{signal.strength}</span>
        <span style={pill}>{signal.signal_class}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
          {timeAgo(signal.created_at)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text)" }}>
        <span>{signal.name}</span>
        {signal.layer && <span style={tag}>{signal.layer}</span>}
        <span style={tag}>{signal.source_table}</span>
      </div>

      {signal.headline && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text)",
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: open ? "normal" : "nowrap",
          }}
          title={signal.headline}
        >
          {signal.headline}
        </div>
      )}

      {signal.snippet && (
        <div>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              ...btn,
              fontSize: 9,
              padding: "3px 8px",
              border: "1px solid var(--rim)",
              color: "var(--text-dim)",
            }}
          >
            {open ? "Hide snippet" : "Show snippet"}
          </button>
          {open && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "var(--text-dim)",
                lineHeight: 1.5,
                padding: "8px 10px",
                background: "var(--panel)",
                border: "1px solid var(--rim)",
                borderRadius: 2,
              }}
            >
              {signal.snippet}
            </div>
          )}
        </div>
      )}

      {signal.matched_keywords && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-dim)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          KEYWORDS · {signal.matched_keywords}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {signal.url && (
          <button
            onClick={() => openExternal(signal.url!)}
            style={{ ...btn, color: "var(--text-dim)" }}
          >
            Source ↗
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          onClick={handleReview}
          disabled={busy}
          style={{
            ...btn,
            color: "var(--green)",
            border: "1px solid rgba(90,191,160,0.3)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "…" : "Mark Reviewed"}
        </button>
        <button
          onClick={handleResearch}
          style={{
            ...btn,
            color: "#C8A96E",
            border: "1px solid rgba(200,169,110,0.4)",
          }}
        >
          Open in Research Commit ↗
        </button>
      </div>
    </div>
  );
}

export default function NarrativeSignalsCard() {
  const { signals, loading, markReviewed } = useNarrativeSignals();

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>Narrative Signals</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 6px var(--green)",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--text-dim)",
              letterSpacing: "0.14em",
            }}
          >
            LIVE · {signals.length} NEW
          </span>
        </span>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 12, padding: 20 }}>
            Loading…
          </div>
        ) : signals.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 12, padding: 20 }}>
            No new HIGH/MEDIUM signals
          </div>
        ) : (
          signals.map((s) => (
            <SignalRow key={s.id} signal={s} onMarkReviewed={markReviewed} />
          ))
        )}
      </div>
    </div>
  );
}
