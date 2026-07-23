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
    let q = (sb.from as any)("scores_snapshot").select("*").limit(limit ?? 50);
    if (ticker) q = q.ilike("ticker", ticker);
    const { data, error } = (await q) as { data: any[] | null; error: any };
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
