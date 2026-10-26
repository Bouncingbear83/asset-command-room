import { createClient } from "npm:@supabase/supabase-js@2";
import { appCorsHeaders, isOwnerEmail } from "./owner-access.ts";
export { appCorsHeaders };
export async function verifiedOwner(req: Request): Promise<boolean> {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !url || !key) return false;
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    return !error && Boolean(data.user?.email_confirmed_at) && isOwnerEmail(data.user?.email);
  } catch { return false; }
}
export function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...appCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
