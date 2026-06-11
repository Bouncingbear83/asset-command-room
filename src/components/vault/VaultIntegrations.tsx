/**
 * Vault integration cards: self-contained components that pull
 * vault content from Supabase and render in the Stellar design.
 *
 * Each component is a drop-in: import + render, no props plumbing needed
 * beyond the identifying key (ticker, layer name, etc).
 */
import { useVaultNote, useVaultNotes, useVaultBacklinks } from "@/hooks/useVaultContent";
import { VaultNotePanel, VaultSessionList, VaultLayerPanel, VaultSections } from "@/components/vault/VaultContent";

const card: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--rim)", marginBottom: 16 };
const cardHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 20px", borderBottom: "1px solid var(--rim)",
};
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-mid)",
};

/* ────────────────────────────────────────────────
 * 1. TICKER THESIS: for FactSheet / Holdings drill-down
 *    Shows: Score, Latest change, Cross-references from vault
 * ──────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────
 * 2. WATCHLIST THESIS SNIPPET: compact thesis for watchlist cards
 *    Shows: first 8 lines of Latest change section
 * ──────────────────────────────────────────────── */
export function VaultWatchlistSnippet({ ticker }: { ticker: string | null }) {
  const { note, loading } = useVaultNote("ticker", ticker);

  if (!ticker || loading || !note) return null;
  if (!note.body_sections?.["Latest change"] && !note.body) return null;

  return (
    <div style={{ borderTop: "1px solid var(--rim)", padding: "8px 0 4px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 4 }}>
        VAULT THESIS
      </div>
      <VaultSections note={note} sections={["Latest change"]} maxLines={8} />
    </div>
  );
}

/* ────────────────────────────────────────────────
 * 3. RECENT SESSIONS: for Command tab
 *    Shows: last 10 session notes with type, tickers, summary
 * ──────────────────────────────────────────────── */
export function VaultRecentSessions() {
  const { notes, loading } = useVaultNotes("session", 10);

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={cardTitle}>Recent Sessions</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em" }}>
          {loading ? "..." : `${notes.length} IN VAULT`}
        </span>
      </div>
      <div style={{ padding: "14px 20px" }}>
        {loading ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>Loading...</div>
        ) : (
          <VaultSessionList notes={notes} />
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────
 * 4. LAYER NOTE: for Layers tab
 *    Shows: layer anchor note with open questions, gap analysis
 * ──────────────────────────────────────────────── */
export function VaultLayerNote({ layer }: { layer: string | null }) {
  const { note, loading } = useVaultNote("layer", layer);

  if (!layer || loading || !note) return null;

  return (
    <div style={{ padding: "0 20px 14px" }}>
      <VaultLayerPanel note={note} />
    </div>
  );
}
