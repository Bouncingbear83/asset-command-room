/**
 * Vault integration cards: self-contained components that pull
 * vault content from Supabase and render in the Stellar design.
 */
import { useState } from "react";
import { useVaultNote, useVaultNotes, useVaultBacklinks, VaultNote } from "@/hooks/useVaultContent";
import { VaultNotePanel, VaultLayerPanel, VaultSections } from "@/components/vault/VaultContent";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 20px", borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
};
const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
};
const chevron: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", marginLeft: 8,
};

/* ── 1. TICKER THESIS: Holdings drill-down + Fact Sheet ── */
export function VaultTickerThesis({ ticker }: { ticker: string | null }) {
  const { note, loading } = useVaultNote("ticker", ticker);
  const { backlinks } = useVaultBacklinks("ticker", ticker);

  if (!ticker || loading || !note) return null;
  if (!note.body) return null;

  return (
    <div style={{ padding: "0 18px 14px" }}>
      <VaultNotePanel
        note={note}
        sections={["Score", "Latest change", "Cross-references"]}
        backlinkCount={backlinks.length}
        maxLines={20}
      />
    </div>
  );
}

/* ── 2. WATCHLIST THESIS SNIPPET ── */
export function VaultWatchlistSnippet({ ticker }: { ticker: string | null }) {
  const { note, loading } = useVaultNote("ticker", ticker);

  if (!ticker || loading || !note) return null;
  if (!note.body_sections?.["Latest change"] && !note.body) return null;

  return (
    <div style={{ borderTop: "1px solid var(--rim)", padding: "8px 0 4px" }}>
      <div style={{ ...mono9, fontSize: 8, color: "var(--gold)", marginBottom: 4 }}>
        VAULT THESIS
      </div>
      <VaultSections note={note} sections={["Latest change"]} maxLines={8} />
    </div>
  );
}

/* ── 3. RECENT SESSIONS: collapsible card + click-to-expand each session ── */
function SessionRow({ note }: { note: VaultNote }) {
  const [open, setOpen] = useState(false);
  const fm = note.frontmatter ?? {};
  const body = note.body ?? "";
  const tickersRaw = fm.tickers_touched ? String(fm.tickers_touched) : "";
  const tickers = tickersRaw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  return (
    <div style={{ borderLeft: "2px solid var(--rim)", paddingLeft: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          width: "100%", textAlign: "left", color: "inherit",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ ...chevron, marginLeft: 0 }}>{open ? "▾" : "▸"}</span>
          <span style={{ ...mono9, color: "var(--gold)", fontSize: 11 }}>{note.identifier}</span>
          {fm.session_type && (
            <span style={{
              ...mono9, padding: "2px 8px", borderRadius: 2,
              color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}>
              {fm.session_type}
            </span>
          )}
          {fm.fires && <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.fires} FIRES</span>}
        </div>
        {tickers.length > 0 && (
          <div style={{ ...mono9, color: "var(--text-dim)", marginBottom: 4, marginLeft: 22 }}>
            {tickers.join(" · ")}
          </div>
        )}
      </button>
      {open && body && (
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.6,
          color: "var(--text-mid)", whiteSpace: "pre-wrap", wordBreak: "break-word",
          marginLeft: 22, marginTop: 8, padding: "10px 12px",
          background: "rgba(0,0,0,0.2)", border: "1px solid var(--rim)",
        }}>
          {body}
        </div>
      )}
      {open && !body && (
        <div style={{ ...mono9, color: "var(--text-dim)", marginLeft: 22, marginTop: 4 }}>
          No body content for this session.
        </div>
      )}
    </div>
  );
}

export function VaultRecentSessions() {
  const { notes, loading } = useVaultNotes("session", 10);
  const [open, setOpen] = useState(true);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      style={card}
    >
      <summary style={{ ...cardHeader, cursor: "pointer", listStyle: "none", userSelect: "none" }}>
        <span style={{ ...cardTitle, display: "flex", alignItems: "center" }}>
          <span style={{ ...chevron, marginLeft: 0, marginRight: 8 }}>{open ? "▾" : "▸"}</span>
          Recent Sessions
        </span>
        <span style={{ ...mono9, color: "var(--text-dim)" }}>
          {loading ? "..." : `${notes.length} IN VAULT`}
        </span>
      </summary>
      <div style={{ padding: "14px 20px" }}>
        {loading ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading...</div>
        ) : notes.length === 0 ? (
          <div style={{ ...mono9, color: "var(--text-dim)" }}>No session notes in vault yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((n) => <SessionRow key={n.path} note={n} />)}
          </div>
        )}
      </div>
    </details>
  );
}

/* ── 4. LAYER NOTE: collapsible, closed by default ── */
export function VaultLayerNote({ layer }: { layer: string | null }) {
  const { note, loading } = useVaultNote("layer", layer);

  if (!layer || loading || !note) return null;

  return (
    <details style={{ padding: "0 20px 14px" }}>
      <summary style={{
        cursor: "pointer", listStyle: "none", userSelect: "none",
        padding: "8px 0", display: "flex", alignItems: "center", gap: 8,
        borderTop: "1px solid var(--rim)",
      }}>
        <span style={{ ...mono9, color: "var(--text-dim)" }}>▸</span>
        <span style={{ ...mono9, color: "var(--gold)" }}>VAULT: LAYER NOTE</span>
      </summary>
      <VaultLayerPanel note={note} />
    </details>
  );
}
