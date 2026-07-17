import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sbForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_vault_note",
  title: "Get vault note",
  description:
    "Fetch a single research vault note by type (ticker/theme/layer/etc.) and identifier. Returns full body and sections.",
  inputSchema: {
    type: z.string().min(1).describe("Note type, e.g. 'ticker', 'theme', 'layer'."),
    identifier: z.string().min(1).describe("Identifier within that type, e.g. 'NVDA'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ type, identifier }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = sbForUser(ctx);
    const { data, error } = await sb
      .from("vault_notes_meta")
      .select("type,identifier,body,body_sections,updated_at")
      .eq("type", type.toLowerCase())
      .eq("identifier", identifier.toLowerCase())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Note not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { note: data },
    };
  },
});
