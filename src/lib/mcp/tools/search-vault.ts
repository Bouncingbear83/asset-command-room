import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const Deno: { env: { get(k: string): string | undefined } } | undefined;

function sbAnon() {
  const url = typeof Deno !== "undefined"
    ? Deno.env.get("SUPABASE_URL")!
    : process.env.SUPABASE_URL!;
  const key = typeof Deno !== "undefined"
    ? Deno.env.get("SUPABASE_ANON_KEY")!
    : process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_vault",
  title: "Search vault notes",
  description:
    "Full-text search across the user's research vault (tickers, themes, layers). Returns matching notes with a snippet and rank.",
  inputSchema: {
    query: z.string().min(1).describe("Search query, e.g. 'NVDA moat' or 'AI infrastructure'."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const sb = sbAnon();
    const { data, error } = await sb.rpc("vault_search", { q: query, lim: limit ?? 10 });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
