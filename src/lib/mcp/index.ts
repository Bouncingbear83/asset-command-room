import { defineMcp } from "@lovable.dev/mcp-js";
import searchVaultTool from "./tools/search-vault";
import getVaultNoteTool from "./tools/get-vault-note";
import listScoresTool from "./tools/list-scores";

export default defineMcp({
  name: "stellar-command-mcp",
  title: "Stellar Command MCP",
  version: "0.2.0",
  instructions:
    "Tools for the Stellar Command dashboard. Use `search_vault` to full-text search research notes, `get_vault_note` to fetch a single note's full body, and `list_scores` to inspect the latest 6D scores snapshot.",
  tools: [searchVaultTool, getVaultNoteTool, listScoresTool],
});
