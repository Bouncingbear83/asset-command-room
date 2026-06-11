import { VaultNote } from "@/hooks/useVaultContent";

const mono9: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
};
const sectionHeader: React.CSSProperties = {
  ...mono9, color: "var(--text-dim)", borderBottom: "1px solid var(--rim)",
  padding: "8px 0 4px", marginTop: 16, marginBottom: 8,
};
const bodyText: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6,
  color: "var(--text-mid)", whiteSpace: "pre-wrap", wordBreak: "break-word",
};
const pillBase: React.CSSProperties = {
  ...mono9, padding: "2px 8px", borderRadius: 2, display: "inline-block",
};

/**
 * Render specific sections from a vault note.
 * If `sections` is provided, only those H2 headings are shown.
 * If omitted, the full body is rendered.
 */
export function VaultSections({
  note,
  sections,
  maxLines,
}: {
  note: VaultNote;
  sections?: string[];
  maxLines?: number;
}) {
  if (!note.body && !note.body_sections) {
    return <div style={{ ...mono9, color: "var(--text-dim)", padding: "8px 0" }}>No vault content.</div>;
  }

  // If specific sections requested and body_sections available
  if (sections && note.body_sections) {
    const found = sections.filter((s) => note.body_sections![s]);
    if (found.length === 0) {
      return <div style={{ ...mono9, color: "var(--text-dim)", padding: "8px 0" }}>Sections not found in vault note.</div>;
    }
    return (
      <div>
        {found.map((s) => (
          <div key={s}>
            <div style={sectionHeader}>{s}</div>
            <div style={bodyText}>{maybeTruncate(note.body_sections![s], maxLines)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Full body
  return <div style={bodyText}>{maybeTruncate(note.body ?? "", maxLines)}</div>;
}

/**
 * Compact vault metadata pills row.
 * Shows score, tier, status, layer, substrate level from frontmatter.
 */
export function VaultMeta({ note }: { note: VaultNote }) {
  const fm = note.frontmatter ?? {};
  const pills: Array<{ label: string; color: string }> = [];

  if (fm.score) pills.push({ label: `SCORE ${fm.score}`, color: "var(--gold)" });
  if (fm.tier) pills.push({ label: fm.tier, color: fm.tier === "Core" ? "var(--green)" : "var(--accent)" });
  if (fm.status) pills.push({ label: fm.status, color: statusColor(fm.status) });
  if (fm.substrate_level) pills.push({ label: fm.substrate_level, color: "var(--text-dim)" });
  if (fm.stellar_type) pills.push({ label: `TYPE ${fm.stellar_type}`, color: "var(--text-dim)" });
  if (fm.reclass_status) pills.push({ label: `RECLASS ${fm.reclass_status}`, color: reclassColor(fm.reclass_status) });

  if (pills.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 0" }}>
      {pills.map((p, i) => (
        <span key={i} style={{ ...pillBase, color: p.color, border: `1px solid color-mix(in srgb, ${p.color} 30%, transparent)` }}>
          {p.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Full vault note panel: meta + selected sections + backlink count.
 */
export function VaultNotePanel({
  note,
  sections,
  backlinkCount,
  maxLines,
}: {
  note: VaultNote;
  sections?: string[];
  backlinkCount?: number;
  maxLines?: number;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--rim)", padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ ...mono9, color: "var(--gold)" }}>VAULT NOTE</span>
        {backlinkCount !== undefined && backlinkCount > 0 && (
          <span style={{ ...mono9, color: "var(--accent)" }}>{backlinkCount} REFERENCES</span>
        )}
      </div>
      <VaultMeta note={note} />
      <VaultSections note={note} sections={sections} maxLines={maxLines} />
    </div>
  );
}

/**
 * Render recent session notes for Command tab.
 */
export function VaultSessionList({ notes }: { notes: VaultNote[] }) {
  if (notes.length === 0) {
    return <div style={{ ...mono9, color: "var(--text-dim)", padding: "8px 0" }}>No session notes in vault yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {notes.map((n) => {
        const fm = n.frontmatter ?? {};
        return (
          <div key={n.path} style={{ borderLeft: "2px solid var(--rim)", paddingLeft: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
              <span style={{ ...mono9, color: "var(--gold)" }}>{n.identifier}</span>
              {fm.session_type && <span style={{ ...pillBase, color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}>{fm.session_type}</span>}
              {fm.fires && <span style={{ ...mono9, color: "var(--text-dim)" }}>{fm.fires} FIRES</span>}
            </div>
            {fm.tickers_touched && (
              <div style={{ ...mono9, color: "var(--text-dim)", marginBottom: 4 }}>
                {String(fm.tickers_touched).split(",").map((t: string) => t.trim()).join(" · ")}
              </div>
            )}
            {n.body && (
              <div style={{ ...bodyText, fontSize: 10, maxHeight: 80, overflow: "hidden" }}>
                {n.body.slice(0, 300)}{n.body.length > 300 ? "..." : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Layer anchor note panel for Layers tab.
 */
export function VaultLayerPanel({ note }: { note: VaultNote }) {
  const fm = note.frontmatter ?? {};
  return (
    <div style={{ borderTop: "1px solid var(--rim)", padding: "12px 0" }}>
      <span style={{ ...mono9, color: "var(--gold)", marginBottom: 8, display: "block" }}>VAULT: LAYER NOTE</span>
      {fm.current_weight_pct && fm.target_weight_pct && (
        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          <span style={{ ...mono9, color: "var(--text-dim)" }}>CURRENT {fm.current_weight_pct}%</span>
          <span style={{ ...mono9, color: "var(--text-dim)" }}>TARGET {fm.target_weight_pct}%</span>
          {fm.gap_pp && <span style={{ ...mono9, color: Number(fm.gap_pp) < 0 ? "var(--red)" : "var(--green)" }}>GAP {fm.gap_pp}pp</span>}
        </div>
      )}
      {note.body_sections?.["Open questions"] && (
        <>
          <div style={sectionHeader}>OPEN QUESTIONS</div>
          <div style={bodyText}>{note.body_sections["Open questions"]}</div>
        </>
      )}
      {note.body && !note.body_sections?.["Open questions"] && (
        <div style={bodyText}>{note.body.slice(0, 500)}{note.body.length > 500 ? "..." : ""}</div>
      )}
    </div>
  );
}

/* ── helpers ── */

function maybeTruncate(text: string, maxLines?: number): string {
  if (!maxLines) return text;
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + "\n...";
}

function statusColor(status: string): string {
  switch (status) {
    case "HELD": return "var(--green)";
    case "WAIT": return "var(--amber)";
    case "WATCH": return "var(--text-dim)";
    case "REJECTED": return "var(--red)";
    case "RESEARCH": return "var(--accent)";
    default: return "var(--text-dim)";
  }
}

function reclassColor(status: string): string {
  switch (status) {
    case "PRE": return "var(--gold)";
    case "IN_PROGRESS": return "var(--amber)";
    case "COMPLETE": return "var(--green)";
    default: return "var(--text-dim)";
  }
}
