import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TickerLabel, NamedText } from "@/components/shared/TickerLabel";
import { proxyWebhook } from "@/lib/ownerFunction";
import { acceptPreview, buildAcceptRequest } from "@/lib/earningsVerdict";
import type { Candidate } from "@/lib/actionSurface";

const mono = (size: number, color = "var(--text-mid)"): React.CSSProperties => ({ fontFamily: "var(--font-mono)", fontSize: size, color });
const btn = (color: string): React.CSSProperties => ({ background: "transparent", border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, color, ...mono(9, color), letterSpacing: "0.14em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 2, cursor: "pointer" });

async function call(body: object) {
  const res = await proxyWebhook("apply-tracker", body);
  const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok && !j?.error && !j?.stale) return { error: `HTTP ${res.status}` };
  return j;
}

/** R33 — every CONFIRM verdict in one DECIDE card; opens a list with Apply all. */
export default function ConfirmVerdictsCard({ c, onChanged }: { c: Candidate; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const members = c.members ?? [];

  const applyAll = async () => {
    if (!members.length || !window.confirm(`Apply ${members.length} CONFIRM verdict${members.length === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    setMsg(null);
    const errors: string[] = [];
    try {
      const rowIds = members.filter((m) => m.verdict?.apply_target === "UPDATE_ROW").map((m) => m.verdict!.id);
      if (rowIds.length) {
        const j = await call({ op: "apply_all", ids: rowIds });
        if (j?.stale) errors.push("Sheet changed since staging: rebuild in session");
        else if (j?.error) errors.push(String(j.error));
      }
      for (const m of members.filter((x) => x.verdict && x.verdict.apply_target !== "UPDATE_ROW")) {
        const j = await call(buildAcceptRequest(m.verdict!.id));
        if (j?.stale) errors.push(`${m.ticker}: sheet changed since staging`);
        else if (j?.error) errors.push(`${m.ticker}: ${j.error}`);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setMsg(errors.length ? errors.join(" · ") : null);
      onChanged();
    }
  };

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--rim)", borderLeft: "3px solid var(--green)", borderRadius: 2 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "10px 14px", cursor: "pointer", textAlign: "left" }}>
        <span style={{ color: "var(--text-dim)" }}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span style={{ ...mono(8, "var(--green)"), letterSpacing: "0.12em", padding: "2px 8px", border: "1px solid color-mix(in srgb, var(--green) 40%, transparent)", borderRadius: 2 }}>CONFIRM</span>
        <span style={{ ...mono(11, "var(--gold)"), fontWeight: 700 }}>{c.title}</span>
        <span style={{ ...mono(10, "var(--text-dim)"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <NamedText text={members.map((m) => m.ticker).join(", ")} />
        </span>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--rim)", padding: "10px 14px", display: "grid", gap: 8 }}>
          {members.map((m) => (
            <div key={m.key} style={{ display: "grid", gap: 2, paddingBottom: 6, borderBottom: "1px solid rgba(28,28,48,0.4)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ ...mono(11, "var(--gold)"), fontWeight: 700 }}><TickerLabel ticker={m.ticker} plain /></span>
                <span style={mono(9, "var(--text-dim)")}>print {m.verdict?.payload?.print_date ?? "—"}{m.next_review ? ` · by ${m.next_review}` : ""}</span>
              </div>
              {m.verdict?.payload?.band_action && <div style={mono(10)}><NamedText text={m.verdict.payload.band_action} /></div>}
              {m.verdict && (
                <div style={mono(9, "var(--text-dim)")}>
                  Accept does: {acceptPreview({ id: m.verdict.id, apply_target: m.verdict.apply_target, staged_payload: m.verdict.payload })}
                </div>
              )}
            </div>
          ))}
          {msg && <div style={mono(10, "var(--amber)")}>{msg}</div>}
          <button disabled={busy} onClick={() => void applyAll()} style={{ ...btn("var(--green)"), justifySelf: "end", opacity: busy ? 0.5 : 1 }}>
            {busy ? "Applying…" : `Apply all ${members.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
