import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser } })) }));
import { supabaseForOwner } from "./supabase";

const context = (clientId: string | undefined = "oauth-client") => ({
  isAuthenticated: () => true, getToken: () => "test-token", getUserId: () => "verified-subject", getClientId: () => clientId,
} as unknown as ToolContext);

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://database.example");
  vi.stubEnv("SUPABASE_ANON_KEY", "public-test-key");
});

describe("MCP owner boundary", () => {
  it("permits the verified owner subject", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "verified-subject", email: "bertbroadhead@gmail.com", email_confirmed_at: "2026-07-09" } }, error: null });
    await expect(supabaseForOwner(context())).resolves.toBeDefined();
  });
  it("rejects other emails and an unconfirmed owner", async () => {
    for (const user of [
      { id: "verified-subject", email: "other@gmail.com", email_confirmed_at: "2026-07-09" },
      { id: "verified-subject", email: "bertbroadhead@gmail.com", email_confirmed_at: null },
    ]) {
      getUser.mockResolvedValue({ data: { user }, error: null });
      await expect(supabaseForOwner(context())).rejects.toThrow("Owner access required");
    }
  });
  it("rejects a mismatched OAuth subject", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "different-subject", email: "bertbroadhead@gmail.com", email_confirmed_at: "2026-07-09" } }, error: null });
    await expect(supabaseForOwner(context())).rejects.toThrow("Owner access required");
  });
  it("rejects app-session tokens without an OAuth client identity", async () => {
    await expect(supabaseForOwner(context(""))).rejects.toThrow("Verified OAuth access required");
  });
});