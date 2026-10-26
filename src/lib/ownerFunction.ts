import { supabase } from "@/integrations/supabase/client";
/** Owner functions must carry the current session, never the public API key as bearer. */
export async function ownerFunctionResponse(name: "sheet-read" | "n8n-proxy", body: object): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to continue");
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body),
  });
}
export async function proxyWebhook(endpoint: string, body: object): Promise<Response> {
  return ownerFunctionResponse("n8n-proxy", { endpoint, body });
}
export async function responseError(response: Response): Promise<Error> {
  return new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
}
