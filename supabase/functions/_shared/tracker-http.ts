// Server-to-server only: intentionally no CORS headers or browser preflight.
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function secretMatches(header: string | null, secret: string | undefined) {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  const token = match?.[1] ?? "";
  // SHA-256 makes both buffers fixed-size; compare every byte without early exit.
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret ?? "")),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0 && Boolean(match && secret);
}

export function createTrackerHandler(
  execute: (body: any, root: string, key: string) => Promise<Response>,
) {
  return async (req: Request) => {
    if (!await secretMatches(req.headers.get("Authorization"), Deno.env.get("INGEST_SECRET"))) {
      return json({ status: "error", error: "unauthorised" }, 401);
    }
    if (req.method !== "POST") {
      return json({ status: "error", error: "Method not allowed" }, 405);
    }
    let body: unknown;
    try { body = await req.json(); }
    catch { return json({ status: "error", error: "invalid_json" }, 400); }
    const root = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!root || !key) return json({ status: "error", error: "Server configuration missing" }, 500);
    try { return await execute(body, root, key); }
    catch {
      return json({ status: "error", error: "Database request failed" }, 502);
    }
  };
}

export function serviceHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { message: text }; }
}