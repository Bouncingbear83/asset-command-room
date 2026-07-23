import { auth, defineMcp, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import searchVaultTool from "./tools/search-vault";
import getVaultNoteTool from "./tools/get-vault-note";
import listScoresTool from "./tools/list-scores";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

const pingTool = defineTool({
  name: "ping",
  title: "Ping",
  description: "Health check. Returns pong.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    return {
      content: [{ type: "text", text: "pong" }],
    };
  },
});

export default defineMcp({
  name: "stellar-command-mcp",
  title: "Stellar Command MCP",
  version: "0.2.1",
  instructions:
    "Tools for the Stellar Command dashboard. Use `search_vault` to full-text search research notes, `get_vault_note` to fetch a single note's full body, and `list_scores` to inspect the latest 6D scores snapshot.",
  tools: [pingTool, searchVaultTool, getVaultNoteTool, listScoresTool],
});
