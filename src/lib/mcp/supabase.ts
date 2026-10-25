import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { isOwnerEmail } from "../ownerAccess";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};
function env(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

// The MCP SDK verifies issuer, audience and OAuth client_id before a handler runs.
// Keep that caller's bearer on database queries so owner RLS remains authoritative.
export async function supabaseForOwner(ctx: ToolContext) {
  const token = ctx.getToken();
  const subject = ctx.getUserId();
  if (!ctx.isAuthenticated() || !token || !subject || !ctx.getClientId()) throw new Error("Verified OAuth access required");
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY") ?? env("SUPABASE_PUBLISHABLE_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("MCP database configuration missing");
  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || data.user?.id !== subject || !data.user?.email_confirmed_at || !isOwnerEmail(data.user.email)) {
    throw new Error("Owner access required");
  }
  return sb;
}