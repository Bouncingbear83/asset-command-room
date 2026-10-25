import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPortfolio, EMPTY_SNAPSHOT, type PortfolioData, type SourceKey } from "@/hooks/usePortfolioData";

/**
 * Single React Query instance of the portfolio sheets, mounted at app root.
 * Every component reads through usePortfolio(); nothing else fetches the sheets.
 */
const PortfolioContext = createContext<PortfolioData | null>(null);

export const PORTFOLIO_QUERY_KEY = ["portfolio"] as const;

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const q = useQuery({
    queryKey: PORTFOLIO_QUERY_KEY,
    queryFn: fetchPortfolio,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });
  const { refetch } = q;

  useEffect(() => {
    const onRefresh = () => { refetch(); };
    window.addEventListener("lovable:portfolio-refresh", onRefresh);
    return () => window.removeEventListener("lovable:portfolio-refresh", onRefresh);
  }, [refetch]);

  useEffect(() => {
    if (q.dataUpdatedAt) window.dispatchEvent(new CustomEvent("lovable:portfolio-refreshed", { detail: { at: q.dataUpdatedAt } }));
  }, [q.dataUpdatedAt]);

  const value = useMemo<PortfolioData>(() => {
    const snap = q.data ?? EMPTY_SNAPSHOT;
    const failed = Object.entries(snap.sources).filter(([, s]) => s.status === "error").map(([k]) => k);
    return {
      ...snap,
      loading: q.isFetching,
      error: q.error ? String((q.error as Error).message) : failed.length ? `${failed.length} source(s) failed` : null,
      refresh: () => { refetch(); },
    };
  }, [q.data, q.isFetching, q.error, refetch]);

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioData {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside <PortfolioProvider>");
  return ctx;
}

/** True once a source has loaded successfully. Panels fed by a non-ok source must show NO DATA. */
export function useSourceOk(...keys: SourceKey[]): boolean {
  const { sources } = usePortfolio();
  return keys.every((k) => sources[k]?.status === "ok");
}
