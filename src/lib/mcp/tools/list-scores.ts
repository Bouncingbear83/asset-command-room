import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sbAnon() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

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
  handler: async ({ ticker, limit }) => {
    const sb = sbAnon();
    let q = sb.from("scores_snapshot").select("*").limit(limit ?? 50);
    if (ticker) q = q.ilike("ticker", ticker);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
