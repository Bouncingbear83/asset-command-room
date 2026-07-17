import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchVaultTool from "./tools/search-vault";
import getVaultNoteTool from "./tools/get-vault-note";
import listScoresTool from "./tools/list-scores";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "stellar-command-mcp",
  title: "Stellar Command MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Stellar Command dashboard. Use `search_vault` to full-text search research notes, `get_vault_note` to fetch a single note's full body, and `list_scores` to inspect the latest 6D scores snapshot.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchVaultTool, getVaultNoteTool, listScoresTool],
});
