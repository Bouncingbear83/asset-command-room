import { toast } from "sonner";

import { proxyWebhook, responseError } from "@/lib/ownerFunction";

/** POSTs to an n8n webhook. Only reports success when the server returns 2xx. */
export async function triggerWebhook(endpoint: string, body: object, successMsg: string): Promise<boolean> {
  try {
    const res = await proxyWebhook(endpoint, body);
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      toast.error(`Webhook failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
      return false;
    }
    toast.success(successMsg);
    return true;
  } catch (e: any) {
    toast.error(`Webhook failed: ${e.message}`);
    return false;
  }
}
