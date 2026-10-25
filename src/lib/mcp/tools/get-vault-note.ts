import { supabaseForOwner } from "../supabase";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

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
    const sb = await supabaseForOwner(ctx);
    const { data, error } = (await (sb.from as any)("vault_notes_meta")
      .select("path,type,identifier,title,ticker,frontmatter,body,body_sections")
      .eq("type", type.toLowerCase())
      .ilike("identifier", identifier)
      .maybeSingle()) as { data: any | null; error: any };
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Note not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { note: data },
    };
  },
});
