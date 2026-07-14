/**
 * useResearchIndex
 * Fetches all ticker-type vault notes + any bespoke HTML reports
 * to power the unified Research tab grid.
 */
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResearchIndexEntry {
  ticker: string;
  name: string | null;
  layer: string | null;
  score: number | null;
  tier: string | null;
  status: string | null;
  stellar_type: string | null;
  return_profile: string | null;
  reclass_status: string | null;
  substrate_stage: string | null;
  factor_group: string | null;
  framework: string | null;
  last_scored: string | null;
  bb_target_date: string | null;
  thesis_snippet: string | null;
  has_deep_dive: boolean;
  deep_dive_id: string | null;
  deep_dive_date: string | null;
  vault_path: string | null;
}

interface VaultRow {
  path: string;
  ticker: string | null;
  title: string | null;
  frontmatter: Record<string, any> | null;
  body_sections: Record<string, string> | null;
}

interface ReportRow {
  id: string;
  ticker: string;
  report_date: string;
}

function extractThesisSnippet(sections: Record<string, string> | null): string | null {
  if (!sections) return null;
  const thesis = sections["Thesis"];
  if (!thesis) return null;
  // Take first 280 chars, clean markdown
  const cleaned = thesis
    .replace(/\[\[([^\]]+:)?([^\]]+)\]\]/g, "$2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
  return cleaned.length > 280 ? cleaned.slice(0, 280) + "..." : cleaned;
}

export function useResearchIndex() {
  const [entries, setEntries] = useState<ResearchIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      // All ticker vault notes
      (supabase as any)
        .from("vault_notes_meta")
        .select("path, ticker, title, frontmatter, body_sections")
        .eq("type", "ticker"),
      // All latest bespoke HTML reports
      (supabase as any)
        .from("research_reports")
        .select("id, ticker, report_date")
        .eq("is_latest", true),
    ]).then(([vaultResult, reportsResult]) => {
      if (cancelled) return;

      const vaultRows: VaultRow[] =
        vaultResult.status === "fulfilled" && !vaultResult.value.error
          ? (vaultResult.value.data || [])
          : [];

      const reportRows: ReportRow[] =
        reportsResult.status === "fulfilled" && !reportsResult.value.error
          ? (reportsResult.value.data || [])
          : [];

      // Index reports by ticker (uppercase)
      const reportMap = new Map<string, ReportRow>();
      for (const r of reportRows) {
        reportMap.set(r.ticker.toUpperCase(), r);
      }

      const items: ResearchIndexEntry[] = vaultRows
        .map((v) => {
          const fm = v.frontmatter || {};
          // Top-level ticker column may be NULL if nightly index hasn't backfilled.
          // Fall back to frontmatter.ticker (always present for ticker-type notes).
          const resolvedTicker = v.ticker || fm.ticker || "";
          return { ...v, _ticker: resolvedTicker.toUpperCase() };
        })
        .filter((v) => v._ticker) // must resolve a ticker somehow
        .map((v) => {
          const fm = v.frontmatter || {};
          const tkr = v._ticker;
          const report = reportMap.get(tkr) || null;

          return {
            ticker: tkr,
            name: fm.name || v.title || null,
            layer: fm.layer || null,
            score: fm.score != null ? Number(fm.score) : null,
            tier: fm.tier || null,
            status: fm.status || null,
            stellar_type: fm.stellar_type || null,
            return_profile: fm.return_profile || null,
            reclass_status: fm.reclass_status || null,
            substrate_stage: fm.substrate_stage || null,
            factor_group: fm.factor_group || null,
            framework: fm.framework || null,
            last_scored: fm.last_scored || null,
            bb_target_date: fm.bb_target_date || null,
            thesis_snippet: extractThesisSnippet(v.body_sections),
            has_deep_dive: !!report,
            deep_dive_id: report?.id || null,
            deep_dive_date: report?.report_date || null,
            vault_path: v.path,
          };
        });

      // Deduplicate: if multiple vault notes resolve to the same ticker,
      // keep the one with the highest score (or most recent last_scored).
      const deduped = new Map<string, ResearchIndexEntry>();
      for (const item of items) {
        const existing = deduped.get(item.ticker);
        if (!existing) {
          deduped.set(item.ticker, item);
        } else {
          // Prefer higher score, then more recent last_scored
          const existingScore = existing.score ?? -1;
          const itemScore = item.score ?? -1;
          if (itemScore > existingScore || (itemScore === existingScore && (item.last_scored ?? "") > (existing.last_scored ?? ""))) {
            deduped.set(item.ticker, item);
          }
        }
      }

      setEntries(Array.from(deduped.values()));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // Counts by status
  const counts = useMemo(() => {
    const held = entries.filter((e) => e.status === "HELD").length;
    const watchlist = entries.filter((e) => e.status && e.status !== "HELD" && e.status !== "EXITED" && e.status !== "REJECTED" && e.status !== "DORMANT").length;
    const exited = entries.filter((e) => e.status === "EXITED" || e.status === "REJECTED" || e.status === "DORMANT").length;
    return { held, watchlist, exited, total: entries.length };
  }, [entries]);

  return { entries, loading, counts };
}
