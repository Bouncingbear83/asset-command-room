import { supabaseForOwner } from "../supabase";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

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
  handler: async ({ query, limit }, ctx) => {
    const sb = await supabaseForOwner(ctx);
    const { data, error } = await sb.rpc("vault_search", {
  search_query: query,
  note_type: null,
  max_results: limit ?? 10,
});
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
