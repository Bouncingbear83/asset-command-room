import { supabaseForOwner } from "../supabase";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_scores",
  title: "List latest scores snapshot",
  description:
    "Return the latest snapshot of 6D scores across holdings and watchlist. Optionally filter by ticker.",
  inputSchema: {
    ticker: z.string().optional().describe("Optional ticker to filter, e.g. 'NVDA'."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ ticker, limit }, ctx) => {
    const sb = await supabaseForOwner(ctx);
    let q = sb.from("scores_latest").select("*").limit(limit ?? 200);
    if (ticker) q = q.ilike("ticker", ticker);
    const { data, error } = (await q) as { data: any[] | null; error: any };
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
