import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

type CoverageRow = {
  stack: string;
  coverage_pct: number | null;
  subsystems: number;
  owned: number;
  toehold: number;
  gap: number;
  nopipe: number;
  structural: number;
};
type SubsystemRow = {
  stack: string;
  subsystem: string;
  subsystem_slug: string;
  layer: string;
  irreplaceability: number;
  keystone: boolean;
  ownership_quality: number;
  subsystem_state: string;
  held_names: string | null;
};
type SupplierRow = {
  map_id: string;
  supplier_name: string;
  ticker: string | null;
  supplier_state: string;
  score: number | null;
};

const STATE_STYLE: Record<string, { bg: string; bd: string; fg: string; label: string }> = {
  OWNED:      { bg: "rgba(63,191,159,.14)", bd: "rgba(63,191,159,.4)",  fg: "#3fbf9f", label: "Owned" },
  TOEHOLD:    { bg: "rgba(217,164,65,.12)", bd: "rgba(217,164,65,.4)",  fg: "#d9a441", label: "Toehold" },
  GAP:        { bg: "rgba(77,107,154,.10)", bd: "rgba(77,107,154,.35)", fg: "#4d6b9a", label: "Gap" },
  NOPIPE:     { bg: "rgba(198,95,95,.10)",  bd: "rgba(198,95,95,.4)",   fg: "#c65f5f", label: "No pipeline" },
  STRUCTURAL: { bg: "#161b22",              bd: "#232a33",              fg: "#5b6675", label: "Structural" },
};
const SUP_BADGE: Record<string, string> = {
  HELD: "#3fbf9f", HELD_PENDING: "#d9a441", WATCHLIST: "#4d6b9a", UNIVERSE: "#5b6675", NONE: "#3a424d",
};

export default function BottleneckCoverageTab() {
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [subsystems, setSubsystems] = useState<SubsystemRow[]>([]);
  const [drawer, setDrawer] = useState<SubsystemRow | null>(null);
  const [note, setNote] = useState<string>("");
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const { data: cov, error: e1 } = await supabase.from("bottleneck_coverage").select("*");
        const { data: subs, error: e2 } = await supabase
          .from("bottleneck_subsystem_state")
          .select("*")
          .order("irreplaceability", { ascending: false });
        if (e1 || e2) throw e1 || e2;
        setCoverage(cov ?? []);
        setSubsystems(subs ?? []);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to load coverage");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openDrawer(s: SubsystemRow) {
    setDrawer(s); setNote(""); setSuppliers([]);
    const { data: sup } = await supabase
      .from("bottleneck_supplier_state")
      .select("*")
      .eq("subsystem_slug", s.subsystem_slug);
    setSuppliers(sup ?? []);
    const { data: n } = await supabase
      .from("vault_notes_meta")
      .select("body")
      .eq("type", "bottleneck")
      .eq("identifier", s.subsystem_slug)
      .maybeSingle();
    setNote((n as { body?: string } | null)?.body ?? "");
  }

  if (loading) return <div style={{ padding: 24, color: "#8b97a6", fontFamily: "monospace" }}>Loading coverage…</div>;
  if (err) return <div style={{ padding: 24, color: "#c65f5f", fontFamily: "monospace" }}>Error: {err}</div>;

  const stacks = [...new Set(subsystems.map((s) => s.stack))];
  const mono: CSSProperties = { fontFamily: "monospace" };

  return (
    <div style={{ color: "#e6ebf1" }}>
      {stacks.map((stack) => {
        const cov = coverage.find((c) => c.stack === stack);
        const tiles = subsystems.filter((s) => s.stack === stack);
        return (
          <div key={stack} style={{ background: "#12161c", border: "1px solid #232a33", borderRadius: 4, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", padding: 16, borderBottom: "1px solid #1b2129" }}>
              <strong style={{ fontSize: 16, textTransform: "capitalize" }}>{stack.replace(/-/g, " ")}</strong>
              <span style={{ ...mono, marginLeft: "auto", fontSize: 30, fontWeight: 600, color: "#3fbf9f" }}>
                {cov?.coverage_pct ?? "—"}%
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 14 }}>
              {tiles.map((s) => {
                const st = STATE_STYLE[s.subsystem_state] ?? STATE_STYLE.GAP;
                return (
                  <div key={s.subsystem_slug} onClick={() => openDrawer(s)}
                    style={{ flex: `${s.irreplaceability} 1 ${96 + s.irreplaceability * 12}px`, cursor: "pointer",
                      background: st.bg, border: `1px solid ${st.bd}`, borderRadius: 3, padding: 11, minHeight: 78,
                      display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.subsystem}{s.keystone ? " ◆" : ""}</div>
                    <div style={{ ...mono, fontSize: 10, color: st.fg }}>
                      {s.held_names || st.label} · irr {s.irreplaceability}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {drawer && (
        <div onClick={() => setDrawer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 50 }}>
          <aside onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(440px,92vw)",
              background: "#12161c", borderLeft: "1px solid #232a33", overflowY: "auto", padding: 22 }}>
            <button onClick={() => setDrawer(null)}
              style={{ float: "right", background: "none", border: "none", color: "#5b6675", fontSize: 20, cursor: "pointer" }}>×</button>
            <h2 style={{ fontSize: 20, marginTop: 0 }}>{drawer.subsystem}</h2>
            <div style={{ ...mono, fontSize: 10, color: STATE_STYLE[drawer.subsystem_state]?.fg }}>
              {STATE_STYLE[drawer.subsystem_state]?.label} · irr {drawer.irreplaceability}{drawer.keystone ? " · keystone" : ""}
            </div>
            <h3 style={{ ...mono, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6675", marginTop: 22 }}>Supplier pipeline</h3>
            {suppliers.map((sp) => (
              <div key={sp.map_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #1b2129" }}>
                <span style={{ ...mono, fontSize: 12, flex: 1 }}>{sp.supplier_name}{sp.ticker ? ` (${sp.ticker})` : ""}</span>
                <span style={{ ...mono, fontSize: 9, padding: "2px 7px", border: `1px solid ${SUP_BADGE[sp.supplier_state]}`, color: SUP_BADGE[sp.supplier_state] }}>{sp.supplier_state}</span>
                <span style={{ ...mono, fontSize: 11, color: "#8b97a6", width: 30, textAlign: "right" }}>{sp.score ?? "—"}</span>
              </div>
            ))}
            <h3 style={{ ...mono, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#5b6675", marginTop: 22 }}>Vault note</h3>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#8b97a6", lineHeight: 1.6, margin: 0 }}>{note || "No note found."}</pre>
          </aside>
        </div>
      )}
    </div>
  );
}
