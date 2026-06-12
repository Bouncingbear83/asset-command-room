import { useState, useRef, useEffect } from "react";
import { useVaultSearch, VaultSearchResult } from "@/hooks/useVaultSearch";
import { Search, FileText, Hash, Settings, BookOpen, Layers, TrendingUp, X } from "lucide-react";

const TYPE_ICONS: Record<string, typeof FileText> = {
  ticker: Hash,
  session: FileText,
  spec: Settings,
  rule: BookOpen,
  framework: Layers,
  section: FileText,
  layer: Layers,
  trend: TrendingUp,
};

const TYPE_COLOURS: Record<string, string> = {
  ticker: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  session: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  spec: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rule: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  framework: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  section: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  layer: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  trend: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const NOTE_TYPES = ["", "ticker", "session", "spec", "rule", "framework", "section", "layer", "trend"];

export function VaultSearch() {
  const { results, loading, error, search, clear } = useVaultSearch();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search: 400ms after typing stops
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      clear();
      return;
    }
    debounceRef.current = setTimeout(() => {
      search(query, typeFilter || undefined, 30);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, typeFilter, search, clear]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault notes..."
            className="w-full pl-10 pr-8 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); clear(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All types</option>
          {NOTE_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      {loading && (
        <div className="text-sm text-zinc-500 animate-pulse">Searching...</div>
      )}
      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}
      {results && !loading && (
        <div className="text-xs text-zinc-500">
          {results.count} of {results.total} results
          {results.type_filter ? ` (type: ${results.type_filter})` : ""}
        </div>
      )}

      {/* Results */}
      {results?.results && (
        <div className="space-y-2">
          {results.results.map((r) => (
            <VaultResultCard key={r.path} result={r} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}

function VaultResultCard({ result, query }: { result: VaultSearchResult; query: string }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICONS[result.type] || FileText;
  const colourClass = TYPE_COLOURS[result.type] || TYPE_COLOURS.section;

  // Build display title
  const displayTitle = result.title || result.identifier || result.path.split("/").pop() || result.path;

  // Deep Dive link for tickers
  const isHeld = result.frontmatter?.status === "HELD";
  const deepDiveUrl = result.type === "ticker"
    ? `https://claude.ai/project/YOUR_PROJECT_ID?q=Deep+dive+${result.identifier}`
    : null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded border ${colourClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100 truncate">
              {displayTitle}
            </span>
            {result.frontmatter?.score && (
              <span className="text-xs text-zinc-500 tabular-nums">
                {result.frontmatter.score}
              </span>
            )}
            {result.frontmatter?.tier && (
              <span className="text-xs text-zinc-500">
                {result.frontmatter.tier}
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 truncate mt-0.5">
            {result.path}
          </div>

          {/* Frontmatter chips for tickers */}
          {result.type === "ticker" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.frontmatter?.layer && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {result.frontmatter.layer}
                </span>
              )}
              {result.frontmatter?.substrate_level && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {result.frontmatter.substrate_level}
                </span>
              )}
              {result.frontmatter?.return_profile && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {result.frontmatter.return_profile}
                </span>
              )}
              {result.frontmatter?.status && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {result.frontmatter.status}
                </span>
              )}
            </div>
          )}

          {/* Sections toggle */}
          {result.sections.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-1.5"
            >
              {expanded ? "Hide" : "Show"} {result.sections.length} sections
            </button>
          )}
          {expanded && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {result.sections.map((s) => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          {deepDiveUrl && (
            <a
              href={deepDiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
            >
              Deep Dive
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
