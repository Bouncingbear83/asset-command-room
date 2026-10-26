import { proxyWebhook, responseError } from "@/lib/ownerFunction";
import { useState, useCallback } from "react";


export interface VaultSearchResult {
  path: string;
  type: "ticker" | "session" | "spec" | "rule" | "framework" | "section" | "layer" | "trend";
  identifier: string;
  title: string;
  sections: string[];
  frontmatter: Record<string, string>;
  rank: number;
  snippet: string | null;
}

export interface VaultSearchResponse {
  query: string;
  type_filter: string | null;
  count: number;
  total: number;
  results: VaultSearchResult[];
}

export function useVaultSearch() {
  const [results, setResults] = useState<VaultSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string, type?: string, limit: number = 20) => {
      if (!query.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await proxyWebhook("stellar-vault-search", { query: query.trim(), type: type || undefined, limit: limit });
        if (!res.ok) throw await responseError(res);
        const data: VaultSearchResponse = await res.json();
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return { results, loading, error, search, clear };
}
