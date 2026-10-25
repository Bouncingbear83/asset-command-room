import { createClient } from "npm:@supabase/supabase-js@2";
import { secretMatches } from "./tracker-http.ts";

export const OWNER_EMAIL = "bertbroadhead@gmail.com";
export function isOwnerEmail(email: unknown): boolean {
  return typeof email === "string" && email.toLowerCase() === OWNER_EMAIL;
}

export function appCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = new Set([
    "https://asset-command-room.lovable.app",
    "https://id-preview--be2a318a-707e-4e8d-ae4b-23f3eab50633.lovable.app",
    "http://localhost:8080",
  ]);
  return {
    ...(origin && allowed.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export async function ownerOrIngest(req: Request): Promise<boolean> {
  const header = req.headers.get("Authorization");
  if (await secretMatches(header, Deno.env.get("INGEST_SECRET"))) return true;
  const token = /^Bearer\s+(.+)$/i.exec(header ?? "")?.[1];
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !url || !key) return false;
  try {
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    return !error && Boolean(data.user?.email_confirmed_at) && isOwnerEmail(data.user?.email);
  } catch { return false; }
}