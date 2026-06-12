/**
 * Vault integration cards.
 *
 * Design principle: surface what is UNIQUE to the vault (history, session
 * discussion, evolution) and avoid duplicating what the sheet already shows.
 */
import { useState, useMemo } from "react";
import {
  useVaultNote,
  useVaultNotes,
  useVaultBacklinks,
  useVaultNotesByPaths,
  VaultNote,
} from "@/hooks/useVaultContent";
import { VaultLayerPanel, VaultSections } from "@/components/vault/VaultContent";

/* ── shared styles ── */
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
const sectionBody: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55,
  color: "var(--text-mid)", whiteSpace: "pre-wrap", wordBreak: "break-word",
};

/* ── light markdown clean-up for display (no full parser, just tidy) ── */
function tidyMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[\[(ticker|rule|framework|section|session|layer|trend|spec):([^\]]+)\]\]/g, "$2")  // strip wikilink syntax
    .replace(/\*\*([^*]+)\*\*/g, "$1")  // strip bold markers
    .replace(/^[-*]\s+/gm, "• ")        // normalize bullets
    .replace(/^#{1,6}\s+/gm, "")        // strip heading markers
    .trim();
}

function formatSessionDate(id: string | null): string {
  // session id format: YYYY-MM-DD-N
  if (!id) return "";
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})-(\d+)$/);
  if (!m) return id;
  const [, y, mm, dd, n] = m;
  const monthName = new Date(`${y}-${mm}-${dd}`).toLocaleDateString("en-GB", { month: "short" });
  return `${dd} ${monthName} ${y} #${n}`;
}

/* ──────────────────────────────────────────────────────────
 *  TICKER DISCUSSION HISTORY (for Holdings inline + Fact Sheet)
 *  Shows sessions/research notes that touched this ticker.
 *  Each row is click-to-expand to reveal the session body.
 * ────────────────────────────────────────────────────────── */
function SessionEntry({ note }: { note: VaultNote }) {
  const [open, setOpen] = useState(false);
  const fm = note.frontmatter ?? {};
  const body = note.body ?? "";

  return (
    <div style={{ borderTop: "1px solid rgba(28,28,48,0.4)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", width: "100%", textAlign: "left",
          cursor: "pointer", padding: "8px 0", display: "flex", alignItems: "center",
          gap: 10, color: "inherit",
        }}
      >
        <span style={{ ...mono9, color: "var(--text-dim)" }}>{open ? "▾" : "▸"}</span>
        <span style={{ ...mono9, color: "var(--gold)" }}>{formatSessionDate(note.identifier)}</span>
        {fm.session_type && (
          <span style={{
            ...mono9, padding: "2px 8px", borderRadius: 2,
            color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}>
            {fm.session_type}
          </span>
        )}
        {fm.fires && <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.fires} FIRES</span>}
      </button>
      {open && (
        <div style={{ ...sectionBody, padding: "0 0 12px 22px", fontSize: 10 }}>
          {body ? tidyMarkdown(body) : <span style={{ color: "var(--text-dim)" }}>No body content.</span>}
        </div>
      )}
    </div>
  );
}

export function VaultTickerThesis({ ticker }: { ticker: string | null }) {
  const { backlinks, loading: blLoading } = useVaultBacklinks("ticker", ticker);

  // Paths of session notes that reference this ticker
  const sessionPaths = useMemo(
    () => backlinks.filter((b) => b.source_type === "session").map((b) => b.source_path),
    [backlinks]
  );
  const { notes: sessionNotes, loading: snLoading } = useVaultNotesByPaths(sessionPaths);

  // Sort newest first by identifier (YYYY-MM-DD-N)
  const sorted = useMemo(
    () => [...sessionNotes].sort((a, b) => (b.identifier ?? "").localeCompare(a.identifier ?? "")),
    [sessionNotes]
  );

  if (!ticker) return null;
  if (blLoading || snLoading) return null;
  if (sorted.length === 0) return null;

  return (
    <div style={{ padding: "0 18px 14px" }}>
      <div style={{ borderTop: "1px solid var(--rim)", paddingTop: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ ...mono9, color: "var(--gold)" }}>DISCUSSION HISTORY</span>
          <span style={{ ...mono9, color: "var(--text-dim)" }}>
            {sorted.length} SESSION{sorted.length !== 1 ? "S" : ""}
          </span>
        </div>
        <div>
          {sorted.map((n) => <SessionEntry key={n.path} note={n} />)}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 *  WATCHLIST: small "Latest change" snippet
 * ────────────────────────────────────────────────────────── */
export function VaultWatchlistSnippet({ ticker }: { ticker: string | null }) {
  const { note, loading } = useVaultNote("ticker", ticker);

  if (!ticker || loading || !note) return null;
  const latestChange = note.body_sections?.["Latest change"];
  if (!latestChange) return null;

  return (
    <div style={{ borderTop: "1px solid var(--rim)", padding: "8px 0 4px" }}>
      <div style={{ ...mono9, fontSize: 8, color: "var(--gold)", marginBottom: 4 }}>VAULT LATEST CHANGE</div>
      <div style={{ ...sectionBody, fontSize: 10 }}>{tidyMarkdown(latestChange)}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 *  COMMAND TAB: Recent Sessions (collapsible card + click-to-expand)
 * ────────────────────────────────────────────────────────── */
function RecentSessionRow({ note }: { note: VaultNote }) {
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
          <span style={{ ...mono9, color: "var(--text-dim)", fontSize: 11 }}>{open ? "▾" : "▸"}</span>
          <span style={{ ...mono9, color: "var(--gold)", fontSize: 11 }}>{formatSessionDate(note.identifier)}</span>
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
      {open && (
        <div style={{
          ...sectionBody, fontSize: 10,
          marginLeft: 22, marginTop: 6, padding: "10px 12px",
          background: "rgba(0,0,0,0.2)", border: "1px solid var(--rim)",
        }}>
          {body ? tidyMarkdown(body) : <span style={{ color: "var(--text-dim)" }}>No body content.</span>}
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
          <span style={{ ...mono9, marginRight: 8 }}>{open ? "▾" : "▸"}</span>
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
            {notes.map((n) => <RecentSessionRow key={n.path} note={n} />)}
          </div>
        )}
      </div>
    </details>
  );
}

/* ──────────────────────────────────────────────────────────
 *  LAYERS: collapsible layer anchor note
 * ────────────────────────────────────────────────────────── */
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
