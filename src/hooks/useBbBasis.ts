/**
 * Sprint A · A2 — ticker → BB basis class for every HELD and WATCHLIST SCORES row.
 * T4 rows (non-score change notes) read the ticker's vault note: one batched read, capped at
 * BB_BASIS_VAULT_CAP per page load, cached for the page (React Query, no refetch).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortfolio } from "@/data/PortfolioProvider";
import { bbBasis, tickerNotePath, type BbBasisResult } from "@/lib/bbBasis";
import { BB_BASIS_VAULT_CAP } from "@/config/signalRules";

type Row = { ticker: string; heldStatus?: string; changeNote?: string };
const up = (s: unknown) => String(s ?? "").trim().toUpperCase();

export function basisRows(scores: Row[]): Row[] {
  return scores.filter((s) => s.ticker && ["HELD", "WATCHLIST"].includes(up(s.heldStatus)));
}

export function useBbBasis(): { ready: boolean; byTicker: Record<string, BbBasisResult> } {
  const { scores, sources } = usePortfolio() as any;
  const ok = sources?.scores?.status === "ok";
  const rows = useMemo(() => (ok ? basisRows(scores as Row[]) : []), [ok, scores]);
  const first = useMemo(() => {
    const m: Record<string, BbBasisResult> = {};
    for (const r of rows) if (!m[up(r.ticker)]) m[up(r.ticker)] = bbBasis(r.changeNote);
    return m;
  }, [rows]);
  const vaultTickers = useMemo(() => Object.keys(first).filter((t) => first[t].needsVault).sort().slice(0, BB_BASIS_VAULT_CAP), [first]);
  const q = useQuery({
    queryKey: ["bb-basis-vault", vaultTickers],
    enabled: vaultTickers.length > 0,
    staleTime: Infinity, gcTime: Infinity, refetchOnWindowFocus: false, retry: false,
    queryFn: async () => {
      const paths = vaultTickers.map(tickerNotePath);
      const { data, error } = await (supabase as any).from("vault_notes_meta").select("path,body").in("path", paths);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((d: any) => [d.path, typeof d.body === "string" ? d.body : null])) as Record<string, string | null>;
    },
  });
  const byTicker = useMemo(() => {
    const m: Record<string, BbBasisResult> = { ...first };
    const note = new Map(rows.map((r) => [up(r.ticker), r.changeNote]));
    for (const t of Object.keys(first)) {
      if (!first[t].needsVault) continue;
      const inCap = vaultTickers.includes(t);
      // Not in the cap, fetch failed, or no note → null (UNKNOWN). Still loading → keep UNKNOWN.
      const body = inCap && q.data ? q.data[tickerNotePath(t)] ?? null : null;
      m[t] = bbBasis(note.get(t), body);
    }
    return m;
  }, [first, rows, vaultTickers, q.data]);
  return { ready: ok && (vaultTickers.length === 0 || !q.isLoading), byTicker };
}
